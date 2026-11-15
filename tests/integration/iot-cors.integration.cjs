const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const previewOrigin = 'https://ceos-reviewed-migration.vercel.app';
process.env.CORS_ORIGINS = `${previewOrigin},https://*.vercel.app,http://unsafe.invalid,https://invalid.example/path`;
const app = require('../../index');

test('browser READ_ONCE preflight permits the idempotency header and credentials for a trusted origin', async () => {
  const origin = 'http://localhost:3000';
  const response = await request(app).options('/iot/devices/test/requests')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
    .expect(204);
  assert.equal(response.headers['access-control-allow-origin'], origin);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  const allowed = response.headers['access-control-allow-headers'].toLowerCase().split(/,\s*/);
  assert.ok(allowed.includes('content-type'));
  assert.ok(allowed.includes('idempotency-key'), 'browser must be allowed to send the durable request key');
});

test('an untrusted origin receives no CORS grant', async () => {
  const response = await request(app).options('/iot/devices/test/requests')
    .set('Origin', 'https://untrusted.invalid')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'idempotency-key');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
});

test('only explicitly configured HTTPS Preview origins pass both CORS and cookie CSRF', async () => {
  const response = await request(app).options('/auth/refresh').set('Origin', previewOrigin)
    .set('Access-Control-Request-Method', 'POST').expect(204);
  assert.equal(response.headers['access-control-allow-origin'], previewOrigin);
  // The fake refresh token reaches validation only if CSRF allows this exact origin.
  await request(app).post('/auth/refresh').set('Origin', previewOrigin)
    .set('Cookie', 'refreshToken=invalid').send({}).expect(401);
  for (const origin of ['https://another.vercel.app', 'http://unsafe.invalid', 'https://invalid.example/path']) {
    const r = await request(app).post('/auth/refresh').set('Origin', origin)
      .set('Cookie', 'refreshToken=invalid').send({}).expect(403);
    assert.equal(r.body.error.code, 'CSRF_ORIGIN_DENIED');
  }
});
