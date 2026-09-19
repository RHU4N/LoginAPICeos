/**
 * UserUseCases - Operações relacionadas a usuários
 */

const {
  UserNotFoundError,
  MissingFieldsError,
} = require("../errors/UserErrors");
const {
  ValidationError,
  DuplicateEmailError,
} = require("../../errors/AppError");

class UserUseCases {
  constructor(userRepository, passwordHasher) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  /**
   * Listar todos os usuários (sem senhas)
   */
  async getAllUsers() {
    return await this.userRepository.findAll();
  }

  /**
   * Buscar usuário por email
   */
  async getUserByEmail(email) {
    if (!email) throw new ValidationError("Email é obrigatório");
    return await this.userRepository.findByEmail(email);
  }

  /**
   * Buscar usuário por ID
   */
  async getUserById(id) {
    if (!id) throw new ValidationError("ID é obrigatório");
    const user = await this.userRepository.findById(id);
    if (!user) throw new UserNotFoundError();
    return user;
  }

  /**
   * Buscar usuário por ID COM SENHA (para validação)
   */
  async getUserByIdWithPassword(id) {
    if (!id) throw new ValidationError("ID é obrigatório");
    return await this.userRepository.findByIdWithPassword(id);
  }

  /**
   * Registrar novo usuário
   */
  async registerUser(data) {
    const { nome, email, senha, telefone, assinante } = data;

    // Validar campos obrigatórios
    if (!nome || !email || !senha || !telefone) {
      throw new MissingFieldsError();
    }

    // Verificar se email já está em uso
    const userExistente = await this.userRepository.findByEmail(email);
    if (userExistente) {
      throw new DuplicateEmailError();
    }

    // Validar força de senha
    if (!this.passwordHasher.isStrong(senha)) {
      throw new ValidationError(
        `Senha fraca. Requisitos: ${this.passwordHasher.getRequirements()}`,
      );
    }

    // Hash de senha
    const senhaHash = await this.passwordHasher.hash(senha);

    // Criar usuário
    return await this.userRepository.create({
      nome,
      email: email.toLowerCase(),
      senhaHash,
      telefone,
      assinante: assinante || false,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
  }

  /**
   * Atualizar dados do usuário (NÃO senha)
   */
  async updateUser(id, data) {
    if (!id) throw new ValidationError("ID é obrigatório");

    const user = await this.getUserById(id);

    // Remover campos que não devem ser atualizados diretamente
    const {
      senhaHash,
      tentativasLogin,
      bloqueadoAte,
      tokenVersion,
      role,
      ...updateData
    } = data;

    // Se email está sendo atualizado, verificar duplicação
    if (updateData.email && updateData.email !== user.email) {
      const userExistente = await this.userRepository.findByEmail(
        updateData.email,
      );
      if (userExistente) {
        throw new DuplicateEmailError();
      }
    }

    updateData.atualizadoEm = new Date();
    return await this.userRepository.update(id, updateData);
  }

  /**
   * Deletar usuário
   */
  async deleteUser(id) {
    if (!id) throw new ValidationError("ID é obrigatório");
    const user = await this.getUserById(id);
    return await this.userRepository.delete(id);
  }

  /**
   * Adicionar entrada ao histórico
   */
  async addHistorico(userId, historico) {
    if (!userId || !historico) {
      throw new ValidationError("userId e histórico são obrigatórios");
    }
    return await this.userRepository.addHistorico(userId, historico);
  }

  /**
   * Obter histórico do usuário
   */
  async getHistorico(userId) {
    if (!userId) throw new ValidationError("userId é obrigatório");
    return await this.userRepository.getHistorico(userId);
  }

  /**
   * Limpar todo o histórico do usuário
   */
  async clearHistorico(userId) {
    if (!userId) throw new ValidationError("userId é obrigatório");
    return await this.userRepository.clearHistorico(userId);
  }

  /**
   * Deletar um item específico do histórico
   */
  async deleteHistoricoItem(userId, historicoId) {
    if (!userId || !historicoId) {
      throw new ValidationError("userId e historicoId são obrigatórios");
    }
    return await this.userRepository.deleteHistoricoItem(userId, historicoId);
  }
}

module.exports = UserUseCases;
