const successResponse = require("../src/interfaces/responses/successResponse");

function responseDouble() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe("successResponse", () => {
  test("usa status, mensagem e dados padrão", () => {
    const res = responseDouble();
    successResponse(res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Operação realizada com sucesso",
      data: null,
    });
  });

  test("preserva status, mensagem e objeto informados", () => {
    const res = responseDouble();
    successResponse(res, { id: "u1" }, "Criado com sucesso", 201);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: "Criado com sucesso",
      data: { id: "u1" },
    });
  });

  test("retorna arrays sem descartá-los", () => {
    const res = responseDouble();
    successResponse(res, ["a", "b"], "Itens consultados");

    expect(res.body.data).toEqual(["a", "b"]);
  });
});
