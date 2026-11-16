const express = require('express');
const request = require('supertest');
const routes = require('../../src/interfaces/routes/SiteAssetRoutes');
const { createSiteAssets, MAX_BYTES } = require('../../src/infrastructure/storage/SiteAssets');
function app(read) { const a = express(); a.use('/assets/site', routes({ read })); return a; }
test('serves only approved images with a fixed MIME type and caching', async () => {
  const read = jest.fn().mockResolvedValue({ body: Buffer.from('PNG'), type: 'image/png', etag: '"asset-1"' });
  const response = await request(app(read)).get('/assets/site/logo.png');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('image/png');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['cache-control']).toBe('public, max-age=3600');
  expect((await request(app(read)).get('/assets/site/logo.png').set('If-None-Match', '"asset-1"')).status).toBe(304);
});
test.each(['unknown.png', '__proto__', 'constructor', 'functions-deployment'])('rejects unapproved name %s before accessing storage', async name => {
  const read = jest.fn(); expect((await request(app(read)).get('/assets/site/' + name)).status).toBe(404); expect(read).not.toHaveBeenCalled();
});
test('has no public upload or listing endpoint', async () => {
  const a = app(jest.fn()); expect((await request(a).post('/assets/site/logo.png').send('x')).status).toBe(404); expect((await request(a).get('/assets/site/')).status).toBe(404);
});
test('keeps missing configuration and provider secrets out of errors', async () => {
  expect((await request(app(null)).get('/assets/site/logo.png')).status).toBe(503);
  const response = await request(app(async () => { throw Error('private authorization'); })).get('/assets/site/logo.png');
  expect(response.status).toBe(502); expect(response.text).not.toContain('private authorization');
});
test('bounds the actual download and rejects oversized objects', async () => {
  const downloadToBuffer = jest.fn().mockResolvedValue(Buffer.from('png'));
  const getProperties = jest.fn().mockResolvedValue({ contentLength: 3, etag: '"a"' });
  const read = createSiteAssets({ client: { getBlobClient: () => ({ getProperties, downloadToBuffer }) } });
  expect((await read('logo.png')).body.toString()).toBe('png');
  expect(downloadToBuffer.mock.calls[0].slice(0, 2)).toEqual([0, 3]);
  getProperties.mockResolvedValue({ contentLength: MAX_BYTES + 1 });
  await expect(read('logo.png')).rejects.toThrow('Invalid asset size');
  expect(await read('other.png')).toBeNull();
});
