/**
 * DTOs Consolidados - Data Transfer Objects para toda API
 * Validação de entrada e padronização de saída
 */

const { ValidationError } = require("../errors/AppError");

// Importar validação e avaliação segura de formula para funções personalizadas
const FormulaValidator = require("../../src/application/validators/FormulaValidator");
const FormulaEvaluator = require("../../src/application/services/FormulaEvaluator");

const VALID_CUSTOM_FUNCTION_CATEGORIES = [
  "matematica",
  "fisica",
  "quimica",
  "financeira",
  "outro",
];
const MAX_METADATA_BYTES = 2048;
const RESERVED_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function validateMetadataNode(value, seen) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new ValidationError("metadata contém número não finito");
    }
    return;
  }
  if (value === undefined) return;
  if (typeof value !== "object") {
    throw new ValidationError("metadata contém tipo não serializável");
  }
  if (seen.has(value)) {
    throw new ValidationError("metadata contém referência circular");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      validateMetadataNode(item, seen);
    }
    return;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new ValidationError("metadata deve conter apenas objetos planos");
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (RESERVED_METADATA_KEYS.has(key)) {
      throw new ValidationError(`metadata contém chave reservada não permitida: ${key}`);
    }
    validateMetadataNode(value[key], seen);
  }
}

function validatePlainMetadata(metadata) {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new ValidationError("metadata deve ser um objeto plano");
  }
  const proto = Object.getPrototypeOf(metadata);
  if (proto !== Object.prototype && proto !== null) {
    throw new ValidationError("metadata deve ser um objeto plano");
  }
  validateMetadataNode(metadata, new WeakSet());

  let serialized;
  try {
    serialized = JSON.stringify(metadata);
  } catch {
    throw new ValidationError("metadata não é serializável");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MAX_METADATA_BYTES) {
    throw new ValidationError("metadata excede o limite de 2KB");
  }
}

function validateOptionalDescricao(descricao) {
  if (descricao === undefined) return undefined;
  if (typeof descricao !== "string") {
    throw new ValidationError("Descrição deve ser uma string");
  }
  const trimmed = descricao.trim();
  if (trimmed.length > 500) {
    throw new ValidationError("Descrição deve ter no máximo 500 caracteres");
  }
  return trimmed;
}

function validateCustomFunctionName(nome) {
  if (
    typeof nome !== "string" ||
    nome.trim().length < 3 ||
    nome.trim().length > 100
  ) {
    throw new ValidationError("Nome deve ter entre 3 e 100 caracteres");
  }
  return nome.trim();
}

function validateCustomFunctionType(tipo) {
  if (
    typeof tipo !== "string" ||
    !tipo.trim() ||
    tipo.trim().length > 60
  ) {
    throw new ValidationError("Tipo inválido");
  }
  return tipo.trim();
}

function validateCustomFunctionTags(tags) {
  if (!Array.isArray(tags) || tags.length > 20) {
    throw new ValidationError("tags deve ser uma lista com no máximo 20 itens");
  }
  return tags.map((tag) => {
    if (typeof tag !== "string" || tag.trim().length > 40) {
      throw new ValidationError("Cada tag deve ser uma string de até 40 caracteres");
    }
    return tag.trim();
  }).filter(Boolean);
}

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
    this.id = user.id || user._id?.toString?.() || user._id;
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
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)
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
    if (this.resultado === undefined || this.resultado === null) {
      throw new ValidationError("Resultado é obrigatório");
    }
  }
}

class HistoricoResponseDTO {
  constructor(historico) {
    this.id = historico.id || historico._id?.toString?.() || historico._id;
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
  constructor(data = {}) {
    const payload = data && typeof data === "object" ? data : {};
    this.resourceId = payload.resourceId;
    this.resourceType = payload.resourceType;
    this.nome = payload.nome;
    this.descricao = payload.descricao;
    this.metadata = payload.metadata;
  }

  validate() {
    if (typeof this.resourceId !== "string") {
      if (
        this.resourceId &&
        typeof this.resourceId === "object" &&
        typeof this.resourceId.toHexString === "function" &&
        /^[a-fA-F0-9]{24}$/.test(this.resourceId.toHexString())
      ) {
        this.resourceId = this.resourceId.toHexString();
      } else {
        throw new ValidationError("resourceId é obrigatório e deve ser uma string");
      }
    }
    this.resourceId = this.resourceId.trim();
    if (!this.resourceId || !/^[a-zA-Z0-9:_-]{1,120}$/.test(this.resourceId)) {
      throw new ValidationError(
        "resourceId inválido (use de 1 a 120 caracteres: letras, números, ':', '_' ou '-')",
      );
    }

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

    if (
      typeof this.nome !== "string" ||
      !this.nome.trim() ||
      this.nome.trim().length > 120
    ) {
      throw new ValidationError(
        "Nome é obrigatório e deve ter no máximo 120 caracteres",
      );
    }
    this.nome = this.nome.trim();

    if (this.descricao !== undefined) {
      this.descricao = validateOptionalDescricao(this.descricao);
    }

    if (this.metadata !== undefined) {
      validatePlainMetadata(this.metadata);
    }
  }
}

class FavoriteResponseDTO {
  constructor(favorite) {
    this.id = favorite._id
      ? String(favorite._id)
      : favorite.id
        ? String(favorite.id)
        : undefined;
    this.resourceId = String(favorite.resourceId);
    this.resourceType = favorite.resourceType;
    this.nome = favorite.nome;
    this.descricao = favorite.descricao;
    if (favorite.metadata !== undefined) this.metadata = favorite.metadata;
    this.criadoEm = favorite.criadoEm;
  }
}

// ============================================================================
// CUSTOM FUNCTION DTOs
// ============================================================================

class CreateCustomFunctionDTO {
  constructor(data = {}) {
    const payload = data && typeof data === "object" ? data : {};
    this.nome = payload.nome;
    this.descricao =
      payload.descricao === undefined
        ? undefined
        : typeof payload.descricao === "string"
          ? payload.descricao.trim()
          : payload.descricao;
    this.categoria = payload.categoria;
    this.tipo = payload.tipo === undefined ? "formula" : payload.tipo;
    this.parametros =
      payload.parametros === undefined ? [] : payload.parametros;
    this.formula = payload.formula;
    this.tags = payload.tags === undefined ? [] : payload.tags;
    this.publica = payload.publica === undefined ? false : payload.publica;
  }

  validate() {
    this.nome = validateCustomFunctionName(this.nome);
    if (this.descricao !== undefined) {
      this.descricao = validateOptionalDescricao(this.descricao);
    }

    if (
      !this.categoria ||
      !VALID_CUSTOM_FUNCTION_CATEGORIES.includes(this.categoria)
    ) {
      throw new ValidationError("Categoria inválida");
    }

    this.tipo = validateCustomFunctionType(this.tipo);

    FormulaEvaluator.validateParametersList(this.parametros);

    this.tags = validateCustomFunctionTags(this.tags);
    if (typeof this.publica !== "boolean") {
      throw new ValidationError("publica deve ser booleano");
    }

    FormulaValidator.validate(this.formula, this.parametros);
  }
}

class UpdateCustomFunctionDTO {
  constructor(data = {}) {
    const payload = data && typeof data === "object" ? data : {};
    this.nome = payload.nome;
    this.descricao = payload.descricao;
    this.categoria = payload.categoria;
    this.tipo = payload.tipo;
    this.parametros = payload.parametros;
    this.formula = payload.formula;
    this.tags = payload.tags;
    this.publica = payload.publica;
  }

  validate() {
    if (this.nome !== undefined) {
      this.nome = validateCustomFunctionName(this.nome);
    }

    if (this.descricao !== undefined) {
      this.descricao = validateOptionalDescricao(this.descricao);
    }

    if (
      this.categoria !== undefined &&
      !VALID_CUSTOM_FUNCTION_CATEGORIES.includes(this.categoria)
    ) {
      throw new ValidationError("Categoria inválida");
    }

    if (this.tipo !== undefined) {
      this.tipo = validateCustomFunctionType(this.tipo);
    }

    if (this.parametros !== undefined) {
      FormulaEvaluator.validateParametersList(this.parametros);
    }

    if (this.formula !== undefined && this.parametros !== undefined) {
      FormulaValidator.validate(this.formula, this.parametros);
    } else if (this.formula !== undefined) {
      FormulaEvaluator.parse(this.formula);
    }

    if (this.tags !== undefined) {
      this.tags = validateCustomFunctionTags(this.tags);
    }

    if (this.publica !== undefined && typeof this.publica !== "boolean") {
      throw new ValidationError("publica deve ser booleano");
    }
  }

  toUpdateData() {
    const update = {};
    for (const key of [
      "nome",
      "descricao",
      "categoria",
      "tipo",
      "parametros",
      "formula",
      "tags",
      "publica",
    ]) {
      if (this[key] !== undefined) {
        update[key] = this[key];
      }
    }
    return update;
  }
}

class CustomFunctionResponseDTO {
  constructor(func) {
    this.id = func._id
      ? String(func._id)
      : func.id
        ? String(func.id)
        : undefined;
    this.nome = func.nome;
    this.descricao = func.descricao || "";
    this.categoria = func.categoria;
    this.tipo = func.tipo;
    this.parametros = func.parametros;
    this.formula = func.formula;
    this.tags = func.tags;
    this.publica = func.publica;
    this.favoritos = func.favoritos || 0;
    this.usos = func.usos || 0;
    this.criadoEm = func.criadoEm;
    this.atualizadoEm = func.atualizadoEm;
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
    this.metadata = measurement.metadata;
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
    this.order = query.order || 'desc';
    this.eventId = query.eventId;
  }

  validate() {
    if (this.page < 1) throw new ValidationError("page deve ser >= 1");
    for (const key of ['deviceId', 'sensorId', 'sensorTipo', 'eventId']) if (this[key] !== undefined && (typeof this[key] !== 'string' || this[key].length > 100)) throw new ValidationError('Filtro inválido.');
    if (!['asc', 'desc'].includes(this.order)) throw new ValidationError('Ordenação inválida.');
    for (const key of ['startDate', 'endDate']) if (this[key] && (typeof this[key] !== 'string' || !Number.isFinite(Date.parse(this[key])))) throw new ValidationError('Data inválida.');
    if (this.startDate && this.endDate && Date.parse(this.startDate) > Date.parse(this.endDate)) throw new ValidationError('Período inválido.');
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
