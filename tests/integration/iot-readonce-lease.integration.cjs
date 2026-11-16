// READ_ONCE: prazos de lease/TTL (regressão do 409 com o ESP32 do Wokwi). MongoDB em memória, dados descartáveis.
// O tempo decorrido é simulado deslocando leaseUntil/expiresAt no banco (sem esperas reais).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString("hex");
process.env.CEOS_IOT_COMMANDS_ENABLED = "true";
delete process.env.CEOS_IOT_REQUEST_TTL_SECONDS;
delete process.env.CEOS_IOT_LEASE_SECONDS;

let mongo, app, models, token;
const SENSORES = ["dht22-temperatura", "dht22-umidade", "bmp180-temperatura", "bmp180-pressao"];
const api = (method, path, body) => request(app)[method](path).set("Authorization", `Bearer ${token}`).send(body);
const internal = (path, body) =>
  request(app).post(`/iot/internal/${path}`).set("x-ceos-service-key", process.env.CEOS_SERVICE_KEY).send(body);
const deviceApi = (d, method, path, body) =>
  request(app)[method](`/iot/device/${path}`).set("x-ceos-device-id", d.deviceId).set("Authorization", `Bearer ${d.deviceToken}`).send(body);
const spec = {
  nome: "Wokwi ESP32",
  sensores: [
    { sensorId: "dht22-temperatura", nome: "Temperatura DHT22", tipo: "temperatura", unidade: "C" },
    { sensorId: "dht22-umidade", nome: "Umidade", tipo: "umidade", unidade: "%" },
    { sensorId: "bmp180-temperatura", nome: "Temperatura BMP180", tipo: "temperatura", unidade: "C" },
    { sensorId: "bmp180-pressao", nome: "Pressao", tipo: "pressao", unidade: "hPa" },
  ],
  capacidades: { supportsPush: true, supportsOnDemand: true, supportsCommandPolling: true },
};
const medicoes = () => SENSORES.map((sensorId, i) => ({ sensorId, valor: 20 + i + 0.16 }));
async function parear() {
  const reg = (await api("post", "/iot/devices", spec).expect(201)).body.data;
  const par = (await request(app).post("/iot/device/pair").send({ deviceId: reg.device.deviceId, provisioningToken: reg.provisioningToken }).expect(200)).body.data;
  return { ...reg, ...par };
}
async function solicitarEReceber(d) {
  const r = (await api("post", `/iot/devices/${d.deviceId}/requests`).set("Idempotency-Key", randomUUID()).expect(202)).body.data;
  await internal("dispatch", {}).expect(200);
  const cmd = (await deviceApi(d, "get", "commands").expect(200)).body.data[0];
  return { r, cmd };
}
// Simula "segundos decorridos desde o claim" sem esperar: move leaseUntil para trás.
const decorrer = (requestId, segundos) =>
  models.ReadRequest.updateOne({ requestId }, [{ $set: { leaseUntil: { $subtract: ["$leaseUntil", segundos * 1000] } } }]);
const evento = (d, cmd, extra = {}) => ({ deviceId: d.deviceId, eventId: randomUUID(), requestId: cmd.requestId, leaseToken: cmd.leaseToken, measurements: medicoes(), ...extra });

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI, { dbName: "ceos_test_readonce_" + randomBytes(4).toString("hex") });
  app = require("../../index");
  models = require("../../src/domain/entities/IoTPlatform");
  for (const model of Object.values(models)) await model.init();
  await require("../../src/domain/entities/IoTMeasurement").init();
  const User = require("../../src/domain/entities/User");
  const owner = await User.create({ nome: "Owner", email: "readonce@test.invalid", senhaHash: "x".repeat(60) });
  const Provider = require("../../src/infrastructure/providers/JwtTokenProvider");
  token = new Provider().generateTokenPair(String(owner._id), owner.email, 0).accessToken;
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test("prazos centralizados: padrão TTL 300 s e lease 120 s, validados e lease nunca maior que o TTL", () => {
  const { readOnceTimings } = require("../../src/application/use_cases/IoTPlatform");
  assert.deepEqual(readOnceTimings({}), { ttlSeconds: 300, leaseSeconds: 120 });
  assert.deepEqual(readOnceTimings({ CEOS_IOT_REQUEST_TTL_SECONDS: "abc", CEOS_IOT_LEASE_SECONDS: "" }), { ttlSeconds: 300, leaseSeconds: 120 });
  assert.deepEqual(readOnceTimings({ CEOS_IOT_LEASE_SECONDS: "999" }), { ttlSeconds: 300, leaseSeconds: 300 });
  assert.deepEqual(readOnceTimings({ CEOS_IOT_LEASE_SECONDS: "5" }), { ttlSeconds: 300, leaseSeconds: 30 });
  assert.deepEqual(readOnceTimings({ CEOS_IOT_REQUEST_TTL_SECONDS: "60" }), { ttlSeconds: 60, leaseSeconds: 60 });
  assert.deepEqual(readOnceTimings({ CEOS_IOT_REQUEST_TTL_SECONDS: "9999" }), { ttlSeconds: 600, leaseSeconds: 120 });
});

test("1-4: solicitação, polling, comando com leaseSeconds sincronizado, ACK válido após 31 s e ACK expirado", async () => {
  const d = await parear();
  const { r, cmd } = await solicitarEReceber(d);
  assert.equal(cmd.type, "READ_ONCE");
  assert.equal(cmd.requestId, r.requestId);
  assert.equal(cmd.leaseSeconds, 120);
  const doc = await models.ReadRequest.findOne({ requestId: r.requestId });
  assert.equal(doc.status, "MEASURING");
  assert.equal(Math.round((doc.leaseUntil - doc.startedAt) / 1000), 120);
  assert.equal(Math.round((doc.expiresAt - doc.queuedAt) / 1000), 300);
  // Com o lease antigo de 30 s, este ACK (31 s depois do claim) recebia 409.
  await decorrer(r.requestId, 31);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, { leaseToken: cmd.leaseToken }).expect(200);
  // ACK depois do lease vencido continua recusado (controle preservado).
  await decorrer(r.requestId, 120);
  const exp = await deviceApi(d, "post", `commands/${r.requestId}/ack`, { leaseToken: cmd.leaseToken }).expect(409);
  assert.doesNotMatch(JSON.stringify(exp.body), new RegExp(cmd.leaseToken));
});

test("6, 8, 10: ingresso v2 com requestId 60 s após o claim, retry com o mesmo eventId e conclusão com uma notificação", async () => {
  const d = await parear();
  const { r, cmd } = await solicitarEReceber(d);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, { leaseToken: cmd.leaseToken }).expect(200);
  await decorrer(r.requestId, 60); // Wokwi lento: ainda dentro de 120 s
  const input = evento(d, cmd);
  const ev = (await internal("prepare", { event: input, deviceToken: d.deviceToken }).expect(200)).body.data;
  assert.equal(ev.requestId, r.requestId);
  assert.equal((await api("get", `/iot/requests/${r.requestId}`).expect(200)).body.data.status, "PROCESSING");
  // Retry idêntico (mesmo eventId e corpo) é idempotente.
  const again = (await internal("prepare", { event: input, deviceToken: d.deviceToken }).expect(200)).body.data;
  assert.equal(again.eventId, ev.eventId);
  // Replay do mesmo eventId com corpo diferente continua bloqueado.
  await internal("prepare", { event: { ...input, measurements: medicoes().map((m) => ({ ...m, valor: m.valor + 1 })) }, deviceToken: d.deviceToken }).expect(409);
  // Consumer persiste e conclui; entrega duplicada não duplica medições nem notificação.
  await internal("measurements", ev).expect(200);
  await internal("measurements", ev).expect(200);
  const done = (await api("get", `/iot/requests/${r.requestId}`).expect(200)).body.data;
  assert.equal(done.status, "COMPLETED");
  assert.equal(done.resultEventId, ev.eventId);
  assert.equal(await require("../../src/domain/entities/IoTMeasurement").countDocuments({ "metadata.eventId": ev.eventId }), 4);
  assert.equal(await models.Notification.countDocuments({ relatedRequestId: r.requestId }), 1);
});

test("7: ingresso após o lease vencido e após a solicitação expirar é recusado com 409", async () => {
  const d = await parear();
  const a = await solicitarEReceber(d);
  await decorrer(a.r.requestId, 121);
  const res = await internal("prepare", { event: evento(d, a.cmd), deviceToken: d.deviceToken }).expect(409);
  assert.equal(res.body.error?.code || res.body.code, "IOT_REQUEST_INVALID");
  await api("post", `/iot/requests/${a.r.requestId}/cancel`).expect(200);
  const b = await solicitarEReceber(d);
  await models.ReadRequest.updateOne({ requestId: b.r.requestId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await internal("prepare", { event: evento(d, b.cmd), deviceToken: d.deviceToken }).expect(409);
  await internal("dispatch", {}).expect(200);
  assert.equal((await api("get", `/iot/requests/${b.r.requestId}`).expect(200)).body.data.status, "EXPIRED");
});

test("9: reclaim após o lease vencer gera novo leaseToken e invalida o anterior", async () => {
  const d = await parear();
  const { r, cmd } = await solicitarEReceber(d);
  assert.deepEqual((await deviceApi(d, "get", "commands").expect(200)).body.data, []); // lease ativo: sem reentrega
  await decorrer(r.requestId, 121);
  const second = (await deviceApi(d, "get", "commands").expect(200)).body.data[0];
  assert.equal(second.requestId, r.requestId);
  assert.notEqual(second.leaseToken, cmd.leaseToken);
  assert.equal((await models.ReadRequest.findOne({ requestId: r.requestId })).attempts, 2);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, { leaseToken: cmd.leaseToken }).expect(409);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, { leaseToken: second.leaseToken }).expect(200);
  await internal("prepare", { event: evento(d, second), deviceToken: d.deviceToken }).expect(200);
});

test("11: PUSH espontâneo (sem requestId) continua aceito, persistido e sem afetar solicitações", async () => {
  const d = await parear();
  const input = { deviceId: d.deviceId, eventId: randomUUID(), measurements: medicoes() };
  const ev = (await internal("prepare", { event: input, deviceToken: d.deviceToken }).expect(200)).body.data;
  assert.equal(ev.requestId, undefined);
  await internal("measurements", ev).expect(200);
  assert.equal(await require("../../src/domain/entities/IoTMeasurement").countDocuments({ "metadata.eventId": ev.eventId }), 4);
  assert.equal(await models.ReadRequest.countDocuments({ deviceId: d.deviceId }), 0);
});
