const { IoTMeasurementNotFoundError } = require("../../errors/AppError");
const { AppError } = require('../../errors/AppError');
const validateIoTEvent = require('../validators/IoTEventValidator');
const User = require('../../domain/entities/User');
class IoTUseCases {
  constructor(repository, { findOwner = (value) => value.includes('@') ? User.findOne({ email: value.toLowerCase() }) : User.findById(value), owners = () => process.env.CEOS_DEVICE_OWNERS } = {}) {
    this.repository = repository; this.findOwner = findOwner; this.owners = owners;
  }
  async ingestEvent(data) {
    const event = validateIoTEvent(data);
    let mapping;
    try { mapping = JSON.parse(this.owners() || '{}'); }
    catch { throw new AppError('Configuração IoT inválida.', 503, 'IOT_NOT_CONFIGURED'); }
    const configuredOwner = mapping && Object.hasOwn(mapping, event.deviceId) ? mapping[event.deviceId] : undefined;
    if (typeof configuredOwner !== 'string' || (!/^[0-9a-f]{24}$/i.test(configuredOwner) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredOwner))) {
      throw new AppError('Dispositivo não autorizado.', 403, 'DEVICE_UNAUTHORIZED');
    }
    let owner;
    try { owner = await this.findOwner(configuredOwner); }
    catch { throw new AppError('Persistência IoT temporariamente indisponível.', 503, 'IOT_STORAGE_UNAVAILABLE'); }
    if (!owner || owner.ativo === false) throw new AppError('Proprietário indisponível.', 403, 'DEVICE_UNAUTHORIZED');
    const ownerId = String(owner._id);
    const receipts = [];
    try {
      for (const measurement of event.measurements) {
        const item = await this.repository.upsertFromEvent({
          deviceId: event.deviceId, sensorId: measurement.sensorId, sensorTipo: measurement.sensorTipo,
          valor: measurement.valor, unidade: measurement.unidade, timestamp: measurement.timestamp,
          userId: ownerId, idempotencyKey: `${event.eventId}:${measurement.sensorId}`,
          metadata: { eventId: event.eventId, schemaVersion: event.schemaVersion, receivedAt: event.receivedAt,
            timestampOrigin: measurement.timestampOrigin, physicalSensorId: measurement.physicalSensorId,
            sourceIdempotencyKey: measurement.idempotencyKey },
        });
        receipts.push({ id: item._id.toString(), idempotencyKey: measurement.idempotencyKey });
      }
    } catch (error) {
      console.error(JSON.stringify({ eventId: event.eventId, deviceId: event.deviceId, etapa: 'persistencia', resultado: 'falha', tipoErro: error.errorCode || 'IOT_STORAGE_UNAVAILABLE' }));
      if (error instanceof AppError) throw error;
      throw new AppError('Persistência IoT temporariamente indisponível.', 503, 'IOT_STORAGE_UNAVAILABLE');
    }
    return { eventId: event.eventId, deviceId: event.deviceId, persisted: receipts.length, measurements: receipts };
  }
  create(userId, data) { return this.repository.create({ ...data, userId }); }
  async readiness() {
    let mapping;
    try { mapping = JSON.parse(this.owners() || '{}'); }
    catch { throw new AppError('Configuração IoT inválida.', 503, 'IOT_NOT_CONFIGURED'); }
    const entries = Object.entries(mapping || {});
    if (entries.length === 0) throw new AppError('Nenhum dispositivo configurado.', 503, 'IOT_NOT_CONFIGURED');
    for (const [deviceId, value] of entries) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(deviceId) || typeof value !== 'string') {
        throw new AppError('Configuração IoT inválida.', 503, 'IOT_NOT_CONFIGURED');
      }
      let user;
      try { user = await this.findOwner(value); }
      catch { throw new AppError('Consulta IoT indisponível.', 503, 'IOT_STORAGE_UNAVAILABLE'); }
      if (!user || user.ativo === false) throw new AppError('Proprietário IoT não localizado ou inativo.', 503, 'IOT_OWNER_UNAVAILABLE');
    }
    try { await this.repository.ensureIdempotencyIndex(); }
    catch { throw new AppError('Índice único IoT indisponível.', 503, 'IOT_INDEX_UNAVAILABLE'); }
    return { ready: true, schemaVersion: 1, devices: entries.map(([deviceId]) => deviceId), idempotencyIndex: true };
  }
  async get(userId, id) { const item = await this.repository.findOwned(id, userId); if (!item) throw new IoTMeasurementNotFoundError(); return item; }
  list(userId, query) {
    const filters = { userId };
    for (const key of ["deviceId", "sensorId", "sensorTipo"]) if (query[key]) filters[key] = query[key];
    if (query.startDate || query.endDate) filters.timestamp = { ...(query.startDate && { $gte: new Date(query.startDate) }), ...(query.endDate && { $lte: new Date(query.endDate) }) };
    return this.repository.list(filters, query.page, query.limit);
  }
}
module.exports = IoTUseCases;
