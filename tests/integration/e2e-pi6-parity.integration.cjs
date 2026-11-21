const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID, randomBytes } = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString('hex');
process.env.CEOS_IOT_COMMANDS_ENABLED = 'true';

const mathApiAppPath = path.resolve(__dirname, '../../../MathAPI/app.js');

function startHttpServer(expressApp) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(expressApp);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function stopHttpServer(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
}

function extractCookies(response) {
  const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  return raw
    .map((entry) => entry.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function httpJson(url, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, headers: response.headers, body: json };
}

let mongo;
let loginServer;
let mathServer;
let loginUrl;
let mathUrl;

const webOrigin = 'http://localhost:3000';
const userA = {
  nome: 'Usuário Paridade A',
  email: 'paridade.a@ceos.test',
  senha: 'Password1!',
  confirmaSenha: 'Password1!',
  telefone: '11999990001',
};
const userB = {
  nome: 'Usuário Isolado B',
  email: 'isolado.b@ceos.test',
  senha: 'Password2!',
  confirmaSenha: 'Password2!',
  telefone: '11999990002',
};

let webCookieA = '';
let mobileTokenA = '';
let mobileRefreshA = '';
let mobileTokenB = '';

before(async () => {
  if (!fs.existsSync(mathApiAppPath)) {
    throw new Error(`MathAPI não encontrada em ${mathApiAppPath}`);
  }
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'ceos_e2e_pi6_' + randomBytes(6).toString('hex');
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGODB_DATABASE });

  const loginApp = require('../../index');
  const { createApp: createMathApp } = require(mathApiAppPath);

  const iotModels = Object.values(require('../../src/domain/entities/IoTPlatform'));
  for (const Model of iotModels) {
    await Model.createIndexes();
  }

  const startedLogin = await startHttpServer(loginApp);
  loginServer = startedLogin.server;
  loginUrl = startedLogin.baseUrl;

  const startedMath = await startHttpServer(createMathApp());
  mathServer = startedMath.server;
  mathUrl = startedMath.baseUrl;

  const regA = await httpJson(`${loginUrl}/users`, { method: 'POST', body: userA });
  assert.equal(regA.status, 201);
  const regB = await httpJson(`${loginUrl}/users`, { method: 'POST', body: userB });
  assert.equal(regB.status, 201);

  const webLoginA = await httpJson(`${loginUrl}/auth/login`, {
    method: 'POST',
    headers: { Origin: webOrigin },
    body: { email: userA.email, senha: userA.senha },
  });
  assert.equal(webLoginA.status, 200);
  webCookieA = extractCookies(webLoginA);
  assert.ok(webCookieA.includes('accessToken='), 'Cookie Web accessToken deve ser emitido');

  const mobLoginA = await httpJson(`${loginUrl}/auth/login`, {
    method: 'POST',
    headers: { 'X-CEOS-Client': 'mobile' },
    body: { email: userA.email, senha: userA.senha },
  });
  assert.equal(mobLoginA.status, 200);
  mobileTokenA = mobLoginA.body.data.accessToken;
  mobileRefreshA = mobLoginA.body.data.refreshToken;
  assert.ok(mobileTokenA && mobileRefreshA);

  const mobLoginB = await httpJson(`${loginUrl}/auth/login`, {
    method: 'POST',
    headers: { 'X-CEOS-Client': 'mobile' },
    body: { email: userB.email, senha: userB.senha },
  });
  assert.equal(mobLoginB.status, 200);
  mobileTokenB = mobLoginB.body.data.accessToken;
  assert.ok(mobileTokenB);
}, { timeout: 180000 });

after(async () => {
  await stopHttpServer(loginServer);
  await stopHttpServer(mathServer);
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('Química (Estequiometria, Termoquímica, Soluções) e regressão via HTTP real da MathAPI', async () => {
  const bal = await httpJson(`${mathUrl}/estequiometria/balanceamento`, {
    method: 'POST',
    body: { equacao: 'H2 + O2 -> H2O' },
  });
  assert.equal(bal.status, 200);
  assert.equal(bal.body.data.equacaoBalanceada, '2 H2 + O2 -> 2 H2O');

  const balCa = await httpJson(`${mathUrl}/estequiometria/balanceamento`, {
    method: 'POST',
    body: { equacao: 'CaCO3 -> CaO + CO2' },
  });
  assert.equal(balCa.status, 200);
  assert.equal(balCa.body.data.equacaoBalanceada, 'CaCO3 -> CaO + CO2');

  const mm = await httpJson(`${mathUrl}/estequiometria/massa-molar`, {
    method: 'POST',
    body: { formula: 'H2O' },
  });
  assert.equal(mm.status, 200);
  assert.ok(Math.abs(mm.body.data.valor - 18.015) < 0.05);

  const conv = await httpJson(`${mathUrl}/estequiometria/conversao`, {
    method: 'POST',
    body: { direcao: 'gramas-para-mols', formula: 'H2O', massa: 36.03 },
  });
  assert.equal(conv.status, 200);
  assert.ok(Math.abs(conv.body.data.valor - 2) < 0.01);

  const prop = await httpJson(`${mathUrl}/estequiometria/proporcao-molar`, {
    method: 'POST',
    body: { equacao: 'H2 + O2 -> H2O', especieOrigem: 'H2', especieDestino: 'O2', quantidadeMols: 4 },
  });
  assert.equal(prop.status, 200);
  assert.equal(prop.body.data.molsDestino, 2);

  const massaT = await httpJson(`${mathUrl}/estequiometria/massa-teorica`, {
    method: 'POST',
    body: { equacao: 'H2 + O2 -> H2O', reagente: 'O2', produto: 'H2O', molsReagente: 1 },
  });
  assert.equal(massaT.status, 200);
  assert.ok(Math.abs(massaT.body.data.massaTeoricaG - 36.03) < 0.05);

  const lim = await httpJson(`${mathUrl}/estequiometria/reagente-limitante`, {
    method: 'POST',
    body: {
      equacao: 'H2 + O2 -> H2O',
      reagentes: [
        { formula: 'H2', mols: 2 },
        { formula: 'O2', mols: 2 },
      ],
    },
  });
  assert.equal(lim.status, 200);
  assert.equal(lim.body.data.reagenteLimitante, 'H2');

  const calor = await httpJson(`${mathUrl}/termoquimica/calor-sensivel`, {
    method: 'POST',
    body: { massa: 200, calorEspecifico: 4.18, temperaturaInicial: 20, temperaturaFinal: 30 },
  });
  assert.equal(calor.status, 200);
  assert.equal(calor.body.data.valorJ, 8360);
  assert.equal(calor.body.data.valorKJ, 8.36);
  assert.equal(calor.body.data.processo, 'endotermico');

  const varT = await httpJson(`${mathUrl}/termoquimica/variacao-temperatura`, {
    method: 'POST',
    body: { calor: 8360, massa: 200, calorEspecifico: 4.18, temperaturaInicial: 20 },
  });
  assert.equal(varT.status, 200);
  assert.equal(varT.body.data.deltaT, 10);
  assert.equal(varT.body.data.temperaturaFinal, 30);

  const entForm = await httpJson(`${mathUrl}/termoquimica/entalpia-formacao`, {
    method: 'POST',
    body: {
      reagentes: [
        { substancia: 'CH4', coeficiente: 1, entalpiaFormacao: -74.8 },
        { substancia: 'O2', coeficiente: 2, entalpiaFormacao: 0 },
      ],
      produtos: [
        { substancia: 'CO2', coeficiente: 1, entalpiaFormacao: -393.5 },
        { substancia: 'H2O', coeficiente: 2, entalpiaFormacao: -285.8 },
      ],
    },
  });
  assert.equal(entForm.status, 200);
  assert.equal(entForm.body.data.processo, 'exotermico');
  assert.ok(Math.abs(entForm.body.data.deltaH - (-890.3)) < 0.05);

  const dens = await httpJson(`${mathUrl}/solucoes/densidade`, {
    method: 'POST',
    body: { massa: 10, volume: 2 },
  });
  assert.equal(dens.status, 200);
  assert.ok(dens.body.data.resultado.includes('5 g/mL'));

  const linear = await httpJson(`${mathUrl}/funcao/linear`, {
    method: 'POST',
    body: { a: 2, b: 3, x: 4 },
  });
  assert.equal(linear.status, 200);
  assert.equal(linear.body.data.resultado, 11);
});

test('Fluxo IoT READ_ONCE -> evento completo -> Ponto de Orvalho (MathAPI) -> Histórico e isolamento', async () => {
  const webHeaders = { Cookie: webCookieA, Origin: webOrigin };
  const mobHeadersA = { Authorization: `Bearer ${mobileTokenA}` };
  const mobHeadersB = { Authorization: `Bearer ${mobileTokenB}` };
  const serviceHeaders = { 'x-ceos-service-key': process.env.CEOS_SERVICE_KEY };

  const regDevice = await httpJson(`${loginUrl}/iot/devices`, {
    method: 'POST',
    headers: webHeaders,
    body: {
      nome: 'Estação Lab PI6',
      descricao: 'ESP32 DHT22 + BMP180',
      sensores: [
        { sensorId: 'dht22-temperatura', nome: 'Temp DHT22', tipo: 'temperatura', unidade: 'C' },
        { sensorId: 'dht22-umidade', nome: 'Umid DHT22', tipo: 'umidade', unidade: '%' },
        { sensorId: 'bmp180-temperatura', nome: 'Temp BMP180', tipo: 'temperatura', unidade: 'C' },
        { sensorId: 'bmp180-pressao', nome: 'Pressão BMP180', tipo: 'pressao', unidade: 'hPa' },
      ],
      capacidades: {
        supportsPush: true,
        supportsOnDemand: true,
        supportsCommandPolling: true,
        supportsMultipleSensors: true,
      },
    },
  });
  assert.equal(regDevice.status, 201);
  const { device, provisioningToken } = regDevice.body.data;

  const pair = await httpJson(`${loginUrl}/iot/device/pair`, {
    method: 'POST',
    body: { deviceId: device.deviceId, provisioningToken },
  });
  assert.equal(pair.status, 200);
  const deviceToken = pair.body.data.deviceToken;
  const deviceHeaders = {
    'x-ceos-device-id': device.deviceId,
    Authorization: `Bearer ${deviceToken}`,
  };

  const readReq = await httpJson(`${loginUrl}/iot/devices/${device.deviceId}/requests`, {
    method: 'POST',
    headers: { ...webHeaders, 'Idempotency-Key': randomUUID() },
    body: {},
  });
  assert.equal(readReq.status, 202);
  const requestId = readReq.body.data.requestId;

  const dispatch = await httpJson(`${loginUrl}/iot/internal/dispatch`, {
    method: 'POST',
    headers: serviceHeaders,
    body: {},
  });
  assert.equal(dispatch.status, 200);

  const commands = await httpJson(`${loginUrl}/iot/device/commands`, { headers: deviceHeaders });
  assert.equal(commands.status, 200);
  assert.equal(commands.body.data.length, 1);
  const { leaseToken } = commands.body.data[0];

  const ack = await httpJson(`${loginUrl}/iot/device/commands/${requestId}/ack`, {
    method: 'POST',
    headers: deviceHeaders,
    body: { leaseToken },
  });
  assert.equal(ack.status, 200);

  const eventId = randomUUID();
  const collectedAt = new Date().toISOString();
  const prepare = await httpJson(`${loginUrl}/iot/internal/prepare`, {
    method: 'POST',
    headers: serviceHeaders,
    body: {
      deviceToken,
      event: {
        eventId,
        deviceId: device.deviceId,
        requestId,
        leaseToken,
        measurements: [
          { sensorId: 'dht22-temperatura', valor: 24, collectedAt },
          { sensorId: 'dht22-umidade', valor: 40, collectedAt },
          { sensorId: 'bmp180-temperatura', valor: 24.4, collectedAt },
          { sensorId: 'bmp180-pressao', valor: 1013.2, collectedAt },
        ],
      },
    },
  });
  assert.equal(prepare.status, 200);

  const ingest = await httpJson(`${loginUrl}/iot/internal/measurements`, {
    method: 'POST',
    headers: serviceHeaders,
    body: prepare.body.data,
  });
  assert.equal(ingest.status, 200);
  assert.equal(ingest.body.data.persisted, 4);

  const reqStatus = await httpJson(`${loginUrl}/iot/requests/${requestId}`, { headers: mobHeadersA });
  assert.equal(reqStatus.status, 200);
  assert.equal(reqStatus.body.data.status, 'COMPLETED');
  assert.equal(reqStatus.body.data.resultEventId, eventId);

  const evResp = await httpJson(`${loginUrl}/iot/events/${eventId}`, { headers: mobHeadersA });
  assert.equal(evResp.status, 200);
  assert.equal(evResp.body.data.length, 4);

  const tempDht = evResp.body.data.find((m) => m.sensorId === 'dht22-temperatura');
  const humDht = evResp.body.data.find((m) => m.sensorId === 'dht22-umidade');

  const dew = await httpJson(`${mathUrl}/termologia/ponto-de-orvalho`, {
    method: 'POST',
    body: { temperatura: tempDht.valor, umidadeRelativa: humDht.valor, origem: 'iot' },
  });
  assert.equal(dew.status, 200);
  assert.ok(Math.abs(dew.body.data.pontoOrvalho - 9.56) < 0.05);

  const saveHist = await httpJson(`${loginUrl}/historicos`, {
    method: 'POST',
    headers: webHeaders,
    body: {
      tipo: 'Fisica:Termologia:PontoDeOrvalho',
      valores: `origem=iot, deviceId=${device.deviceId}, eventId=${eventId}, temperatura=${tempDht.valor}, umidadeRelativa=${humDht.valor}`,
      resultado: dew.body.data.resultado,
    },
  });
  assert.equal(saveHist.status, 201);

  const mobHist = await httpJson(`${loginUrl}/historicos`, { headers: mobHeadersA });
  assert.equal(mobHist.status, 200);
  assert.ok(mobHist.body.data.some((h) => h.tipo === 'Fisica:Termologia:PontoDeOrvalho'));

  // Isolamento de dados IoT entre usuários
  const otherEvent = await httpJson(`${loginUrl}/iot/events/${eventId}`, { headers: mobHeadersB });
  assert.equal(otherEvent.status, 404);
  const otherDevices = await httpJson(`${loginUrl}/iot/devices`, { headers: mobHeadersB });
  assert.equal(otherDevices.status, 200);
  assert.equal(otherDevices.body.data.length, 0);
});

test('Paridade Web <-> Mobile em Favoritos e Funções Personalizadas + Refresh Token', async () => {
  const webHeaders = { Cookie: webCookieA, Origin: webOrigin };
  const mobHeadersA = { Authorization: `Bearer ${mobileTokenA}` };
  const mobHeadersB = { Authorization: `Bearer ${mobileTokenB}` };

  // 1) Web adiciona favorito -> Mobile consulta e remove -> Web confirma remoção
  const addWeb = await httpJson(`${loginUrl}/favorites`, {
    method: 'POST',
    headers: webHeaders,
    body: {
      resourceId: 'calc:fisica:termologia:ponto-de-orvalho',
      resourceType: 'calculation',
      nome: 'Ponto de Orvalho',
      descricao: 'Fórmula de Magnus (Manual e IoT)',
    },
  });
  assert.equal(addWeb.status, 201);
  const favId1 = addWeb.body.data.id;

  const listMob = await httpJson(`${loginUrl}/favorites`, { headers: mobHeadersA });
  assert.equal(listMob.status, 200);
  assert.ok(listMob.body.data.some((f) => f.id === favId1 && f.resourceId === 'calc:fisica:termologia:ponto-de-orvalho'));

  const dupMob = await httpJson(`${loginUrl}/favorites`, {
    method: 'POST',
    headers: mobHeadersA,
    body: {
      resourceId: 'calc:fisica:termologia:ponto-de-orvalho',
      resourceType: 'calculation',
      nome: 'Ponto de Orvalho',
    },
  });
  assert.equal(dupMob.status, 409);

  const delOther = await httpJson(`${loginUrl}/favorites/${favId1}`, {
    method: 'DELETE',
    headers: mobHeadersB,
  });
  assert.equal(delOther.status, 404);

  const delMob = await httpJson(`${loginUrl}/favorites/${favId1}`, {
    method: 'DELETE',
    headers: mobHeadersA,
  });
  assert.equal(delMob.status, 204);

  const listWebAfter = await httpJson(`${loginUrl}/favorites`, { headers: webHeaders });
  assert.equal(listWebAfter.status, 200);
  assert.ok(!listWebAfter.body.data.some((f) => f.id === favId1));

  // Sentido inverso: Mobile adiciona -> Web remove -> Mobile confirma
  const addMob = await httpJson(`${loginUrl}/favorites`, {
    method: 'POST',
    headers: mobHeadersA,
    body: {
      resourceId: 'calc:quimica:estequiometria',
      resourceType: 'calculation',
      nome: 'Estequiometria',
    },
  });
  assert.equal(addMob.status, 201);
  const favId2 = addMob.body.data.id;

  const delWeb = await httpJson(`${loginUrl}/favorites/${favId2}`, {
    method: 'DELETE',
    headers: webHeaders,
  });
  assert.equal(delWeb.status, 204);

  const listMobAfter = await httpJson(`${loginUrl}/favorites`, { headers: mobHeadersA });
  assert.ok(!listMobAfter.body.data.some((f) => f.id === favId2));

  // 2) Funções personalizadas: Web cria -> Mobile executa e edita -> Web executa versão editada -> Mobile cria -> Web executa -> Delete
  const valRes = await httpJson(`${loginUrl}/custom-functions/validate`, {
    method: 'POST',
    headers: webHeaders,
    body: {
      formula: '0.5 * m * v^2',
      parametros: [
        { nome: 'm', tipo: 'number', obrigatorio: true },
        { nome: 'v', tipo: 'number', obrigatorio: true },
      ],
    },
  });
  assert.equal(valRes.status, 200);
  assert.equal(valRes.body.data.valida, true);

  const createWebFn = await httpJson(`${loginUrl}/custom-functions`, {
    method: 'POST',
    headers: webHeaders,
    body: {
      nome: 'Energia Cinética Web',
      descricao: 'Teste paridade Web -> Mobile',
      categoria: 'fisica',
      tipo: 'formula',
      formula: '0.5 * m * v^2',
      parametros: [
        { nome: 'm', tipo: 'number', obrigatorio: true },
        { nome: 'v', tipo: 'number', obrigatorio: true },
      ],
    },
  });
  assert.equal(createWebFn.status, 201);
  const fnId = createWebFn.body.data.id;

  const execMob1 = await httpJson(`${loginUrl}/custom-functions/${fnId}/execute`, {
    method: 'POST',
    headers: mobHeadersA,
    body: { valores: { m: 4, v: 3 } },
  });
  assert.equal(execMob1.status, 200);
  assert.equal(execMob1.body.data.resultado, 18);
  assert.equal(execMob1.body.data.usos, 1);

  const patchMob = await httpJson(`${loginUrl}/custom-functions/${fnId}`, {
    method: 'PATCH',
    headers: mobHeadersA,
    body: {
      nome: 'Energia Cinética + Off',
      formula: '0.5 * m * v^2 + c',
      parametros: [
        { nome: 'm', tipo: 'number', obrigatorio: true },
        { nome: 'v', tipo: 'number', obrigatorio: true },
        { nome: 'c', tipo: 'number', obrigatorio: true },
      ],
    },
  });
  assert.equal(patchMob.status, 200);
  assert.equal(patchMob.body.data.nome, 'Energia Cinética + Off');

  const execWeb2 = await httpJson(`${loginUrl}/custom-functions/${fnId}/execute`, {
    method: 'POST',
    headers: webHeaders,
    body: { valores: { m: 4, v: 3, c: 2 } },
  });
  assert.equal(execWeb2.status, 200);
  assert.equal(execWeb2.body.data.resultado, 20);
  assert.equal(execWeb2.body.data.usos, 2);

  // Isolamento: User B não acessa nem executa função privada de User A
  const getB = await httpJson(`${loginUrl}/custom-functions/${fnId}`, { headers: mobHeadersB });
  assert.equal(getB.status, 404);
  const execB = await httpJson(`${loginUrl}/custom-functions/${fnId}/execute`, {
    method: 'POST',
    headers: mobHeadersB,
    body: { valores: { m: 4, v: 3, c: 2 } },
  });
  assert.equal(execB.status, 404);

  // Sentido inverso: Mobile cria função -> Web lista e executa -> Mobile exclui
  const createMobFn = await httpJson(`${loginUrl}/custom-functions`, {
    method: 'POST',
    headers: mobHeadersA,
    body: {
      nome: 'Densidade Mobile',
      categoria: 'quimica',
      tipo: 'formula',
      formula: 'm / v',
      parametros: [
        { nome: 'm', tipo: 'number', obrigatorio: true },
        { nome: 'v', tipo: 'number', obrigatorio: true },
      ],
    },
  });
  assert.equal(createMobFn.status, 201);
  const fnId2 = createMobFn.body.data.id;

  const execWebFn2 = await httpJson(`${loginUrl}/custom-functions/${fnId2}/execute`, {
    method: 'POST',
    headers: webHeaders,
    body: { valores: { m: 10, v: 2 } },
  });
  assert.equal(execWebFn2.status, 200);
  assert.equal(execWebFn2.body.data.resultado, 5);

  const delMobFn2 = await httpJson(`${loginUrl}/custom-functions/${fnId2}`, {
    method: 'DELETE',
    headers: mobHeadersA,
  });
  assert.equal(delMobFn2.status, 204);

  // Refresh token Mobile
  const ref = await httpJson(`${loginUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'X-CEOS-Client': 'mobile' },
    body: { refreshToken: mobileRefreshA },
  });
  assert.equal(ref.status, 200);
  assert.ok(ref.body.data.accessToken);
  const meAfterRefresh = await httpJson(`${loginUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${ref.body.data.accessToken}` },
  });
  assert.equal(meAfterRefresh.status, 200);
  assert.equal(meAfterRefresh.body.data.email, userA.email);
});
