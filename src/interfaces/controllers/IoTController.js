const { CreateIoTMeasurementDTO, IoTMeasurementResponseDTO, QueryIoTDTO } = require("../../dto");
class IoTController {
  constructor(useCases) { this.useCases = useCases; }
  async readiness(_req, res, next) {
    try { return res.json({ success: true, data: await this.useCases.readiness() }); }
    catch (error) { next(error); }
  }
  async ingestEvent(req, res, next) {
    try {
      const result = await this.useCases.ingestEvent(req.body);
      console.log(JSON.stringify({ eventId: result.eventId, deviceId: result.deviceId, etapa: 'persistencia', resultado: 'confirmado', quantidade: result.persisted }));
      return res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }
  async create(req, res, next) { try { const dto = new CreateIoTMeasurementDTO(req.body); dto.validate(); const item = await this.useCases.create(req.userId, dto); res.status(201).json({ success: true, data: new IoTMeasurementResponseDTO(item) }); } catch (e) { next(e); } }
  async list(req, res, next) { try { const dto = new QueryIoTDTO(req.query); dto.validate(); const { items, total } = await this.useCases.list(req.userId, dto); res.json({ success: true, data: items.map((item) => new IoTMeasurementResponseDTO(item)), pagination: { page: dto.page, limit: dto.limit, total, totalPages: Math.ceil(total / dto.limit) } }); } catch (e) { next(e); } }
  async get(req, res, next) { try { const item = await this.useCases.get(req.userId, req.params.id); res.json({ success: true, data: new IoTMeasurementResponseDTO(item) }); } catch (e) { next(e); } }
}
module.exports = IoTController;
