// Associação de dispositivos por código temporário. Usa somente MongoMemoryServer.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString("hex");
process.env.CEOS_IOT_CLAIM_START_LIMIT = "100";
let mongo, app, models, Measurement, token, otherToken, ownerId;
const api = (method, path, body, auth = token) =>
  request(app)[method](path).set("Authorization", `Bearer ${auth}`).send(body);
const station = {
  nome: "Estação Wokwi",
  modelo: "ESP32 DevKit (Wokwi)",
  fabricante: "Espressif",
  tipoDispositivo: "estacao-meteorologica",
  hardwareId: "24:0a:c4:00:01:10",
  sensores: [
    { sensorId: "dht22-temperatura", nome: "Temperatura DHT22", tipo: "temperatura", unidade: "C" },
    { sensorId: "dht22-umidade", nome: "Umidade DHT22", tipo: "umidade", unidade: "%" },
    { sensorId: "bmp180-pressao", nome: "Pressão BMP180", tipo: "pressao", unidade: "hPa" },
  ],
  capacidades: { supportsPush: true, supportsOnDemand: true, supportsCommandPolling: true, supportsMultipleSensors: true },
};
const start = async (body = station) =>
  (await request(app).post("/iot/device/claim").send(body).expect(201)).body.data;
const poll = (c) =>
  request(app).post("/iot/device/claim/poll").send({ claimId: c.claimId, pollSecret: c.pollSecret });
const internal = (path, body) =>
  request(app).post(`/iot/internal/${path}`).set("x-ceos-service-key", process.env.CEOS_SERVICE_KEY).send(body);
async function claimNew(nome = "Minha estação") {
  const c = await start();
  const confirmed = (await api("post", "/iot/claims/confirm", { code: c.pairingCode, nome }).expect(201)).body.data;
  const paired = (await poll(c).expect(200)).body.data;
  return { c, confirmed, paired };
}

before(
  async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    app = require("../../index");
    models = require("../../src/domain/entities/IoTPlatform");
    for (const model of Object.values(models)) await model.init();
    Measurement = require("../../src/domain/entities/IoTMeasurement");
    await Measurement.init();
    const User = require("../../src/domain/entities/User");
    const owner = await User.create({ nome: "Owner", email: "claim-owner@test.invalid", senhaHash: "x".repeat(60) });
    const other = await User.create({ nome: "Other", email: "claim-other@test.invalid", senhaHash: "x".repeat(60) });
    ownerId = owner._id;
    const Provider = require("../../src/infrastructure/providers/JwtTokenProvider");
    token = new Provider().generateTokenPair(String(owner._id), owner.email, 0).accessToken;
    otherToken = new Provider().generateTokenPair(String(other._id), other.email, 0).accessToken;
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test("código temporário associa sem expor tokens ao usuário e entrega a credencial uma única vez", async () => {
  const c = await start();
  assert.match(c.pairingCode, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  const raw = await models.Claim.findOne({ claimId: c.claimId }).select("+codeHash +pollHash").lean();
  assert.notEqual(raw.codeHash, c.pairingCode.replace("-", ""));
  assert.notEqual(raw.pollHash, c.pollSecret);
  assert.equal((await poll(c).expect(200)).body.data.status, "PENDING");

  // Pré-visualização aceita código em minúsculas/sem hífen e não revela segredos.
  const look = (await api("post", "/iot/claims/lookup", { code: c.pairingCode.replace("-", "").toLowerCase() }).expect(200)).body.data;
  assert.equal(look.modelo, station.modelo);
  assert.equal(look.sensores.length, 3);
  assert.deepEqual(look.reconnectable, []);
  assert.equal(JSON.stringify(look).includes(c.pollSecret), false);

  const confirmed = (await api("post", "/iot/claims/confirm", { code: c.pairingCode, nome: "Estação da sala" }).expect(201)).body.data;
  assert.equal(confirmed.device.status, "PROVISIONING");
  assert.equal(confirmed.device.nome, "Estação da sala");
  assert.equal(JSON.stringify(confirmed).includes("Token"), false);

  const paired = (await poll(c).expect(200)).body.data;
  assert.equal(paired.status, "APPROVED");
  assert.equal(paired.deviceId, confirmed.device.deviceId);
  assert.equal(paired.deviceToken.length, 43);
  await poll(c).expect(410); // uso único
  await api("post", "/iot/claims/confirm", { code: c.pairingCode }).expect(404); // código consumido

  // A credencial recebida autentica o dispositivo e aparece como conectado/aguardando medições.
  await request(app)
    .get("/iot/device/commands")
    .set("x-ceos-device-id", paired.deviceId)
    .set("Authorization", `Bearer ${paired.deviceToken}`)
    .expect(200);
  const list = (await api("get", "/iot/devices").expect(200)).body.data;
  const d = list.find((x) => x.deviceId === paired.deviceId);
  assert.equal(d.status, "ACTIVE");
  assert.equal(d.conexao, "AGUARDANDO_MEDICOES");
  assert.equal(d.ultimaMedicao, null);
});

test("códigos inválidos, expirados e segredos errados são rejeitados", async () => {
  await api("post", "/iot/claims/lookup", { code: "AAAA-AAAA" }).expect(404);
  await api("post", "/iot/claims/lookup", { code: "0000-0000" }).expect(404);
  await api("post", "/iot/claims/lookup", { code: 12345678 }).expect(404);
  await request(app).post("/iot/claims/lookup").send({ code: "AAAA-AAAA" }).expect(401);
  const c = await start();
  await request(app).post("/iot/device/claim/poll").send({ claimId: c.claimId, pollSecret: "x".repeat(43) }).expect(401);
  await request(app).post("/iot/device/claim/poll").send({ claimId: randomUUID(), pollSecret: c.pollSecret }).expect(401);
  await models.Claim.updateOne({ claimId: c.claimId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await api("post", "/iot/claims/lookup", { code: c.pairingCode }).expect(404);
  await api("post", "/iot/claims/confirm", { code: c.pairingCode }).expect(404);
  await poll(c).expect(410);
  await request(app).post("/iot/device/claim").send({ ...station, sensores: [] }).expect(400);
  await request(app).post("/iot/device/claim").send({ ...station, capacidades: {} }).expect(400);
});

test("isolamento entre contas: outro usuário não vê, não reconecta e não controla o dispositivo", async () => {
  const { paired } = await claimNew();
  const otherList = (await api("get", "/iot/devices", undefined, otherToken).expect(200)).body.data;
  assert.equal(otherList.some((d) => d.deviceId === paired.deviceId), false);
  await api("get", `/iot/devices/${paired.deviceId}`, undefined, otherToken).expect(404);
  await api("get", `/iot/devices/${paired.deviceId}/dashboard`, undefined, otherToken).expect(404);
  await api("post", `/iot/devices/${paired.deviceId}/revoke`, {}, otherToken).expect(404);
  // O outro usuário recebe um código válido, mas não pode usá-lo para tomar o dispositivo alheio.
  const c = await start();
  const look = (await api("post", "/iot/claims/lookup", { code: c.pairingCode }, otherToken).expect(200)).body.data;
  assert.equal(look.reconnectable.some((d) => d.deviceId === paired.deviceId), false);
  await api("post", "/iot/claims/confirm", { code: c.pairingCode, deviceId: paired.deviceId }, otherToken).expect(404);
  await api("post", "/iot/claims/confirm", { code: c.pairingCode, deviceId: "../x" }, otherToken).expect(404);
});

test("reconexão mantém deviceId e histórico, invalida a credencial anterior e revogação desconecta", async () => {
  const { paired } = await claimNew("Estação reconectável");
  await Measurement.create({
    userId: ownerId,
    deviceId: paired.deviceId,
    sensorId: "dht22-temperatura",
    sensorTipo: "temperatura",
    unidade: "C",
    valor: 24.5,
    timestamp: new Date(),
    metadata: { eventId: randomUUID() },
    idempotencyKey: `${randomUUID()}:dht22-temperatura`,
  });
  let d = (await api("get", "/iot/devices").expect(200)).body.data.find((x) => x.deviceId === paired.deviceId);
  assert.equal(d.conexao, "CONECTADO");
  assert.ok(d.ultimaMedicao);

  const c = await start();
  const look = (await api("post", "/iot/claims/lookup", { code: c.pairingCode }).expect(200)).body.data;
  assert.ok(look.reconnectable.some((x) => x.deviceId === paired.deviceId));
  const re = (await api("post", "/iot/claims/confirm", { code: c.pairingCode, deviceId: paired.deviceId }).expect(201)).body.data;
  assert.equal(re.reconnected, true);
  assert.equal(re.device.deviceId, paired.deviceId);
  // Credencial antiga deixa de funcionar assim que o usuário confirma a reconexão.
  await request(app)
    .get("/iot/device/commands")
    .set("x-ceos-device-id", paired.deviceId)
    .set("Authorization", `Bearer ${paired.deviceToken}`)
    .expect(401);
  const again = (await poll(c).expect(200)).body.data;
  assert.equal(again.deviceId, paired.deviceId);
  assert.notEqual(again.deviceToken, paired.deviceToken);
  const history = (await api("get", "/iot/measurements", undefined).query({ deviceId: paired.deviceId }).expect(200)).body;
  assert.equal(history.data.length, 1);

  // Desconectar (revogar) preserva o vínculo e o histórico, com estado REVOGADO.
  await api("post", `/iot/devices/${paired.deviceId}/revoke`, {}).expect(200);
  d = (await api("get", "/iot/devices").expect(200)).body.data.find((x) => x.deviceId === paired.deviceId);
  assert.equal(d.conexao, "REVOGADO");
  await request(app)
    .get("/iot/device/commands")
    .set("x-ceos-device-id", paired.deviceId)
    .set("Authorization", `Bearer ${again.deviceToken}`)
    .expect(401);
});

test("dispositivo sem contato recente aparece desconectado; sensores diferentes não podem reconectar", async () => {
  const { paired } = await claimNew("Estação parada");
  await models.Device.updateOne({ deviceId: paired.deviceId }, { $set: { ultimoContato: new Date(Date.now() - 3600000) } });
  const d = (await api("get", "/iot/devices").expect(200)).body.data.find((x) => x.deviceId === paired.deviceId);
  assert.equal(d.conexao, "DESCONECTADO");
  const c = await start({ ...station, sensores: station.sensores.slice(0, 1) });
  await api("post", "/iot/claims/confirm", { code: c.pairingCode, deviceId: paired.deviceId }).expect(409);
});

test("dispositivo associado por código envia medições pelo ingresso v2 com idempotência", async () => {
  const { paired } = await claimNew("Estação ingresso");
  const event = {
    eventId: randomUUID(),
    deviceId: paired.deviceId,
    measurements: [{ sensorId: "dht22-temperatura", valor: 22.5 }],
  };
  const prepared = (await internal("prepare", { event, deviceToken: paired.deviceToken }).expect(200)).body.data;
  assert.equal(prepared.deviceId, paired.deviceId);
  const replay = (await internal("prepare", { event, deviceToken: paired.deviceToken }).expect(200)).body.data;
  assert.deepEqual(replay, prepared);
  await internal("prepare", { event: { ...event, measurements: [{ sensorId: "desconhecido", valor: 1 }], eventId: randomUUID() }, deviceToken: paired.deviceToken }).expect(400);
});
