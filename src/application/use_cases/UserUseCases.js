const {
    UserNotFoundError,
    MissingFieldsError,
} = require('../errors/UserErrors')
const jwt = require('jsonwebtoken'); // Importando jsonwebtoken

class UserUseCases {
    constructor(userRepository, passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    async getAllUsers() {
        return await this.userRepository.findAll();
    }

    async getUserByEmail(email) {
        return await this.userRepository.findByEmail(email);
    }

    async getUserById(id) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new UserNotFoundError();
        return user;
    }

    async registerUser(data) {
        const { nome, email, senha, telefone, assinante, historico } = data;
        if (!nome || !email || !senha || !telefone) {
            throw new MissingFieldsError();
        }
        const hashedSenha = await this.passwordHasher.hash(senha);
        return await this.userRepository.create({ nome, email, senha: hashedSenha, telefone, assinante, historico });
    }

    async updateUser(id, data) {
        let updateData = { ...data };
        if (data.senha) {
            updateData.senha = await this.passwordHasher.hash(data.senha);
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

    async clearHistorico(userId) {
        return await this.userRepository.clearHistorico(userId);
    }
    
    async login(email, senha) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new UserNotFoundError();
        }

        const isPasswordValid = await this.passwordHasher.compare(senha, user.senha);
        if (!isPasswordValid) {
            throw new Error('Credenciais inválidas');
        }

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        return { token, user: { id: user._id, email: user.email, nome: user.nome } };
    }
}

module.exports = UserUseCases;