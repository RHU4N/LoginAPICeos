// Smoke test: login -> use protected route -> logout -> protected route should fail
// Usage: set API_URL if needed, then: node smoke_tests/smoke_auth_logout.js

const API_URL = process.env.API_URL || 'http://localhost:8081';

function log(...args) { console.log('[smoke]', ...args); }

async function request(path, opts = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch (e) {}
  return { status: res.status, body, headers: res.headers };
}

async function run() {
  try {
    const unique = Date.now();
    const testUser = {
      nome: `smoke-${unique}`,
      email: `smoke_${unique}@example.com`,
      senha: 'test123',
      telefone: '00000-0000'
    };

    log('1) Creating test user', testUser.email);
    const create = await request('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testUser) });
    log('create status', create.status, 'body', create.body);
    if (create.status >= 400) throw new Error('Failed to create user');

    log('2) Login user');
    const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testUser.email, senha: testUser.senha }) });
    log('login status', login.status, 'body', login.body);
    if (login.status >= 400 || !login.body || !login.body.token) throw new Error('Login failed');
    const token = login.body.token;

    const authHead = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    log('3) Add historico (protected)');
    const histPayload = { tipo: 'smoke-test', valores: '1,2,3', resultado: '6' };
    const addHist = await request('/users/historico', { method: 'POST', headers: authHead, body: JSON.stringify(histPayload) });
    log('addHist status', addHist.status, 'body', addHist.body);
    if (addHist.status >= 400) throw new Error('Failed to add historico with valid token');

    log('4) Get historico (should succeed)');
    const getHist = await request('/users/historico', { method: 'GET', headers: authHead });
    log('getHist status', getHist.status, 'body', getHist.body);
    if (getHist.status >= 400) throw new Error('Failed to get historico before logout');

    log('5) Logout (revoke token)');
    const logout = await request('/auth/logout', { method: 'POST', headers: authHead });
    log('logout status', logout.status, 'body', logout.body);
    if (logout.status >= 400) throw new Error('Logout failed');

    log('6) Get historico after logout (should be blocked)');
    const getHistAfter = await request('/users/historico', { method: 'GET', headers: authHead });
    log('getHistAfter status', getHistAfter.status, 'body', getHistAfter.body);
    if (getHistAfter.status !== 403) {
      throw new Error('Token was not revoked properly; expected 403 but got ' + getHistAfter.status);
    }

    // cleanup: find user id via GET /users then delete
    log('7) Cleaning up: find and delete test user');
    const allUsers = await request('/users');
    const found = (Array.isArray(allUsers.body) ? allUsers.body : []).find(u => u.email === testUser.email);
    if (found && found._id) {
      const del = await request(`/users/${found._id}`, { method: 'DELETE' });
      log('delete status', del.status, 'body', del.body);
    } else {
      log('warning: could not find created user for cleanup');
    }

    log('SMOKE TEST PASSED');
    process.exit(0);
  } catch (err) {
    console.error('SMOKE TEST FAILED:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

// Node >=18 global fetch required
if (typeof fetch === 'undefined') {
  console.error('This script requires Node 18+ (global fetch). Set environment variable API_URL if your server is on another host.');
  process.exit(1);
}

run();
