const { DuplicateFavoriteError, FavoriteNotFoundError } = require("../../errors/AppError");
class FavoriteUseCases {
  constructor(repository) { this.repository = repository; }
  async create(userId, data) {
    try { return await this.repository.create({ ...data, userId }); }
    catch (error) { if (error.code === 11000) throw new DuplicateFavoriteError(); throw error; }
  }
  list(userId) { return this.repository.listByUser(userId); }
  async remove(userId, id) {
    const result = await this.repository.deleteOwned(id, userId);
    if (!result.deletedCount) throw new FavoriteNotFoundError();
  }
}
module.exports = FavoriteUseCases;
