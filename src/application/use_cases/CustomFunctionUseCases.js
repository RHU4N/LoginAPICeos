const {
  CustomFunctionNotFoundError,
  ValidationError,
} = require("../../errors/AppError");
const FormulaValidator = require("../validators/FormulaValidator");
const FormulaEvaluator = require("../services/FormulaEvaluator");

class CustomFunctionUseCases {
  constructor(repository) {
    this.repository = repository;
  }

  create(userId, data) {
    return this.repository.create({ ...data, userId });
  }

  list(userId) {
    return this.repository.listByUser(userId);
  }

  async get(userId, id) {
    const item = await this.repository.findOwned(id, userId);
    if (!item) throw new CustomFunctionNotFoundError();
    return item;
  }

  async update(userId, id, data) {
    const atual = await this.repository.findOwned(id, userId);
    if (!atual) throw new CustomFunctionNotFoundError();
    const updatePayload =
      typeof data?.toUpdateData === "function" ? data.toUpdateData() : data;
    if (
      updatePayload.formula !== undefined ||
      updatePayload.parametros !== undefined
    ) {
      const formulaFinal = updatePayload.formula ?? atual.formula;
      const parametrosFinais = updatePayload.parametros ?? atual.parametros;
      FormulaValidator.validate(formulaFinal, parametrosFinais);
    }
    return await this.repository.updateOwned(id, userId, updatePayload);
  }

  async remove(userId, id) {
    const result = await this.repository.deleteOwned(id, userId);
    if (!result.deletedCount) throw new CustomFunctionNotFoundError();
  }

  validateFormula(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ValidationError("Dados inválidos para validação da fórmula");
    }
    const { formula, parametros = [] } = payload;
    return FormulaEvaluator.validate(formula, parametros);
  }

  async execute(userId, id, valores = {}) {
    const item = await this.repository.findOwned(id, userId);
    if (!item) throw new CustomFunctionNotFoundError();

    const {
      resultado,
      resultadoFormatado,
      substituicao,
      parametrosUsados,
    } = FormulaEvaluator.evaluate(item.formula, item.parametros || [], valores);

    const updated = await this.repository.incrementUsage?.(id, userId);
    const usos =
      updated && typeof updated.usos === "number"
        ? updated.usos
        : (item.usos || 0) + 1;

    return {
      id: String(item._id || item.id),
      nome: item.nome,
      categoria: item.categoria,
      formula: item.formula,
      substituicao,
      parametrosUsados,
      resultado,
      resultadoFormatado,
      usos,
    };
  }
}

module.exports = CustomFunctionUseCases;
