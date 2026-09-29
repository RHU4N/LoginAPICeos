const CustomFunction = require("../../domain/entities/CustomFunction");

class CustomFunctionRepositoryImpl {
  create(data) { return new CustomFunction(data).save(); }
  listByUser(userId) { return CustomFunction.find({ userId }).sort({ criadoEm: -1 }); }
  findOwned(id, userId) { return CustomFunction.findOne({ _id: id, userId }); }
  updateOwned(id, userId, data) { return CustomFunction.findOneAndUpdate({ _id: id, userId }, data, { new: true, runValidators: true }); }
  deleteOwned(id, userId) { return CustomFunction.deleteOne({ _id: id, userId }); }
}
module.exports = CustomFunctionRepositoryImpl;
