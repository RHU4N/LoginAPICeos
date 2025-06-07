const express = require('express');
const router = express.Router();
const User = require("../models/User");
// Busca todos os proprietários (GET)
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Cadastra um novo proprietário (POST)
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, telefone, assinante, historico } = req.body;
        const newUser = new User({
            nome, email, senha, telefone, assinante, historico
        });
        await newUser.save();
        res.status(201).json({ message: 'Cadastrado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Busca um proprietário por ID (GET)
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
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
        await User.findByIdAndUpdate(req.params.id, {
            nome, email, senha, telefone, assinante, historico
        });
        res.status(200).json({ message: 'Atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;
