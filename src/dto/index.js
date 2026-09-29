/**
 * DTOs Consolidados - Data Transfer Objects para toda API
 * Validação de entrada e padronização de saída
 */

const { ValidationError } = require("../errors/AppError");

// ============================================================================
// AUTH DTOs
// ============================================================================

class LoginDTO {
  constructor(email, senha) {
    this.email = email;
    this.senha = senha;
  }

  validate() {
    if (!this.email || typeof this.email !== "string") {
      throw new ValidationError("Email é obrigatório");
    }
    if (!this.senha || typeof this.senha !== "string") {
      throw new ValidationError("Senha é obrigatória");
    }
  }
}

class RefreshTokenDTO {
  constructor(refreshToken) {
    this.refreshToken = refreshToken;
  }

  validate() {
    if (!this.refreshToken || typeof this.refreshToken !== "string") {
      throw new ValidationError("Refresh token é obrigatório");
    }
  }
}

class ChangePasswordDTO {
  constructor(senhaAtual, novaSenha, confirmaNovaSenha) {
    this.senhaAtual = senhaAtual;
    this.novaSenha = novaSenha;
    this.confirmaNovaSenha = confirmaNovaSenha;
  }

  validate() {
    if (!this.senhaAtual)
      throw new ValidationError("Senha atual é obrigatória");
    if (!this.novaSenha || this.novaSenha.length < 8) {
      throw new ValidationError("Nova senha deve ter pelo menos 8 caracteres");
    }
    if (!/[A-Z]/.test(this.novaSenha)) {
      throw new ValidationError("Nova senha deve conter maiúscula");
    }
    if (!/\d/.test(this.novaSenha)) {
      throw new ValidationError("Nova senha deve conter número");
    }
    if (!/[!@#$%^&*]/.test(this.novaSenha)) {
      throw new ValidationError(
        "Nova senha deve conter caractere especial (!@#$%^&*)",
      );
    }
    if (this.novaSenha !== this.confirmaNovaSenha) {
      throw new ValidationError("Novas senhas não conferem");
    }
  }
}

class UserResponseDTO {
  constructor(user) {
    this.id = user._id;
    this.nome = user.nome;
    this.email = user.email;
    this.telefone = user.telefone;
    this.assinante = user.assinante;
    this.ativo = user.ativo;
    this.ultimoLogin = user.ultimoLogin;
    this.criadoEm = user.criadoEm;
  }
}

class LoginResponseDTO {
  constructor(user) {
    this.user = new UserResponseDTO(user);
  }
}

// ============================================================================
// USER DTOs
// ============================================================================

class CreateUserDTO {
  constructor(data) {
    this.nome = data.nome;
    this.email = data.email;
    this.senha = data.senha;
    this.confirmaSenha = data.confirmaSenha;
    this.telefone = data.telefone;
  }

  validate() {
    if (!this.nome || this.nome.length < 3) {
      throw new ValidationError("Nome deve ter pelo menos 3 caracteres");
    }
    if (
      !this.email ||
      !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(this.email)
    ) {
      throw new ValidationError("Email inválido");
    }
    if (!this.senha || this.senha.length < 8) {
      throw new ValidationError("Senha deve ter pelo menos 8 caracteres");
    }
    if (!/[A-Z]/.test(this.senha)) {
      throw new ValidationError("Senha deve conter maiúscula");
    }
    if (!/\d/.test(this.senha)) {
      throw new ValidationError("Senha deve conter número");
    }
    if (!/[!@#$%^&*]/.test(this.senha)) {
      throw new ValidationError(
        "Senha deve conter caractere especial (!@#$%^&*)",
      );
    }
    if (this.senha !== this.confirmaSenha) {
      throw new ValidationError("Senhas não conferem");
    }
    if (!this.telefone || this.telefone.length < 10) {
      throw new ValidationError("Telefone inválido");
    }
  }
}

class UpdateUserDTO {
  constructor(data) {
    this.nome = data.nome;
    this.telefone = data.telefone;
  }

  validate() {
    if (this.nome && this.nome.length < 3) {
      throw new ValidationError("Nome deve ter pelo menos 3 caracteres");
    }
    if (this.telefone && this.telefone.length < 10) {
      throw new ValidationError("Telefone inválido");
    }
  }
}

// ============================================================================
// HISTORICO DTOs
// ============================================================================

class AddHistoricoDTO {
  constructor(data) {
    this.tipo = data.tipo;
    this.valores = data.valores;
    this.resultado = data.resultado;
  }

  validate() {
    if (!this.tipo) throw new ValidationError("Tipo é obrigatório");
    if (!this.valores) throw new ValidationError("Valores é obrigatório");
    if (!this.resultado) throw new ValidationError("Resultado é obrigatório");
  }
}

class HistoricoResponseDTO {
  constructor(historico) {
    this.id = historico._id;
    this.tipo = historico.tipo;
    this.valores = historico.valores;
    this.resultado = historico.resultado;
    this.criadoEm = historico.criadoEm;
  }
}

// ============================================================================
// FAVORITE DTOs
// ============================================================================

class CreateFavoriteDTO {
  constructor(data) {
    this.resourceId = data.resourceId;
    this.resourceType = data.resourceType;
    this.nome = data.nome;
    this.descricao = data.descricao;
  }

  validate() {
    if (!this.resourceId) throw new ValidationError("resourceId é obrigatório");
    if (
      !this.resourceType ||
      !["custom-function", "calculation", "iot-device"].includes(
        this.resourceType,
      )
    ) {
      throw new ValidationError(
        "resourceType inválido (custom-function, calculation, iot-device)",
      );
    }
    if (!this.nome) throw new ValidationError("Nome é obrigatório");
  }
}

class FavoriteResponseDTO {
  constructor(favorite) {
    this.id = favorite._id;
    this.resourceId = favorite.resourceId;
    this.resourceType = favorite.resourceType;
    this.nome = favorite.nome;
    this.descricao = favorite.descricao;
    this.criadoEm = favorite.criadoEm;
  }
}

// ============================================================================
// CUSTOM FUNCTION DTOs
// ============================================================================

class CreateCustomFunctionDTO {
  constructor(data) {
    this.nome = data.nome;
    this.categoria = data.categoria;
    this.tipo = data.tipo;
    this.parametros = data.parametros || [];
    this.formula = data.formula;
    this.tags = data.tags || [];
    this.publica = data.publica || false;
  }

  validate() {
    if (!this.nome || this.nome.length < 3) {
      throw new ValidationError("Nome deve ter pelo menos 3 caracteres");
    }
    if (
      !this.categoria ||
      !["matematica", "fisica", "quimica", "financeira", "outro"].includes(
        this.categoria,
      )
    ) {
      throw new ValidationError("Categoria inválida");
    }
    if (!this.tipo) throw new ValidationError("Tipo é obrigatório");
    if (!this.formula) throw new ValidationError("Fórmula é obrigatória");
  }
}

class UpdateCustomFunctionDTO {
  constructor(data) {
    this.nome = data.nome;
    this.categoria = data.categoria;
    this.parametros = data.parametros;
    this.formula = data.formula;
    this.tags = data.tags;
    this.publica = data.publica;
  }

  validate() {
    if (this.nome && this.nome.length < 3) {
      throw new ValidationError("Nome deve ter pelo menos 3 caracteres");
    }
    if (
      this.categoria &&
      !["matematica", "fisica", "quimica", "financeira", "outro"].includes(
        this.categoria,
      )
    ) {
      throw new ValidationError("Categoria inválida");
    }
  }
}

class CustomFunctionResponseDTO {
  constructor(func) {
    this.id = func._id;
    this.nome = func.nome;
    this.categoria = func.categoria;
    this.tipo = func.tipo;
    this.parametros = func.parametros;
    this.formula = func.formula;
    this.tags = func.tags;
    this.publica = func.publica;
    this.favoritos = func.favoritos || 0;
    this.usos = func.usos || 0;
    this.criadoEm = func.criadoEm;
  }
}

// ============================================================================
// IoT DTOs
// ============================================================================

class CreateIoTMeasurementDTO {
  constructor(data) {
    this.deviceId = data.deviceId;
    this.sensorId = data.sensorId;
    this.sensorTipo = data.sensorTipo;
    this.valor = data.valor;
    this.unidade = data.unidade;
    this.timestamp = data.timestamp;
    this.localizacao = data.localizacao;
    this.metadata = data.metadata;
    this.idempotencyKey = data.idempotencyKey;
  }

  validate() {
    if (!this.deviceId) throw new ValidationError("deviceId é obrigatório");
    if (!this.sensorId) throw new ValidationError("sensorId é obrigatório");
    if (!this.sensorTipo) throw new ValidationError("sensorTipo é obrigatório");
    if (
      this.valor === null ||
      this.valor === undefined ||
      typeof this.valor !== "number"
    ) {
      throw new ValidationError("valor deve ser número");
    }
    if (!this.unidade) throw new ValidationError("unidade é obrigatória");
    if (!this.timestamp) throw new ValidationError("timestamp é obrigatório");
  }
}

class IoTMeasurementResponseDTO {
  constructor(measurement) {
    this.id = measurement._id;
    this.deviceId = measurement.deviceId;
    this.sensorId = measurement.sensorId;
    this.sensorTipo = measurement.sensorTipo;
    this.valor = measurement.valor;
    this.unidade = measurement.unidade;
    this.timestamp = measurement.timestamp;
    this.localizacao = measurement.localizacao;
    this.criadoEm = measurement.criadoEm;
  }
}

class QueryIoTDTO {
  constructor(query) {
    this.deviceId = query.deviceId;
    this.sensorId = query.sensorId;
    this.sensorTipo = query.sensorTipo;
    this.page = parseInt(query.page, 10) || 1;
    this.limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
    this.startDate = query.startDate;
    this.endDate = query.endDate;
  }

  validate() {
    if (this.page < 1) throw new ValidationError("page deve ser >= 1");
    if (this.limit < 1 || this.limit > 1000)
      throw new ValidationError("limit deve estar entre 1 e 1000");
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Auth
  LoginDTO,
  RefreshTokenDTO,
  LoginResponseDTO,
  ChangePasswordDTO,
  UserResponseDTO,

  // User
  CreateUserDTO,
  UpdateUserDTO,

  // Historico
  AddHistoricoDTO,
  HistoricoResponseDTO,

  // Favorite
  CreateFavoriteDTO,
  FavoriteResponseDTO,

  // CustomFunction
  CreateCustomFunctionDTO,
  UpdateCustomFunctionDTO,
  CustomFunctionResponseDTO,

  // IoT
  CreateIoTMeasurementDTO,
  IoTMeasurementResponseDTO,
  QueryIoTDTO,
};
