/**
 * Testes do LoginUseCase com a arquitetura de erros e proteção contra brute force
 */

const LoginUseCase = require("../src/application/use_cases/LoginUseCase");
const {
  UserNotFoundError,
  InvalidPasswordError,
} = require("../src/application/errors/AuthErrors");
const {
  ValidationError,
  AuthenticationError,
  UserBlockedError,
} = require("../src/errors/AppError");
const {
  resetAttempts,
  recordFailedAttempt,
} = require("../src/infrastructure/middleware/BruteForceMiddleware");

describe("LoginUseCase - Nova Arquitetura", () => {
  let mockUserUseCases;
  let mockPasswordHasher;
  let mockTokenProvider;
  let loginUseCase;

  beforeEach(() => {
    mockUserUseCases = {
      getUserByEmail: jest.fn(),
    };

    mockPasswordHasher = {
      compare: jest.fn(),
    };

    mockTokenProvider = {
      generateTokenPair: jest.fn(),
    };

    loginUseCase = new LoginUseCase(
      mockUserUseCases,
      mockPasswordHasher,
      mockTokenProvider,
    );
  });

  test("deve retornar access e refresh tokens e zerar tentativas após sucesso", async () => {
    const email = "joao@email.com";
    resetAttempts(email);
    recordFailedAttempt(email);

    const fakeUser = {
      _id: "user123",
      nome: "João",
      email,
      senhaHash: "hashedpassword",
      ativo: true,
      save: jest.fn(),
    };

    mockUserUseCases.getUserByEmail.mockResolvedValue(fakeUser);
    mockPasswordHasher.compare.mockResolvedValue(true);
    mockTokenProvider.generateTokenPair.mockReturnValue({
      accessToken: "access_token_xyz",
      refreshToken: "refresh_token_xyz",
    });

    const result = await loginUseCase.execute(email, "Senha123!");

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: "access_token_xyz",
        refreshToken: "refresh_token_xyz",
        user: expect.objectContaining({
          id: "user123",
          email,
        }),
      }),
    );

    expect(fakeUser.save).toHaveBeenCalledTimes(1);
    expect(mockUserUseCases.getUserByEmail).toHaveBeenCalledWith(email);
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith(
      "Senha123!",
      fakeUser.senhaHash,
    );
    resetAttempts(email);
  });

  test("deve lançar ValidationError quando email não fornecido", async () => {
    await expect(loginUseCase.execute(null, "Senha123!")).rejects.toThrow(
      ValidationError,
    );
  });

  test("deve lançar UserNotFoundError quando usuário não encontrado", async () => {
    const email = "nao-existe-new@test.invalid";
    resetAttempts(email);
    mockUserUseCases.getUserByEmail.mockResolvedValue(null);

    await expect(loginUseCase.execute(email, "Senha123!")).rejects.toThrow(
      UserNotFoundError,
    );
    resetAttempts(email);
  });

  test("deve lançar AuthenticationError USER_INACTIVE quando conta inativa", async () => {
    const email = "inativo-new@test.invalid";
    resetAttempts(email);
    mockUserUseCases.getUserByEmail.mockResolvedValue({
      _id: "user456",
      email,
      senhaHash: "hashedpassword",
      ativo: false,
    });

    const promise = loginUseCase.execute(email, "Senha123!");
    await expect(promise).rejects.toThrow(AuthenticationError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 401,
      errorCode: "USER_INACTIVE",
    });
    resetAttempts(email);
  });

  test("deve lançar InvalidPasswordError quando senha incorreta", async () => {
    const email = "senha-errada-new@test.invalid";
    resetAttempts(email);
    const fakeUser = {
      _id: "user123",
      email,
      senhaHash: "hashedpassword",
      ativo: true,
    };

    mockUserUseCases.getUserByEmail.mockResolvedValue(fakeUser);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(
      loginUseCase.execute(email, "SenhaErrada123!"),
    ).rejects.toThrow(InvalidPasswordError);
    resetAttempts(email);
  });

  test("deve retornar UserBlockedError, e não erro interno, para conta bloqueada", async () => {
    const email = "bloqueado@example.com";
    resetAttempts(email);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      recordFailedAttempt(email);
    }

    const promise = loginUseCase.execute(email, "Senha123!");
    await expect(promise).rejects.toThrow(UserBlockedError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 401,
      errorCode: "USER_BLOCKED",
    });
    resetAttempts(email);
  });
});
