const router = require("express").Router();
const auth = require("../../infrastructure/middleware/AuthMiddleware");
const serviceAuth = require("../../infrastructure/middleware/ServiceAuthMiddleware");
const {
  IoTPlatform,
  clean,
  ACTIVE,
} = require("../../application/use_cases/IoTPlatform");
const {
  ReadRequest,
  Notification,
} = require("../../domain/entities/IoTPlatform");
const Measurement = require("../../domain/entities/IoTMeasurement");
const { AppError } = require("../../errors/AppError");
const { IoTClaims } = require("../../application/use_cases/IoTClaims");
const platform = new IoTPlatform();
const claims = new IoTClaims(platform);
const run =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      res.status(status).json({ success: true, data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
router.use((req, _res, next) => {
  if (process.env.NODE_ENV === "production" && !req.secure)
    return next(new AppError("HTTPS obrigatório.", 403, "HTTPS_REQUIRED"));
  next();
});
const deviceAuth = async (req, _res, next) => {
  try {
    await platform.rate(`device-ip:${req.ip}`, 300);
    req.iotDevice = await platform.authenticate(
      req.get("x-ceos-device-id"),
      (req.get("authorization") || "").replace(/^Bearer /, ""),
    );
    next();
  } catch (e) {
    next(e);
  }
};
router.post(
  "/device/pair",
  async (req, _res, next) => {
    try {
      await platform.rate(`pair:${req.ip}`, 20);
      next();
    } catch (e) {
      next(e);
    }
  },
  run((req) => platform.pair(req.body || {})),
);
// Associação por código temporário (dispositivo sem credencial -> usuário confirma no app).
router.post(
  "/device/claim",
  run((req) => claims.start(req.body || {}, req.ip), 201),
);
router.post(
  "/device/claim/poll",
  run((req) => claims.poll(req.body || {})),
);
router.post(
  "/claims/lookup",
  auth,
  run((req) => claims.lookup(req.userId, req.body?.code)),
);
router.post(
  "/claims/confirm",
  auth,
  run((req) => claims.confirm(req.userId, req.body || {}), 201),
);
router.get(
  "/device/commands",
  deviceAuth,
  run((req) => platform.commands(req.iotDevice)),
);
router.post(
  "/device/commands/:requestId/ack",
  deviceAuth,
  run((req) =>
    platform.ack(req.iotDevice, req.params.requestId, req.body || {}),
  ),
);
router.post(
  "/internal/prepare",
  serviceAuth,
  run((req) => platform.prepare(req.body?.event || {}, req.body?.deviceToken)),
);
router.post(
  "/internal/dispatch",
  serviceAuth,
  run(() => platform.dispatch()),
);
router.get(
  "/devices",
  auth,
  run((req) => platform.listDevices(req.userId)),
);
router.get(
  "/devices/:deviceId/dashboard",
  auth,
  run(async (req) => {
    const devices = await platform.listDevices(req.userId);
    if (!devices.some((d) => d.deviceId === req.params.deviceId))
      throw new AppError("Dispositivo não encontrado.", 404);
    const latest = await Measurement.aggregate([
      {
        $match: {
          userId: new (require("mongoose").Types.ObjectId)(req.userId),
          deviceId: req.params.deviceId,
        },
      },
      { $sort: { timestamp: -1, _id: -1 } },
      { $group: { _id: "$sensorId", measurement: { $first: "$$ROOT" } } },
    ]);
    return latest.map((r) => r.measurement);
  }),
);
router.post(
  "/devices",
  auth,
  run((req) => platform.register(req.userId, req.body || {}), 201),
);
router.post(
  "/legacy/:deviceId/migrate",
  auth,
  run((req) => platform.migrateLegacy(req.userId, req.params.deviceId), 201),
);
router.get(
  "/devices/:deviceId",
  auth,
  run(async (req) =>
    clean(await platform.owned(req.userId, req.params.deviceId)),
  ),
);
router.patch(
  "/devices/:deviceId",
  auth,
  run((req) => platform.edit(req.userId, req.params.deviceId, req.body || {})),
);
for (const [path, action] of [
  ["rotate", "ROTATE"],
  ["revoke", "REVOKE"],
  ["unlink", "UNLINK"],
]) {
  router.post(
    `/devices/:deviceId/${path}`,
    auth,
    run((req) => platform.credentials(req.userId, req.params.deviceId, action)),
  );
}
router.post(
  "/devices/:deviceId/requests",
  auth,
  run(
    (req) =>
      platform.request(
        req.userId,
        req.params.deviceId,
        req.get("idempotency-key"),
      ),
    202,
  ),
);
const page = (q) => ({
  page: Math.max(1, Math.min(100000, Number.parseInt(q.page) || 1)),
  limit: Math.max(1, Math.min(100, Number.parseInt(q.limit) || 25)),
});
async function paged(Model, filter, query) {
  const { page: p, limit } = page(query);
  const [items, total] = await Promise.all([
    Model.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);
  return {
    items: items.map(clean),
    pagination: { page: p, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
router.get(
  "/requests",
  auth,
  run((req) =>
    paged(
      ReadRequest,
      {
        userId: req.userId,
        ...(typeof req.query.deviceId === "string" && {
          deviceId: req.query.deviceId,
        }),
      },
      req.query,
    ),
  ),
);
router.get(
  "/devices/:deviceId/requests",
  auth,
  run(async (req) => {
    await platform.owned(req.userId, req.params.deviceId);
    return paged(
      ReadRequest,
      { userId: req.userId, deviceId: req.params.deviceId },
      req.query,
    );
  }),
);
router.get(
  "/requests/:requestId",
  auth,
  run(async (req) => {
    const r = await ReadRequest.findOne({
      requestId: req.params.requestId,
      userId: req.userId,
    });
    if (!r) throw new AppError("Solicitação não encontrada.", 404);
    return clean(r);
  }),
);
router.post(
  "/requests/:requestId/cancel",
  auth,
  run(async (req) => {
    const r = await ReadRequest.findOneAndUpdate(
      {
        requestId: req.params.requestId,
        userId: req.userId,
        status: { $in: ACTIVE },
      },
      {
        $set: { status: "CANCELLED", completedAt: new Date() },
        $unset: { activeDevice: 1, activeSlot: 1, leaseHash: 1, leaseUntil: 1 },
      },
      { new: true },
    );
    if (!r)
      throw new AppError("Solicitação indisponível para cancelamento.", 409);
    return clean(r);
  }),
);
router.get(
  "/events/:eventId",
  auth,
  run(async (req) => {
    const items = await Measurement.find({
      userId: req.userId,
      "metadata.eventId": req.params.eventId,
    })
      .sort({ sensorId: 1 })
      .limit(32);
    if (!items.length) throw new AppError("Leitura não encontrada.", 404);
    return items;
  }),
);
module.exports = { router, run, paged };
const notifications = require("express").Router();
notifications.use(auth);
notifications.get(
  "/",
  run((req) => paged(Notification, { userId: req.userId }, req.query)),
);
notifications.get(
  "/unread-count",
  run(async (req) => ({
    count: await Notification.countDocuments({
      userId: req.userId,
      readAt: null,
    }),
  })),
);
notifications.patch(
  "/:id/read",
  run(async (req) => {
    const n = await Notification.findOneAndUpdate(
      { notificationId: req.params.id, userId: req.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!n) throw new AppError("Notificação não encontrada.", 404);
    return clean(n);
  }),
);
module.exports.notifications = notifications;
