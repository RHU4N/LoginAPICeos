/**
 * RefreshTokenUseCase - Renovar access token usando refresh token
 */

const {
  InvalidTokenError,
  TokenExpiredError,
  ValidationError,
} = require("../../errors/AppError");

class RefreshTokenUseCase {
  constructor(userUseCases, tokenProvider) {
    this.userUseCases = userUseCases;
    this.tokenProvider = tokenProvider;
  }

  /**
   * Executar refresh de token
   */
  async execute(refreshToken) {
    if (!refreshToken) {
      throw new ValidationError("O refresh token é obrigatório");
    }

    try {
      // Verificar refresh token
      const decoded = this.tokenProvider.verifyRefreshToken(refreshToken);

      // Buscar usuário
      const user = await this.userUseCases.getUserByIdWithPassword(decoded.id);
      if (!user || user.ativo === false) {
        throw new InvalidTokenError();
      }

      // Verificar se token foi revogado
      if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
        throw new InvalidTokenError();
      }

      // Gerar novo access token
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      const tokens = this.tokenProvider.generateTokenPair(
        user._id.toString(), user.email, user.tokenVersion, user.role || "USER",
      );

      return {
        ...tokens,
        expiresIn: "15m",
      };
    } catch (error) {
      if (error instanceof TokenExpiredError) throw error;
      throw new InvalidTokenError();
    }
  }
}

module.exports = RefreshTokenUseCase;
