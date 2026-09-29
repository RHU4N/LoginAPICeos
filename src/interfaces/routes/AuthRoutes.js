/**
 * Rotas de Autenticação
 */

const express = require("express");
const router = express.Router();

// Controllers
const AuthController = require("../controllers/AuthController");

// Use Cases
const LoginUseCase = require("../../application/use_cases/LoginUseCase");
const RefreshTokenUseCase = require("../../application/use_cases/RefreshTokenUseCase");
const ChangePasswordUseCase = require("../../application/use_cases/ChangePasswordUseCase");
const UserUseCases = require("../../application/use_cases/UserUseCases");

// Providers
const BcryptPasswordHasher = require("../../infrastructure/providers/BcryptPasswordHasher");
const JwtTokenProvider = require("../../infrastructure/providers/JwtTokenProvider");

// Repositories
const UserRepositoryImpl = require("../../infrastructure/repositories/UserRepositoryImpl");

// Middlewares
const authMiddleware = require("../../infrastructure/middleware/AuthMiddleware");
const {
  bruteForceMiddleware,
} = require("../../infrastructure/middleware/BruteForceMiddleware");

// Inicializar dependências
const userRepository = new UserRepositoryImpl();
const userUseCases = new UserUseCases(
  userRepository,
  new BcryptPasswordHasher(),
);
const passwordHasher = new BcryptPasswordHasher();
const tokenProvider = new JwtTokenProvider();

const loginUseCase = new LoginUseCase(
  userUseCases,
  passwordHasher,
  tokenProvider,
);
const refreshTokenUseCase = new RefreshTokenUseCase(
  userUseCases,
  tokenProvider,
);
const changePasswordUseCase = new ChangePasswordUseCase(
  userUseCases,
  passwordHasher,
);

const authController = new AuthController(
  loginUseCase,
  refreshTokenUseCase,
  changePasswordUseCase,
);

/**
 * POST /auth/login
 * Autenticar usuário com email e senha
 */
router.post("/login", bruteForceMiddleware, (req, res, next) => {
  authController.login(req, res).catch(next);
});

/**
 * POST /auth/refresh
 * Renovar access token usando refresh token
 */
router.post("/refresh", (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

/**
 * POST /auth/logout
 * Logout do usuário (revogar refresh tokens)
 */
router.post("/logout", authMiddleware, (req, res, next) => {
  authController.logout(req, res).catch(next);
});

/**
 * POST /auth/change-password
 * Trocar senha do usuário autenticado
 */
router.post("/change-password", authMiddleware, (req, res, next) => {
  authController.changePassword(req, res).catch(next);
});

/**
 * GET /auth/me
 * Obter dados do usuário autenticado
 */
router.get("/me", authMiddleware, (req, res, next) => {
  authController.getMe(req, res).catch(next);
});

module.exports = router;
