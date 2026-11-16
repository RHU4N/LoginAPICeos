// Integração real (MongoDB em memória, dados descartáveis): /ready reflete o banco; /health continua 200 (liveness).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
process.env.CEOS_SERVICE_KEY = process.env.CEOS_SERVICE_KEY || randomBytes(32).toString('hex');
let mongo, app;

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'ceos_test_health_' + randomBytes(6).toString('hex');
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGODB_DATABASE });
  app = require('../../index');
});

after(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop();
});

test('with MongoDB up: /ready 200 and /health 200 with driver state connected', async () => {
  const ready = await request(app).get('/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.data.status, 'READY');
  const health = await request(app).get('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.data.database, 'connected');
  assert.equal(health.body.data.databaseVerified, false);
});

test('with MongoDB down: /ready 503 but /health stays 200 (no global eviction)', async () => {
  await mongoose.disconnect();
  await new Promise((r) => setTimeout(r, 5200)); // expira o cache de 5 s do /ready
  const ready = await request(app).get('/ready');
  assert.equal(ready.status, 503);
  assert.equal(ready.body.data.status, 'NOT_READY');
  const health = await request(app).get('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.data.database, 'disconnected');
});
