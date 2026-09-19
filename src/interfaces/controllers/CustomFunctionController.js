const { CreateCustomFunctionDTO, UpdateCustomFunctionDTO, CustomFunctionResponseDTO } = require("../../dto");
class CustomFunctionController {
  constructor(useCases) { this.useCases = useCases; }
  async create(req, res, next) { try { const dto = new CreateCustomFunctionDTO(req.body); dto.validate(); const item = await this.useCases.create(req.userId, dto); res.status(201).json({ success: true, data: new CustomFunctionResponseDTO(item) }); } catch (e) { next(e); } }
  async list(req, res, next) { try { const items = await this.useCases.list(req.userId); res.json({ success: true, data: items.map((item) => new CustomFunctionResponseDTO(item)) }); } catch (e) { next(e); } }
  async get(req, res, next) { try { const item = await this.useCases.get(req.userId, req.params.id); res.json({ success: true, data: new CustomFunctionResponseDTO(item) }); } catch (e) { next(e); } }
  async update(req, res, next) { try { const dto = new UpdateCustomFunctionDTO(req.body); dto.validate(); const item = await this.useCases.update(req.userId, req.params.id, dto); res.json({ success: true, data: new CustomFunctionResponseDTO(item) }); } catch (e) { next(e); } }
  async remove(req, res, next) { try { await this.useCases.remove(req.userId, req.params.id); res.status(204).send(); } catch (e) { next(e); } }
}
module.exports = CustomFunctionController;
