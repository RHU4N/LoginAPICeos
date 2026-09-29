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

  test('GET /health follows the standard success contract', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body).toMatchObject({
      success: true,
      message: 'API em funcionamento',
      data: expect.objectContaining({ status: 'OK' }),
    });
  });

  test('unknown endpoints preserve an HTTP error status', async () => {
    const res = await request(app).get('/rota-inexistente').expect(404);

    expect(res.body).toMatchObject({
      success: false,
      error: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });
});
