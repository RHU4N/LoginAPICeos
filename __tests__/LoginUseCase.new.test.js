/**
 * Testes do LoginUseCase com a nova arquitetura
 */

const LoginUseCase = require("../src/application/use_cases/LoginUseCase");
const UserNotFoundError = require("../src/errors/AppError");

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

  test("deve retornar access e refresh tokens com sucesso", async () => {
    const fakeUser = {
      _id: "user123",
      nome: "João",
      email: "joao@email.com",
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

    const result = await loginUseCase.execute("joao@email.com", "Senha123!");

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: "access_token_xyz",
        refreshToken: "refresh_token_xyz",
        user: expect.objectContaining({
          id: "user123",
          email: "joao@email.com",
        }),
      }),
    );

    expect(mockUserUseCases.getUserByEmail).toHaveBeenCalledWith(
      "joao@email.com",
    );
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith(
      "Senha123!",
      fakeUser.senhaHash,
    );
  });

  test("deve lançar erro quando email não fornecido", async () => {
    await expect(loginUseCase.execute(null, "Senha123!")).rejects.toThrow();
  });

  test("deve lançar erro quando usuário não encontrado", async () => {
    mockUserUseCases.getUserByEmail.mockResolvedValue(null);

    await expect(
      loginUseCase.execute("nao@existe.com", "Senha123!"),
    ).rejects.toThrow();
  });

  test("deve lançar erro quando senha incorreta", async () => {
    const fakeUser = {
      _id: "user123",
      email: "joao@email.com",
      senhaHash: "hashedpassword",
      ativo: true,
    };

    mockUserUseCases.getUserByEmail.mockResolvedValue(fakeUser);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(
      loginUseCase.execute("joao@email.com", "SenhaErrada123!"),
    ).rejects.toThrow();
  });
});
