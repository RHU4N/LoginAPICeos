/**
 * Bcrypt Password Hasher - Criptografia segura de senhas
 */

const bcrypt = require("bcrypt");
const authConfig = require("../../config/auth");
const { ValidationError } = require("../../errors/AppError");

class BcryptPasswordHasher {
  /**
   * Hash de senha com Bcrypt
   * @param {string} password - Senha em texto plano
   * @returns {Promise<string>} - Senha hasheada
   */
  async hash(password) {
    if (!password || typeof password !== "string") {
      throw new ValidationError("Senha inválida");
    }

    try {
      return await bcrypt.hash(password, authConfig.password.hashRounds);
    } catch (error) {
      throw new Error(`Erro ao hashear senha: ${error.message}`);
    }
  }

  /**
   * Comparar senha em texto plano com hash
   * @param {string} plainPassword - Senha em texto plano
   * @param {string} hashedPassword - Senha hasheada
   * @returns {Promise<boolean>} - True se confere
   */
  async compare(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error(`Erro ao comparar senhas: ${error.message}`);
    }
  }

  /**
   * Validar força de senha sem hashear
   * @param {string} password - Senha para validar
   * @returns {boolean} - True se senha é forte
   */
  isStrong(password) {
    return authConfig.password.isStrong(password);
  }

  /**
   * Obter requisitos de senha
   * @returns {string} - Mensagem com requisitos
   */
  getRequirements() {
    return authConfig.password.getRequirements();
  }
}

module.exports = BcryptPasswordHasher;
