const { randomBytes, randomUUID, createHash } = require("node:crypto");
const {
  Device,
  ReadRequest,
  Notification,
  Ingress,
  Rate,
} = require("../../domain/entities/IoTPlatform");
const User = require("../../domain/entities/User");
const Measurement = require("../../domain/entities/IoTMeasurement");
const { AppError } = require("../../errors/AppError");
const ACTIVE = ["QUEUED", "WAITING_FOR_DEVICE", "MEASURING", "PROCESSING"];
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (s) => createHash("sha256").update(s).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const fail = (message, status = 400, code = "IOT_INVALID_INPUT") => {
  throw new AppError(message, status, code);
};
function text(value, max = 120, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail("Texto inválido.");
  return value.trim();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  if (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT.*Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toISOString();
  return value;
}
const digest = (value) => hash(JSON.stringify(stable(value)));
function clean(document) {
  const result = document.toObject ? document.toObject() : { ...document };
  for (const key of [
    "credentialHash",
    "provisioningHash",
    "leaseHash",
    "activeDevice",
    "activeSlot",
    "__v",
    "audit",
  ])
    delete result[key];
  return result;
}
class IoTPlatform {
  async rate(key, limit = 30, seconds = 60) {
    const window = Math.floor(Date.now() / (seconds * 1000));
    let record;
    try {
      record = await Rate.findOneAndUpdate(
        { _id: `${key}:${window}` },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((window + 2) * seconds * 1000) },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      return this.rate(key, limit, seconds);
    }
    if (record.count > limit)
      fail("Muitas solicitações. Aguarde um minuto.", 429, "IOT_RATE_LIMIT");
  }
  async owned(userId, deviceId) {
    if (typeof deviceId !== "string" || !ID.test(deviceId))
      fail("Dispositivo não encontrado.", 404);
    const device = await Device.findOne({ ownerId: userId, deviceId });
    if (!device)
      fail("Dispositivo não encontrado.", 404, "IOT_DEVICE_NOT_FOUND");
    return device;
  }
  async register(userId, body) {
    await this.rate(`register:${userId}`, 10);
    if (
      (await Device.countDocuments({
        ownerId: userId,
        status: { $ne: "UNLINKED" },
      })) >= 30
    )
      fail("Limite de dispositivos atingido.", 409);
    if (
      !Array.isArray(body.sensores) ||
      !body.sensores.length ||
      body.sensores.length > 32
    )
      fail("Informe de 1 a 32 sensores.");
    const sensores = body.sensores.map((s) => {
      if (
        !s ||
        typeof s.sensorId !== "string" ||
        typeof s.tipo !== "string" ||
        !ID.test(s.sensorId) ||
        !ID.test(s.tipo)
      )
        fail("Sensor inválido.");
      return {
        sensorId: s.sensorId,
        nome: text(s.nome, 80, true),
        tipo: s.tipo,
        unidade: text(s.unidade, 24, true),
      };
    });
    if (new Set(sensores.map((s) => s.sensorId)).size !== sensores.length)
      fail("Sensores duplicados.");
    const c = body.capacidades || {};
    const capacidades = Object.fromEntries(
      [
        "supportsPush",
        "supportsOnDemand",
        "supportsCommandPolling",
        "supportsMultipleSensors",
      ].map((k) => [k, c[k] === true]),
    );
    if (
      !capacidades.supportsPush ||
      (capacidades.supportsOnDemand && !capacidades.supportsCommandPolling)
    )
      fail("HTTP push é necessário; leitura remota exige polling.");
    const provisioningToken = secret();
    const device = await Device.create({
      ownerId: userId,
      deviceId: `ceos-${randomUUID()}`,
      nome: text(body.nome, 80, true),
      descricao: text(body.descricao || "", 500),
      tipoDispositivo: text(body.tipoDispositivo || "http-json", 80),
      fabricante: text(body.fabricante || "", 80),
      modelo: text(body.modelo || "", 80),
      sensores,
      capacidades,
      provisioningHash: hash(provisioningToken),
      provisioningExpiresAt: new Date(Date.now() + 15 * 60000),
      audit: [{ action: "REGISTER", at: new Date() }],
    });
    return { device: clean(device), provisioningToken };
  }
  async migrateLegacy(userId, deviceId) {
    if (process.env.CEOS_IOT_LEGACY_MIGRATION_ENABLED !== "true")
      fail("Migração legada desabilitada.", 503);
    if (!ID.test(deviceId || "")) fail("Dispositivo inválido.");
    let mapping;
    try {
      mapping = JSON.parse(process.env.CEOS_DEVICE_OWNERS || "{}");
    } catch {
      fail("Mapeamento indisponível.", 503);
    }
    const configured = Object.hasOwn(mapping, deviceId)
      ? mapping[deviceId]
      : null;
    if (typeof configured !== "string")
      fail("Dispositivo não encontrado.", 404);
    const owner = await User.findOne(
      configured.includes("@")
        ? { email: configured.toLowerCase(), ativo: { $ne: false } }
        : { _id: configured, ativo: { $ne: false } },
    );
    if (!owner || String(owner._id) !== String(userId))
      fail("Dispositivo não encontrado.", 404);
    if (await Device.exists({ deviceId })) fail("Dispositivo já migrado.", 409);
    await this.rate(`migration:${userId}`, 5);
    const provisioningToken = secret();
    const { FIELDS } = require("../contracts/IoTEventContract");
    const device = await Device.create({
      ownerId: userId,
      deviceId,
      nome: deviceId,
      tipoDispositivo: "legacy-weather",
      legacy: true,
      sensores: Object.values(FIELDS).map(([sensorId, , tipo, unidade]) => ({
        sensorId,
        nome: sensorId,
        tipo,
        unidade,
      })),
      capacidades: {
        supportsPush: true,
        supportsOnDemand: true,
        supportsCommandPolling: true,
        supportsMultipleSensors: true,
      },
      provisioningHash: hash(provisioningToken),
      provisioningExpiresAt: new Date(Date.now() + 15 * 60000),
      audit: [{ action: "MIGRATE_LEGACY", at: new Date() }],
    });
    return { device: clean(device), provisioningToken };
  }
  async pair(body) {
    if (
      !ID.test(body.deviceId || "") ||
      typeof body.provisioningToken !== "string" ||
      body.provisioningToken.length !== 43
    )
      fail("Pareamento inválido.", 401);
    const deviceToken = secret();
    const device = await Device.findOneAndUpdate(
      {
        deviceId: body.deviceId,
        status: "PROVISIONING",
        provisioningHash: hash(body.provisioningToken),
        provisioningExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: "ACTIVE",
          credentialHash: hash(deviceToken),
          ultimoContato: new Date(),
        },
        $unset: { provisioningHash: 1, provisioningExpiresAt: 1 },
        $push: { audit: { action: "PAIR", at: new Date() } },
      },
      { new: true },
    );
    if (
      !device ||
      !(await User.exists({ _id: device.ownerId, ativo: { $ne: false } }))
    )
      fail("Provisionamento inválido ou expirado.", 401);
    return {
      deviceId: device.deviceId,
      deviceToken,
      sensores: device.sensores,
      capacidades: device.capacidades,
    };
  }
  async authenticate(deviceId, token) {
    if (
      !ID.test(deviceId || "") ||
      typeof token !== "string" ||
      token.length !== 43
    )
      fail("Credencial de dispositivo inválida.", 401);
    await this.rate(`device:${deviceId}`, 120);
    const device = await Device.findOne({
      deviceId,
      credentialHash: hash(token),
      status: "ACTIVE",
    });
    if (
      !device ||
      !(await User.exists({ _id: device.ownerId, ativo: { $ne: false } }))
    )
      fail("Credencial de dispositivo inválida.", 401);
    await Device.updateOne(
      { _id: device._id, status: "ACTIVE" },
      { $set: { ultimoContato: new Date() } },
    );
    return device;
  }
  async edit(userId, deviceId, body) {
    const device = await this.owned(userId, deviceId);
    const fields = {};
    if (body.nome !== undefined) fields.nome = text(body.nome, 80, true);
    if (body.descricao !== undefined)
      fields.descricao = text(body.descricao, 500);
    return clean(
      await Device.findByIdAndUpdate(
        device._id,
        { $set: fields },
        { new: true },
      ),
    );
  }
  async credentials(userId, deviceId, action) {
    const device = await this.owned(userId, deviceId);
    await this.rate(`credentials:${userId}`, 10);
    if (device.status === "UNLINKED") fail("Dispositivo desvinculado.", 409);
    const provisioningToken = action === "ROTATE" ? secret() : undefined;
    const update = {
      $set: {
        status:
          action === "ROTATE"
            ? "PROVISIONING"
            : action === "UNLINK"
              ? "UNLINKED"
              : "REVOKED",
        revokedAt: new Date(),
        ...(provisioningToken && {
          provisioningHash: hash(provisioningToken),
          provisioningExpiresAt: new Date(Date.now() + 15 * 60000),
        }),
      },
      $unset: {
        credentialHash: 1,
        ...(!provisioningToken && {
          provisioningHash: 1,
          provisioningExpiresAt: 1,
        }),
      },
      $inc: { credentialVersion: 1 },
      $push: { audit: { action, at: new Date() } },
    };
    const updated = await Device.findByIdAndUpdate(device._id, update, {
      new: true,
    });
    const requests = await ReadRequest.find({
      deviceId,
      status: { $in: ACTIVE },
    });
    for (const r of requests)
      await this.terminal(r.requestId, "FAILED", "DEVICE_REVOKED");
    return {
      device: clean(updated),
      ...(provisioningToken && { provisioningToken }),
    };
  }
  async notify(r) {
    const offline = r.status === "EXPIRED";
    const complete = r.status === "COMPLETED";
    if (!complete && !offline && r.status !== "FAILED") return;
    try {
      await Notification.updateOne(
        { relatedRequestId: r.requestId },
        {
          $setOnInsert: {
            notificationId: randomUUID(),
            userId: r.userId,
            relatedRequestId: r.requestId,
            relatedDeviceId: r.deviceId,
            type: complete
              ? "IOT_READ_COMPLETED"
              : offline
                ? "IOT_DEVICE_OFFLINE"
                : "IOT_READ_FAILED",
            title: complete
              ? "Sua leitura foi concluída."
              : "Não foi possível concluir a leitura.",
            message: complete
              ? "As medições estão disponíveis. Ver resultado."
              : offline
                ? "O dispositivo não respondeu dentro do prazo."
                : "Falha de comunicação ou dispositivo revogado.",
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  async terminal(requestId, status, errorCode, resultEventId) {
    const r = await ReadRequest.findOneAndUpdate(
      { requestId, status: { $in: ACTIVE } },
      {
        $set: {
          status,
          completedAt: new Date(),
          ...(errorCode && { errorCode }),
          ...(resultEventId && { resultEventId }),
        },
        $unset: { activeDevice: 1, activeSlot: 1, leaseHash: 1, leaseUntil: 1 },
      },
      { new: true },
    );
    if (r) await this.notify(r);
    return r;
  }
  async dispatch() {
    // Bounded, repeatable durable-outbox dispatch. Never waits for a physical device.
    const expired = await ReadRequest.find({
      status: { $in: ACTIVE },
      expiresAt: { $lte: new Date() },
    }).limit(100);
    for (const r of expired)
      await this.terminal(r.requestId, "EXPIRED", "DEVICE_TIMEOUT");
    const batch = await ReadRequest.find({
      status: "QUEUED",
      expiresAt: { $gt: new Date() },
    }).limit(100);
    for (const r of batch) {
      if (
        !(await Device.exists({
          deviceId: r.deviceId,
          ownerId: r.userId,
          status: "ACTIVE",
        }))
      ) {
        await this.terminal(r.requestId, "FAILED", "DEVICE_REVOKED");
        continue;
      }
      await ReadRequest.updateOne(
        { _id: r._id, status: "QUEUED" },
        { $set: { status: "WAITING_FOR_DEVICE", dispatchedAt: new Date() } },
      );
    }
    const interrupted = await ReadRequest.find({
      status: "PROCESSING",
      leaseUntil: { $lte: new Date() },
      expiresAt: { $gt: new Date() },
    }).limit(100);
    for (const r of interrupted)
      if (!(await Ingress.exists({ eventId: r.resultEventId }))) {
        await ReadRequest.updateOne(
          { _id: r._id, status: "PROCESSING", resultEventId: r.resultEventId },
          {
            $set: { status: "WAITING_FOR_DEVICE" },
            $unset: { resultEventId: 1, leaseHash: 1, leaseUntil: 1 },
          },
        );
      }
    // Repair the crash window between terminal state and notification upsert.
    const pending = await ReadRequest.aggregate([
      { $match: { status: { $in: ["COMPLETED", "FAILED", "EXPIRED"] } } },
      {
        $lookup: {
          from: "user-notifications",
          localField: "requestId",
          foreignField: "relatedRequestId",
          as: "notifications",
        },
      },
      { $match: { "notifications.0": { $exists: false } } },
      { $limit: 100 },
    ]);
    for (const r of pending) await this.notify(r);
    return {
      dispatched: batch.length,
      expired: expired.length,
      repaired: pending.length,
    };
  }
  async request(userId, deviceId, key) {
    const device = await this.owned(userId, deviceId);
    if (
      device.status !== "ACTIVE" ||
      !device.capacidades.supportsOnDemand ||
      !device.capacidades.supportsCommandPolling
    )
      fail(
        "Dispositivo indisponível ou aceita apenas envio espontâneo.",
        409,
        "IOT_COMMAND_UNSUPPORTED",
      );
    if (typeof key !== "string" || !UUID.test(key))
      fail("Idempotency-Key deve ser UUID.");
    const existing = await ReadRequest.findOne({ userId, idempotencyKey: key });
    if (existing) {
      if (existing.deviceId !== deviceId)
        fail("Chave utilizada por outro dispositivo.", 409);
      return clean(existing);
    }
    await this.rate(`request:${userId}`, 10);
    if (process.env.CEOS_IOT_COMMANDS_ENABLED !== "true")
      fail(
        "Leituras remotas ainda não foram habilitadas.",
        503,
        "IOT_COMMANDS_DISABLED",
      );
    for (let slot = 1; slot <= 5; slot++) {
      try {
        const r = await ReadRequest.create({
          requestId: randomUUID(),
          userId,
          deviceId,
          status: "QUEUED",
          queuedAt: new Date(),
          expiresAt: new Date(
            Date.now() +
              Math.max(
                30,
                Math.min(
                  600,
                  Number(process.env.CEOS_IOT_REQUEST_TTL_SECONDS) || 180,
                ),
              ) *
                1000,
          ),
          idempotencyKey: key,
          activeDevice: deviceId,
          activeSlot: slot,
        });
        return clean(r);
      } catch (error) {
        if (error.code !== 11000) throw error;
        const duplicate = await ReadRequest.findOne({
          userId,
          idempotencyKey: key,
        });
        if (duplicate) {
          if (duplicate.deviceId !== deviceId)
            fail("Chave utilizada por outro dispositivo.", 409);
          return clean(duplicate);
        }
        if (await ReadRequest.exists({ activeDevice: deviceId }))
          fail(
            "Já existe uma leitura pendente neste dispositivo.",
            409,
            "IOT_REQUEST_ACTIVE",
          );
      }
    }
    fail(
      "Limite de cinco solicitações simultâneas atingido.",
      409,
      "IOT_REQUEST_LIMIT",
    );
  }
  async commands(device) {
    const leaseToken = secret();
    const now = new Date();
    const r = await ReadRequest.findOneAndUpdate(
      {
        deviceId: device.deviceId,
        userId: device.ownerId,
        expiresAt: { $gt: now },
        $or: [
          { status: "WAITING_FOR_DEVICE" },
          {
            status: "MEASURING",
            leaseUntil: { $lte: now },
            attempts: { $lt: 5 },
          },
        ],
      },
      {
        $set: {
          status: "MEASURING",
          startedAt: now,
          leaseUntil: new Date(Date.now() + 30000),
          leaseHash: hash(leaseToken),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    return r
      ? [
          {
            type: "READ_ONCE",
            requestId: r.requestId,
            expiresAt: r.expiresAt,
            leaseToken,
            leaseSeconds: 30,
          },
        ]
      : [];
  }
  async ack(device, requestId, body) {
    if (!UUID.test(requestId) || typeof body.leaseToken !== "string")
      fail("Comando inválido.");
    const filter = {
      requestId,
      deviceId: device.deviceId,
      userId: device.ownerId,
      status: "MEASURING",
      leaseHash: hash(body.leaseToken),
      leaseUntil: { $gt: new Date() },
      expiresAt: { $gt: new Date() },
    };
    if (body.errorCode) {
      const r = await ReadRequest.findOne(filter);
      if (!r) fail("Lease inválido.", 409);
      await this.terminal(requestId, "FAILED", "DEVICE_READ_FAILED");
      return { acknowledged: true };
    }
    const result = await ReadRequest.updateOne(filter, {
      $set: { acknowledgedAt: new Date() },
    });
    if (!result.matchedCount) fail("Lease inválido.", 409);
    return { acknowledged: true };
  }
  async prepare(body, token) {
    const device = await this.authenticate(body.deviceId, token);
    if (
      !UUID.test(body.eventId || "") ||
      body.userId !== undefined ||
      !Array.isArray(body.measurements) ||
      !body.measurements.length ||
      body.measurements.length > 32
    )
      fail("Evento inválido.");
    const inputHash = digest(body);
    const existing = await Ingress.findOne({ eventId: body.eventId });
    if (existing) {
      if (
        existing.deviceId !== device.deviceId ||
        existing.inputHash !== inputHash ||
        existing.credentialVersion !== device.credentialVersion
      )
        fail("Replay conflitante.", 409, "IOT_REPLAY_CONFLICT");
      return existing.event;
    }
    if (await Measurement.exists({ "metadata.eventId": body.eventId }))
      fail(
        "Evento já persistido; recibo de ingresso expirado.",
        409,
        "IOT_REPLAY_EXPIRED",
      );
    const receivedAt = new Date().toISOString();
    const seen = new Set();
    const measurements = body.measurements.map((m) => {
      if (!m || typeof m.sensorId !== "string") fail("Medição inválida.");
      const sensor = device.sensores.find((s) => s.sensorId === m.sensorId);
      if (
        !sensor ||
        seen.has(m.sensorId) ||
        typeof m.valor !== "number" ||
        !Number.isFinite(m.valor) ||
        m.userId !== undefined
      )
        fail("Sensor ou valor inválido.");
      seen.add(m.sensorId);
      let timestamp = receivedAt;
      if (m.collectedAt !== undefined) {
        if (
          typeof m.collectedAt !== "string" ||
          !Number.isFinite(Date.parse(m.collectedAt)) ||
          Date.parse(m.collectedAt) > Date.now() + 120000 ||
          Date.parse(m.collectedAt) < Date.now() - 86400000
        )
          fail("Horário de coleta inválido.");
        timestamp = new Date(m.collectedAt).toISOString();
      }
      return {
        sensorId: sensor.sensorId,
        sensorTipo: sensor.tipo,
        unidade: sensor.unidade,
        valor: m.valor,
        timestamp,
        timestampOrigin: m.collectedAt ? "collectedAt" : "receivedAt",
        idempotencyKey: `${body.eventId}:${sensor.sensorId}`,
      };
    });
    if (body.requestId) {
      if (
        !UUID.test(body.requestId) ||
        typeof body.leaseToken !== "string" ||
        measurements.length !== device.sensores.length
      )
        fail("Resultado incompleto ou comando inválido.");
      const r = await ReadRequest.findOneAndUpdate(
        {
          requestId: body.requestId,
          deviceId: device.deviceId,
          userId: device.ownerId,
          $or: [
            { status: "MEASURING" },
            { status: "PROCESSING", resultEventId: body.eventId },
          ],
          leaseHash: hash(body.leaseToken),
          leaseUntil: { $gt: new Date() },
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: "PROCESSING", resultEventId: body.eventId } },
        { new: true },
      );
      if (!r)
        fail(
          "Solicitação expirada ou lease inválido.",
          409,
          "IOT_REQUEST_INVALID",
        );
    }
    const event = {
      schemaVersion: 2,
      eventId: body.eventId,
      deviceId: device.deviceId,
      receivedAt,
      measurements,
      ...(body.requestId && { requestId: body.requestId }),
      credentialVersion: device.credentialVersion,
    };
    try {
      await Ingress.create({
        eventId: body.eventId,
        deviceId: device.deviceId,
        ownerId: device.ownerId,
        credentialVersion: device.credentialVersion,
        inputHash,
        event,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const duplicate = await Ingress.findOne({ eventId: body.eventId });
      if (
        duplicate.inputHash !== inputHash ||
        duplicate.deviceId !== device.deviceId
      )
        fail("Replay conflitante.", 409);
      return duplicate.event;
    }
    return event;
  }
  async authorizedEvent(event) {
    const receipt = await Ingress.findOne({
      eventId: event.eventId,
      expiresAt: { $gt: new Date() },
    });
    if (!receipt || digest(receipt.event) !== digest(event))
      fail("Evento não autenticado.", 403, "IOT_EVENT_UNAUTHORIZED");
    const device = await Device.findOne({
      deviceId: event.deviceId,
      ownerId: receipt.ownerId,
      status: "ACTIVE",
      credentialVersion: receipt.credentialVersion,
    });
    if (
      !device ||
      !(await User.exists({ _id: receipt.ownerId, ativo: { $ne: false } }))
    )
      fail("Dispositivo revogado.", 403);
    if (event.requestId) {
      const r = await ReadRequest.findOne({
        requestId: event.requestId,
        deviceId: event.deviceId,
        userId: receipt.ownerId,
        resultEventId: event.eventId,
      });
      if (
        !r ||
        !["PROCESSING", "COMPLETED"].includes(r.status) ||
        (r.status !== "COMPLETED" && r.expiresAt <= new Date())
      )
        fail("Solicitação inválida ou expirada.", 409);
    }
    return String(receipt.ownerId);
  }
  async complete(event) {
    if (!event.requestId) return;
    const r = await ReadRequest.findOneAndUpdate(
      {
        requestId: event.requestId,
        status: "PROCESSING",
        resultEventId: event.eventId,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: "COMPLETED", completedAt: new Date() },
        $unset: { activeDevice: 1, activeSlot: 1, leaseHash: 1, leaseUntil: 1 },
      },
      { new: true },
    );
    if (r) await this.notify(r);
    else {
      const done = await ReadRequest.findOne({
        requestId: event.requestId,
        status: "COMPLETED",
        resultEventId: event.eventId,
      });
      if (!done) fail("Solicitação não pôde ser concluída.", 409);
      await this.notify(done);
    }
  }
  async listDevices(userId) {
    const devices = await Device.find({
      ownerId: userId,
      status: { $ne: "UNLINKED" },
    })
      .sort({ createdAt: -1 })
      .limit(100);
    // Read-only legacy inventory; registration/ownership is never inferred from client input.
    const legacyIds = await Measurement.distinct("deviceId", { userId });
    for (const deviceId of legacyIds)
      if (
        !devices.some((d) => d.deviceId === deviceId) &&
        !(await Device.exists({ deviceId }))
      ) {
        const latest = await Measurement.findOne({ userId, deviceId }).sort({
          timestamp: -1,
        });
        const sensors = await Measurement.aggregate([
          { $match: { userId: latest.userId, deviceId } },
          {
            $group: {
              _id: "$sensorId",
              tipo: { $first: "$sensorTipo" },
              unidade: { $first: "$unidade" },
            },
          },
        ]);
        devices.push({
          deviceId,
          nome: deviceId,
          status: "LEGACY",
          legacy: true,
          ultimoContato: latest.criadoEm,
          capacidades: { supportsPush: true },
          sensores: sensors.map((s) => ({
            sensorId: s._id,
            nome: s._id,
            tipo: s.tipo,
            unidade: s.unidade,
          })),
        });
      }
    return devices.map(clean);
  }
}
module.exports = { IoTPlatform, ACTIVE, clean, digest };
