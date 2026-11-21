const mongoose = require("mongoose");
const Favorite = require("../../domain/entities/Favorite");

class FavoriteRepositoryImpl {
  create(data) { return new Favorite(data).save(); }
  listByUser(userId) { return Favorite.find({ userId }).sort({ criadoEm: -1 }); }
  async findOwned(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Favorite.findOne({ _id: id, userId });
  }
  async deleteOwned(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return { deletedCount: 0 };
    return Favorite.deleteOne({ _id: id, userId });
  }
}
module.exports = FavoriteRepositoryImpl;
