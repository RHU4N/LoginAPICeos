const express = require("express");
const request = require("supertest");
const AuthController = require("../src/interfaces/controllers/AuthController");
const ChangePasswordUseCase = require("../src/application/use_cases/ChangePasswordUseCase");
const errorHandler = require("../src/infrastructure/middleware/ErrorHandler");

describe("troca de senha - contrato HTTP", () => {
  test("rejeita reutilizar a senha atual com 409 e código específico", async () => {
    const user = { senhaHash: "hash-atual", tokenVersion: 0, save: jest.fn() };
    const userUseCases = { getUserByIdWithPassword: jest.fn().mockResolvedValue(user) };
    const passwordHasher = {
      compare: jest.fn().mockResolvedValue(true),
      isStrong: jest.fn().mockReturnValue(true),
      getRequirements: jest.fn(),
    };
    const controller = new AuthController({}, {}, new ChangePasswordUseCase(userUseCases, passwordHasher));
    const app = express();
    app.use(express.json());
    app.post("/auth/change-password", (req, res, next) => {
      req.userId = "u1";
      return controller.changePassword(req, res, next);
    });
    app.use(errorHandler);

    const response = await request(app).post("/auth/change-password").send({
      senhaAtual: "Senha123!",
      novaSenha: "Senha123!",
      confirmaNovaSenha: "Senha123!",
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "PASSWORD_SAME_AS_CURRENT", statusCode: 409 },
    });
    expect(user.save).not.toHaveBeenCalled();
  });
});
