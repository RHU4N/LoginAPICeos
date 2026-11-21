const FormulaValidator = require("../src/application/validators/FormulaValidator");
const { ValidationError } = require("../src/errors/AppError");

describe("FormulaValidator", () => {
  const parametros = [{ nome: "x" }, { nome: "y" }];

  test.each([
    "x+y",
    "(x+y)/2",
    "-x+2",
    "x^2 + y^2",
    "2 * pi * x + e",
    "sqrt(x^2 + y^2)",
    "pow(x, 2) + min(x, y, 10)",
    "max(abs(x), round(y))",
  ])("aceita fórmula válida: %s", (formula) => {
    expect(FormulaValidator.validate(formula, parametros)).toBe(true);
  });

  test.each([
    "x+",
    "()",
    "2x",
    "x//y",
    "",
    "   ",
    "x + z",
    "(x + y",
    "x + y)",
    "unknownFn(x)",
    "pow(x)",
    "sqrt(x, y)",
    "(x, y)",
    "process.exit(1)",
    "require('fs')",
    "eval('1+1')",
    "__proto__",
    "constructor",
    "prototype",
  ])("rejeita fórmula inválida: %s", (formula) => {
    expect(() => FormulaValidator.validate(formula, parametros)).toThrow(
      ValidationError,
    );
  });

  test("preserva métodos auxiliares estáticos compatíveis", () => {
    expect(() => FormulaValidator.validateCharacters("x^2 + min(x, 1)")).not.toThrow();
    expect(() => FormulaValidator.validateCharacters("x; y")).toThrow(ValidationError);
    expect(() => FormulaValidator.validateParentheses("(x+y)")).not.toThrow();
    expect(() => FormulaValidator.validateParentheses("((x)")).toThrow(ValidationError);
    expect(() => FormulaValidator.validateVariables("pi * x", [{ nome: "x" }])).not.toThrow();
    expect(() => FormulaValidator.validateVariables("pi * z", [{ nome: "x" }])).toThrow(ValidationError);
    expect(() => FormulaValidator.validateSyntax("x + y")).not.toThrow();
    expect(() => FormulaValidator.validateSyntax("2x")).toThrow(ValidationError);
  });
});
