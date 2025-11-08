const request = require('supertest');
const app = require('../index');

describe('loginAPI basics', () => {
  test('GET / should return 200 and a body', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.text).toMatch(/Estou aqui/);
  });
});
