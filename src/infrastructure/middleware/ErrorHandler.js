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

  // Erros legados da aplicação também informam statusCode; não devem virar 500.
  if (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600) {
    const codeByStatus = {
      400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
      404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR",
    };
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode || codeByStatus[err.statusCode] || "REQUEST_ERROR",
        message: err.message || "Não foi possível concluir a solicitação",
        statusCode: err.statusCode,
      },
    });
  }

  // JSON malformado enviado no body.
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "O corpo da requisição contém JSON inválido", statusCode: 400 },
    });
  }

  // Se for erro de validação do Mongoose
  if (err.name === "ValidationError") {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        statusCode: 422,
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
        statusCode: 400,
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
        message: `O campo ${field} já está em uso`,
        statusCode: 409,
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
        statusCode: 401,
      },
    });
  }

  // Erro genérico/desconhecido
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocorreu um erro interno. Tente novamente mais tarde.",
      statusCode: 500,
    },
  });
}

module.exports = errorHandler;
