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
    async clearHistorico(userId) {
        // Remove all historico entries for the user
        const updated = await User.findByIdAndUpdate(
            userId,
            { $set: { historico: [] } },
            { new: true }
        ).select('historico');
        return updated ? updated.historico : null;
    }

    async deleteHistoricoItem(userId, historicoId) {
        // Pull the subdocument with the provided _id from historico
        const updated = await User.findByIdAndUpdate(
            userId,
            { $pull: { historico: { _id: historicoId } } },
            { new: true }
        ).select('historico');
        return updated ? updated.historico : null;
    }
}

module.exports = UserRepositoryImpl;