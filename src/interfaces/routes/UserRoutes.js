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
 *     x-internal: true
 *     summary: Listar usuários
 *     description: Lista todos os usuários cadastrados
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: 
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nome:
 *                     type: string
 *                   email:
 *                     type: string
 *                   senha:
 *                     type: string
 *                   telefone:
 *                     type: string
 *                   assinante:
 *                     type: boolean
 *                   historico:
 *                     type: object
 *                     properties:
 *                       tipo:
 *                         type: string
 *                       valores:
 *                         type: string
 *                       resultado:
 *                         type: string
 *                       data:
 *                         type: date
 *       500: 
 *         description: Erro interno do servidor
 *         content: 
 *           application/json:
 *             schema:
 *               type: object
 *               properties: 
 *                 error:
 *                   type: string
 *                   example: Erro interno do servidor
 */
router.get('/', (req, res) => userController.getAll(req, res));
/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Criar usuário
 *     description: Recebe os parâmetros `"nome"`, `"email"`, `"senha"`, `"telefone"`, `"assinante"` e `"histórico"` e registra usuário. 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@email.com
 *               senha:
 *                 type: string
 *                 example: 12345
 *               telefone: 
 *                 type: string
 *                 example: 11111-1111
 *               assinante:
 *                 type: boolean
 *                 example: true
 *               historico:
 *                 type: object
 *                 properties:
 *                   tipo:
 *                     type: string
 *                   valores: 
 *                     type: string
 *                   resultado:
 *                     type: string
 *                   data: 
 *                     type: string
 *                     format: date
 *     responses:
 *       201:
 *         description: Cadastrado com sucesso
 *         content: 
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 nome:
 *                   type: string
 *                   example: John Doe
 *                 email:
 *                   type: string
 *                   example: john@email.com
 *                 senha:
 *                   type: string
 *                   example: 12345
 *                 telefone: 
 *                   type: string
 *                   example: 11111-1111
 *                 assinante:
 *                   type: boolean
 *                   example: true
 *                 historico:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                     valores: 
 *                       type: string
 *                     resultado:
 *                       type: string
 *                     data: 
 *                       type: string
 *                       format: date
 *       400:
 *         description: Campos obrigatórios faltando
 *         content: 
 *           application/json:
 *             schema:
 *               type: object
 *               properties: 
 *                 error:
 *                   type: string
 *                   example: Campo "nome" é obrigatório
 *       500: 
 *         description: Erro interno do servidor
 *         content: 
 *           application/json:
 *             schema:
 *               type: object
 *               properties: 
 *                 error:
 *                   type: string
 *                   example: Erro interno do servidor
 */
router.post('/', (req, res) => userController.create(req, res));
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     x-internal: true
 *     summary: Buscar usuário por id
 *     description: Realiza busca de usuário filtrada por `Id`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Parâmetro de busca
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 nome:
 *                   type: string
 *                   example: John Doe
 *                 email:
 *                   type: string
 *                   example: john@email.com
 *                 telefone: 
 *                   type: string
 *                   example: 11111-1111
 *                 assinante:
 *                   type: boolean
 *                   example: true
 *                 historico:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                     valores: 
 *                       type: string
 *                     resultado:
 *                       type: string
 *                     data: 
 *                       type: string
 *                       format: date
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/:id', (req, res) => userController.getById(req, res));

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Atualiza dados do usuário
 *     description: Realiza busca de usuário filtrada por `Id` e altera os campos específicados.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Parâmetro de busca
 *         schema:
 *           type: string
 *     requestBody: 
 *         required: false
 *         content:
 *             application/json:
 *                 schema:
 *                     type: object
 *                     properties:
 *                         nome:
 *                            type: string
 *                            example: João Ninguém
 *                         assinante:
 *                            type: boolean
 *                            example: false
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 nome:
 *                   type: string
 *                   example: João Ninguém
 *                 email:
 *                   type: string
 *                   example: john@email.com
 *                 telefone: 
 *                   type: string
 *                   example: 11111-1111
 *                 assinante:
 *                   type: boolean
 *                   example: false
 *                 historico:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                     valores: 
 *                       type: string
 *                     resultado:
 *                       type: string
 *                     data: 
 *                       type: string
 *                       format: date
 *       400:
 *         description: Campos obrigatórios faltando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Campos obrigatórios faltando
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Usuário não encontrado
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
router.put('/:id', (req, res) => userController.update(req, res));

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Deleta usuário
 *     description: Realiza busca de usuário filtrada por `Id` e deleta o usuário.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Parâmetro de busca
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excluído com sucesso
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Excluído com sucesso
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Usuário não encontrado
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
router.delete('/:id', (req, res) => userController.delete(req, res));

/**
 * @openapi
 * /historico:
 *   post:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     summary: Adiciona operação ao histórico do usuário
 *     description: Operação matemática é adicionada ao histórico do usuário.
 *     requestBody:
 *         required: true
 *         content: 
 *             application/json:
 *                 schema:
 *                     type: object
 *                     properties:
 *                         tipo:
 *                            type: string
 *                         valores:
 *                            type: string
 *                         resultado:
 *                            type: string
 *     responses:
 *       201:
 *         description: Histórico salvo com sucesso
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Histórico salvo com sucesso
 *       400:
 *         description: Campos obrigatórios faltando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Campos obrigatórios faltando
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
router.post('/historico', auth, (req, res) => userController.addHistorico(req, res));

/**
 * @openapi
 * /historico:
 *   get:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     summary: Retorna histórico do usuário
 *     description: Lista as operações matemáticas realizadas pelo usuário.
 *     requestBody:
 *         required: true
 *         content: 
 *             application/json:
 *                 schema:
 *                     type: object
 *                     properties:
 *                         id:
 *                            type: string
 *     responses:
 *       201:
 *         description: Histórico salvo com sucesso
 *         content:
 *           application/json:
 *             schema: 
 *               type: object
 *               properties:
 *                 tipo:
 *                   type: string
 *                 valores:
 *                   type: string
 *                 resultado:
 *                   type: string
 *       400:
 *         description: Campos obrigatórios faltando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: 
 *                   type: string
 *                   example: Campos obrigatórios faltando
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
router.get('/historico', auth, (req, res) => userController.getHistorico(req, res));

/**
 * @openapi
 * /historico:
 *   delete:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     summary: Deleta todo o histórico do usuário
 *     description: Remove todas as entradas do histórico do usuário autenticado.
 *     responses:
 *       200:
 *         description: Histórico removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Histórico removido com sucesso
 */
router.delete('/historico', auth, (req, res) => userController.clearHistorico(req, res));

/**
 * @openapi
 * /historico/{id}:
 *   delete:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     summary: Deleta item do histórico por id
 *     description: Remove uma entrada específica do histórico do usuário autenticado.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Item do histórico removido com sucesso
 */
router.delete('/historico/:id', auth, (req, res) => userController.deleteHistoricoItem(req, res));

module.exports = router;