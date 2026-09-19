/**
 * AuthController - Controlador de Autenticação
 * Responsável por orquestrar requisições HTTP para operações de autenticação
 */

const {
  LoginDTO,
  LoginResponseDTO,
  ChangePasswordDTO,
} = require("../../dto");
const authConfig = require("../../config/auth");
const { AppError } = require("../../errors/AppError");

class AuthController {
  constructor(loginUseCase, refreshTokenUseCase, changePasswordUseCase) {
    this.loginUseCase = loginUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.changePasswordUseCase = changePasswordUseCase;
  }

  /**
   * POST /auth/login
   */
  async login(req, res, next) {
    try {
      const { email, senha } = req.body;

      // Validar entrada
      const loginDTO = new LoginDTO(email, senha);
      loginDTO.validate();

      // Executar login
      const result = await this.loginUseCase.execute(email, senha);

      // Retornar resposta
      res.cookie(authConfig.cookies.accessToken.name, result.accessToken, authConfig.cookies.accessToken);
      res.cookie(authConfig.cookies.refreshToken.name, result.refreshToken, authConfig.cookies.refreshToken);
      return res.status(200).json({
        success: true,
        data: {
          user: new LoginResponseDTO(result.user).user,
          expiresIn: "15m",
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        throw new AppError(
          "Refresh token é obrigatório",
          400,
          "MISSING_REFRESH_TOKEN",
        );
      }

      // Executar refresh
      const result = await this.refreshTokenUseCase.execute(refreshToken);

      res.cookie(authConfig.cookies.accessToken.name, result.accessToken, authConfig.cookies.accessToken);
      res.cookie(authConfig.cookies.refreshToken.name, result.refreshToken, authConfig.cookies.refreshToken);
      return res.status(200).json({
        success: true,
        data: {
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /auth/logout
   * Revogar refresh tokens
   */
  async logout(req, res, next) {
    try {
      // Em uma implementação real, revigoar o token no banco
      // Por enquanto, apenas retornar sucesso
      // A validação do token acontece no middleware

      const user = await this.changePasswordUseCase.userUseCases.getUserByIdWithPassword(req.userId);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      res.clearCookie(authConfig.cookies.accessToken.name, authConfig.cookies.accessToken);
      res.clearCookie(authConfig.cookies.refreshToken.name, authConfig.cookies.refreshToken);
      return res.status(200).json({
        success: true,
        message: "Logout realizado com sucesso",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.userId;
      const { senhaAtual, novaSenha, confirmaNovaSenha } = req.body;

      // Validar entrada
      const changePasswordDTO = new ChangePasswordDTO(
        senhaAtual,
        novaSenha,
        confirmaNovaSenha,
      );
      changePasswordDTO.validate();

      // Executar mudança de senha
      const result = await this.changePasswordUseCase.execute(
        userId,
        senhaAtual,
        novaSenha,
      );

      res.clearCookie(authConfig.cookies.accessToken.name, authConfig.cookies.accessToken);
      res.clearCookie(authConfig.cookies.refreshToken.name, authConfig.cookies.refreshToken);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /auth/me
   * Obter dados do usuário autenticado
   */
  async getMe(req, res, next) {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new AppError("Usuário não autenticado", 401, "NOT_AUTHENTICATED");
      }

      // Buscar usuário (sem senha)
      const userUseCases = this.changePasswordUseCase.userUseCases;
      const user = await userUseCases.getUserById(userId);

      const { UserResponseDTO } = require("../../dto");
      const response = new UserResponseDTO(user);

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuthController;
