const { CustomFunctionNotFoundError } = require("../../errors/AppError");
const FormulaValidator = require("../validators/FormulaValidator"); 

class CustomFunctionUseCases {
  constructor(repository) { this.repository = repository; }
  create(userId, data) { return this.repository.create({ ...data, userId }); }
  list(userId) { return this.repository.listByUser(userId); }
  async get(userId, id) { const item = await this.repository.findOwned(id, userId); if (!item) throw new CustomFunctionNotFoundError(); return item; }
  async update(userId, id, data) { const atual = await this.repository.findOwned(id, userId); if (!atual) throw new CustomFunctionNotFoundError(); const formulaFinal = data.formula ?? atual.formula; const parametrosFinais = data.parametros ?? atual.parametros; FormulaValidator.validate(formulaFinal, parametrosFinais); return await this.repository.updateOwned(id, userId, data);}
  async remove(userId, id) { const result = await this.repository.deleteOwned(id, userId); if (!result.deletedCount) throw new CustomFunctionNotFoundError(); }
}
module.exports = CustomFunctionUseCases;
