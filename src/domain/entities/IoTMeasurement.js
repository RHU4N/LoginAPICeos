/**
 * Modelo IoTMeasurement - Medições de Sensores IoT
 * Preparado para grande volume de dados e Data Streaming
 * Utiliza Time Series Collection do MongoDB (v4.4+)
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const IoTMeasurementSchema = new Schema(
  {
    // Identificação de dispositivo e sensor
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      // Ex: "ESP32-001", "Arduino-LAB-1"
    },
    sensorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      // Ex: "temperature-01", "humidity-01"
    },
    sensorTipo: {
      type: String,
      required: true,
      enum: [
        "temperatura",
        "umidade",
        "pressao",
        "luz",
        "movimento",
        "gas",
        "outro",
      ],
      index: true,
    },

    // Dados da medição
    valor: {
      type: Number,
      required: true,
    },
    unidade: {
      type: String,
      required: true,
      // Ex: "C", "F", "%", "Pa", "lux", etc.
    },
    precisao: {
      type: Number,
      // Precisão da medição
    },

    // Timestamps (crítico para séries temporais)
    timestamp: {
      type: Date,
      required: true,
      index: true,
      // Timestamp da medição real (quando o sensor capturou)
    },
    criadoEm: {
      type: Date,
      default: Date.now,
      index: -1,
      // Timestamp de recebimento pela API
    },

    // Localização e contexto
    localizacao: {
      type: String,
      // Ex: "laboratorio", "sala-aula-1"
    },
    latitude: Number,
    longitude: Number,

    // Status e qualidade
    statusSensor: {
      type: String,
      enum: ["ativo", "inativo", "erro", "desconectado"],
      default: "ativo",
    },
    nivelBateria: Number,

    // Metadados flexíveis
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Rastreabilidade
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      // Usuário responsável pelo dispositivo (futuro)
    },
    projetoId: {
      type: Schema.Types.ObjectId,
      // Projeto ao qual pertence (futuro)
    },

    // Para Data Streaming
    processado: {
      type: Boolean,
      default: false,
      index: true,
    },
    idempotencyKey: {
      type: String,
      // Para evitar duplicação em retransmissão
      unique: true,
      sparse: true,
    },
  },
  {
    collection: "iot-measurements",
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Índices críticos para queries de IoT
IoTMeasurementSchema.index({ deviceId: 1, timestamp: -1 });
IoTMeasurementSchema.index({ sensorId: 1, timestamp: -1 });
IoTMeasurementSchema.index({ deviceId: 1, sensorId: 1, timestamp: -1 });
IoTMeasurementSchema.index({ timestamp: -1 });
IoTMeasurementSchema.index({ sensorTipo: 1, timestamp: -1 });
IoTMeasurementSchema.index({ processado: 1, criadoEm: -1 });
// TTL Index para auto-cleanup (manter últimos 90 dias)
IoTMeasurementSchema.index({ criadoEm: 1 }, { expireAfterSeconds: 7776000 });

const IoTMeasurement = mongoose.model("IoTMeasurement", IoTMeasurementSchema);

module.exports = IoTMeasurement;
