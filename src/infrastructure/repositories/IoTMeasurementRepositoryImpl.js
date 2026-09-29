const IoTMeasurement = require("../../domain/entities/IoTMeasurement");

class IoTMeasurementRepositoryImpl {
  create(data) { return new IoTMeasurement(data).save(); }
  findOwned(id, userId) { return IoTMeasurement.findOne({ _id: id, userId }); }
  async list(filters, page, limit) {
    const [items, total] = await Promise.all([
      IoTMeasurement.find(filters).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit),
      IoTMeasurement.countDocuments(filters),
    ]);
    return { items, total };
  }
}
module.exports = IoTMeasurementRepositoryImpl;
