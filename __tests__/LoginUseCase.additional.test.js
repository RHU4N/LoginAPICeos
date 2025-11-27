const LoginUseCase = require('../src/application/use_cases/LoginUseCase');
const {
  MissingCredentialsError,
  UserNotFoundError,
  InvalidPasswordError,
} = require('../src/application/errors/AuthErrors');

describe('LoginUseCase (unit)', () => {
  test('throws MissingCredentialsError when missing email or senha', async () => {
    const lc = new LoginUseCase({}, {}, {});
    await expect(lc.execute(null, null)).rejects.toThrow();
  });

  test('throws UserNotFoundError when user not found', async () => {
    const userUseCases = { getUserByEmail: async () => null };
    const lc = new LoginUseCase(userUseCases, {}, {});
    await expect(lc.execute('a@b', 'pw')).rejects.toThrow();
  });

  test('throws InvalidPasswordError when password invalid', async () => {
    const user = { _id: 'u1', senha: 'hash' };
    const userUseCases = { getUserByEmail: async () => user };
    const passwordHasher = { compare: async () => false };
    const lc = new LoginUseCase(userUseCases, passwordHasher, {});
    await expect(lc.execute('a@b', 'pw')).rejects.toThrow();
  });

  test('returns token when credentials valid', async () => {
    const user = { _id: 'u1', senha: 'hash' };
    const userUseCases = { getUserByEmail: async () => user };
    const passwordHasher = { compare: async () => true };
    const tokenProvider = { generate: (p) => `tok-${p.id}` };
    const lc = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
    const tok = await lc.execute('a@b', 'pw');
    expect(tok).toBe('tok-u1');
  });
});
