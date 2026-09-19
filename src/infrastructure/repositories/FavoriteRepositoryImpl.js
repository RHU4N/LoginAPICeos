const Favorite = require("../../domain/entities/Favorite");

class FavoriteRepositoryImpl {
  create(data) { return new Favorite(data).save(); }
  listByUser(userId) { return Favorite.find({ userId }).sort({ criadoEm: -1 }); }
  findOwned(id, userId) { return Favorite.findOne({ _id: id, userId }); }
  deleteOwned(id, userId) { return Favorite.deleteOne({ _id: id, userId }); }
}
module.exports = FavoriteRepositoryImpl;
