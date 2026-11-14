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
let mongo, app, models, token, otherToken, userId;
const api = (method, path, body, auth = token) =>
  request(app)[method](path).set("Authorization", `Bearer ${auth}`).send(body);
const internal = (path, body) =>
  request(app)
    .post(`/iot/internal/${path}`)
    .set("x-ceos-service-key", process.env.CEOS_SERVICE_KEY)
    .send(body);
const spec = {
  nome: "Estacao",
  sensores: [
    {
      sensorId: "temp",
      nome: "Temperatura",
      tipo: "temperatura",
      unidade: "C",
    },
    { sensorId: "humid", nome: "Umidade", tipo: "umidade", unidade: "%" },
  ],
  capacidades: {
    supportsPush: true,
    supportsOnDemand: true,
    supportsCommandPolling: true,
  },
};
async function setup(overrides = {}) {
  const registered = (
    await api("post", "/iot/devices", { ...spec, ...overrides }).expect(201)
  ).body.data;
  const paired = (
    await request(app)
      .post("/iot/device/pair")
      .send({
        deviceId: registered.device.deviceId,
        provisioningToken: registered.provisioningToken,
      })
      .expect(200)
  ).body.data;
  return { ...registered, ...paired };
}
const deviceApi = (device, method, path, body) =>
  request(app)
    [method](`/iot/device/${path}`)
    .set("x-ceos-device-id", device.deviceId)
    .set("Authorization", `Bearer ${device.deviceToken}`)
    .send(body);
const createRequest = (d, key = randomUUID()) =>
  api("post", `/iot/devices/${d.deviceId}/requests`).set(
    "Idempotency-Key",
    key,
  );
before(
  async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    app = require("../../index");
    models = require("../../src/domain/entities/IoTPlatform");
    for (const model of Object.values(models)) await model.init();
    await require("../../src/domain/entities/IoTMeasurement").init();
    const User = require("../../src/domain/entities/User");
    const owner = await User.create({
      nome: "Owner",
      email: "platform@test.invalid",
      senhaHash: "x".repeat(60),
    });
    const other = await User.create({
      nome: "Other",
      email: "platform-other@test.invalid",
      senhaHash: "x".repeat(60),
    });
    userId = owner._id;
    const Provider = require("../../src/infrastructure/providers/JwtTokenProvider");
    token = new Provider().generateTokenPair(
      String(owner._id),
      owner.email,
      0,
    ).accessToken;
    otherToken = new Provider().generateTokenPair(
      String(other._id),
      other.email,
      0,
    ).accessToken;
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test("secure pairing, hashed secrets, IDOR and unsupported push-only device", async () => {
  const d = await setup({ capacidades: { supportsPush: true } });
  const raw = await models.Device.findOne({ deviceId: d.deviceId }).select(
    "+credentialHash +provisioningHash",
  );
  assert.notEqual(raw.credentialHash, d.deviceToken);
  assert.equal(raw.provisioningHash, undefined);
  await request(app)
    .post("/iot/device/pair")
    .send({ deviceId: d.deviceId, provisioningToken: d.provisioningToken })
    .expect(401);
  await api("get", `/iot/devices/${d.deviceId}`, undefined, otherToken).expect(
    404,
  );
  await api(
    "patch",
    `/iot/devices/${d.deviceId}`,
    { nome: "stolen" },
    otherToken,
  ).expect(404);
  await createRequest(d).expect(409);
  await deviceApi(
    { ...d, deviceToken: randomBytes(32).toString("base64url") },
    "get",
    "commands",
  ).expect(401);
});
test("durable dispatch, lease, correlation, partial writes, retry, completion and one notification", async () => {
  const d = await setup();
  const key = randomUUID();
  const responses = await Promise.all([
    createRequest(d, key).expect(202),
    createRequest(d, key).expect(202),
  ]);
  const r = responses[0].body.data;
  assert.equal(r.requestId, responses[1].body.data.requestId);
  assert.equal(r.status, "QUEUED");
  await createRequest(d).expect(409);
  await internal("dispatch", {}).expect(200);
  const command = (await deviceApi(d, "get", "commands").expect(200)).body
    .data[0];
  assert.equal(command.requestId, r.requestId);
  assert.deepEqual(
    (await deviceApi(d, "get", "commands").expect(200)).body.data,
    [],
  );
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, {
    leaseToken: command.leaseToken,
  }).expect(200);
  const input = {
    deviceId: d.deviceId,
    eventId: randomUUID(),
    requestId: r.requestId,
    leaseToken: command.leaseToken,
    measurements: [
      { sensorId: "temp", valor: 24 },
      { sensorId: "humid", valor: 60 },
    ],
  };
  await internal("prepare", {
    event: { ...input, userId: String(userId) },
    deviceToken: d.deviceToken,
  }).expect(400);
  const event = (
    await internal("prepare", {
      event: input,
      deviceToken: d.deviceToken,
    }).expect(200)
  ).body.data;
  assert.equal(
    (await api("get", `/iot/requests/${r.requestId}`).expect(200)).body.data
      .status,
    "PROCESSING",
  );
  assert.equal(await models.Notification.countDocuments(), 0);
  const Repo = require("../../src/infrastructure/repositories/IoTMeasurementRepositoryImpl");
  const original = Repo.prototype.upsertFromEvent;
  let count = 0;
  Repo.prototype.upsertFromEvent = function (data) {
    if (++count === 2) throw new Error("injected failure");
    return original.call(this, data);
  };
  try {
    await internal("measurements", event).expect(503);
  } finally {
    Repo.prototype.upsertFromEvent = original;
  }
  assert.equal(await models.Notification.countDocuments(), 0);
  const results = await Promise.all([
    internal("measurements", event).expect(200),
    internal("measurements", event).expect(200),
  ]);
  assert.equal(results[0].body.data.persisted, 2);
  assert.equal(
    await require("../../src/domain/entities/IoTMeasurement").countDocuments({
      "metadata.eventId": event.eventId,
    }),
    2,
  );
  const done = (await api("get", `/iot/requests/${r.requestId}`).expect(200))
    .body.data;
  assert.equal(done.status, "COMPLETED");
  assert.equal(done.resultEventId, event.eventId);
  const notes = (await api("get", "/notifications").expect(200)).body.data
    .items;
  assert.equal(notes.length, 1);
  assert.equal(
    (await api("get", "/notifications/unread-count").expect(200)).body.data
      .count,
    1,
  );
  await api(
    "patch",
    `/notifications/${notes[0].notificationId}/read`,
    {},
  ).expect(200);
  assert.equal(
    (await api("get", "/notifications/unread-count").expect(200)).body.data
      .count,
    0,
  );
  assert.equal(
    (await api("get", "/notifications", undefined, otherToken).expect(200)).body
      .data.items.length,
    0,
  );
  await api(
    "get",
    `/iot/events/${event.eventId}`,
    undefined,
    otherToken,
  ).expect(404);
  await api("get", `/iot/events/${event.eventId}`).expect(200);
  await internal("measurements", {
    ...event,
    measurements: [{ ...event.measurements[0], valor: 100 }],
  }).expect(403);
  await internal("prepare", {
    event: input,
    deviceToken: d.deviceToken,
  }).expect(200);
});
test("offline expiration, repair after notification failure, cancellation and revocation", async () => {
  const d = await setup();
  const r = (await createRequest(d).expect(202)).body.data;
  await models.ReadRequest.updateOne(
    { requestId: r.requestId },
    { $set: { expiresAt: new Date(Date.now() - 1) } },
  );
  await internal("dispatch", {}).expect(200);
  assert.equal(
    (await api("get", `/iot/requests/${r.requestId}`).expect(200)).body.data
      .status,
    "EXPIRED",
  );
  await models.Notification.deleteOne({ relatedRequestId: r.requestId });
  await internal("dispatch", {}).expect(200);
  assert.equal(
    await models.Notification.countDocuments({
      relatedRequestId: r.requestId,
      type: "IOT_DEVICE_OFFLINE",
    }),
    1,
  );
  const r2 = (await createRequest(d).expect(202)).body.data;
  await api(
    "post",
    `/iot/requests/${r2.requestId}/cancel`,
    {},
    otherToken,
  ).expect(409);
  await api("post", `/iot/requests/${r2.requestId}/cancel`, {}).expect(200);
  await api("post", `/iot/devices/${d.deviceId}/revoke`, {}).expect(200);
  await deviceApi(d, "get", "commands").expect(401);
  const rotate = (
    await api("post", `/iot/devices/${d.deviceId}/rotate`, {}).expect(200)
  ).body.data;
  await request(app)
    .post("/iot/device/pair")
    .send({ deviceId: d.deviceId, provisioningToken: rotate.provisioningToken })
    .expect(200);
  await deviceApi(d, "get", "commands").expect(401);
});
test("five simultaneous slots are enforced atomically across different devices", async () => {
  await models.Rate.deleteMany({});
  const devices = await Promise.all(
    Array.from({ length: 6 }, (_, i) => setup({ nome: `Parallel ${i}` })),
  );
  const responses = await Promise.all(devices.map((d) => createRequest(d)));
  assert.equal(responses.filter((r) => r.status === 202).length, 5);
  assert.equal(responses.filter((r) => r.status === 409).length, 1);
  for (const r of responses.filter((r) => r.status === 202))
    await api(
      "post",
      `/iot/requests/${r.body.data.requestId}/cancel`,
      {},
    ).expect(200);
});
test("expired provisioning, lease redelivery, wrong lease, device failure and credential rate limit", async () => {
  await models.Rate.deleteMany({});
  const registration = (await api("post", "/iot/devices", spec).expect(201))
    .body.data;
  await models.Device.updateOne(
    { deviceId: registration.device.deviceId },
    { $set: { provisioningExpiresAt: new Date(0) } },
  );
  await request(app)
    .post("/iot/device/pair")
    .send({
      deviceId: registration.device.deviceId,
      provisioningToken: registration.provisioningToken,
    })
    .expect(401);
  const d = await setup();
  const r = (await createRequest(d).expect(202)).body.data;
  await internal("dispatch", {}).expect(200);
  const first = (await deviceApi(d, "get", "commands").expect(200)).body
    .data[0];
  await models.ReadRequest.updateOne(
    { requestId: r.requestId },
    { $set: { leaseUntil: new Date(0) } },
  );
  const second = (await deviceApi(d, "get", "commands").expect(200)).body
    .data[0];
  assert.equal(second.requestId, first.requestId);
  assert.notEqual(second.leaseToken, first.leaseToken);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, {
    leaseToken: first.leaseToken,
  }).expect(409);
  await deviceApi(d, "post", `commands/${r.requestId}/ack`, {
    leaseToken: second.leaseToken,
    errorCode: "SENSOR_FAILURE",
  }).expect(200);
  assert.equal(
    (await api("get", `/iot/requests/${r.requestId}`).expect(200)).body.data
      .status,
    "FAILED",
  );
  assert.equal(
    await models.Notification.countDocuments({
      relatedRequestId: r.requestId,
      type: "IOT_READ_FAILED",
    }),
    1,
  );
  const window = Math.floor(Date.now() / 60000);
  await models.Rate.updateOne(
    { _id: `device:${d.deviceId}:${window}` },
    { $set: { count: 120 } },
    { upsert: true },
  );
  await deviceApi(d, "get", "commands").expect(429);
});
test("legacy migration authorizes only the configured owner and never rewrites measurements", async () => {
  await models.Rate.deleteMany({});
  process.env.CEOS_IOT_LEGACY_MIGRATION_ENABLED = "true";
  const fixture = structuredClone(require("../fixtures/event-v1.json"));
  fixture.eventId = randomUUID();
  fixture.measurements.forEach((m) => {
    m.idempotencyKey = `${fixture.eventId}:${m.sensorId}`;
  });
  process.env.CEOS_DEVICE_OWNERS = JSON.stringify({
    [fixture.deviceId]: String(userId),
  });
  await internal("measurements", fixture).expect(200);
  await api(
    "post",
    `/iot/legacy/${fixture.deviceId}/migrate`,
    {},
    otherToken,
  ).expect(404);
  const migrated = (
    await api("post", `/iot/legacy/${fixture.deviceId}/migrate`, {}).expect(201)
  ).body.data;
  assert.equal(migrated.device.deviceId, fixture.deviceId);
  await internal("measurements", fixture).expect(403);
  const result = await api("get", `/iot/events/${fixture.eventId}`).expect(200);
  assert.equal(result.body.data.length, 4);
  assert.ok(result.body.data.every((m) => m.userId === String(userId)));
});
