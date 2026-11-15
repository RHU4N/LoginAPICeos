const express = require('express');
const request = require('supertest');
const trustProxySetting = require('../src/config/trustProxy');
const azure = { WEBSITE_SITE_NAME: 'loginapi-ceos', WEBSITE_INSTANCE_ID: 'platform-instance', WEBSITE_HOSTNAME: 'loginapi-ceos.azurewebsites.net' };
function probe(env) {
  const app = express();
  app.set('trust proxy', trustProxySetting(env));
  app.get('/', (req, res) => res.json({ secure: req.secure, ip: req.ip }));
  return request(app).get('/').set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '192.0.2.99, 192.0.2.1');
}
test('Azure recognizes TLS at its closest platform proxy', async () => {
  const res = await probe(azure);
  expect(res.body).toEqual({ secure: true, ip: '192.0.2.1' });
});
test('client headers alone cannot enable trust', async () => {
  expect((await probe({})).body.secure).toBe(false);
  expect(trustProxySetting({ ...azure, WEBSITE_HOSTNAME: 'untrusted.invalid' })).toBe(false);
});
test('explicit configured trust and explicit disable take priority', () => {
  expect(trustProxySetting({ TRUST_PROXY_HOPS: '1' })).toBe(1);
  for (const value of ['0', 'true', '-1', '100', '*']) {
    expect(trustProxySetting({ ...azure, TRUST_PROXY_HOPS: value })).toBe(false);
  }
});
