const { CreateIoTMeasurementDTO, IoTMeasurementResponseDTO, QueryIoTDTO } = require("../../dto");
class IoTController {
  constructor(useCases) { this.useCases = useCases; }
  async create(req, res, next) { try { const dto = new CreateIoTMeasurementDTO(req.body); dto.validate(); const item = await this.useCases.create(req.userId, dto); res.status(201).json({ success: true, data: new IoTMeasurementResponseDTO(item) }); } catch (e) { next(e); } }
  async list(req, res, next) { try { const dto = new QueryIoTDTO(req.query); dto.validate(); const { items, total } = await this.useCases.list(req.userId, dto); res.json({ success: true, data: items.map((item) => new IoTMeasurementResponseDTO(item)), pagination: { page: dto.page, limit: dto.limit, total, totalPages: Math.ceil(total / dto.limit) } }); } catch (e) { next(e); } }
  async get(req, res, next) { try { const item = await this.useCases.get(req.userId, req.params.id); res.json({ success: true, data: new IoTMeasurementResponseDTO(item) }); } catch (e) { next(e); } }
}
module.exports = IoTController;
