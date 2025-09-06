const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const UserUseCases = require('../../application/use_cases/UserUseCases');
const auth = require('../../infrastructure/middleware/AuthMiddleware');

const userRepository = new UserRepositoryImpl();
const userUseCases = new UserUseCases(userRepository);
const userController = new UserController(userUseCases);

router.get('/', (req, res) => userController.getAll(req, res));
router.post('/', (req, res) => userController.create(req, res));
router.get('/:id', (req, res) => userController.getById(req, res));
router.put('/:id', (req, res) => userController.update(req, res));
router.delete('/:id', (req, res) => userController.delete(req, res));
router.post('/historico', auth, (req, res) => userController.addHistorico(req, res));
router.get('/historico', auth, (req, res) => userController.getHistorico(req, res));

module.exports = router;