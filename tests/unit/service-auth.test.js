const express = require('express');
const request = require('supertest');
const { randomBytes } = require('node:crypto');
const serviceAuth = require('../../src/infrastructure/middleware/ServiceAuthMiddleware');
const { acceptedKeys } = serviceAuth;

const k = () => randomBytes(32).toString('hex');
function app() {
  const a = express();
  a.get('/internal', serviceAuth, (_req, res) => res.json({ ok: true }));
  a.use((err, _req, res, _next) => res.status(err.statusCode || err.status || 500).json({ code: err.code }));
  return a;
}
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

test('accepts the current key and rejects others', async () => {
  const current = k();
  process.env.CEOS_SERVICE_KEY = current; delete process.env.CEOS_SERVICE_KEY_PREVIOUS; process.env.NODE_ENV = 'test';
  expect((await request(app()).get('/internal').set('x-ceos-service-key', current)).status).toBe(200);
  expect((await request(app()).get('/internal').set('x-ceos-service-key', k())).status).toBe(401);
  expect((await request(app()).get('/internal')).status).toBe(401);
});

test('during rotation accepts both current and previous keys', async () => {
  const current = k(); const previous = k();
  process.env.CEOS_SERVICE_KEY = current; process.env.CEOS_SERVICE_KEY_PREVIOUS = previous; process.env.NODE_ENV = 'test';
  expect((await request(app()).get('/internal').set('x-ceos-service-key', current)).status).toBe(200);
  expect((await request(app()).get('/internal').set('x-ceos-service-key', previous)).status).toBe(200);
  expect((await request(app()).get('/internal').set('x-ceos-service-key', k())).status).toBe(401);
});

test('removing the previous key ends the transition window', async () => {
  const current = k(); const previous = k();
  process.env.CEOS_SERVICE_KEY = current; process.env.NODE_ENV = 'test'; delete process.env.CEOS_SERVICE_KEY_PREVIOUS;
  expect((await request(app()).get('/internal').set('x-ceos-service-key', previous)).status).toBe(401);
});

test('ignores a short or duplicated previous key and requires a valid current key', () => {
  expect(acceptedKeys({ CEOS_SERVICE_KEY: 'curta' })).toBeNull();
  const current = k();
  expect(acceptedKeys({ CEOS_SERVICE_KEY: current, CEOS_SERVICE_KEY_PREVIOUS: 'curta' })).toEqual([current]);
  expect(acceptedKeys({ CEOS_SERVICE_KEY: current, CEOS_SERVICE_KEY_PREVIOUS: current })).toEqual([current]);
  expect(acceptedKeys({ CEOS_SERVICE_KEY_PREVIOUS: k() })).toBeNull();
});

test('returns 503 when not configured and never echoes keys', async () => {
  delete process.env.CEOS_SERVICE_KEY; process.env.NODE_ENV = 'test';
  const r = await request(app()).get('/internal').set('x-ceos-service-key', 'x'.repeat(40));
  expect(r.status).toBe(503);
  expect(JSON.stringify(r.body)).not.toContain('x'.repeat(40));
});
