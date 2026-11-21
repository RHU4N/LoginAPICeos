const express = require('express');
const request = require('supertest');
const { createHealthRouter } = require('../../src/interfaces/routes/HealthRoutes');

function app(connection, opts = {}) {
  const a = express();
  a.use(createHealthRouter({ connection, environment: 'test', ...opts }));
  return a;
}
const conn = (readyState, command) => ({ readyState, db: { admin: () => ({ command }) } });

test('/health is a liveness probe: 200 even when MongoDB is down, without claiming a verified database', async () => {
  const command = jest.fn();
  const res = await request(app(conn(0, command))).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('OK');
  expect(res.body.data.check).toBe('liveness');
  expect(res.body.data.database).toBe('disconnected');
  expect(res.body.data.databaseVerified).toBe(false);
  expect(command).not.toHaveBeenCalled();
  expect(res.headers['cache-control']).toBe('no-store');
});

test('/health reports the real driver state instead of a hardcoded value', async () => {
  for (const [state, label] of [[1, 'connected'], [2, 'connecting'], [3, 'disconnecting'], [99, 'unknown']]) {
    const res = await request(app(conn(state, jest.fn()))).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe(label);
  }
  expect((await request(app(undefined)).get('/health')).body.data.database).toBe('unknown');
});

test('/ready pings MongoDB and returns 200 with latency when it answers', async () => {
  const command = jest.fn().mockResolvedValue({ ok: 1 });
  const res = await request(app(conn(1, command))).get('/ready');
  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('READY');
  expect(res.body.data.database).toBe('ok');
  expect(command).toHaveBeenCalledWith({ ping: 1 });
});

test('/ready returns 503 without pinging when the driver is not connected', async () => {
  const command = jest.fn();
  const res = await request(app(conn(0, command))).get('/ready');
  expect(res.status).toBe(503);
  expect(res.body.data.status).toBe('NOT_READY');
  expect(res.body.data.database).toBe('not_connected');
  expect(command).not.toHaveBeenCalled();
});

test('/ready times out quickly when the ping hangs and never leaks driver errors', async () => {
  const hang = jest.fn(() => new Promise(() => {}));
  const started = Date.now();
  const res = await request(app(conn(1, hang), { timeoutMs: 50 })).get('/ready');
  expect(res.status).toBe(503);
  expect(res.body.data.database).toBe('timeout');
  expect(Date.now() - started).toBeLessThan(2000);
  const failing = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND cluster0.private-host.example'));
  const res2 = await request(app(conn(1, failing))).get('/ready');
  expect(res2.status).toBe(503);
  expect(res2.body.data.database).toBe('ping_failed');
  expect(JSON.stringify(res2.body)).not.toContain('private-host');
});

test('/ready caches the result briefly to avoid hammering the database', async () => {
  let t = 1000;
  const command = jest.fn().mockResolvedValue({ ok: 1 });
  const a = app(conn(1, command), { cacheMs: 5000, now: () => t });
  await request(a).get('/ready'); await request(a).get('/ready');
  expect(command).toHaveBeenCalledTimes(1);
  t += 6000;
  await request(a).get('/ready');
  expect(command).toHaveBeenCalledTimes(2);
});
