const { UserResponseDTO, AddHistoricoDTO } = require("../src/dto");

describe("DTOs públicos", () => {
  test("preserva id de objetos públicos que não são documentos Mongoose", () => {
    const response = new UserResponseDTO({
      id: "user-public-id",
      nome: "Ana",
      email: "ana@example.com",
      telefone: "11999999999",
      assinante: false,
      ativo: true,
      senhaHash: "não deve ser copiado",
    });

    expect(response).toMatchObject({ id: "user-public-id", email: "ana@example.com" });
    expect(response).not.toHaveProperty("senhaHash");
  });

  test("aceita resultado zero no histórico", () => {
    expect(() => new AddHistoricoDTO({ tipo: "subtracao", valores: "1,1", resultado: 0 }).validate())
      .not.toThrow();
  });

  test("aceita endereço de email válido com sinal de mais", () => {
    const dto = new (require("../src/dto").CreateUserDTO)({
      nome: "Usuário Teste",
      email: "teste+ci@example.com",
      senha: "Senha123!",
      confirmaSenha: "Senha123!",
      telefone: "11999999999",
    });

    expect(() => dto.validate()).not.toThrow();
  });
});
