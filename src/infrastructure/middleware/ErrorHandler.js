/**
 * Middleware de tratamento de erros
 */

const { AppError } = require("../../errors/AppError");
const environment = require("../../config/environment");

/**
 * Middleware de tratamento de erro global
 */
function errorHandler(err, req, res, next) {
  // Log do erro (sem expor detalhes em produção)
  if (environment.isDevelopment()) {
    console.error("❌ Erro:", err);
  } else {
    console.error(`❌ ${err.name}: ${err.message}`);
  }

  // Se for AppError, retornar resposta padronizada
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Se for erro de validação do Mongoose
  if (err.name === "ValidationError") {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: Object.values(err.errors).map((e) => e.message),
      },
    });
  }

  // Se for erro de Cast do Mongoose (ID inválido)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ID",
        message: "ID inválido",
      },
    });
  }

  // Erro de chave duplicada (unique index)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_FIELD",
        message: `${field} já está em uso`,
      },
    });
  }

  // Se for erro JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Token inválido",
      },
    });
  }

  // Erro genérico/desconhecido
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro interno do servidor",
      ...(environment.isDevelopment() && { debug: err.message }),
    },
  });
}

module.exports = errorHandler;
