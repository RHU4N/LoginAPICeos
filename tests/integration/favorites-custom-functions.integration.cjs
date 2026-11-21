const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString("hex");

const WEB_ORIGIN = "http://localhost:3000";

let mongo, app, Favorite, CustomFunction, User;
let tokenA, tokenB, userA, userB;

function webReq(method, path, body, token = tokenA) {
  const req = request(app)
    [method](path)
    .set("Origin", WEB_ORIGIN)
    .set("Cookie", `accessToken=${token}`);
  return body !== undefined ? req.send(body) : req;
}

function mobileReq(method, path, body, token = tokenA) {
  const req = request(app)
    [method](path)
    .set("Authorization", `Bearer ${token}`);
  return body !== undefined ? req.send(body) : req;
}

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = "ceos_test_fav_cf_" + randomBytes(6).toString("hex");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGODB_DATABASE,
  });

  app = require("../../index");
  Favorite = require("../../src/domain/entities/Favorite");
  CustomFunction = require("../../src/domain/entities/CustomFunction");
  User = require("../../src/domain/entities/User");

  await Favorite.init();
  await CustomFunction.init();

  userA = await User.create({
    nome: "Usuário A",
    email: "user-a@test.invalid",
    senhaHash: "x".repeat(60),
  });
  userB = await User.create({
    nome: "Usuário B",
    email: "user-b@test.invalid",
    senhaHash: "x".repeat(60),
  });

  const JwtTokenProvider = require("../../src/infrastructure/providers/JwtTokenProvider");
  const provider = new JwtTokenProvider();
  tokenA = provider.generateTokenPair(String(userA._id), userA.email, 0).accessToken;
  tokenB = provider.generateTokenPair(String(userB._id), userB.email, 0).accessToken;
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop();
});

test("Favoritos: ciclo completo Web (cookie) <-> Mobile (Bearer), ID canônico, duplicidade 409 e isolamento", async () => {
  const calcPayload = {
    resourceId: "calc:fisica:termologia:ponto-de-orvalho",
    resourceType: "calculation",
    nome: "Ponto de Orvalho",
    descricao: "Cálculo de ponto de orvalho via fórmula de Magnus",
    metadata: { area: "fisica", subarea: "termologia" },
  };

  // 1. Web (cookie + Origin) favorita calculadora canônica
  const createdWeb = await webReq("post", "/favorites", calcPayload).expect(201);
  assert.equal(createdWeb.body.success, true);
  assert.equal(createdWeb.body.data.resourceId, calcPayload.resourceId);
  assert.equal(createdWeb.body.data.resourceType, "calculation");
  assert.equal(createdWeb.body.data.nome, calcPayload.nome);
  assert.deepEqual(createdWeb.body.data.metadata, calcPayload.metadata);
  const favId = createdWeb.body.data.id;
  assert.ok(favId);

  // 2. Mobile (Bearer) lista favoritos e encontra o item
  const listedMobile = await mobileReq("get", "/favorites").expect(200);
  assert.equal(listedMobile.body.success, true);
  assert.equal(listedMobile.body.data.length, 1);
  assert.equal(listedMobile.body.data[0].id, favId);
  assert.equal(listedMobile.body.data[0].resourceId, calcPayload.resourceId);

  // 3. Duplicidade -> HTTP 409 FAVORITE_ALREADY_EXISTS
  const dup = await mobileReq("post", "/favorites", calcPayload).expect(409);
  assert.equal(dup.body.success, false);
  assert.equal(dup.body.error.code, "FAVORITE_ALREADY_EXISTS");

  // 4. User B tenta remover favorito de User A -> HTTP 404 (e ID malformado também 404)
  await mobileReq("delete", `/favorites/${favId}`, undefined, tokenB).expect(404);
  await mobileReq("delete", "/favorites/id-malformado", undefined, tokenA).expect(404);

  // 5. Mobile (Bearer) remove o favorito -> 204; Web (cookie) confirma remoção
  await mobileReq("delete", `/favorites/${favId}`).expect(204);
  const afterMobileDelete = await webReq("get", "/favorites").expect(200);
  assert.equal(afterMobileDelete.body.data.length, 0);

  // 6. Sentido inverso: Mobile adiciona (ObjectId) -> Web lista e remove -> Mobile confirma remoção
  const objectIdStr = new mongoose.Types.ObjectId().toString();
  const createdMobile = await mobileReq("post", "/favorites", {
    resourceId: objectIdStr,
    resourceType: "iot-device",
    nome: "Estação Meteorológica",
  }).expect(201);
  const favId2 = createdMobile.body.data.id;

  const listedWeb = await webReq("get", "/favorites").expect(200);
  assert.equal(listedWeb.body.data.length, 1);
  assert.equal(listedWeb.body.data[0].resourceId, objectIdStr);

  await webReq("delete", `/favorites/${favId2}`).expect(204);
  const afterWebDelete = await mobileReq("get", "/favorites").expect(200);
  assert.equal(afterWebDelete.body.data.length, 0);

  // Validação de entrada inválida em favoritos (resourceId inválido e metadata com __proto__)
  await mobileReq("post", "/favorites", {
    resourceId: "invalid id with spaces",
    resourceType: "calculation",
    nome: "Inválido",
  }).expect(400);

  const maliciousBody = '{"resourceId":"calc:a:b","resourceType":"calculation","nome":"Teste","metadata":{"__proto__":{"x":1}}}';
  await request(app)
    .post("/favorites")
    .set("Authorization", `Bearer ${tokenA}`)
    .set("Content-Type", "application/json")
    .send(maliciousBody)
    .expect(400);
});

test("Funções Personalizadas: validate, CRUD, execute seguro, PATCH parcial e isolamento", async () => {
  // 1. POST /custom-functions/validate com fórmula válida e inválida
  const validResp = await mobileReq("post", "/custom-functions/validate", {
    formula: "0.5 * m * v^2",
    parametros: [{ nome: "m" }, { nome: "v" }],
  }).expect(200);
  assert.equal(validResp.body.success, true);
  assert.deepEqual(validResp.body.data, {
    valida: true,
    variaveisDetectadas: ["m", "v"],
  });

  await mobileReq("post", "/custom-functions/validate", {
    formula: "2x + process.exit(1)",
    parametros: [{ nome: "x" }],
  }).expect(400);

  await mobileReq("post", "/custom-functions/validate", {
    formula: "m * c^2",
    parametros: [{ nome: "m" }],
  }).expect(400);

  // 2. Web (cookie + Origin) cria função
  const created = await webReq("post", "/custom-functions", {
    nome: "Energia cinética",
    descricao: "Calcula energia cinética clássica",
    categoria: "fisica",
    parametros: [
      { nome: "m", tipo: "number", obrigatorio: true },
      { nome: "v", tipo: "number", obrigatorio: true },
    ],
    formula: "0.5 * m * v^2",
    tags: ["mecanica", "energia"],
  }).expect(201);

  assert.equal(created.body.success, true);
  assert.equal(created.body.data.nome, "Energia cinética");
  assert.equal(created.body.data.descricao, "Calcula energia cinética clássica");
  assert.equal(created.body.data.tipo, "formula");
  assert.equal(created.body.data.usos, 0);
  const fnId = created.body.data.id;
  assert.ok(fnId);

  // 3. Mobile lista, consulta GET /:id e executa POST /:id/execute
  const listed = await mobileReq("get", "/custom-functions").expect(200);
  assert.equal(listed.body.data.length, 1);
  assert.equal(listed.body.data[0].id, fnId);

  const fetched = await mobileReq("get", `/custom-functions/${fnId}`).expect(200);
  assert.equal(fetched.body.data.formula, "0.5 * m * v^2");

  const exec1 = await mobileReq("post", `/custom-functions/${fnId}/execute`, {
    valores: { m: 2, v: 3 },
  }).expect(200);
  assert.equal(exec1.body.success, true);
  assert.equal(exec1.body.data.resultado, 9);
  assert.equal(exec1.body.data.resultadoFormatado, "9");
  assert.equal(exec1.body.data.substituicao, "0.5 * 2 * 3^2");
  assert.deepEqual(exec1.body.data.parametrosUsados, { m: 2, v: 3 });
  assert.equal(exec1.body.data.usos, 1);

  // 4. User B tenta GET, PATCH, POST execute, DELETE -> todos 404 (e ID inválido -> 404)
  await mobileReq("get", `/custom-functions/${fnId}`, undefined, tokenB).expect(404);
  await mobileReq("patch", `/custom-functions/${fnId}`, { nome: "Hackeado" }, tokenB).expect(404);
  await mobileReq("post", `/custom-functions/${fnId}/execute`, { valores: { m: 2, v: 3 } }, tokenB).expect(404);
  await mobileReq("delete", `/custom-functions/${fnId}`, undefined, tokenB).expect(404);

  await mobileReq("get", "/custom-functions/id-invalido").expect(404);
  await mobileReq("patch", "/custom-functions/id-invalido", { nome: "Novo nome" }).expect(404);
  await mobileReq("post", "/custom-functions/id-invalido/execute", { valores: {} }).expect(404);
  await mobileReq("delete", "/custom-functions/id-invalido").expect(404);

  // 5. Mobile edita via PATCH /:id (preserva campos não enviados!); Web consulta e executa com novo resultado
  const patched = await mobileReq("patch", `/custom-functions/${fnId}`, {
    nome: "Energia cinética + offset",
    formula: "0.5 * m * v^2 + 1",
  }).expect(200);
  assert.equal(patched.body.data.nome, "Energia cinética + offset");
  assert.equal(patched.body.data.descricao, "Calcula energia cinética clássica");
  assert.equal(patched.body.data.categoria, "fisica");
  assert.equal(patched.body.data.formula, "0.5 * m * v^2 + 1");

  const fetchedWeb = await webReq("get", `/custom-functions/${fnId}`).expect(200);
  assert.equal(fetchedWeb.body.data.formula, "0.5 * m * v^2 + 1");

  const exec2 = await webReq("post", `/custom-functions/${fnId}/execute`, {
    valores: { m: 2, v: 3 },
  }).expect(200);
  assert.equal(exec2.body.data.resultado, 10);
  assert.equal(exec2.body.data.usos, 2);

  // 6. Excluir função e confirmar 404
  await webReq("delete", `/custom-functions/${fnId}`).expect(204);
  await mobileReq("get", `/custom-functions/${fnId}`).expect(404);
});
