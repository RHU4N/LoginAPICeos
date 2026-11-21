#!/usr/bin/env node
'use strict';

/**
 * Benchmark técnico reproduzível da US68 (SCRUM-107).
 *
 * Mede MathAPI e LoginAPICeos em processos Node isolados (para separar CPU/RAM
 * por serviço via IPC) com MongoMemoryServer local, warm-up descartado,
 * perfis crescentes (1, 5 e 10 VUs), concorrência efetiva real (em voo e L = lambda * W),
 * bursts concorrentes de persistência/IoT e integridade funcional concorrente.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { fork } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { performance } = require('node:perf_hooks');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function roundMs(value) {
  return Number(value.toFixed(2));
}

function percentile(sortedValues, pct) {
  if (!sortedValues.length) return 0;
  const idx = Math.ceil((pct / 100) * sortedValues.length) - 1;
  return roundMs(sortedValues[Math.max(0, Math.min(sortedValues.length - 1, idx))]);
}

function summarizeLatencies(samples) {
  if (!samples.length) {
    return { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((acc, value) => acc + value, 0);
  return {
    min: roundMs(sorted[0]),
    mean: roundMs(total / sorted.length),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: roundMs(sorted[sorted.length - 1]),
  };
}

function resolveMathAppPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.MATH_API_APP_PATH,
    path.resolve(__dirname, '..', '..', 'MathAPI', 'app.js'),
    path.resolve(__dirname, '..', '..', 'mathapi', 'app.js'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

function createTelemetrySnapshot() {
  const cpu = process.cpuUsage();
  const mem = process.memoryUsage();
  return {
    cpuUserUs: cpu.user,
    cpuSystemUs: cpu.system,
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    externalBytes: mem.external,
    timestampMs: Date.now(),
  };
}

function computeTelemetryDelta(before, after, wallMs) {
  if (!before || !after) return null;
  const cpuUserMs = (after.cpuUserUs - before.cpuUserUs) / 1000;
  const cpuSystemMs = (after.cpuSystemUs - before.cpuSystemUs) / 1000;
  const cpuTotalMs = cpuUserMs + cpuSystemMs;
  const toMb = (bytes) => Number((bytes / (1024 * 1024)).toFixed(2));
  return {
    cpuUserMs: roundMs(cpuUserMs),
    cpuSystemMs: roundMs(cpuSystemMs),
    cpuTotalMs: roundMs(cpuTotalMs),
    cpuPctOfSingleCore: wallMs > 0 ? Number(((cpuTotalMs / wallMs) * 100).toFixed(2)) : 0,
    rssStartMb: toMb(before.rssBytes),
    rssEndMb: toMb(after.rssBytes),
    rssDeltaMb: Number((toMb(after.rssBytes) - toMb(before.rssBytes)).toFixed(2)),
    heapUsedEndMb: toMb(after.heapUsedBytes),
  };
}

async function runWorker(role, options) {
  let server = null;
  let mongoose = null;
  let mongo = null;

  if (role === 'math') {
    const appPath = resolveMathAppPath(options.mathAppPath);
    if (!appPath) {
      throw new Error('MathAPI/app.js não encontrada; informe --math-app-path ou MATH_API_APP_PATH.');
    }
    const { createApp } = require(appPath);
    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    process.send({
      type: 'ready',
      role: 'math',
      pid: process.pid,
      appPath,
      baseUrl: `http://127.0.0.1:${addr.port}`,
    });
  } else if (role === 'login') {
    const bcryptRounds = String(options.bcryptRounds || '10');
    const serviceKey = options.serviceKey || `ceos-us68-service-${randomBytes(8).toString('hex')}`;
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoose = require('mongoose');

    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = mongo.getUri();
    process.env.MONGODB_DATABASE = `ceos_us68_${randomBytes(6).toString('hex')}`;
    process.env.BCRYPT_ROUNDS = bcryptRounds;
    process.env.RATE_LIMIT_MAX_ATTEMPTS = '5';
    process.env.RATE_LIMIT_WINDOW_MS = '900000';
    process.env.LOGIN_LOCK_DURATION_MS = '900000';
    process.env.JWT_SECRET = 'us68-benchmark-jwt-secret-key-min-32-chars';
    process.env.JWT_REFRESH_SECRET = 'us68-benchmark-refresh-secret-min-32';
    process.env.CEOS_SERVICE_KEY = serviceKey;
    process.env.CEOS_IOT_COMMANDS_ENABLED = 'true';
    process.env.ENABLE_SWAGGER = 'false';
    process.env.LOG_LEVEL = 'error';

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGODB_DATABASE,
    });

    const loginApp = require('../index');
    const models = [
      require('../src/domain/entities/User'),
      require('../src/domain/entities/Favorite'),
      require('../src/domain/entities/CustomFunction'),
      require('../src/domain/entities/IoTMeasurement'),
      ...Object.values(require('../src/domain/entities/IoTPlatform')),
    ];
    for (const Model of models) {
      await Model.createIndexes();
    }

    server = http.createServer(loginApp);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    process.send({
      type: 'ready',
      role: 'login',
      pid: process.pid,
      serviceKey,
      bcryptRounds: Number(bcryptRounds),
      baseUrl: `http://127.0.0.1:${addr.port}`,
    });
  } else {
    throw new Error(`Worker inválido: ${role}`);
  }

  process.on('message', async (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'sample') {
      process.send({
        type: 'sample',
        id: msg.id,
        snapshot: createTelemetrySnapshot(),
      });
    } else if (msg.type === 'shutdown') {
      try {
        if (server) {
          await new Promise((resolve) => server.close(resolve));
        }
        if (mongoose && mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
        if (mongo) {
          await mongo.stop();
        }
      } finally {
        process.exit(0);
      }
    }
  });
}

function spawnWorker(role, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, ['--worker', role, ...extraArgs], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { ...process.env },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const sampleWaiters = new Map();
    let sampleSeq = 0;

    child.on('message', (msg) => {
      if (msg && msg.type === 'ready') {
        resolve({
          info: msg,
          async sample() {
            const id = ++sampleSeq;
            return new Promise((res, rej) => {
              const timer = setTimeout(() => {
                sampleWaiters.delete(id);
                rej(new Error(`Timeout aguardando amostra IPC do worker ${role}`));
              }, 5000);
              sampleWaiters.set(id, { res, timer });
              child.send({ type: 'sample', id });
            });
          },
          async stop() {
            if (child.killed || child.exitCode !== null) return;
            await new Promise((res) => {
              const timer = setTimeout(() => {
                child.kill('SIGTERM');
                res();
              }, 5000);
              child.once('exit', () => {
                clearTimeout(timer);
                res();
              });
              child.send({ type: 'shutdown' });
            });
          },
        });
      } else if (msg && msg.type === 'sample' && sampleWaiters.has(msg.id)) {
        const entry = sampleWaiters.get(msg.id);
        clearTimeout(entry.timer);
        sampleWaiters.delete(msg.id);
        entry.res(msg.snapshot);
      }
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code && code !== 0) {
        reject(new Error(`Worker ${role} encerrou com código ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function requestJson(url, options = {}) {
  const started = performance.now();
  try {
    const headers = { ...(options.headers || {}) };
    let body;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs || 15000),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body: json,
      raw: text,
      durationMs: performance.now() - started,
      connectionError: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      raw: null,
      durationMs: performance.now() - started,
      connectionError: error.message || String(error),
    };
  }
}

async function measureStage(label, workers, fn) {
  const before = {};
  for (const [name, worker] of Object.entries(workers)) {
    if (worker) before[name] = await worker.sample();
  }
  const wallStart = performance.now();
  const outcome = await fn();
  const wallMs = performance.now() - wallStart;
  const after = {};
  const resources = {};
  for (const [name, worker] of Object.entries(workers)) {
    if (worker) {
      after[name] = await worker.sample();
      resources[name] = computeTelemetryDelta(before[name], after[name], wallMs);
    }
  }
  return {
    label,
    wallMs: roundMs(wallMs),
    resources,
    ...outcome,
  };
}

async function runLoadProfile({ label, vus, durationMs, buildRequest, workers }) {
  const durations = [];
  const statusCodes = {};
  const byEndpoint = {};
  const errors = [];
  let connectionFailures = 0;
  let httpErrors = 0;
  let checkFailures = 0;
  let inFlight = 0;
  let effectiveConcurrencyPeak = 0;

  const outcome = await measureStage(label, workers, async () => {
    const startWall = performance.now();
    const deadline = startWall + durationMs;

    const runVu = async (vuIndex) => {
      let step = 0;
      while (performance.now() < deadline) {
        const spec = buildRequest(vuIndex, step);
        step += 1;
        inFlight += 1;
        if (inFlight > effectiveConcurrencyPeak) {
          effectiveConcurrencyPeak = inFlight;
        }
        let res;
        try {
          res = await requestJson(spec.url, spec);
        } finally {
          inFlight -= 1;
        }
        durations.push(res.durationMs);
        statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;

        if (!byEndpoint[spec.name]) {
          byEndpoint[spec.name] = { count: 0, durations: [], failures: 0 };
        }
        byEndpoint[spec.name].count += 1;
        byEndpoint[spec.name].durations.push(res.durationMs);

        if (res.connectionError) {
          connectionFailures += 1;
          byEndpoint[spec.name].failures += 1;
          if (errors.length < 10) errors.push(`${spec.name}: ${res.connectionError}`);
          continue;
        }
        if (res.status >= 400) {
          httpErrors += 1;
        }
        const valid = spec.check(res);
        if (!valid) {
          checkFailures += 1;
          byEndpoint[spec.name].failures += 1;
          if (errors.length < 10) {
            errors.push(`${spec.name}: status=${res.status} body=${JSON.stringify(res.body)}`);
          }
        }
      }
    };

    await Promise.all(Array.from({ length: vus }, (_, idx) => runVu(idx)));
    return {};
  });

  const sumRequestMs = durations.reduce((acc, value) => acc + value, 0);
  const totalRequests = durations.length;
  const endpointSummary = {};
  for (const [name, item] of Object.entries(byEndpoint)) {
    endpointSummary[name] = {
      count: item.count,
      failures: item.failures,
      ...summarizeLatencies(item.durations),
    };
  }

  return {
    label: outcome.label,
    configuredVUs: vus,
    durationTargetMs: durationMs,
    wallMs: outcome.wallMs,
    totalRequests,
    rps: outcome.wallMs > 0 ? Number(((totalRequests / outcome.wallMs) * 1000).toFixed(2)) : 0,
    effectiveConcurrencyAvg: outcome.wallMs > 0 ? Number((sumRequestMs / outcome.wallMs).toFixed(2)) : 0,
    effectiveConcurrencyPeak,
    latencyMs: summarizeLatencies(durations),
    statusCodes,
    httpErrors,
    connectionFailures,
    checkFailures,
    sampleErrors: errors,
    byEndpoint: endpointSummary,
    resources: outcome.resources,
  };
}

async function createAndLoginUser(loginUrl, tag, senha = 'SenhaForte@2026') {
  const email = `perf.${tag}.${randomBytes(4).toString('hex')}@ceos.test`;
  const reg = await requestJson(`${loginUrl}/users`, {
    method: 'POST',
    body: {
      nome: `Benchmark ${tag}`,
      email,
      senha,
      confirmaSenha: senha,
      telefone: '11999998888',
    },
  });
  if (reg.status !== 201) {
    throw new Error(`Falha ao criar usuário ${tag}: status=${reg.status} body=${reg.raw}`);
  }
  const login = await requestJson(`${loginUrl}/auth/login`, {
    method: 'POST',
    headers: { 'X-CEOS-Client': 'mobile' },
    body: { email, senha },
  });
  if (login.status !== 200 || !login.body?.data?.accessToken) {
    throw new Error(`Falha no login de ${tag}: status=${login.status} body=${login.raw}`);
  }
  return {
    userId: reg.body.data.id,
    email,
    senha,
    accessToken: login.body.data.accessToken,
    refreshToken: login.body.data.refreshToken,
  };
}

async function registerAndPairDevice(loginUrl, accessToken, nome) {
  const reg = await requestJson(`${loginUrl}/iot/devices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      nome,
      descricao: 'Estação Benchmark US68',
      sensores: [
        { sensorId: 'temp', nome: 'Temp', tipo: 'temperatura', unidade: 'C' },
        { sensorId: 'humid', nome: 'Umid', tipo: 'umidade', unidade: '%' },
      ],
      capacidades: {
        supportsPush: true,
        supportsOnDemand: true,
        supportsCommandPolling: true,
        supportsMultipleSensors: true,
      },
    },
  });
  if (reg.status !== 201) {
    throw new Error(`Falha ao registrar device: status=${reg.status} body=${reg.raw}`);
  }
  const deviceId = reg.body.data.device.deviceId;
  const pair = await requestJson(`${loginUrl}/iot/device/pair`, {
    method: 'POST',
    body: {
      deviceId,
      provisioningToken: reg.body.data.provisioningToken,
    },
  });
  if (pair.status !== 200) {
    throw new Error(`Falha ao parear device: status=${pair.status} body=${pair.raw}`);
  }
  return {
    deviceId,
    deviceToken: pair.body.data.deviceToken,
  };
}

function buildMathSpecs(mathUrl) {
  return [
    {
      name: 'POST /funcao/linear',
      url: `${mathUrl}/funcao/linear`,
      method: 'POST',
      body: { a: 2, b: 3, x: 4 },
      check: (res) => res.status === 200 && res.body?.success === true && res.body?.data?.resultado === 11,
    },
    {
      name: 'POST /estequiometria/balanceamento',
      url: `${mathUrl}/estequiometria/balanceamento`,
      method: 'POST',
      body: { equacao: 'H2 + O2 -> H2O' },
      check: (res) =>
        res.status === 200 &&
        res.body?.success === true &&
        res.body?.data?.equacaoBalanceada === '2 H2 + O2 -> 2 H2O',
    },
    {
      name: 'POST /termoquimica/calor-sensivel',
      url: `${mathUrl}/termoquimica/calor-sensivel`,
      method: 'POST',
      body: { massa: 200, calorEspecifico: 4.18, temperaturaInicial: 20, temperaturaFinal: 30 },
      check: (res) => res.status === 200 && res.body?.success === true && res.body?.data?.valorJ === 8360,
    },
    {
      name: 'POST /termologia/ponto-de-orvalho',
      url: `${mathUrl}/termologia/ponto-de-orvalho`,
      method: 'POST',
      body: { temperatura: 24, umidadeRelativa: 40 },
      check: (res) =>
        res.status === 200 &&
        res.body?.success === true &&
        typeof res.body?.data?.pontoOrvalho === 'number' &&
        Math.abs(res.body.data.pontoOrvalho - 9.56) < 0.1,
    },
    {
      name: 'POST /solucoes/molaridade',
      url: `${mathUrl}/solucoes/molaridade`,
      method: 'POST',
      body: { soluto: 3, volume: 1.5 },
      check: (res) =>
        res.status === 200 &&
        res.body?.success === true &&
        typeof res.body?.data?.resultado === 'string' &&
        res.body.data.resultado.includes('2 mol/L'),
    },
    {
      name: 'POST /estatistica/media',
      url: `${mathUrl}/estatistica/media`,
      method: 'POST',
      body: { valores: [10, 20, 30, 40] },
      check: (res) => res.status === 200 && res.body?.success === true && res.body?.data?.resultado === 25,
    },
  ];
}

function buildLoginReadSpecs(loginUrl, user, fnId) {
  const headers = { Authorization: `Bearer ${user.accessToken}` };
  return [
    {
      name: 'GET /ready',
      url: `${loginUrl}/ready`,
      method: 'GET',
      check: (res) =>
        res.status === 200 &&
        res.body?.data?.status === 'READY' &&
        res.body?.data?.database === 'ok',
    },
    {
      name: 'GET /auth/me',
      url: `${loginUrl}/auth/me`,
      method: 'GET',
      headers,
      check: (res) => res.status === 200 && res.body?.success === true && Boolean(res.body?.data?.email),
    },
    {
      name: 'GET /favorites',
      url: `${loginUrl}/favorites`,
      method: 'GET',
      headers,
      check: (res) => res.status === 200 && Array.isArray(res.body?.data),
    },
    {
      name: 'GET /custom-functions',
      url: `${loginUrl}/custom-functions`,
      method: 'GET',
      headers,
      check: (res) => res.status === 200 && Array.isArray(res.body?.data),
    },
    {
      name: 'POST /custom-functions/:id/execute',
      url: `${loginUrl}/custom-functions/${fnId}/execute`,
      method: 'POST',
      headers,
      body: { valores: { m: 4, v: 3 } },
      check: (res) => res.status === 200 && res.body?.data?.resultado === 18,
    },
    {
      name: 'GET /historicos',
      url: `${loginUrl}/historicos`,
      method: 'GET',
      headers,
      check: (res) => res.status === 200 && Array.isArray(res.body?.data),
    },
  ];
}

async function runConcurrencyBurst({ loginUrl, mathUrl, serviceKey, burstSize }) {
  const userC = await createAndLoginUser(loginUrl, 'burst-c');
  const headersC = { Authorization: `Bearer ${userC.accessToken}` };

  // C1: 10x POST /favorites mesmo resource -> 1x 201 + 9x 409
  const favResourceId = `calc:esteq-burst-${randomBytes(3).toString('hex')}`;
  const c1Responses = await Promise.all(
    Array.from({ length: burstSize }, () =>
      requestJson(`${loginUrl}/favorites`, {
        method: 'POST',
        headers: headersC,
        body: {
          resourceId: favResourceId,
          resourceType: 'calculation',
          nome: 'Balanceamento Estequiométrico',
        },
      }),
    ),
  );
  const favList = await requestJson(`${loginUrl}/favorites`, { headers: headersC });
  const matchingFavs = (favList.body?.data || []).filter((f) => f.resourceId === favResourceId);
  const c1 = {
    requests: c1Responses.length,
    created201: c1Responses.filter((r) => r.status === 201).length,
    conflict409: c1Responses.filter((r) => r.status === 409).length,
    otherStatuses: c1Responses.filter((r) => r.status !== 201 && r.status !== 409).map((r) => r.status),
    storedCountForResource: matchingFavs.length,
    passed:
      c1Responses.filter((r) => r.status === 201).length === 1 &&
      c1Responses.filter((r) => r.status === 409).length === burstSize - 1 &&
      matchingFavs.length === 1,
  };

  // C2: 10x POST /custom-functions/:id/execute -> 10x 200 e usos +10
  const createdFn = await requestJson(`${loginUrl}/custom-functions`, {
    method: 'POST',
    headers: headersC,
    body: {
      nome: `Energia Cinetica ${randomBytes(3).toString('hex')}`,
      categoria: 'fisica',
      tipo: 'formula',
      parametros: [
        { nome: 'm', tipo: 'number', obrigatorio: true },
        { nome: 'v', tipo: 'number', obrigatorio: true },
      ],
      formula: '0.5 * m * (v ^ 2)',
    },
  });
  if (createdFn.status !== 201) {
    throw new Error(`Falha ao criar função no Bloco C2: ${createdFn.status} ${createdFn.raw}`);
  }
  const fnId = createdFn.body.data.id;
  const c2Responses = await Promise.all(
    Array.from({ length: burstSize }, () =>
      requestJson(`${loginUrl}/custom-functions/${fnId}/execute`, {
        method: 'POST',
        headers: headersC,
        body: { valores: { m: 4, v: 3 } },
      }),
    ),
  );
  const fnAfter = await requestJson(`${loginUrl}/custom-functions/${fnId}`, { headers: headersC });
  const c2 = {
    requests: c2Responses.length,
    ok200: c2Responses.filter((r) => r.status === 200 && r.body?.data?.resultado === 18).length,
    finalUsos: fnAfter.body?.data?.usos ?? null,
    passed:
      c2Responses.filter((r) => r.status === 200 && r.body?.data?.resultado === 18).length === burstSize &&
      fnAfter.body?.data?.usos === burstSize,
  };

  // C3: 10x POST /historicos -> 10x 201 + 10 registros persistidos
  // HistoricoSchema define valores como String; serializamos JSON explicitamente.
  const c3Responses = await Promise.all(
    Array.from({ length: burstSize }, (_, idx) =>
      requestJson(`${loginUrl}/historicos`, {
        method: 'POST',
        headers: headersC,
        body: {
          tipo: 'benchmark-c3',
          valores: JSON.stringify({ idx, temperatura: 20 + idx }),
          resultado: { valor: idx * 2 },
        },
      }),
    ),
  );
  const histAfter = await requestJson(`${loginUrl}/historicos?limit=100`, { headers: headersC });
  const c3Count = (histAfter.body?.data || []).filter((h) => h.tipo === 'benchmark-c3').length;
  const c3 = {
    requests: c3Responses.length,
    created201: c3Responses.filter((r) => r.status === 201).length,
    persistedMatching: c3Count,
    passed: c3Responses.filter((r) => r.status === 201).length === burstSize && c3Count === burstSize,
  };

  // C4: Fluxo completo READ_ONCE -> 10x POST /iot/internal/measurements idempotentes
  const deviceC4 = await registerAndPairDevice(loginUrl, userC.accessToken, 'Estacao C4');
  const reqC4 = await requestJson(`${loginUrl}/iot/devices/${deviceC4.deviceId}/requests`, {
    method: 'POST',
    headers: { ...headersC, 'Idempotency-Key': randomUUID() },
  });
  await requestJson(`${loginUrl}/iot/internal/dispatch`, {
    method: 'POST',
    headers: { 'x-ceos-service-key': serviceKey },
    body: {},
  });
  const cmds = await requestJson(`${loginUrl}/iot/device/commands`, {
    headers: {
      'x-ceos-device-id': deviceC4.deviceId,
      Authorization: `Bearer ${deviceC4.deviceToken}`,
    },
  });
  const cmd = cmds.body?.data?.[0];
  await requestJson(`${loginUrl}/iot/device/commands/${cmd.requestId}/ack`, {
    method: 'POST',
    headers: {
      'x-ceos-device-id': deviceC4.deviceId,
      Authorization: `Bearer ${deviceC4.deviceToken}`,
    },
    body: { leaseToken: cmd.leaseToken },
  });
  const eventId = randomUUID();
  const prepared = await requestJson(`${loginUrl}/iot/internal/prepare`, {
    method: 'POST',
    headers: { 'x-ceos-service-key': serviceKey },
    body: {
      deviceToken: deviceC4.deviceToken,
      event: {
        deviceId: deviceC4.deviceId,
        eventId,
        requestId: cmd.requestId,
        leaseToken: cmd.leaseToken,
        measurements: [
          { sensorId: 'temp', valor: 24 },
          { sensorId: 'humid', valor: 40 },
        ],
      },
    },
  });
  const c4Responses = await Promise.all(
    Array.from({ length: burstSize }, () =>
      requestJson(`${loginUrl}/iot/internal/measurements`, {
        method: 'POST',
        headers: { 'x-ceos-service-key': serviceKey },
        body: prepared.body.data,
      }),
    ),
  );
  const storedC4 = await requestJson(`${loginUrl}/iot/measurements?eventId=${eventId}`, {
    headers: headersC,
  });
  const reqC4Status = await requestJson(`${loginUrl}/iot/requests/${cmd.requestId}`, {
    headers: headersC,
  });
  const dewPointCheck = await requestJson(`${mathUrl}/termologia/ponto-de-orvalho`, {
    method: 'POST',
    body: { temperatura: 24, umidadeRelativa: 40 },
  });
  const c4 = {
    requests: c4Responses.length,
    ok200: c4Responses.filter((r) => r.status === 200).length,
    otherStatuses: c4Responses.filter((r) => r.status !== 200).map((r) => r.status),
    persistedMeasurementsForEvent: storedC4.body?.pagination?.total ?? null,
    requestFinalStatus: reqC4Status.body?.data?.status ?? null,
    dewPointCalculated: dewPointCheck.body?.data?.pontoOrvalho ?? null,
    passed:
      reqC4.status === 202 &&
      prepared.status === 200 &&
      c4Responses.filter((r) => r.status === 200).length === burstSize &&
      storedC4.body?.pagination?.total === 2 &&
      reqC4Status.body?.data?.status === 'COMPLETED',
  };

  // C5: Concorrência em POST /iot/devices/:deviceId/requests (respeitando rate de 10 reqs/usuário)
  // Dispara 9 requisições simultâneas: 2 com a mesma Idempotency-Key + 7 chaves distintas.
  const userC5 = await createAndLoginUser(loginUrl, 'burst-c5');
  const headersC5 = { Authorization: `Bearer ${userC5.accessToken}` };
  const deviceC5 = await registerAndPairDevice(loginUrl, userC5.accessToken, 'Estacao C5');
  const sharedKey = randomUUID();
  const c5Keys = [sharedKey, sharedKey, ...Array.from({ length: 7 }, () => randomUUID())];
  const c5Responses = await Promise.all(
    c5Keys.map((key) =>
      requestJson(`${loginUrl}/iot/devices/${deviceC5.deviceId}/requests`, {
        method: 'POST',
        headers: { ...headersC5, 'Idempotency-Key': key },
      }),
    ),
  );
  const c5List = await requestJson(`${loginUrl}/iot/devices/${deviceC5.deviceId}/requests`, {
    headers: headersC5,
  });
  const c5Status202 = c5Responses.filter((r) => r.status === 202).length;
  const c5Status409 = c5Responses.filter((r) => r.status === 409).length;
  const c5Total = c5List.body?.data?.pagination?.total ?? null;
  const c5 = {
    requests: c5Responses.length,
    accepted202: c5Status202,
    conflict409: c5Status409,
    otherStatuses: c5Responses.filter((r) => r.status !== 202 && r.status !== 409).map((r) => r.status),
    createdReadRequestsTotal: c5Total,
    passed:
      c5Status202 >= 1 &&
      c5Status202 <= 2 &&
      c5Status202 + c5Status409 === c5Keys.length &&
      c5Total === 1,
  };

  return {
    c1FavoritesDuplicateBurst: c1,
    c2CustomFunctionExecuteAtomicUsage: c2,
    c3HistoricosConcurrentInsert: c3,
    c4IotIngestIdempotentBurst: c4,
    c5IotReadOnceLockAndIdempotency: c5,
  };
}

async function runConcurrentIntegrity(loginUrl) {
  // D1: Brute force concorrente (14 tentativas com senha errada -> 401 iniciais, 429 após limite 5)
  const bruteUser = await createAndLoginUser(loginUrl, 'brute-d1');
  const d1Wrong = await Promise.all(
    Array.from({ length: 14 }, () =>
      requestJson(`${loginUrl}/auth/login`, {
        method: 'POST',
        headers: { 'X-CEOS-Client': 'mobile' },
        body: { email: bruteUser.email, senha: 'SenhaErrada@999' },
      }),
    ),
  );
  const d1AfterLock = await requestJson(`${loginUrl}/auth/login`, {
    method: 'POST',
    headers: { 'X-CEOS-Client': 'mobile' },
    body: { email: bruteUser.email, senha: bruteUser.senha },
  });
  // BruteForceStore usa count > maxAttempts (maxAttempts = 5 permite até 6 respostas 401 antes do bloqueio 429).
  const unauthorized401 = d1Wrong.filter((r) => r.status === 401).length;
  const locked429 = d1Wrong.filter((r) => r.status === 429).length;
  const unexpected200Or5xx = d1Wrong.filter((r) => r.status === 200 || r.status >= 500).length;
  const d1 = {
    wrongAttempts: d1Wrong.length,
    unauthorized401,
    locked429,
    unexpected200Or5xx,
    validLoginWhileLockedStatus: d1AfterLock.status,
    passed:
      unauthorized401 >= 1 &&
      unauthorized401 <= 6 &&
      locked429 >= d1Wrong.length - 6 &&
      unauthorized401 + locked429 === d1Wrong.length &&
      unexpected200Or5xx === 0 &&
      d1AfterLock.status === 429,
  };

  // D2: Isolamento multiusuário A/B concorrente
  const [userA, userB] = await Promise.all([
    createAndLoginUser(loginUrl, 'tenant-a'),
    createAndLoginUser(loginUrl, 'tenant-b'),
  ]);
  const hdrA = { Authorization: `Bearer ${userA.accessToken}` };
  const hdrB = { Authorization: `Bearer ${userB.accessToken}` };

  const [fnA, fnB, favA, favB, devA, devB] = await Promise.all([
    requestJson(`${loginUrl}/custom-functions`, {
      method: 'POST',
      headers: hdrA,
      body: {
        nome: 'Funcao Privada A',
        categoria: 'matematica',
        tipo: 'formula',
        parametros: [{ nome: 'x', tipo: 'number', obrigatorio: true }],
        formula: 'x * 2',
      },
    }),
    requestJson(`${loginUrl}/custom-functions`, {
      method: 'POST',
      headers: hdrB,
      body: {
        nome: 'Funcao Privada B',
        categoria: 'matematica',
        tipo: 'formula',
        parametros: [{ nome: 'x', tipo: 'number', obrigatorio: true }],
        formula: 'x * 3',
      },
    }),
    requestJson(`${loginUrl}/favorites`, {
      method: 'POST',
      headers: hdrA,
      body: { resourceId: 'calc:priv-a', resourceType: 'calculation', nome: 'Priv A' },
    }),
    requestJson(`${loginUrl}/favorites`, {
      method: 'POST',
      headers: hdrB,
      body: { resourceId: 'calc:priv-b', resourceType: 'calculation', nome: 'Priv B' },
    }),
    registerAndPairDevice(loginUrl, userA.accessToken, 'Device A'),
    registerAndPairDevice(loginUrl, userB.accessToken, 'Device B'),
  ]);

  const fnAId = fnA.body.data.id;
  const fnBId = fnB.body.data.id;
  const favAId = favA.body.data.id;
  const favBId = favB.body.data.id;

  const crossChecks = await Promise.all([
    requestJson(`${loginUrl}/custom-functions/${fnAId}`, { headers: hdrB }),
    requestJson(`${loginUrl}/custom-functions/${fnBId}`, { headers: hdrA }),
    requestJson(`${loginUrl}/custom-functions/${fnAId}/execute`, {
      method: 'POST',
      headers: hdrB,
      body: { valores: { x: 5 } },
    }),
    requestJson(`${loginUrl}/favorites/${favAId}`, { method: 'DELETE', headers: hdrB }),
    requestJson(`${loginUrl}/favorites/${favBId}`, { method: 'DELETE', headers: hdrA }),
    requestJson(`${loginUrl}/iot/devices/${devA.deviceId}`, { headers: hdrB }),
    requestJson(`${loginUrl}/iot/devices/${devB.deviceId}`, { headers: hdrA }),
    requestJson(`${loginUrl}/iot/devices/${devA.deviceId}/dashboard`, { headers: hdrB }),
  ]);

  const [listFnA, listFnB, listFavA, listFavB] = await Promise.all([
    requestJson(`${loginUrl}/custom-functions`, { headers: hdrA }),
    requestJson(`${loginUrl}/custom-functions`, { headers: hdrB }),
    requestJson(`${loginUrl}/favorites`, { headers: hdrA }),
    requestJson(`${loginUrl}/favorites`, { headers: hdrB }),
  ]);

  const crossStatuses = crossChecks.map((r) => r.status);
  const leaked =
    (listFnA.body?.data || []).some((x) => x.id === fnBId) ||
    (listFnB.body?.data || []).some((x) => x.id === fnAId) ||
    (listFavA.body?.data || []).some((x) => x.id === favBId) ||
    (listFavB.body?.data || []).some((x) => x.id === favAId);

  const d2 = {
    crossAccessStatuses: crossStatuses,
    allDenied404: crossStatuses.every((s) => s === 404),
    crossTenantListLeakage: leaked,
    passed: crossStatuses.every((s) => s === 404) && !leaked,
  };

  return {
    d1ConcurrentBruteForceLock: d1,
    d2ConcurrentMultiTenantIsolation: d2,
  };
}

async function runCoordinator(args) {
  const durationMs = Number(args['duration-ms'] || 2500);
  const loginDurationMs = Number(args['login-duration-ms'] || 2000);
  const burstSize = Number(args['burst-size'] || 10);
  const bcryptRounds = Number(args['bcrypt-rounds'] || 10);
  const vuProfiles = (args.vus || '1,5,10')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  let mathWorker = null;
  let mathUrl = args['math-url'] || null;
  if (!mathUrl) {
    const mathExtra = args['math-app-path'] ? ['--math-app-path', args['math-app-path']] : [];
    mathWorker = await spawnWorker('math', mathExtra);
    mathUrl = mathWorker.info.baseUrl;
  }

  const loginWorker = await spawnWorker('login', ['--bcrypt-rounds', String(bcryptRounds)]);
  const loginUrl = loginWorker.info.baseUrl;
  const serviceKey = loginWorker.info.serviceKey;

  try {
    // Setup dedicado para Bloco B1 e B2
    const loadUser = await createAndLoginUser(loginUrl, 'load-b');
    const hdrLoad = { Authorization: `Bearer ${loadUser.accessToken}` };
    const createdFn = await requestJson(`${loginUrl}/custom-functions`, {
      method: 'POST',
      headers: hdrLoad,
      body: {
        nome: 'Energia Cinetica Load',
        categoria: 'fisica',
        tipo: 'formula',
        parametros: [
          { nome: 'm', tipo: 'number', obrigatorio: true },
          { nome: 'v', tipo: 'number', obrigatorio: true },
        ],
        formula: '0.5 * m * (v ^ 2)',
      },
    });
    const loadFnId = createdFn.body.data.id;
    await requestJson(`${loginUrl}/favorites`, {
      method: 'POST',
      headers: hdrLoad,
      body: { resourceId: `custom:${loadFnId}`, resourceType: 'custom-function', nome: 'Fav Load' },
    });
    const maxVus = Math.max(...vuProfiles);
    // Pool de usuários distintos por VU no Bloco B2 evita colisão em reserveAttempt()
    // quando mais de 5 logins simultâneos usam o mesmo email durante bcrypt.
    const loginPool = await Promise.all(
      Array.from({ length: maxVus }, (_, idx) => createAndLoginUser(loginUrl, `login-b2-${idx}`)),
    );
    await requestJson(`${loginUrl}/historicos`, {
      method: 'POST',
      headers: hdrLoad,
      body: { tipo: 'warmup-seed', valores: JSON.stringify({ x: 1 }), resultado: { y: 2 } },
    });

    const mathSpecs = buildMathSpecs(mathUrl);
    const loginReadSpecs = buildLoginReadSpecs(loginUrl, loadUser, loadFnId);

    // Warm-up explícito e descartado das estatísticas
    const warmupResults = [];
    for (const spec of [...mathSpecs, ...loginReadSpecs]) {
      const res = await requestJson(spec.url, spec);
      warmupResults.push({ name: spec.name, ok: spec.check(res), status: res.status });
    }
    const loginWarmup = await requestJson(`${loginUrl}/auth/login`, {
      method: 'POST',
      headers: { 'X-CEOS-Client': 'mobile' },
      body: { email: loadUser.email, senha: loadUser.senha },
    });
    warmupResults.push({ name: 'POST /auth/login', ok: loginWarmup.status === 200, status: loginWarmup.status });

    const blockAMath = [];
    for (const vus of vuProfiles) {
      blockAMath.push(
        await runLoadProfile({
          label: `MathAPI ${vus} VU${vus > 1 ? 's' : ''}`,
          vus,
          durationMs,
          buildRequest: (vu, step) => mathSpecs[(vu + step) % mathSpecs.length],
          workers: { mathapi: mathWorker },
        }),
      );
    }

    const blockB1LoginRead = [];
    for (const vus of vuProfiles) {
      blockB1LoginRead.push(
        await runLoadProfile({
          label: `LoginAPICeos Auth/CRUD Reads ${vus} VU${vus > 1 ? 's' : ''}`,
          vus,
          durationMs,
          buildRequest: (vu, step) => loginReadSpecs[(vu + step) % loginReadSpecs.length],
          workers: { loginapi: loginWorker },
        }),
      );
    }

    const blockB2LoginBcrypt = [];
    for (const vus of vuProfiles) {
      blockB2LoginBcrypt.push(
        await runLoadProfile({
          label: `LoginAPICeos POST /auth/login (bcrypt ${bcryptRounds}) ${vus} VU${vus > 1 ? 's' : ''}`,
          vus,
          durationMs: loginDurationMs,
          buildRequest: (vu) => {
            const account = loginPool[vu % loginPool.length];
            return {
              name: 'POST /auth/login',
              url: `${loginUrl}/auth/login`,
              method: 'POST',
              headers: { 'X-CEOS-Client': 'mobile' },
              body: { email: account.email, senha: account.senha },
              check: (res) => res.status === 200 && Boolean(res.body?.data?.accessToken),
            };
          },
          workers: { loginapi: loginWorker },
        }),
      );
    }

    const blockCBurst = await measureStage(
      'LoginAPICeos Persistence Concurrency Bursts',
      { mathapi: mathWorker, loginapi: loginWorker },
      () => runConcurrencyBurst({ loginUrl, mathUrl, serviceKey, burstSize }),
    );

    const blockDIntegrity = await measureStage(
      'LoginAPICeos Concurrent Security & Tenant Integrity',
      { loginapi: loginWorker },
      () => runConcurrentIntegrity(loginUrl),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        isolation: 'separate-child-processes-with-local-mongodb-memory-server',
        mathApiAppPath: mathWorker ? mathWorker.info.appPath : mathUrl,
        bcryptRounds,
        vuProfiles,
        durationMs,
        loginDurationMs,
        burstSize,
        warmupDiscarded: true,
        warmupRequestsCount: warmupResults.length,
        warmupAllOk: warmupResults.every((r) => r.ok),
      },
      blockA_mathApi: blockAMath,
      blockB1_loginApiAuthCrud: blockB1LoginRead,
      blockB2_loginApiBcryptAuth: blockB2LoginBcrypt,
      blockC_persistenceBursts: blockCBurst,
      blockD_concurrentIntegrity: blockDIntegrity,
    };

    if (args.out) {
      const outPath = path.resolve(args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    const allProfilesPass =
      [...blockAMath, ...blockB1LoginRead, ...blockB2LoginBcrypt].every(
        (p) => p.checkFailures === 0 && p.connectionFailures === 0 && p.httpErrors === 0,
      ) &&
      Object.values(blockCBurst)
        .filter((v) => v && typeof v === 'object' && 'passed' in v)
        .every((v) => v.passed) &&
      Object.values(blockDIntegrity)
        .filter((v) => v && typeof v === 'object' && 'passed' in v)
        .every((v) => v.passed);

    console.log(JSON.stringify(report, null, 2));
    if (!allProfilesPass) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.all([
      mathWorker ? mathWorker.stop() : Promise.resolve(),
      loginWorker.stop(),
    ]);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.worker) {
    await runWorker(args.worker, {
      mathAppPath: args['math-app-path'],
      bcryptRounds: args['bcrypt-rounds'],
      serviceKey: args['service-key'],
    });
    return;
  }
  await runCoordinator(args);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
