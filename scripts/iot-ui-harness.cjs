// Local-only UI harness. Disposable MongoDB and explicit simulated device; never production.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.CEOS_SERVICE_KEY = randomBytes(32).toString("hex");
process.env.CEOS_IOT_COMMANDS_ENABLED = "true";
const cache = path.resolve(__dirname, "../.cache");
fs.mkdirSync(cache, { recursive: true });
async function run() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require("../index");
  const models = require("../src/domain/entities/IoTPlatform");
  for (const m of Object.values(models)) await m.init();
  await require("../src/domain/entities/IoTMeasurement").init();
  const email = "ceos-ui@test.invalid",
    password = "LocalA!9" + randomBytes(12).toString("hex");
  await require("../src/domain/entities/User").create({
    nome: "Teste Mobile IoT",
    email,
    senhaHash: await require("bcrypt").hash(password, 4),
  });
  fs.writeFileSync(
    path.join(cache, "iot-ui.json"),
    JSON.stringify({ email, password }),
  );
  const server = app.listen(18081, "127.0.0.1", () =>
    console.log(
      "Isolated IoT UI backend ready: port 18081. Credentials saved only in ignored .cache.",
    ),
  );
  const { IoTPlatform } = require("../src/application/use_cases/IoTPlatform");
  const platform = new IoTPlatform();
  const UseCases = require("../src/application/use_cases/IoTUseCases");
  const Repository = require("../src/infrastructure/repositories/IoTMeasurementRepositoryImpl");
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await platform.dispatch();
      const deviceFile = path.join(cache, "iot-ui-device.json");
      if (!fs.existsSync(deviceFile)) return;
      const credentials = JSON.parse(fs.readFileSync(deviceFile, "utf8"));
      if (!credentials.respond) return;
      const device = await platform.authenticate(
        credentials.deviceId,
        credentials.deviceToken,
      );
      const command = (await platform.commands(device))[0];
      if (!command) return;
      await new Promise((resolve) => setTimeout(resolve, 12000));
      await platform.ack(device, command.requestId, {
        leaseToken: command.leaseToken,
      });
      const input = {
        deviceId: device.deviceId,
        eventId: require("node:crypto").randomUUID(),
        requestId: command.requestId,
        leaseToken: command.leaseToken,
        measurements: device.sensores.map((s, i) => ({
          sensorId: s.sensorId,
          valor: [24.5, 61.2, 25.3, 1013.8][i] ?? 1,
        })),
      };
      const event = await platform.prepare(input, credentials.deviceToken);
      await new UseCases(new Repository()).ingestEvent(event);
      console.log(
        "Isolated simulated device persisted request " + command.requestId,
      );
    } catch (e) {
      console.log("Harness diagnostic: " + (e.errorCode || e.code || e.name));
    } finally {
      busy = false;
    }
  }, 3000);
  async function close() {
    clearInterval(timer);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  }
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
run().catch((e) => {
  console.error(e.code || e.name);
  process.exit(1);
});
