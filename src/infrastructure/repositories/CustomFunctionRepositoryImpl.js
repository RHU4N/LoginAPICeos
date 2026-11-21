const mongoose = require("mongoose");
const CustomFunction = require("../../domain/entities/CustomFunction");

class CustomFunctionRepositoryImpl {
  create(data) {
    return new CustomFunction(data).save();
  }

  listByUser(userId) {
    return CustomFunction.find({ userId }).sort({ criadoEm: -1 });
  }

  async findOwned(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return CustomFunction.findOne({ _id: id, userId });
  }

  async updateOwned(id, userId, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return CustomFunction.findOneAndUpdate(
      { _id: id, userId },
      { ...data, atualizadoEm: new Date() },
      { new: true, runValidators: true },
    );
  }

  async deleteOwned(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return { deletedCount: 0 };
    return CustomFunction.deleteOne({ _id: id, userId });
  }

  async incrementUsage(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return CustomFunction.findOneAndUpdate(
      { _id: id, userId },
      { $inc: { usos: 1 } },
      { new: true },
    );
  }
}

module.exports = CustomFunctionRepositoryImpl;
