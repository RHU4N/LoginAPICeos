const IoTMeasurement = require("../../domain/entities/IoTMeasurement");
const { ConflictError } = require('../../errors/AppError');

class IoTMeasurementRepositoryImpl {
  async ensureIdempotencyIndex() {
    // Não usar syncIndexes: nunca remover índices ou migrar coleções existentes.
    if (!this.indexReady) {
      this.indexReady = IoTMeasurement.collection.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true })
        .catch((error) => { this.indexReady = undefined; throw error; });
    }
    return this.indexReady;
  }
  async upsertFromEvent(data) {
    await this.ensureIdempotencyIndex();
    let item;
    try {
      item = await IoTMeasurement.findOneAndUpdate(
        { idempotencyKey: data.idempotencyKey }, { $setOnInsert: data },
        { upsert: true, new: true, runValidators: true, writeConcern: { w: 'majority' } },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      item = await IoTMeasurement.findOne({ idempotencyKey: data.idempotencyKey });
      if (!item) throw error;
    }
    // Mesma chave com outro valor/origem não é uma duplicata bem-sucedida.
    if (String(item.userId) !== String(data.userId) || item.deviceId !== data.deviceId ||
        item.sensorId !== data.sensorId || item.sensorTipo !== data.sensorTipo ||
        item.valor !== data.valor || item.unidade !== data.unidade ||
        new Date(item.timestamp).toISOString() !== new Date(data.timestamp).toISOString()) {
      throw new ConflictError('Evento já registrado com conteúdo diferente.', 'IDEMPOTENCY_CONFLICT');
    }
    return item;
  }
  create(data) { return new IoTMeasurement(data).save(); }
  findOwned(id, userId) { return IoTMeasurement.findOne({ _id: id, userId }); }
  async list(filters, page, limit, order = 'desc') {
    const [items, total] = await Promise.all([
      IoTMeasurement.find(filters).sort({ timestamp: order === 'asc' ? 1 : -1, _id: order === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit),
      IoTMeasurement.countDocuments(filters),
    ]);
    return { items, total };
  }
}
module.exports = IoTMeasurementRepositoryImpl;
