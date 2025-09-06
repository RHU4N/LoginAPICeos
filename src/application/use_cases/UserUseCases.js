const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserUseCases {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async getAllUsers() {
        return await this.userRepository.findAll();
    }

    async getUserById(id) {
        return await this.userRepository.findById(id);
    }

    async registerUser(data) {
        const { nome, email, senha, telefone, assinante, historico } = data;
        if (!nome || !email || !senha || !telefone) {
            throw new Error('Campos obrigatórios faltando');
        }
        const hashedSenha = await bcrypt.hash(senha, 10);
        return await this.userRepository.create({ nome, email, senha: hashedSenha, telefone, assinante, historico });
    }

    async loginUser(email, senha) {
        if (!email || !senha) {
            throw new Error('Email e senha são obrigatórios');
        }
        const user = await this.userRepository.findByEmail(email);
        if (!user) throw new Error('Usuário não encontrado');
        const valid = await bcrypt.compare(senha, user.senha);
        if (!valid) throw new Error('Senha inválida');
        const token = jwt.sign({ id: user._id }, 'seuSegredoJWT', { expiresIn: '1h' });
        return token;
    }

    async updateUser(id, data) {
        let updateData = { ...data };
        if (data.senha) {
            updateData.senha = await bcrypt.hash(data.senha, 10);
        }
        return await this.userRepository.update(id, updateData);
    }

    async deleteUser(id) {
        return await this.userRepository.delete(id);
    }

    async addHistorico(userId, historico) {
        return await this.userRepository.addHistorico(userId, historico);
    }

    async getHistorico(userId) {
        return await this.userRepository.getHistorico(userId);
    }
}

module.exports = UserUseCases;