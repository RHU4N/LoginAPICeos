const AuthController = require("../src/interfaces/controllers/AuthController");

function responseDouble() {
  return {
    body: undefined,
    cookies: [],
    status() { return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
  };
}

test("mobile login returns tokens without creating browser cookies", async () => {
  const controller = new AuthController({
    execute: jest.fn().mockResolvedValue({
      accessToken: "access-mobile",
      refreshToken: "refresh-mobile",
      user: { _id: "u1", nome: "Ana", email: "ana@example.com", ativo: true },
    }),
  }, {}, {});
  const res = responseDouble();

  await controller.login({
    body: { email: "ana@example.com", senha: "Senha123!" },
    get: jest.fn().mockReturnValue("mobile"),
  }, res, jest.fn());

  expect(res.body.data).toMatchObject({
    accessToken: "access-mobile",
    refreshToken: "refresh-mobile",
    user: { id: "u1", email: "ana@example.com" },
  });
  expect(res.cookies).toHaveLength(0);
});
