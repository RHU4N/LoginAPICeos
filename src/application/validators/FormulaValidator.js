const { ValidationError } = require("../../errors/AppError");
const FormulaEvaluator = require("../services/FormulaEvaluator");

class FormulaValidator {
  static validate(formula, parametros = []) {
    FormulaEvaluator.validate(formula, parametros);
    return true;
  }

  static validateCharacters(formula) {
    if (!formula || typeof formula !== "string") {
      throw new ValidationError("Fórmula é obrigatória");
    }
    if (formula.length > FormulaEvaluator.MAX_FORMULA_LENGTH) {
      throw new ValidationError(
        `Fórmula excede o limite de ${FormulaEvaluator.MAX_FORMULA_LENGTH} caracteres`,
      );
    }
    const caracteresPermitidos = /^[a-zA-Z0-9_+\-*/^(),.\s]+$/;
    if (!caracteresPermitidos.test(formula)) {
      throw new ValidationError("Fórmula contém caracteres não permitidos");
    }
  }

  static validateParentheses(formula) {
    let balance = 0;

    for (const char of formula) {
      if (char === "(") {
        balance++;
        if (balance > FormulaEvaluator.MAX_PAREN_DEPTH) {
          throw new ValidationError("Parênteses inválidos na fórmula");
        }
      }

      if (char === ")") {
        balance--;
        if (balance < 0) {
          throw new ValidationError("Parênteses inválidos na fórmula");
        }
      }
    }

    if (balance !== 0) {
      throw new ValidationError("Parênteses inválidos na fórmula");
    }
  }

  static validateVariables(formula, parametros = []) {
    const declaredNames = FormulaEvaluator.validateParametersList(parametros);
    const variables = FormulaEvaluator.extractVariables(formula);
    const variaveisInvalidas = variables.filter(
      (variable) => !declaredNames.has(variable),
    );

    if (variaveisInvalidas.length > 0) {
      throw new ValidationError(
        `Variável não declarada: ${variaveisInvalidas[0]}`,
      );
    }
  }

  static validateSyntax(formula) {
    FormulaEvaluator.parse(formula);
  }
}

module.exports = FormulaValidator;
