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

/**
 * @openapi
 * /login:
 *   post:
 *     tags: [Auth]
 *     summary: Executa login.
 *     description: Recebe `email`,`senha` e realiza login.
 *     requestBody:
 *         required: true
 *         content: 
 *             application/json:
 *                 schema:
 *                     type: object
 *                     properties:
 *                         email:
 *                            type: string
 *                            example: jonh@email.com
 *                         senha:
 *                            type: string
 *                            example: 12345
 *     responses:
 *       200:
 *         description: Login executado com sucesso
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: hk1239k%ndsa
 *       400:
 *         description: Campos obrigatórios faltando
 *         content: 
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Campos obrigatórios faltando
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Token não fornecido
 *       401:
 *         description: Usuário não encontrado
 *         content: 
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Usuário não encontrado
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Senha inválida
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Token inválido
 *       500:
 *         description: Erro interno no servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Erro interno no servidor
 */
router.post('/login', (req, res) => authController.login(req, res));

module.exports = router;