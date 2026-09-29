const JwtTokenProvider = require("../src/infrastructure/providers/JwtTokenProvider");
const ChangePasswordUseCase = require("../src/application/use_cases/ChangePasswordUseCase");

describe("Segurança de autenticação", () => {
  beforeAll(() => { process.env.JWT_SECRET = "test-secret-for-auth-security"; });

  test("não aceita access token como refresh nem refresh token como access", () => {
    const provider = new JwtTokenProvider();
    const { accessToken, refreshToken } = provider.generateTokenPair("u1", "u@test.com", 0);
    expect(() => provider.verifyRefreshToken(accessToken)).toThrow();
    expect(() => provider.verifyAccessToken(refreshToken)).toThrow();
  });

  test("não troca senha quando a senha atual está incorreta", async () => {
    const user = { senhaHash: "hash", tokenVersion: 0, save: jest.fn() };
    const useCase = new ChangePasswordUseCase(
      { getUserByIdWithPassword: jest.fn().mockResolvedValue(user) },
      { compare: jest.fn().mockResolvedValue(false), isStrong: jest.fn(), hash: jest.fn() },
    );
    await expect(useCase.execute("u1", "QualquerCoisa1!", "NovaSenha1!")).rejects.toThrow();
    expect(user.save).not.toHaveBeenCalled();
  });
});
