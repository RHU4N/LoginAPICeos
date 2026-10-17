const FormulaValidator = require("../src/application/validators/FormulaValidator");

describe("FormulaValidator", () => {
  const parametros = [{ nome: "x" }, { nome: "y" }];

  test.each(["x+y", "(x+y)/2", "-x+2"]) ("aceita fórmula válida: %s", (formula) => {
    expect(FormulaValidator.validate(formula, parametros)).toBe(true);
  });

  test.each(["x+", "()", "2x", "x//y"]) ("rejeita fórmula inválida: %s", (formula) => {
    expect(() => FormulaValidator.validate(formula, parametros)).toThrow();
  });
});
