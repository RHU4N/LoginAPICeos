const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const fixture = require('../fixtures/event-v1.json');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString('hex');
let mongo, app, Model, Repository, User, token, otherToken, owner;
const fresh = () => {
  const value = structuredClone(fixture); value.eventId = randomUUID();
  for (const m of value.measurements) m.idempotencyKey = value.eventId + ':' + m.sensorId;
  return value;
};
const post = (value) => request(app).post('/iot/internal/measurements').set('x-ceos-service-key', process.env.CEOS_SERVICE_KEY).send(value);

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'ceos_test_iot_' + randomBytes(6).toString('hex');
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGODB_DATABASE });
  app = require('../../index');
  Model = require('../../src/domain/entities/IoTMeasurement');
  Repository = require('../../src/infrastructure/repositories/IoTMeasurementRepositoryImpl');
  User = require('../../src/domain/entities/User');
  await Model.init();
  owner = await User.create({ nome: 'Teste IoT', email: 'iot@test.invalid', senhaHash: 'x'.repeat(60) });
  const other = await User.create({ nome: 'Outro usuário', email: 'other@test.invalid', senhaHash: 'x'.repeat(60) });
  process.env.CEOS_DEVICE_OWNERS = JSON.stringify({ [fixture.deviceId]: String(owner._id) });
  const Provider = require('../../src/infrastructure/providers/JwtTokenProvider');
  token = new Provider().generateTokenPair(String(owner._id), owner.email, 0).accessToken;
  otherToken = new Provider().generateTokenPair(String(other._id), other.email, 0).accessToken;
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('autenticação, JSON, versão e dispositivo inválidos não gravam', async () => {
  await request(app).post('/iot/internal/measurements').send(fixture).expect(401);
  await request(app).post('/iot/internal/measurements').set('x-ceos-service-key', process.env.CEOS_SERVICE_KEY).set('Content-Type', 'application/json').send('{').expect(400);
  await post({ ...fixture, schemaVersion: 2 }).expect(400);
  await post({ ...fixture, deviceId: 'unknown-device' }).expect(403);
  assert.equal(await Model.countDocuments(), 0);
});
test('persistência MongoDB real, recibos, índice único e duplicação concorrente', async () => {
  const value = fresh();
  const results = await Promise.all(Array.from({ length: 5 }, () => post(value).expect(200)));
  for (const response of results) assert.equal(response.body.data.persisted, 4);
  assert.equal(await Model.countDocuments({ 'metadata.eventId': value.eventId }), 4);
  const indexes = await Model.collection.indexes();
  assert.ok(indexes.some((i) => i.key.idempotencyKey === 1 && i.unique === true));
  const docs = await Model.find({ 'metadata.eventId': value.eventId });
  assert.ok(docs.every((m) => String(m.userId) === String(owner._id)));
});
test('retry recupera duas gravações parciais usando o Repository real', async () => {
  const value = fresh();
  const original = Repository.prototype.upsertFromEvent;
  let count = 0;
  Repository.prototype.upsertFromEvent = async function (data) {
    if (++count === 3) throw new Error('falha injetada de banco');
    return original.call(this, data);
  };
  try {
    await post(value).expect(503);
    assert.equal(await Model.countDocuments({ 'metadata.eventId': value.eventId }), 2);
  } finally { Repository.prototype.upsertFromEvent = original; }
  await post(value).expect(200);
  assert.equal(await Model.countDocuments({ 'metadata.eventId': value.eventId }), 4);
});
test('conteúdo conflitante recebe 409 e conserva a medição original', async () => {
  const value = fresh(); await post(value).expect(200);
  value.measurements[0].valor += 1;
  await post(value).expect(409);
  const original = await Model.findOne({ idempotencyKey: value.measurements[0].idempotencyKey });
  assert.equal(original.valor, fixture.measurements[0].valor);
});
test('consulta REST usa JWT, filtra proprietário e preserva criação legada', async () => {
  const response = await request(app).get('/iot/measurements').set('Authorization', 'Bearer ' + token).expect(200);
  assert.ok(response.body.data.length >= 4);
  const id = response.body.data[0].id;
  await request(app).get('/iot/measurements/' + id).set('Authorization', 'Bearer ' + otherToken).expect(404);
  const other = await request(app).get('/iot/measurements').set('Authorization', 'Bearer ' + otherToken).expect(200);
  assert.equal(other.body.pagination.total, 0);
  await request(app).get('/iot/measurements').expect(401);
  await request(app).post('/iot/measurements').set('Authorization', 'Bearer ' + token)
    .send({ ...fixture.measurements[0], deviceId: fixture.deviceId, idempotencyKey: randomUUID() }).expect(201);
  await request(app).get('/health').expect(200);
});
test('readiness verifica proprietário e índice e não expõe identidade', async () => {
  await request(app).get('/iot/internal/health').expect(401);
  const response = await request(app).get('/iot/internal/health').set('x-ceos-service-key', process.env.CEOS_SERVICE_KEY).expect(200);
  assert.equal(response.body.data.ready, true);
  assert.equal(response.body.data.idempotencyIndex, true);
  assert.ok(!JSON.stringify(response.body).includes(String(owner._id)));
});
test('chaves legadas e canônicas representam a mesma medição lógica', async () => {
  const value = fresh(); await post(value).expect(200);
  value.measurements.forEach((m, i) => { m.idempotencyKey = value.eventId + ':' + ['temperatura_dht22', 'umidade', 'temperatura_bmp180', 'pressao_hpa'][i]; });
  await post(value).expect(200);
  assert.equal(await Model.countDocuments({ 'metadata.eventId': value.eventId }), 4);
});
