const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
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
