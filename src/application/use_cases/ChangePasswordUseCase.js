/**
 * ChangePasswordUseCase - Trocar senha do usuário autenticado
 */

const { ValidationError } = require("../../errors/AppError");
const {
  PasswordSameAsCurrentError,
  InvalidPasswordError,
} = require("../errors/AuthErrors");

class ChangePasswordUseCase {
  constructor(userUseCases, passwordHasher) {
    this.userUseCases = userUseCases;
    this.passwordHasher = passwordHasher;
  }

  /**
   * Executar mudança de senha
   */
  async execute(userId, senhaAtual, novaSenha) {
    if (!userId || !senhaAtual || !novaSenha) {
      throw new ValidationError("Todos os campos são obrigatórios");
    }

    // Buscar usuário (com select de senhaHash)
    const user = await this.userUseCases.getUserByIdWithPassword(userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Validar senha atual
    const senhaAtualValida = await this.passwordHasher.compare(
      senhaAtual,
      user.senhaHash,
    );
    if (!senhaAtualValida) {
      throw new InvalidPasswordError();
    }

    // Validar que nova senha é diferente da atual
    const novaSenhaIgualAnterior = await this.passwordHasher.compare(
      novaSenha,
      user.senhaHash,
    );
    if (novaSenhaIgualAnterior) {
      throw new PasswordSameAsCurrentError();
    }

    // Validar força de nova senha
    if (!this.passwordHasher.isStrong(novaSenha)) {
      throw new ValidationError(
        `Nova senha fraca. Requisitos: ${this.passwordHasher.getRequirements()}`,
      );
    }

    // Gerar hash de nova senha
    const novaSenhaHash = await this.passwordHasher.hash(novaSenha);

    // Atualizar usuário
    user.senhaHash = novaSenhaHash;
    user.atualizadoEm = new Date();

    // Revogar todos os refresh tokens anteriores (força re-login em todos os devices)
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    return { message: "Senha alterada com sucesso" };
  }
}

module.exports = ChangePasswordUseCase;
