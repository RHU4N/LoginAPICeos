const UseCases = require('../src/application/use_cases/IoTUseCases');
const serviceAuth = require('../src/infrastructure/middleware/ServiceAuthMiddleware');
const fixture = require('../tests/fixtures/event-v1.json');
const owner = '507f1f77bcf86cd799439011';

describe('Ingestão IoT segura', () => {
  const original = { key: process.env.CEOS_SERVICE_KEY, mode: process.env.NODE_ENV };
  afterEach(() => {
    if (original.key === undefined) delete process.env.CEOS_SERVICE_KEY; else process.env.CEOS_SERVICE_KEY = original.key;
    process.env.NODE_ENV = original.mode;
  });
  test('serviço sem chave, chave errada e HTTPS obrigatório', () => {
    process.env.CEOS_SERVICE_KEY = 'test-service-key-that-has-at-least-32-characters';
    const next = jest.fn();
    serviceAuth({ get: () => undefined }, {}, next); expect(next.mock.calls[0][0].statusCode).toBe(401);
    next.mockClear(); process.env.NODE_ENV = 'production';
    serviceAuth({ secure: false, get: () => process.env.CEOS_SERVICE_KEY }, {}, next);
    expect(next.mock.calls[0][0].errorCode).toBe('HTTPS_REQUIRED');
    next.mockClear();
    serviceAuth({ secure: true, get: () => process.env.CEOS_SERVICE_KEY }, {}, next);
    expect(next.mock.calls[0]).toEqual([]);
  });
  test('integração sem configuração falha fechada', () => {
    delete process.env.CEOS_SERVICE_KEY;
    const next = jest.fn(); serviceAuth({ get: () => '' }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(503);
  });
  function create(repository, extra = {}) {
    return new UseCases(repository, { findOwner: async () => ({ _id: owner, ativo: true }), findDevice: async () => null,
      owners: () => JSON.stringify({ [fixture.deviceId]: owner }), ...extra });
  }
  test('resolve proprietário do servidor e persiste quatro recibos', async () => {
    const repository = { upsertFromEvent: jest.fn(async (m) => ({ ...m, _id: 'id-' + m.sensorId })) };
    const result = await create(repository).ingestEvent(fixture);
    expect(result.persisted).toBe(4);
    expect(repository.upsertFromEvent.mock.calls.every(([m]) => m.userId === owner)).toBe(true);
  });
  test('rejeita dados inválidos antes de qualquer persistência', async () => {
    const repository = { upsertFromEvent: jest.fn() };
    for (const invalid of [{ ...fixture, schemaVersion: 2 }, { ...fixture, userId: owner }, { ...fixture, measurements: [] }]) {
      await expect(create(repository).ingestEvent(invalid)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(repository.upsertFromEvent).not.toHaveBeenCalled();
  });
  test('dispositivo desconhecido, usuário inativo e configuração inválida', async () => {
    await expect(create({}, { owners: () => '{}' }).ingestEvent(fixture)).rejects.toMatchObject({ statusCode: 403 });
    await expect(create({}, { findOwner: async () => ({ ativo: false }) }).ingestEvent(fixture)).rejects.toMatchObject({ statusCode: 403 });
    await expect(create({}, { owners: () => '{' }).ingestEvent(fixture)).rejects.toMatchObject({ statusCode: 503 });
  });
  test('falha após duas gravações não retorna sucesso e retry completa sem duplicatas', async () => {
    const saved = new Map(); let calls = 0;
    const repository = { upsertFromEvent: jest.fn(async (m) => {
      if (++calls === 3) throw new Error('falha temporária');
      if (!saved.has(m.idempotencyKey)) saved.set(m.idempotencyKey, { ...m, _id: m.sensorId });
      return saved.get(m.idempotencyKey);
    }) };
    const useCases = create(repository);
    await expect(useCases.ingestEvent(fixture)).rejects.toMatchObject({ statusCode: 503 });
    expect(saved.size).toBe(2);
    expect((await useCases.ingestEvent(fixture)).persisted).toBe(4); expect(saved.size).toBe(4);
  });
});
