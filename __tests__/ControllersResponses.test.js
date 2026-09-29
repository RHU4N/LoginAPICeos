const AuthController = require("../src/interfaces/controllers/AuthController");
const UserController = require("../src/interfaces/controllers/UserController");
const HistoricoController = require("../src/interfaces/controllers/HistoricoController");

function responseDouble() {
  return {
    statusCode: undefined,
    body: undefined,
    cookies: [],
    clearedCookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
    clearCookie(...args) { this.clearedCookies.push(args); return this; },
  };
}

const user = {
  _id: "u1",
  nome: "Ana Silva",
  email: "ana@example.com",
  telefone: "11999999999",
  assinante: false,
  ativo: true,
  senhaHash: "nunca-expor",
  tokenVersion: 4,
};

describe("respostas dos controllers", () => {
  test("login retorna o usuário público no contrato esperado pelo frontend", async () => {
    const loginUseCase = {
      execute: jest.fn().mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user,
      }),
    };
    const controller = new AuthController(loginUseCase, {}, {});
    const res = responseDouble();
    const next = jest.fn();

    await controller.login({ body: { email: user.email, senha: "Senha123!" } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "Login realizado com sucesso",
      data: { user: { id: "u1", email: user.email }, expiresIn: "15m" },
    });
    expect(res.body.data.user).not.toHaveProperty("senhaHash");
    expect(res.body.data.user).not.toHaveProperty("tokenVersion");
    expect(res.cookies).toHaveLength(2);
  });

  test("consultas e alterações de usuário usam dados públicos e status corretos", async () => {
    const useCases = {
      getAllUsers: jest.fn().mockResolvedValue([user]),
      getUserById: jest.fn().mockResolvedValue(user),
      registerUser: jest.fn().mockResolvedValue(user),
      updateUser: jest.fn().mockResolvedValue(user),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new UserController(useCases);
    const next = jest.fn();

    const list = responseDouble();
    await controller.getAll({}, list, next);
    expect(list.body.data[0]).not.toHaveProperty("senhaHash");

    const byId = responseDouble();
    await controller.getById({ params: { id: "u1" } }, byId, next);
    expect(byId.body.message).toBe("Usuário consultado com sucesso");

    const create = responseDouble();
    await controller.create({ body: { nome: "Ana Silva", email: user.email, senha: "Senha123!", confirmaSenha: "Senha123!", telefone: user.telefone } }, create, next);
    expect(create.statusCode).toBe(201);
    expect(create.body.data).not.toHaveProperty("senhaHash");

    const update = responseDouble();
    await controller.update({ params: { id: "u1" }, body: { nome: "Ana Maria", telefone: user.telefone } }, update, next);
    expect(update.statusCode).toBe(200);

    const deletion = responseDouble();
    await controller.delete({ params: { id: "u1" } }, deletion, next);
    expect(deletion.body).toEqual({ success: true, message: "Usuário excluído com sucesso", data: null });
    expect(next).not.toHaveBeenCalled();
  });

  test("histórico retorna registros em data e usa 201 na criação", async () => {
    const historico = { _id: "h1", tipo: "soma", valores: "1,2", resultado: 3 };
    const repository = {
      addHistorico: jest.fn().mockResolvedValue(historico),
      getHistorico: jest.fn().mockResolvedValue([historico]),
      deleteHistoricoItem: jest.fn().mockResolvedValue([]),
      clearHistorico: jest.fn().mockResolvedValue([]),
    };
    const controller = new HistoricoController(repository);
    const next = jest.fn();

    const add = responseDouble();
    await controller.add({ userId: "u1", body: { tipo: "soma", valores: "1,2", resultado: 3 } }, add, next);
    expect(add.statusCode).toBe(201);
    expect(add.body.data).toEqual(historico);

    const list = responseDouble();
    await controller.list({ userId: "u1", query: {} }, list, next);
    expect(list.body.data).toEqual([historico]);
    expect(list.body.pagination).toMatchObject({ total: 1 });

    const deletion = responseDouble();
    await controller.delete({ userId: "u1", params: { id: "h1" } }, deletion, next);
    expect(deletion.body.data).toEqual([]);

    const clear = responseDouble();
    await controller.clear({ userId: "u1", query: { confirmed: "true" } }, clear, next);
    expect(clear.body).toEqual({ success: true, message: "Histórico limpo com sucesso", data: null });
    expect(next).not.toHaveBeenCalled();
  });
});
