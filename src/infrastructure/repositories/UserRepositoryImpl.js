/**
 * UserRepositoryImpl - Implementação do repositório de usuários
 */

const mongoose = require("mongoose");
const User = require("../../domain/entities/User");
const UserRepository = require("../../domain/repositories/UserRepository");
const Historico = require("../../domain/entities/Historico");

class UserRepositoryImpl extends UserRepository {
  /**
   * Listar todos os usuários (sem senhas)
   */
  async findAll() {
    return await User.find().select(
      "-senhaHash -tentativasLogin -bloqueadoAte -tokenVersion -role",
    );
  }

  /**
   * Buscar usuário por ID (sem senha)
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await User.findById(id).select(
      "-senhaHash -tentativasLogin -bloqueadoAte -tokenVersion -role",
    );
  }

  /**
   * Buscar usuário por ID COM SENHA (para validação)
   */
  async findByIdWithPassword(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await User.findById(id).select("+senhaHash +tokenVersion +role");
  }

  /**
   * Buscar usuário por email (com senha para login)
   */
  async findByEmail(email) {
    if (!email) return null;
    return await User.findOne({ email: email.toLowerCase() }).select(
      "+senhaHash +tentativasLogin +bloqueadoAte +tokenVersion +role",
    );
  }

  /**
   * Criar novo usuário
   */
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  /**
   * Atualizar usuário
   */
  async update(id, userData) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await User.findByIdAndUpdate(id, userData, { new: true }).select(
      "-senhaHash -tentativasLogin -bloqueadoAte -tokenVersion -role",
    );
  }

  /**
   * Deletar usuário
   */
  async delete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    // Deletar usuário e seu histórico
    await Historico.deleteMany({ userId: id });
    return await User.findByIdAndDelete(id);
  }

  /**
   * Adicionar entrada ao histórico
   */
  async addHistorico(userId, historicoData) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;

    const historico = new Historico({
      userId,
      ...historicoData,
    });

    await historico.save();

    // Atualizar contador no usuário
    await User.findByIdAndUpdate(userId, { $inc: { countFavoritos: 0 } });

    return historico;
  }

  /**
   * Obter histórico do usuário
   */
  async getHistorico(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    return await Historico.find({ userId }).sort({ criadoEm: -1 });
  }

  /**
   * Limpar todo o histórico do usuário
   */
  async clearHistorico(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await Historico.deleteMany({ userId });
    return [];
  }

  /**
   * Deletar item específico do histórico
   */
  async deleteHistoricoItem(userId, historicoId) {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(historicoId)
    ) {
      return [];
    }
    await Historico.deleteOne({ _id: historicoId, userId });
    return await Historico.find({ userId }).sort({ criadoEm: -1 });
  }
}

module.exports = UserRepositoryImpl;
