// Interface para UserRepository
class UserRepository {
    async findAll() { throw new Error('Not implemented'); }
    async findById(id) { throw new Error('Not implemented'); }
    async findByEmail(email) { throw new Error('Not implemented'); }
    async create(user) { throw new Error('Not implemented'); }
    async update(id, user) { throw new Error('Not implemented'); }
    async delete(id) { throw new Error('Not implemented'); }
    async addHistorico(userId, historico) { throw new Error('Not implemented'); }
    async getHistorico(userId) { throw new Error('Not implemented'); }
    async clearHistorico(userId) { throw new Error('Not implemented'); }
}
module.exports = UserRepository;