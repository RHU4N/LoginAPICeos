import http from 'k6/http';
import { check, sleep } from 'k6';

const vus = __ENV.K6_VUS ? parseInt(__ENV.K6_VUS, 10) : 10;
const duration = __ENV.K6_DURATION || '15s';
const sleepSeconds = __ENV.K6_SLEEP_MS ? parseFloat(__ENV.K6_SLEEP_MS) / 1000 : 0.1;

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const baseUrl = (__ENV.TARGET_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');

export function setup() {
  const uniqueEmail = `k6-${Date.now()}-${Math.floor(Math.random() * 100000)}@ceos.test`;
  const password = __ENV.K6_TEST_PASSWORD || 'K6Bench!2026#Safe';
  const createRes = http.post(
    `${baseUrl}/users`,
    JSON.stringify({
      nome: 'Benchmark K6',
      email: uniqueEmail,
      senha: password,
      confirmaSenha: password,
      telefone: '11999990000',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(createRes, {
    'setup user 201': (r) => r.status === 201,
  });

  const loginRes = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email: uniqueEmail, senha: password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CEOS-Client': 'mobile',
      },
    },
  );
  check(loginRes, {
    'setup login 200': (r) => r.status === 200 && Boolean(r.json('data.accessToken')),
  });

  return {
    token: loginRes.json('data.accessToken'),
    email: uniqueEmail,
  };
}

export default function (data) {
  const healthRes = http.get(`${baseUrl}/health`);
  check(healthRes, {
    'health 200': (r) => r.status === 200 && r.json('success') === true,
  });

  const readyRes = http.get(`${baseUrl}/ready`);
  check(readyRes, {
    'ready 200': (r) => r.status === 200 && r.json('data.status') === 'READY' && r.json('data.database') === 'ok',
  });

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'X-CEOS-Client': 'mobile',
    },
  };

  const meRes = http.get(`${baseUrl}/auth/me`, authHeaders);
  check(meRes, {
    'auth me 200': (r) => r.status === 200 && r.json('data.email') === data.email,
  });

  const favRes = http.get(`${baseUrl}/favorites`, authHeaders);
  check(favRes, {
    'favorites 200': (r) => r.status === 200 && r.json('success') === true,
  });

  const cfRes = http.get(`${baseUrl}/custom-functions`, authHeaders);
  check(cfRes, {
    'custom-functions 200': (r) => r.status === 200 && r.json('success') === true,
  });

  if (sleepSeconds > 0) sleep(sleepSeconds);
}
