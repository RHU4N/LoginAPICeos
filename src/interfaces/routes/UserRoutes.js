const express = require('express');
/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Operações com usuários
 */
const router = express.Router();
const UserController = require('../controllers/UserController');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const UserUseCases = require('../../application/use_cases/UserUseCases');
const auth = require('../../infrastructure/middleware/AuthMiddleware');
const BcryptPasswordHasher = require('../../infrastructure/providers/BcryptPasswordHasher');

const userRepository = new UserRepositoryImpl();
const passwordHasher = new BcryptPasswordHasher();
const userUseCases = new UserUseCases(userRepository, passwordHasher);
const userController = new UserController(userUseCases);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuários
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get('/', (req, res) => userController.getAll(req, res));
/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Criar usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 */
router.post('/', (req, res) => userController.create(req, res));
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Buscar usuário por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário
 */
router.get('/:id', (req, res) => userController.getById(req, res));
router.put('/:id', (req, res) => userController.update(req, res));
router.delete('/:id', (req, res) => userController.delete(req, res));
router.post('/historico', auth, (req, res) => userController.addHistorico(req, res));
router.get('/historico', auth, (req, res) => userController.getHistorico(req, res));

module.exports = router;