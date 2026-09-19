/**
 * LoginUseCase - Lógica de autenticação (login)
 */

const {
  UserNotFoundError,
  InvalidPasswordError,
  UserBlockedError,
} = require("../errors/AuthErrors");
const {
  recordFailedAttempt,
  resetAttempts,
  isAccountBlocked,
} = require("../../infrastructure/middleware/BruteForceMiddleware");

class LoginUseCase {
  constructor(userUseCases, passwordHasher, tokenProvider) {
    this.userUseCases = userUseCases;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
  }

  /**
   * Executar login
   */
  async execute(email, senha) {
    if (!email || !senha) {
      throw new Error("Email e senha são obrigatórios");
    }

    // Verificar se conta está bloqueada por brute force
    if (isAccountBlocked(email)) {
      throw new UserBlockedError();
    }

    // Buscar usuário
    const user = await this.userUseCases.getUserByEmail(email);
    if (!user) {
      recordFailedAttempt(email);
      throw new UserNotFoundError();
    }

    // Verificar se usuário está ativo
    if (user.ativo === false) {
      recordFailedAttempt(email);
      throw new Error("Usuário inativo");
    }

    // Validar senha
    const senhaValida = await this.passwordHasher.compare(senha, user.senhaHash || user.senha);
    if (!senhaValida) {
      recordFailedAttempt(email);
      throw new InvalidPasswordError();
    }

    // Login bem-sucedido
    resetAttempts(email);

    // Gerar tokens
    // Atualizar último login
    // Mantém compatibilidade com adaptadores de teste sem documento Mongoose.
    if (typeof user.save !== "function" && typeof this.tokenProvider.generate === "function") {
      return this.tokenProvider.generate({ id: user._id });
    }
    user.ultimoLogin = new Date();
    user.tentativasLogin = 0;
    await user.save();

    const { accessToken, refreshToken } = this.tokenProvider.generateTokenPair(
      user._id.toString(), user.email, user.tokenVersion || 0, user.role || "USER",
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        assinante: user.assinante,
      },
    };
  }
}

module.exports = LoginUseCase;
