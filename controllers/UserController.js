const express = require('express');
const router = express.Router();
const User = require("../models/User");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Busca todos os proprietários (GET)
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-senha');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cadastra um novo proprietário (POST)
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, telefone, assinante, historico } = req.body;
        if (!nome || !email || !senha || !telefone) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }
        const hashedSenha = await bcrypt.hash(senha, 10);
        const newUser = new User({
            nome, email, senha: hashedSenha, telefone, assinante, historico
        });
        await newUser.save();
        res.status(201).json({ message: 'Cadastrado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login (POST)
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
        const valid = await bcrypt.compare(senha, user.senha);
        if (!valid) return res.status(401).json({ error: 'Senha inválida' });
        const token = jwt.sign({ id: user._id }, 'seuSegredoJWT', { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Busca um proprietário por ID (GET)
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-senha');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deleta um proprietário por ID (DELETE)
router.delete('/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Altera um proprietário por ID (PUT)
router.put('/:id', async (req, res) => {
    try {
        const { nome, email, senha, telefone, assinante, historico } = req.body;
        let updateData = { nome, email, telefone, assinante, historico };
        if (senha) {
            updateData.senha = await bcrypt.hash(senha, 10);
        }
        await User.findByIdAndUpdate(req.params.id, updateData);
        res.status(200).json({ message: 'Atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
