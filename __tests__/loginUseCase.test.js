const LoginUseCase = require('../src/application/use_cases/LoginUseCase');
const { ValidationError } = require('../src/errors/AppError');
const { resetAttempts } = require('../src/infrastructure/middleware/BruteForceMiddleware');

describe('LoginUseCase (unit)', () => {
  test('returns token pair with custom tokenVersion/role and public user when credentials are valid', async () => {
    const email = 'any@e.mail';
    resetAttempts(email);
    const fakeUser = {
      _id: 'abc123',
      nome: 'João',
      email,
      senha: 'hashedpwd',
      tokenVersion: 3,
      role: 'ADMIN',
      ativo: true,
      save: jest.fn(),
    };

    const userUseCases = {
      getUserByEmail: jest.fn().mockResolvedValue(fakeUser),
    };

    const passwordHasher = {
      compare: jest.fn().mockResolvedValue(true),
    };

    const tokenProvider = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };

    const login = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
    const result = await login.execute(email, 'plainpwd');

    expect(userUseCases.getUserByEmail).toHaveBeenCalledWith(email);
    expect(passwordHasher.compare).toHaveBeenCalledWith('plainpwd', fakeUser.senha);
    expect(tokenProvider.generateTokenPair).toHaveBeenCalledWith(
      fakeUser._id,
      fakeUser.email,
      3,
      'ADMIN',
    );
    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: fakeUser._id, email: fakeUser.email },
    });
    expect(result.user).not.toHaveProperty('senha');
    expect(result.user).not.toHaveProperty('tokenVersion');
    resetAttempts(email);
  });

  test('throws ValidationError when missing credentials', async () => {
    const login = new LoginUseCase({}, {}, {});
    await expect(login.execute(null, null)).rejects.toThrow(ValidationError);
  });
});
