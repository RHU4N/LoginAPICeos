class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 401;
  }
}

class MissingCredentialsError extends AuthError {
  constructor() {
    super("Email e senha são obrigatórios", 400);
  }
}

class UserNotFoundError extends AuthError {
  constructor() {
    super("Usuário não encontrado", 401);
  }
}

class InvalidPasswordError extends AuthError {
  constructor() {
    super("Senha inválida", 401);
  }
}

class TokenNotProvidedError extends AuthError {
  constructor() {
    super("Token não fornecido", 400);
  }
}

class InvalidTokenError extends AuthError {
  constructor() {
    super("Token inválido", 401);
  }
}

module.exports = {
  AuthError,
  MissingCredentialsError,
  UserNotFoundError,
  InvalidPasswordError,
  TokenNotProvidedError,
  InvalidTokenError
};
