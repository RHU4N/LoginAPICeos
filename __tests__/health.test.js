const request = require('supertest');
const app = require('../index');

describe('loginAPI basics', () => {
  test('GET / should return 200 and a body', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'API disponível',
      data: expect.objectContaining({ service: 'LoginAPICeos - API de Autenticação' })
    });
  });
});
