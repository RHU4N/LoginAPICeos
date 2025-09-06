const express = require('express');
const router = express.Router();
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const UserUseCases = require('../../application/use_cases/UserUseCases');
const userRepository = new UserRepositoryImpl();
const userUseCases = new UserUseCases(userRepository);
const jwt = require('jsonwebtoken');

// Middleware para autenticação JWT
function auth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    jwt.verify(token, 'seuSegredoJWT', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.userId = user.id;
        next();
    });
}

// Busca todos os usuários (GET)
router.get('/', async (req, res) => {
    try {
        const users = await userUseCases.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cadastra um novo usuário (POST)
router.post('/', async (req, res) => {
    try {
        await userUseCases.registerUser(req.body);
        res.status(201).json({ message: 'Cadastrado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login (POST)
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const token = await userUseCases.loginUser(email, senha);
        res.json({ token });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Busca um usuário por ID (GET)
router.get('/:id', async (req, res) => {
    try {
        const user = await userUseCases.getUserById(req.params.id);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deleta um usuário por ID (DELETE)
router.delete('/:id', async (req, res) => {
    try {
        await userUseCases.deleteUser(req.params.id);
        res.status(200).json({ message: 'Excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Altera um usuário por ID (PUT)
router.put('/:id', async (req, res) => {
    try {
        await userUseCases.updateUser(req.params.id, req.body);
        res.status(200).json({ message: 'Atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Adiciona um item ao histórico do usuário autenticado
router.post('/historico', auth, async (req, res) => {
    try {
        const { tipo, valores, resultado } = req.body;
        if (!tipo || !valores || !resultado) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }
        await userUseCases.addHistorico(req.userId, { tipo, valores, resultado });
        res.status(201).json({ message: 'Histórico salvo com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retorna o histórico do usuário autenticado
router.get('/historico', auth, async (req, res) => {
    try {
        const historico = await userUseCases.getHistorico(req.userId);
        res.status(200).json(historico);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;