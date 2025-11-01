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
 * /auth/login:
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

/**
 * @openapi
 * /logout:
 *   post:
 *     tags: [Auth]
 *     summary: Realiza logout do usuário
 *     description: Remove o token do servidor (invalida sessão). O token deve ser enviado no header Authorization como `Bearer <token>`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout executado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Token inválido ou não fornecido
 */
// logout route implemented below

// Implement logout: revoke the token by adding it to a blacklist collection
const TokenRepository = require('../../infrastructure/repositories/TokenRepository');
const tokenRepo = new TokenRepository();
const jwt = require('jsonwebtoken');

router.post('/logout', async (req, res) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];
		if (!token) return res.status(400).json({ error: 'Token não fornecido' });

		// Try to decode token to obtain exp. Use decode to avoid failing on already-invalid tokens.
		const decoded = jwt.decode(token);
		if (!decoded || !decoded.exp) {
			// If no exp, still store token for a short time (1 hour)
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
			await tokenRepo.add(token, expiresAt);
			return res.json({ success: true });
		}

		const expiresAt = new Date(decoded.exp * 1000);
		await tokenRepo.add(token, expiresAt);
		return res.json({ success: true });
	} catch (err) {
		console.error('Logout error', err);
		return res.status(500).json({ error: 'Erro ao processar logout' });
	}
});

module.exports = router;
