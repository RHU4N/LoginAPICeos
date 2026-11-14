'use strict';

// Contrato transportado entre repositórios. O teste de contrato verifica igualdade.
const FIELDS = Object.freeze({
  temperatura_dht22: ['dht22-temperatura', 'dht22', 'temperatura', 'C'],
  umidade: ['dht22-umidade', 'dht22', 'umidade', '%'],
  temperatura_bmp180: ['bmp180-temperatura', 'bmp180', 'temperatura', 'C'],
  pressao_hpa: ['bmp180-pressao', 'bmp180', 'pressao', 'hPa'],
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

class EventValidationError extends Error {
  constructor(message) { super(message); this.name = 'EventValidationError'; this.code = 'INVALID_EVENT'; }
}
function requireValid(condition, message) {
  if (!condition) throw new EventValidationError(message);
}
function validDate(value) {
  return typeof value === 'string' && ISO.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() ===
      value.replace(/(?:\.(\d{1,3}))?Z$/, (_match, fraction) => '.' + (fraction || '').padEnd(3, '0') + 'Z');
}
function validateEvent(event) {
  requireValid(event && typeof event === 'object' && !Array.isArray(event), 'Evento deve ser objeto.');
  if (event.schemaVersion === 2) return validateV2(event);
  requireValid(event.schemaVersion === 1, 'schemaVersion não suportada.');
  requireValid(typeof event.eventId === 'string' && UUID.test(event.eventId), 'eventId deve ser UUID.');
  requireValid(typeof event.deviceId === 'string' && DEVICE.test(event.deviceId), 'deviceId inválido.');
  requireValid(validDate(event.receivedAt), 'receivedAt deve ser ISO-8601 UTC.');
  requireValid(event.userId === undefined, 'Proprietário não pode ser informado no evento.');
  requireValid(Array.isArray(event.measurements) && event.measurements.length === 4, 'São necessárias quatro medições.');
  const seen = new Set();
  for (const measurement of event.measurements) {
    requireValid(measurement && typeof measurement === 'object', 'Medição inválida.');
    const definition = Object.entries(FIELDS).find(([, value]) => value[0] === measurement.sensorId);
    requireValid(Boolean(definition), 'sensorId desconhecido.');
    const [field, [sensorId, physicalSensorId, sensorTipo, unidade]] = definition;
    requireValid(!seen.has(sensorId), 'sensorId duplicado.');
    seen.add(sensorId);
    requireValid(measurement.sensorTipo === sensorTipo && measurement.unidade === unidade, 'Tipo ou unidade incompatível com sensor.');
    requireValid(measurement.physicalSensorId === undefined || measurement.physicalSensorId === physicalSensorId, 'Sensor físico incompatível.');
    requireValid(measurement.deviceId === undefined || measurement.deviceId === event.deviceId, 'Dispositivo da medição incompatível.');
    requireValid(measurement.userId === undefined, 'Proprietário não pode ser informado na medição.');
    requireValid(typeof measurement.valor === 'number' && Number.isFinite(measurement.valor), 'valor deve ser número finito.');
    requireValid(validDate(measurement.timestamp), 'timestamp inválido.');
    requireValid(measurement.timestamp === event.receivedAt, 'timestamp deve representar o recebimento desta leitura.');
    requireValid(measurement.timestampOrigin === 'receivedAt', 'Origem temporal deve ser receivedAt.');
    // A chave antiga é preservada para mensagens produzidas antes da migração.
    requireValid(measurement.idempotencyKey === event.eventId + ':' + sensorId ||
      measurement.idempotencyKey === event.eventId + ':' + field, 'idempotencyKey incompatível.');
  }
  return event;
}
function validateV2(event) {
  requireValid(UUID.test(event.eventId || '') && DEVICE.test(event.deviceId || ''), 'Identificadores inválidos.');
  requireValid(validDate(event.receivedAt) && event.userId === undefined, 'Recebimento ou proprietário inválido.');
  requireValid(Number.isInteger(event.credentialVersion) && event.credentialVersion > 0, 'Vínculo inválido.');
  requireValid(event.requestId === undefined || UUID.test(event.requestId), 'requestId inválido.');
  requireValid(Array.isArray(event.measurements) && event.measurements.length > 0 && event.measurements.length <= 32, 'Quantidade de sensores inválida.');
  const seen = new Set();
  for (const m of event.measurements) {
    requireValid(m && DEVICE.test(m.sensorId || '') && !seen.has(m.sensorId), 'Sensor inválido ou duplicado.');
    seen.add(m.sensorId);
    requireValid(DEVICE.test(m.sensorTipo || '') && typeof m.unidade === 'string' && m.unidade.length > 0 && m.unidade.length <= 24, 'Tipo ou unidade inválido.');
    requireValid(typeof m.valor === 'number' && Number.isFinite(m.valor) && validDate(m.timestamp), 'Valor ou data inválido.');
    requireValid(['receivedAt', 'collectedAt'].includes(m.timestampOrigin) && m.userId === undefined, 'Origem inválida.');
    requireValid(m.idempotencyKey === `${event.eventId}:${m.sensorId}`, 'Chave inválida.');
  }
  return event;
}
function decodeMessage(message) {
  if (Buffer.isBuffer(message)) message = message.toString('utf8');
  if (typeof message !== 'string') return message;
  try { return JSON.parse(message); } catch { /* Mensagens antigas do output binding podem ser Base64. */ }
  requireValid(/^[a-zA-Z0-9+/]+={0,2}$/.test(message) && message.length % 4 === 0, 'JSON inválido.');
  try { return JSON.parse(Buffer.from(message, 'base64').toString('utf8')); }
  catch { throw new EventValidationError('JSON ou Base64 inválido.'); }
}
function parseQueueEvent(message) {
  let event = decodeMessage(message);
  // Formato v1 original: timestamp na raiz, dht22/bmp180 como sensorId,
  // chave baseada no nome do campo Wokwi. Nunca gerar outro eventId no retry.
  if (event?.schemaVersion === 1 && event.receivedAt === undefined && event.timestamp &&
      Array.isArray(event.measurements)) {
    const measurements = event.measurements.map((measurement) => {
      const definition = Object.entries(FIELDS).find(([field, value]) =>
        measurement?.idempotencyKey === event.eventId + ':' + field &&
        measurement.sensorId === value[1] && measurement.sensorTipo === value[2] &&
        measurement.unidade === value[3]);
      requireValid(Boolean(definition), 'Medição legada incompatível.');
      return { ...measurement, sensorId: definition[1][0], physicalSensorId: definition[1][1],
        timestampOrigin: 'receivedAt' };
    });
    event = { ...event, receivedAt: event.timestamp, measurements };
  }
  return validateEvent(event);
}
module.exports = { FIELDS, UUID, DEVICE, EventValidationError, validateEvent, parseQueueEvent };
