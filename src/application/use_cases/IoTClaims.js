// Associação de dispositivos por código temporário (semelhante a "conectar TV/smart device").
// 1. O dispositivo sem credencial chama start(): recebe um código curto (exibido no Serial/tela)
//    e um pollSecret que só ele conhece.
// 2. O usuário autenticado digita o código no Web/Mobile: lookup() mostra o equipamento e
//    confirm() o associa à conta (novo dispositivo ou reconexão de um existente).
// 3. O dispositivo consulta poll() com o pollSecret e recebe uma única vez o deviceToken.
// O usuário nunca vê nem copia tokens. Códigos expiram, são de uso único e só geram hash no banco.
const { randomInt, randomUUID } = require("node:crypto");
const { Claim, Device, ReadRequest } = require("../../domain/entities/IoTPlatform");
const User = require("../../domain/entities/User");
const {
  ACTIVE,
  clean,
  deviceSpec,
  hash,
  secret,
  text,
  fail,
  ID,
} = require("./IoTPlatform");

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0/O, 1/I/L
const CODE_LENGTH = 8;
const CLAIM_TTL_MS = 10 * 60000;
const APPROVED_TTL_MS = 10 * 60000;
const POLL_INTERVAL_SECONDS = 5;
const MAX_DEVICES = 30;

function newCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
function normalizeCode(value) {
  const code = typeof value === "string" ? value.toUpperCase().replace(/[\s-]/g, "") : "";
  if (code.length !== CODE_LENGTH || [...code].some((c) => !ALPHABET.includes(c)))
    fail("Código de associação inválido ou expirado.", 404, "IOT_CLAIM_INVALID");
  return code;
}
const preview = (claim) => ({
  nomeSugerido: claim.nomeSugerido,
  tipoDispositivo: claim.tipoDispositivo,
  fabricante: claim.fabricante,
  modelo: claim.modelo,
  hardwareId: claim.hardwareId,
  sensores: claim.sensores,
  capacidades: claim.capacidades,
  expiresAt: claim.expiresAt,
});

class IoTClaims {
  constructor(platform) {
    this.platform = platform;
  }

  async start(body, ip) {
    const limit = Number(process.env.CEOS_IOT_CLAIM_START_LIMIT) || 10;
    await this.platform.rate(`claim-start:${ip}`, limit);
    const { sensores, capacidades } = deviceSpec(body || {});
    const pollSecret = secret();
    const now = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        const claim = await Claim.create({
          claimId: randomUUID(),
          codeHash: hash(code),
          pollHash: hash(pollSecret),
          nomeSugerido: text(body.nome || "Dispositivo CEOS", 80, true),
          tipoDispositivo: text(body.tipoDispositivo || "http-json", 80),
          fabricante: text(body.fabricante || "", 80),
          modelo: text(body.modelo || "", 80),
          hardwareId: text(body.hardwareId || "", 64),
          sensores,
          capacidades,
          expiresAt: new Date(now + CLAIM_TTL_MS),
          purgeAt: new Date(now + CLAIM_TTL_MS + APPROVED_TTL_MS + 86400000),
        });
        return {
          claimId: claim.claimId,
          pairingCode: formatCode(code),
          pollSecret,
          expiresAt: claim.expiresAt,
          pollIntervalSeconds: POLL_INTERVAL_SECONDS,
        };
      } catch (error) {
        if (error.code !== 11000) throw error; // colisão de código: tenta outro
      }
    }
    fail("Não foi possível gerar o código. Tente novamente.", 503, "IOT_CLAIM_UNAVAILABLE");
  }

  async pending(code) {
    const claim = await Claim.findOne({
      codeHash: hash(normalizeCode(code)),
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    });
    if (!claim) fail("Código de associação inválido ou expirado.", 404, "IOT_CLAIM_INVALID");
    return claim;
  }

  async lookup(userId, code) {
    await this.platform.rate(`claim-lookup:${userId}`, 10);
    const claim = await this.pending(code);
    const ids = claim.sensores.map((s) => s.sensorId).sort().join(",");
    // Somente dispositivos da própria conta com os mesmos sensores podem ser reconectados.
    const reconnectable = (
      await Device.find({ ownerId: userId, status: { $ne: "UNLINKED" } })
        .sort({ createdAt: -1 })
        .limit(100)
    ).filter((d) => d.sensores.map((s) => s.sensorId).sort().join(",") === ids);
    return {
      ...preview(claim),
      reconnectable: reconnectable.map((d) => ({
        deviceId: d.deviceId,
        nome: d.nome,
        status: d.status,
      })),
    };
  }

  async confirm(userId, body) {
    await this.platform.rate(`claim-confirm:${userId}`, 10);
    const claim = await this.pending(body.code);
    let device;
    let created = false;
    if (body.deviceId !== undefined && body.deviceId !== null && body.deviceId !== "") {
      if (typeof body.deviceId !== "string" || !ID.test(body.deviceId))
        fail("Dispositivo não encontrado.", 404, "IOT_DEVICE_NOT_FOUND");
      device = await this.platform.owned(userId, body.deviceId);
      if (device.status === "UNLINKED") fail("Dispositivo desvinculado.", 409);
      const same =
        device.sensores.map((s) => s.sensorId).sort().join(",") ===
        claim.sensores.map((s) => s.sensorId).sort().join(",");
      if (!same) fail("Os sensores não correspondem ao dispositivo escolhido.", 409, "IOT_CLAIM_MISMATCH");
    } else {
      if (
        (await Device.countDocuments({ ownerId: userId, status: { $ne: "UNLINKED" } })) >=
        MAX_DEVICES
      )
        fail("Limite de dispositivos atingido.", 409);
      device = await Device.create({
        ownerId: userId,
        deviceId: `ceos-${randomUUID()}`,
        nome: text(body.nome || claim.nomeSugerido, 80, true),
        descricao: text(body.descricao || "", 500),
        tipoDispositivo: claim.tipoDispositivo,
        fabricante: claim.fabricante,
        modelo: claim.modelo,
        sensores: claim.sensores,
        capacidades: claim.capacidades,
        status: "PROVISIONING",
        audit: [{ action: "CLAIM", at: new Date() }],
      });
      created = true;
    }
    const approved = await Claim.findOneAndUpdate(
      { _id: claim._id, status: "PENDING", expiresAt: { $gt: new Date() } },
      { $set: { status: "APPROVED", ownerId: userId, deviceId: device.deviceId, approvedAt: new Date() } },
      { new: true },
    );
    if (!approved) {
      if (created) await Device.deleteOne({ _id: device._id, status: "PROVISIONING" });
      fail("Código de associação inválido ou expirado.", 404, "IOT_CLAIM_INVALID");
    }
    if (!created) {
      // Reconexão: a credencial anterior deixa de valer imediatamente; histórico é preservado.
      device = await Device.findByIdAndUpdate(
        device._id,
        {
          $set: {
            status: "PROVISIONING",
            revokedAt: new Date(),
            ...(body.nome && { nome: text(body.nome, 80, true) }),
          },
          $unset: { credentialHash: 1, provisioningHash: 1, provisioningExpiresAt: 1 },
          $inc: { credentialVersion: 1 },
          $push: { audit: { action: "RECLAIM", at: new Date() } },
        },
        { new: true },
      );
      const requests = await ReadRequest.find({ deviceId: device.deviceId, status: { $in: ACTIVE } });
      for (const r of requests) await this.platform.terminal(r.requestId, "FAILED", "DEVICE_REVOKED");
    }
    return { device: clean(device), reconnected: !created };
  }

  async poll(body) {
    if (typeof body.claimId !== "string" || typeof body.pollSecret !== "string" || body.pollSecret.length !== 43)
      fail("Associação inválida.", 401, "IOT_CLAIM_UNAUTHORIZED");
    await this.platform.rate(`claim-poll:${body.claimId}`, 30);
    const claim = await Claim.findOne({ claimId: body.claimId }).select("+pollHash");
    if (!claim || claim.pollHash !== hash(body.pollSecret))
      fail("Associação inválida.", 401, "IOT_CLAIM_UNAUTHORIZED");
    const now = new Date();
    if (claim.status === "PENDING") {
      if (claim.expiresAt <= now) fail("Código expirado. Reinicie o dispositivo para gerar outro.", 410, "IOT_CLAIM_EXPIRED");
      return { status: "PENDING", expiresAt: claim.expiresAt, pollIntervalSeconds: POLL_INTERVAL_SECONDS };
    }
    if (claim.status !== "APPROVED" || claim.approvedAt.getTime() + APPROVED_TTL_MS <= now.getTime())
      fail("Associação já utilizada ou expirada.", 410, "IOT_CLAIM_EXPIRED");
    const consumed = await Claim.findOneAndUpdate(
      { _id: claim._id, status: "APPROVED" },
      { $set: { status: "CONSUMED", consumedAt: now } },
      { new: true },
    );
    if (!consumed) fail("Associação já utilizada ou expirada.", 410, "IOT_CLAIM_EXPIRED");
    if (!(await User.exists({ _id: consumed.ownerId, ativo: { $ne: false } })))
      fail("Associação inválida.", 401, "IOT_CLAIM_UNAUTHORIZED");
    const deviceToken = secret();
    const device = await Device.findOneAndUpdate(
      { deviceId: consumed.deviceId, ownerId: consumed.ownerId, status: "PROVISIONING" },
      {
        $set: { status: "ACTIVE", credentialHash: hash(deviceToken), ultimoContato: now },
        $push: { audit: { action: "PAIR", at: now } },
      },
      { new: true },
    );
    if (!device) fail("A associação foi cancelada pelo usuário.", 409, "IOT_CLAIM_CANCELLED");
    return {
      status: "APPROVED",
      deviceId: device.deviceId,
      deviceToken,
      sensores: device.sensores,
      capacidades: device.capacidades,
    };
  }
}

module.exports = { IoTClaims, normalizeCode, formatCode, ALPHABET, CODE_LENGTH };
