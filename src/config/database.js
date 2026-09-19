/**
 * Configuração centralizada do MongoDB
 * Gerencia a conexão com separação clara entre ambientes
 */

const mongoose = require("mongoose");
const dns = require("node:dns");
const environment = require("./environment");

/**
 * Conectar ao MongoDB com validação de ambiente
 */
async function connectDatabase() {
  try {
    const mongoUri = environment.MONGO_URI;
    const dbName = environment.MONGODB_DATABASE;

    if (!mongoUri) {
      throw new Error("MONGO_URI não está definido nas variáveis de ambiente");
    }

    // Para MongoDB+SRV, usar DNS customizado se necessário
    if (mongoUri.startsWith("mongodb+srv://")) {
      dns.setServers([process.env.MONGODB_DNS_SERVER || "1.1.1.1"]);
    }

    // Log de conexão (sem exposição de credenciais)
    const dbLog = mongoUri.replace(/([^:]+):([^@]+)@/, "***:***@");
    console.log(`🔌 Conectando ao MongoDB...`);
    console.log(`   Ambiente: ${environment.NODE_ENV}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   URI: ${dbLog}`);

    // Conectar
    await mongoose.connect(mongoUri, {
      dbName: dbName,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      retryWrites: true,
      w: "majority",
    });

    console.log(`✅ Conectado ao MongoDB com sucesso!`);
    console.log(`   Database selecionado: ${mongoose.connection.db.getName()}`);

    // Validar que produção nunca usa banco de testes
    if (environment.isProduction()) {
      const currentDb = mongoose.connection.db.getName();
      if (currentDb.includes("test")) {
        console.error(
          "❌ SEGURANÇA: Produção conectou ao banco de testes! Abortando...",
        );
        await mongoose.connection.close();
        process.exit(1);
      }
    }

    return mongoose.connection;
  } catch (error) {
    console.error(`❌ Erro ao conectar ao MongoDB:`, error.message);
    if (environment.isProduction()) {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Desconectar do MongoDB
 */
async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log("✅ Desconectado do MongoDB");
  } catch (error) {
    console.error("❌ Erro ao desconectar:", error.message);
    throw error;
  }
}

/**
 * Limpar banco de dados (APENAS TESTES)
 */
async function clearDatabase() {
  if (!environment.isTest()) {
    throw new Error("clearDatabase só pode ser chamado em ambiente de testes!");
  }
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    console.log("✅ Banco de testes limpo");
  } catch (error) {
    console.error("❌ Erro ao limpar banco:", error.message);
    throw error;
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  clearDatabase,
};
