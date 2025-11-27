const VerifyTokenUseCase = require('../src/application/use_cases/VerifyTokenUseCase');
const { TokenNotProvidedError, InvalidTokenError } = require('../src/application/errors/AuthErrors');

describe('VerifyTokenUseCase (unit)', () => {
  test('throws TokenNotProvidedError when token is missing', () => {
    const uc = new VerifyTokenUseCase({ verify: () => ({}) });
    expect(() => uc.execute()).toThrow();
  });

  test('returns decoded when provider verifies', () => {
    const provider = { verify: (t) => ({ id: 'u1', t }) };
    const uc = new VerifyTokenUseCase(provider);
    const out = uc.execute('token');
    expect(out).toEqual({ id: 'u1', t: 'token' });
  });

  test('throws InvalidTokenError when provider throws', () => {
    const provider = { verify: () => { throw new Error('boom'); } };
    const uc = new VerifyTokenUseCase(provider);
    expect(() => uc.execute('x')).toThrow();
  });
});
