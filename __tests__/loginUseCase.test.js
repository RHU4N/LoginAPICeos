const LoginUseCase = require('../src/application/use_cases/LoginUseCase');

describe('LoginUseCase (unit)', () => {
  test('returns token pair and public user when credentials are valid', async () => {
    const fakeUser = {
      _id: 'abc123',
      nome: 'João',
      email: 'joao@example.com',
      senha: 'hashedpwd',
      ativo: true,
      save: jest.fn(),
    };

    const userUseCases = {
      getUserByEmail: jest.fn().mockResolvedValue(fakeUser)
    };

    const passwordHasher = {
      compare: jest.fn().mockResolvedValue(true)
    };

    const tokenProvider = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };

    const login = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
    const result = await login.execute('any@e.mail', 'plainpwd');

    expect(userUseCases.getUserByEmail).toHaveBeenCalledWith('any@e.mail');
    expect(passwordHasher.compare).toHaveBeenCalledWith('plainpwd', fakeUser.senha);
    expect(tokenProvider.generateTokenPair).toHaveBeenCalledWith(
      fakeUser._id,
      fakeUser.email,
      0,
      'USER',
    );
    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: fakeUser._id, email: fakeUser.email },
    });
    expect(result.user).not.toHaveProperty('senha');
  });

  test('throws when missing credentials', async () => {
    const login = new LoginUseCase({}, {}, {});
    await expect(login.execute(null, null)).rejects.toThrow();
  });
});
