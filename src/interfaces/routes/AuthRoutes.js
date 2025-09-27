const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const LoginUseCase = require('../../application/use_cases/LoginUseCase');
const UserUseCases = require('../../application/use_cases/UserUseCases');
const BcryptPasswordHasher = require('../../infrastructure/providers/BcryptPasswordHasher');
const JwtTokenProvider = require('../../infrastructure/providers/JwtTokenProvider');
const userRepository = new (require('../../infrastructure/repositories/UserRepositoryImpl'))();
const userUseCases = new UserUseCases(userRepository);

const passwordHasher = new BcryptPasswordHasher();
const tokenProvider = new JwtTokenProvider();
const loginUseCase = new LoginUseCase(userUseCases, passwordHasher, tokenProvider);
const authController = new AuthController(loginUseCase);

router.post('/login', (req, res) => authController.login(req, res));

module.exports = router;