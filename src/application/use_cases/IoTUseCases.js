const { IoTMeasurementNotFoundError } = require("../../errors/AppError");
class IoTUseCases {
  constructor(repository) { this.repository = repository; }
  create(userId, data) { return this.repository.create({ ...data, userId }); }
  async get(userId, id) { const item = await this.repository.findOwned(id, userId); if (!item) throw new IoTMeasurementNotFoundError(); return item; }
  list(userId, query) {
    const filters = { userId };
    for (const key of ["deviceId", "sensorId", "sensorTipo"]) if (query[key]) filters[key] = query[key];
    if (query.startDate || query.endDate) filters.timestamp = { ...(query.startDate && { $gte: new Date(query.startDate) }), ...(query.endDate && { $lte: new Date(query.endDate) }) };
    return this.repository.list(filters, query.page, query.limit);
  }
}
module.exports = IoTUseCases;
