const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString("hex");
process.env.BCRYPT_ROUNDS = "4";
process.env.RATE_LIMIT_MAX_ATTEMPTS = "5";

let mongo, app, authConfig, store;
const SENHA = "Senha!" + randomBytes(6).toString("hex");

async function registerUser(email) {
  const res = await request(app).post("/users").send({
    nome: "Usuario Brute Force",
    email,
    senha: SENHA,
    confirmaSenha: SENHA,
    telefone: "11999990000",
  });
  assert.equal(res.status, 201);
}

const login = (email, senha) =>
  request(app).post("/auth/login").send({ email, senha });

const tally = (responses) =>
  responses.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = "ceos_test_bf_" + randomBytes(6).toString("hex");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGODB_DATABASE });
  app = require("../../index");
  authConfig = require("../../src/config/auth");
  store = require("../../src/infrastructure/middleware/BruteForceMiddleware");
  await require("../../src/domain/entities/User").init();
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop();
});

test("Brute force: tentativas inválidas SIMULTÂNEAS respeitam exatamente o limite (6 x 401, restante 429)", async () => {
  const email = "race-a@test.invalid";
  await registerUser(email);
  const responses = await Promise.all(
    Array.from({ length: 14 }, () => login(email, "errada-" + randomBytes(3).toString("hex"))),
  );
  const t = tally(responses);
  // Mesma semântica do fluxo sequencial: 6 falhas aceitas, a 7ª já é bloqueada.
  assert.equal(t[401], 6, JSON.stringify(t));
  assert.equal(t[429], 8, JSON.stringify(t));
  assert.equal(responses.filter((r) => r.status === 429).every((r) => r.body?.error?.code === "BRUTE_FORCE_LOCKED" || r.body?.error?.code === "USER_BLOCKED"), true);
});

test("Brute force: a senha correta também é bloqueada durante o bloqueio (não afrouxa a proteção)", async () => {
  const res = await login("race-a@test.invalid", SENHA);
  assert.equal(res.status, 429);
});

test("Brute force: variações de caixa/espaços do mesmo e-mail compartilham o mesmo contador", async () => {
  const email = "case-b@test.invalid";
  await registerUser(email);
  const variants = ["case-b@test.invalid", "CASE-B@test.invalid", "Case-B@Test.Invalid", " case-b@test.invalid "];
  const responses = await Promise.all(
    Array.from({ length: 16 }, (_, i) => login(variants[i % variants.length], "errada-" + i)),
  );
  const t = tally(responses);
  assert.equal(t[401], 6, JSON.stringify(t));
  assert.equal(t[429], 10, JSON.stringify(t));
});

test("Brute force: login válido zera o contador e usuários diferentes não se afetam", async () => {
  const email = "reset-c@test.invalid";
  const other = "other-d@test.invalid";
  await registerUser(email);
  await registerUser(other);
  for (let i = 0; i < 4; i += 1) assert.equal((await login(email, "errada-" + i)).status, 401);
  const ok = await login(email, SENHA);
  assert.equal(ok.status, 200);
  assert.ok(ok.body?.data?.accessToken || ok.body?.accessToken || ok.headers["set-cookie"]);
  // contador zerado: mais 6 falhas aceitas antes do bloqueio
  const after = await Promise.all(Array.from({ length: 8 }, (_, i) => login(email, "errada-" + i)));
  assert.equal(tally(after)[401], 6);
  // outro usuário continua logando normalmente
  assert.equal((await login(other, SENHA)).status, 200);
});

test("Brute force: recuperação após a janela de bloqueio expirar", async () => {
  const email = "recover-e@test.invalid";
  await registerUser(email);
  for (let i = 0; i < 6; i += 1) assert.equal((await login(email, "errada-" + i)).status, 401);
  assert.equal((await login(email, SENHA)).status, 429);
  const original = authConfig.bruteForce.windowMs;
  try {
    authConfig.bruteForce.windowMs = 50;
    await new Promise((r) => setTimeout(r, 120));
    assert.equal((await login(email, SENHA)).status, 200);
  } finally {
    authConfig.bruteForce.windowMs = original;
  }
});

test("Brute force: e-mail inexistente e inativo também consomem tentativas, sem vazar existência", async () => {
  const email = "ghost@test.invalid";
  const responses = await Promise.all(Array.from({ length: 10 }, () => login(email, "x-" + randomBytes(2).toString("hex"))));
  const t = tally(responses);
  assert.equal(t[401], 6, JSON.stringify(t));
  assert.equal(t[429], 4, JSON.stringify(t));
  assert.equal(typeof store.isAccountBlocked, "function");
});
