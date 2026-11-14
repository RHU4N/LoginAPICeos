const mongoose = require("mongoose");
const { Schema } = mongoose;
const user = { type: Schema.Types.ObjectId, required: true, index: true };
const deviceSchema = new Schema(
  {
    ownerId: user,
    deviceId: { type: String, unique: true, required: true },
    nome: String,
    descricao: String,
    tipoDispositivo: String,
    fabricante: String,
    modelo: String,
    sensores: [
      {
        _id: false,
        sensorId: String,
        nome: String,
        tipo: String,
        unidade: String,
        metadata: Schema.Types.Mixed,
      },
    ],
    capacidades: {
      supportsPush: Boolean,
      supportsOnDemand: Boolean,
      supportsCommandPolling: Boolean,
      supportsMultipleSensors: Boolean,
    },
    status: { type: String, default: "PROVISIONING" },
    ultimoContato: Date,
    revokedAt: Date,
    credentialHash: { type: String, select: false },
    provisioningHash: { type: String, select: false },
    provisioningExpiresAt: Date,
    credentialVersion: { type: Number, default: 1 },
    audit: [{ _id: false, action: String, at: Date }],
    legacy: Boolean,
  },
  { collection: "iot-devices", timestamps: true },
);
deviceSchema.index({ ownerId: 1, createdAt: -1 });
const requestSchema = new Schema(
  {
    requestId: { type: String, unique: true, required: true },
    userId: user,
    deviceId: { type: String, index: true },
    status: String,
    queuedAt: Date,
    dispatchedAt: Date,
    startedAt: Date,
    completedAt: Date,
    expiresAt: Date,
    errorCode: String,
    resultEventId: String,
    attempts: { type: Number, default: 0 },
    idempotencyKey: String,
    activeDevice: String,
    activeSlot: Number,
    leaseUntil: Date,
    leaseHash: { type: String, select: false },
    acknowledgedAt: Date,
  },
  { collection: "iot-read-requests", timestamps: true },
);
requestSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
requestSchema.index(
  { activeDevice: 1 },
  {
    unique: true,
    partialFilterExpression: { activeDevice: { $type: "string" } },
  },
);
requestSchema.index(
  { userId: 1, activeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { activeSlot: { $type: "number" } },
  },
);
requestSchema.index({ status: 1, expiresAt: 1 });
const notificationSchema = new Schema(
  {
    notificationId: { type: String, unique: true },
    userId: user,
    type: String,
    title: String,
    message: String,
    relatedRequestId: { type: String, unique: true },
    relatedDeviceId: String,
    readAt: Date,
  },
  { collection: "user-notifications", timestamps: true },
);
notificationSchema.index({ userId: 1, createdAt: -1 });
const ingressSchema = new Schema(
  {
    eventId: { type: String, unique: true },
    deviceId: String,
    ownerId: user,
    credentialVersion: Number,
    inputHash: String,
    event: Schema.Types.Mixed,
    expiresAt: Date,
  },
  { collection: "iot-ingress" },
);
ingressSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const rateSchema = new Schema(
  { _id: String, count: Number, expiresAt: Date },
  { collection: "iot-rate-limits" },
);
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = {
  Device: mongoose.model("IoTDevice", deviceSchema),
  ReadRequest: mongoose.model("IoTReadRequest", requestSchema),
  Notification: mongoose.model("UserNotification", notificationSchema),
  Ingress: mongoose.model("IoTIngress", ingressSchema),
  Rate: mongoose.model("IoTRate", rateSchema),
};
