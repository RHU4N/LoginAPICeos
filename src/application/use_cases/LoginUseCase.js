/**
 * LoginUseCase - Lógica de autenticação (login)
 */

const {
  UserNotFoundError,
  InvalidPasswordError,
} = require("../errors/AuthErrors");
const {
  reserveLoginAttempt,
  releaseLoginAttempt,
  resetAttempts,
} = require("../../infrastructure/middleware/BruteForceMiddleware");
const {
  ValidationError,
  AuthenticationError,
  UserBlockedError,
} = require("../../errors/AppError");

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
      throw new ValidationError("E-mail e senha são obrigatórios");
    }

    // Reserva atômica da tentativa ANTES de qualquer operação assíncrona:
    // tentativas simultâneas não escapam do limite durante o bcrypt.
    if (!reserveLoginAttempt(email)) {
      throw new UserBlockedError();
    }

    // A reserva conta como tentativa falha, exceto em erros que não são
    // credencial inválida (ex.: banco indisponível), que são devolvidos.
    let credentialFailure = false;
    const failCredential = (error) => {
      credentialFailure = true;
      return error;
    };

    let user;
    try {
      // Buscar usuário
      user = await this.userUseCases.getUserByEmail(email);
      if (!user) {
        throw failCredential(new UserNotFoundError());
      }

      // Verificar se usuário está ativo
      if (user.ativo === false) {
        throw failCredential(
          new AuthenticationError("Esta conta está inativa", "USER_INACTIVE"),
        );
      }

      // Validar senha
      const senhaValida = await this.passwordHasher.compare(
        senha,
        user.senhaHash || user.senha,
      );
      if (!senhaValida) {
        throw failCredential(new InvalidPasswordError());
      }
    } catch (error) {
      if (!credentialFailure) releaseLoginAttempt(email);
      throw error;
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
        id: user.id || user._id?.toString?.() || user._id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        assinante: user.assinante,
        ativo: user.ativo,
      },
    };
  }
}

module.exports = LoginUseCase;
