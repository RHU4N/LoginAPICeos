const LoginUseCase = require('../src/application/use_cases/LoginUseCase');
const {
  UserNotFoundError,
  InvalidPasswordError,
} = require('../src/application/errors/AuthErrors');
const { ValidationError } = require('../src/errors/AppError');

describe('LoginUseCase (unit - domain errors)', () => {
  test('throws ValidationError when missing email or senha', async () => {
    const lc = new LoginUseCase({}, {}, {});
    await expect(lc.execute(null, null)).rejects.toThrow(ValidationError);
  });

  test('throws UserNotFoundError when user not found', async () => {
    const userUseCases = { getUserByEmail: async () => null };
    const lc = new LoginUseCase(userUseCases, {}, {});
    await expect(lc.execute('a@b', 'pw')).rejects.toThrow(UserNotFoundError);
  });

  test('throws InvalidPasswordError when password invalid', async () => {
    const user = { _id: 'u1', senha: 'hash', ativo: true };
    const userUseCases = { getUserByEmail: async () => user };
    const passwordHasher = { compare: async () => false };
    const lc = new LoginUseCase(userUseCases, passwordHasher, {});
    await expect(lc.execute('a@b', 'pw')).rejects.toThrow(InvalidPasswordError);
  });

  test('returns token pair and public user when credentials valid', async () => {
    const user = {
      _id: 'u1',
      nome: 'Ana Silva',
      email: 'ana@example.com',
      senha: 'hash',
      ativo: true,
      save: jest.fn(),
    };
    const userUseCases = { getUserByEmail: async () => user };
    const passwordHasher = { compare: async () => true };
    const tokenProvider = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };
    const lc = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
    const result = await lc.execute('a@b', 'pw');

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'ana@example.com' },
    });
    expect(result.user).not.toHaveProperty('senha');
    expect(tokenProvider.generateTokenPair).toHaveBeenCalledWith('u1', 'ana@example.com', 0, 'USER');
  });
});
