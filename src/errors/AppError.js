/**
 * Estrutura de erros padronizada para toda a API
 */

/**
 * AppError - Classe base para todos os erros da aplicação
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.timestamp = new Date();
    this.name = this.constructor.name;

    // Stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV === "production") {
      this.stack = "";
    }

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        statusCode: this.statusCode,
        ...(process.env.NODE_ENV !== "production" && { stack: this.stack }),
      },
    };
  }
}

/**
 * Erros de Validação (400)
 */
class ValidationError extends AppError {
  constructor(message = "Dados inválidos") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * Erros de Autenticação (401)
 */
class AuthenticationError extends AppError {
  constructor(message = "Credenciais inválidas", code = "INVALID_CREDENTIALS") {
    super(message, 401, code);
  }
}

class UserNotFoundError extends AuthenticationError {
  constructor() {
    super("Usuário não encontrado", "USER_NOT_FOUND");
  }
}

class InvalidPasswordError extends AuthenticationError {
  constructor() {
    super("Senha inválida", "INVALID_PASSWORD");
  }
}

class UserBlockedError extends AuthenticationError {
  constructor(minutosRestantes = 30) {
    super(
      `Conta bloqueada por ${minutosRestantes} minutos. Tente novamente mais tarde.`,
      "USER_BLOCKED",
    );
  }
}

class InvalidTokenError extends AuthenticationError {
  constructor() {
    super("Token inválido ou expirado", "INVALID_TOKEN");
  }
}

class TokenExpiredError extends AuthenticationError {
  constructor() {
    super("Token expirado", "TOKEN_EXPIRED");
  }
}

/**
 * Erros de Autorização (403)
 */
class ForbiddenError extends AppError {
  constructor(
    message = "Você não possui permissão para realizar esta operação",
  ) {
    super(message, 403, "FORBIDDEN");
  }
}

class InsufficientPermissionsError extends ForbiddenError {
  constructor() {
    super("Permissão insuficiente para acessar este recurso");
  }
}

/**
 * Erros de Conflito (409)
 */
class ConflictError extends AppError {
  constructor(message = "Conflito", code = "CONFLICT") {
    super(message, 409, code);
  }
}

class DuplicateEmailError extends ConflictError {
  constructor() {
    super("Este email já está cadastrado", "EMAIL_ALREADY_EXISTS");
  }
}

class DuplicateFavoriteError extends ConflictError {
  constructor() {
    super("Este favorito já existe", "FAVORITE_ALREADY_EXISTS");
  }
}

class PasswordSameAsCurrentError extends ConflictError {
  constructor() {
    super(
      "A nova senha não pode ser igual à senha atual",
      "PASSWORD_SAME_AS_CURRENT",
    );
  }
}

/**
 * Erros de Recurso Não Encontrado (404)
 */
class NotFoundError extends AppError {
  constructor(resource = "Recurso", message = null) {
    super(
      message || `${resource} não encontrado`,
      404,
      `${resource.toUpperCase().replace(" ", "_")}_NOT_FOUND`,
    );
  }
}

class FavoriteNotFoundError extends NotFoundError {
  constructor() {
    super("Favorito", "Favorito não encontrado");
  }
}

class CustomFunctionNotFoundError extends NotFoundError {
  constructor() {
    super("Função Personalizada", "Função personalizada não encontrada");
  }
}

class IoTMeasurementNotFoundError extends NotFoundError {
  constructor() {
    super("Medição IoT", "Medição não encontrada");
  }
}

/**
 * Erro genérico (500)
 */
class InternalServerError extends AppError {
  constructor(message = "Erro interno do servidor") {
    super(message, 500, "INTERNAL_SERVER_ERROR");
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  UserNotFoundError,
  InvalidPasswordError,
  UserBlockedError,
  InvalidTokenError,
  TokenExpiredError,
  ForbiddenError,
  InsufficientPermissionsError,
  ConflictError,
  DuplicateEmailError,
  DuplicateFavoriteError,
  PasswordSameAsCurrentError,
  NotFoundError,
  FavoriteNotFoundError,
  CustomFunctionNotFoundError,
  IoTMeasurementNotFoundError,
  InternalServerError,
};
