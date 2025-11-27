const LoginUseCase = require('../src/application/use_cases/LoginUseCase');

describe('LoginUseCase (unit)', () => {
  test('returns token when credentials are valid', async () => {
    const fakeUser = { _id: 'abc123', senha: 'hashedpwd' };

    const userUseCases = {
      getUserByEmail: jest.fn().mockResolvedValue(fakeUser)
    };

    const passwordHasher = {
      compare: jest.fn().mockResolvedValue(true)
    };

    const tokenProvider = {
      generate: jest.fn().mockReturnValue('token-xyz')
    };

    const login = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
    const token = await login.execute('any@e.mail', 'plainpwd');

    expect(userUseCases.getUserByEmail).toHaveBeenCalledWith('any@e.mail');
    expect(passwordHasher.compare).toHaveBeenCalledWith('plainpwd', fakeUser.senha);
    expect(tokenProvider.generate).toHaveBeenCalledWith({ id: fakeUser._id });
    expect(token).toBe('token-xyz');
  });

  test('throws when missing credentials', async () => {
    const login = new LoginUseCase({}, {}, {});
    await expect(login.execute(null, null)).rejects.toThrow();
  });
});
