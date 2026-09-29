/**
 * Controlador de autenticação.
 */

const successResponse = require("../responses/successResponse");
const {
  LoginDTO,
  LoginResponseDTO,
  ChangePasswordDTO,
  UserResponseDTO,
} = require("../../dto");
const authConfig = require("../../config/auth");
const { AppError } = require("../../errors/AppError");

class AuthController {
  constructor(loginUseCase, refreshTokenUseCase, changePasswordUseCase) {
    this.loginUseCase = loginUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.changePasswordUseCase = changePasswordUseCase;
  }

  async login(req, res, next) {
    try {
      const { email, senha } = req.body;
      new LoginDTO(email, senha).validate();

      const result = await this.loginUseCase.execute(email, senha);
      res.cookie(
        authConfig.cookies.accessToken.name,
        result.accessToken,
        authConfig.cookies.accessToken,
      );
      res.cookie(
        authConfig.cookies.refreshToken.name,
        result.refreshToken,
        authConfig.cookies.refreshToken,
      );

      return successResponse(
        res,
        {
          user: new LoginResponseDTO(result.user).user,
          expiresIn: "15m",
        },
        "Login realizado com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }

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

      const result = await this.refreshTokenUseCase.execute(refreshToken);
      res.cookie(
        authConfig.cookies.accessToken.name,
        result.accessToken,
        authConfig.cookies.accessToken,
      );
      res.cookie(
        authConfig.cookies.refreshToken.name,
        result.refreshToken,
        authConfig.cookies.refreshToken,
      );
      return successResponse(
        res,
        { expiresIn: result.expiresIn },
        "Sessão renovada com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const user = await this.changePasswordUseCase.userUseCases.getUserByIdWithPassword(
        req.userId,
      );
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      res.clearCookie(authConfig.cookies.accessToken.name, authConfig.cookies.accessToken);
      res.clearCookie(authConfig.cookies.refreshToken.name, authConfig.cookies.refreshToken);
      return successResponse(res, null, "Logout realizado com sucesso");
    } catch (error) {
      return next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { senhaAtual, novaSenha, confirmaNovaSenha } = req.body;
      new ChangePasswordDTO(senhaAtual, novaSenha, confirmaNovaSenha).validate();

      const result = await this.changePasswordUseCase.execute(
        req.userId,
        senhaAtual,
        novaSenha,
      );
      res.clearCookie(authConfig.cookies.accessToken.name, authConfig.cookies.accessToken);
      res.clearCookie(authConfig.cookies.refreshToken.name, authConfig.cookies.refreshToken);
      return successResponse(res, null, result.message);
    } catch (error) {
      return next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      if (!req.userId) {
        throw new AppError("Usuário não autenticado", 401, "NOT_AUTHENTICATED");
      }

      const user = await this.changePasswordUseCase.userUseCases.getUserById(req.userId);
      return successResponse(
        res,
        new UserResponseDTO(user),
        "Usuário autenticado consultado com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuthController;
