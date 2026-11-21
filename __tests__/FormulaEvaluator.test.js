const FormulaEvaluator = require("../src/application/services/FormulaEvaluator");
const { ValidationError } = require("../src/errors/AppError");

describe("FormulaEvaluator", () => {
  describe("parse e extractVariables", () => {
    test("extrai variáveis únicas excluindo constantes pi/e e funções permitidas", () => {
      const vars = FormulaEvaluator.extractVariables(
        "2 * pi * r + sqrt(r^2 + h^2) + e - r",
      );
      expect(vars).toEqual(["r", "h"]);
    });

    test("respeita precedência e associatividade à direita do operador ^", () => {
      const params = [{ nome: "a" }, { nome: "b" }, { nome: "c" }];
      const res = FormulaEvaluator.evaluate("a^b^c", params, { a: 2, b: 3, c: 2 });
      expect(res.resultado).toBe(512);

      const precedence = FormulaEvaluator.evaluate("2 + 3 * 4^2", [], {});
      expect(precedence.resultado).toBe(50);

      const unaryPower = FormulaEvaluator.evaluate("-x^2", [{ nome: "x" }], { x: 3 });
      expect(unaryPower.resultado).toBe(-9);

      const parenUnaryPower = FormulaEvaluator.evaluate("(-x)^2", [{ nome: "x" }], { x: 3 });
      expect(parenUnaryPower.resultado).toBe(9);

      const negExp = FormulaEvaluator.evaluate("2^-3", [], {});
      expect(negExp.resultado).toBe(0.125);
    });

    test.each([
      "",
      "   ",
      "x+",
      "()",
      "2x",
      "x//y",
      "((x+1)",
      "(x+1))",
      "1.2.3",
      "5.",
      ".5",
      "unknown(1)",
      "sqrt()",
      "sqrt(1, 2)",
      "pow(2)",
      "pow(2, 3, 4)",
      "min(5)",
      "max(5)",
      "(1, 2)",
      "1, 2",
      "sqrt + 1",
      "pi(2)",
    ])("rejeita sintaxe inválida: %s", (formula) => {
      expect(() => FormulaEvaluator.parse(formula)).toThrow(ValidationError);
    });
  });

  describe("validate", () => {
    test("valida fórmula e retorna variaveisDetectadas", () => {
      const result = FormulaEvaluator.validate("0.5 * m * v^2 + pi", [
        { nome: "m" },
        { nome: "v" },
      ]);
      expect(result).toEqual({
        valida: true,
        variaveisDetectadas: ["m", "v"],
      });
    });

    test("rejeita variável não declarada nos parâmetros", () => {
      expect(() =>
        FormulaEvaluator.validate("a + b", [{ nome: "a" }]),
      ).toThrow(ValidationError);
    });

    test("rejeita nomes reservados e parâmetros duplicados", () => {
      for (const nome of ["__proto__", "constructor", "prototype", "pi", "e", "sqrt"]) {
        expect(() =>
          FormulaEvaluator.validate("1 + 1", [{ nome }]),
        ).toThrow(ValidationError);
      }

      expect(() =>
        FormulaEvaluator.validate("x + 1", [{ nome: "x" }, { nome: "x" }]),
      ).toThrow(ValidationError);
    });
  });

  describe("evaluate", () => {
    test("executa funções matemáticas e constantes corretamente", () => {
      expect(
        FormulaEvaluator.evaluate(
          "sqrt(a^2 + b^2)",
          [{ nome: "a" }, { nome: "b" }],
          { a: 3, b: 4 },
        ),
      ).toEqual({
        resultado: 5,
        resultadoFormatado: "5",
        substituicao: "sqrt(3^2 + 4^2)",
        parametrosUsados: { a: 3, b: 4 },
      });

      expect(FormulaEvaluator.evaluate("sin(pi / 2) + cos(pi)", [], {}).resultado).toBe(0);
      expect(FormulaEvaluator.evaluate("ln(e) + log(100) + exp(0)", [], {}).resultado).toBe(4);
      expect(FormulaEvaluator.evaluate("pow(2, 5) + min(10, 4, 7) + max(1, 9, 3)", [], {}).resultado).toBe(45);
      expect(FormulaEvaluator.evaluate("round(3.6) + floor(3.9) + ceil(3.1) + abs(-5)", [], {}).resultado).toBe(16);
    });

    test("limpa imprecisão IEEE-754 e normaliza -0 para 0", () => {
      const sum = FormulaEvaluator.evaluate("0.1 + 0.2", [], {});
      expect(sum.resultado).toBe(0.3);
      expect(sum.resultadoFormatado).toBe("0.3");

      const negZero = FormulaEvaluator.evaluate("0 * -5", [], {});
      expect(Object.is(negZero.resultado, 0)).toBe(true);
    });

    test("monta substituicao corretamente para valores positivos e negativos", () => {
      const res = FormulaEvaluator.evaluate(
        "m * x + min(m, 10)",
        [{ nome: "m" }, { nome: "x" }],
        { m: 2, x: -3 },
      );
      expect(res.resultado).toBe(-4);
      expect(res.substituicao).toBe("2 * (-3) + min(2, 10)");
      expect(res.parametrosUsados).toEqual({ m: 2, x: -3 });
    });

    test("permite omitir parâmetro opcional não usado, mas exige quando usado ou obrigatório", () => {
      const params = [
        { nome: "x", obrigatorio: true },
        { nome: "opt", obrigatorio: false },
      ];
      expect(FormulaEvaluator.evaluate("x * 2", params, { x: 4 }).resultado).toBe(8);

      expect(() =>
        FormulaEvaluator.evaluate("x + opt", params, { x: 4 }),
      ).toThrow(ValidationError);

      expect(() =>
        FormulaEvaluator.evaluate("2 + 2", [{ nome: "req", obrigatorio: true }], {}),
      ).toThrow(ValidationError);
    });

    test("rejeita divisão por zero e erros de domínio", () => {
      expect(() =>
        FormulaEvaluator.evaluate("x / y", [{ nome: "x" }, { nome: "y" }], { x: 10, y: 0 }),
      ).toThrow("Divisão por zero ou operação indefinida");

      expect(() => FormulaEvaluator.evaluate("0 ^ -1", [], {})).toThrow(
        "Divisão por zero ou operação indefinida",
      );

      for (const expr of ["sqrt(-1)", "ln(0)", "ln(-2)", "log(0)", "log(-2)", "(-1)^0.5"]) {
        expect(() => FormulaEvaluator.evaluate(expr, [], {})).toThrow(
          "Resultado numérico inválido para os valores informados",
        );
      }
    });

    test("rejeita valores não finitos ou não numéricos", () => {
      const params = [{ nome: "x" }];
      for (const bad of [NaN, Infinity, -Infinity, "2", null, undefined, true, {}]) {
        expect(() =>
          FormulaEvaluator.evaluate("x + 1", params, { x: bad }),
        ).toThrow(ValidationError);
      }
    });
  });

  describe("segurança e limites", () => {
    test.each([
      "process.exit(1)",
      "__proto__",
      "constructor",
      "prototype",
      "require('fs')",
      "eval('1+1')",
      "global.process",
    ])("bloqueia tentativa de injeção: %s", (payload) => {
      expect(() => FormulaEvaluator.parse(payload)).toThrow(ValidationError);
    });

    test("bloqueia chaves reservadas em valores JSON", () => {
      const malicious = JSON.parse('{"__proto__": 1, "x": 2}');
      expect(() =>
        FormulaEvaluator.evaluate("x + 1", [{ nome: "x" }], malicious),
      ).toThrow(ValidationError);
    });

    test("aplica limites de tamanho, tokens e profundidade de parênteses", () => {
      expect(() => FormulaEvaluator.parse("1+".repeat(251) + "1")).toThrow(ValidationError);
      expect(() => FormulaEvaluator.parse("1+".repeat(101) + "1")).toThrow(ValidationError);
      const deep = "(".repeat(26) + "1" + ")".repeat(26);
      expect(() => FormulaEvaluator.parse(deep)).toThrow(ValidationError);
    });
  });
});
