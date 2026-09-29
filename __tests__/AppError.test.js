/**
 * Testes de Erros - Validar estrutura de erros padronizados
 */

const {
  AppError,
  ValidationError,
  UserNotFoundError,
  InvalidPasswordError,
  DuplicateEmailError,
  NotFoundError,
  ForbiddenError,
} = require("../src/errors/AppError");

describe("AppError - Estrutura Padronizada", () => {
  test("ValidationError deve retornar status 400", () => {
    const error = new ValidationError("Dados inválidos");
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe("VALIDATION_ERROR");
  });

  test("UserNotFoundError deve retornar status 401", () => {
    const error = new UserNotFoundError();
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe("USER_NOT_FOUND");
  });

  test("InvalidPasswordError deve retornar status 401", () => {
    const error = new InvalidPasswordError();
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe("INVALID_PASSWORD");
  });

  test("DuplicateEmailError deve retornar status 409", () => {
    const error = new DuplicateEmailError();
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe("EMAIL_ALREADY_EXISTS");
  });

  test("ForbiddenError deve retornar status 403", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe("FORBIDDEN");
  });

  test("NotFoundError deve retornar status 404", () => {
    const error = new NotFoundError("Usuário");
    expect(error.statusCode).toBe(404);
  });

  test("toJSON() deve retornar estrutura correta", () => {
    const error = new ValidationError("Erro de validação");
    const json = error.toJSON();

    expect(json).toEqual({
      success: false,
      error: expect.objectContaining({
        code: "VALIDATION_ERROR",
        message: "Erro de validação",
        statusCode: 400,
      }),
    });
  });
});
