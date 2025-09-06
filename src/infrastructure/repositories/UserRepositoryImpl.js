const User = require('../../domain/entities/User');
const UserRepository = require('../../domain/repositories/UserRepository');

class UserRepositoryImpl extends UserRepository {
    async findAll() {
        return await User.find().select('-senha');
    }
    async findById(id) {
        return await User.findById(id).select('-senha');
    }
    async findByEmail(email) {
        return await User.findOne({ email });
    }
    async create(userData) {
        const user = new User(userData);
        return await user.save();
    }
    async update(id, userData) {
        return await User.findByIdAndUpdate(id, userData);
    }
    async delete(id) {
        return await User.findByIdAndDelete(id);
    }
    async addHistorico(userId, historico) {
        const user = await User.findById(userId);
        if (!user) return null;
        user.historico.push(historico);
        await user.save();
        return user;
    }
    async getHistorico(userId) {
        const user = await User.findById(userId).select('historico');
        return user ? user.historico : null;
    }
}

module.exports = UserRepositoryImpl;