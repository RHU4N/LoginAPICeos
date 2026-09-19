const { CreateFavoriteDTO, FavoriteResponseDTO } = require("../../dto");
class FavoriteController {
  constructor(useCases) { this.useCases = useCases; }
  async create(req, res, next) { try { const dto = new CreateFavoriteDTO(req.body); dto.validate(); const item = await this.useCases.create(req.userId, dto); res.status(201).json({ success: true, data: new FavoriteResponseDTO(item) }); } catch (e) { next(e); } }
  async list(req, res, next) { try { const items = await this.useCases.list(req.userId); res.json({ success: true, data: items.map((item) => new FavoriteResponseDTO(item)) }); } catch (e) { next(e); } }
  async remove(req, res, next) { try { await this.useCases.remove(req.userId, req.params.id); res.status(204).send(); } catch (e) { next(e); } }
}
module.exports = FavoriteController;
