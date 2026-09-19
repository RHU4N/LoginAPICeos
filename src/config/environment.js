/**
 * Gerenciador centralizado de configurações de ambiente
 * Valida e exporta todas as variáveis de ambiente necessárias
 */

const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "MONGO_URI",
  "MONGODB_DATABASE",
  "JWT_SECRET",
];

// Validar variáveis obrigatórias
const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] && varName !== "NODE_ENV",
);

if (missingVars.length > 0 && process.env.NODE_ENV === "production") {
  console.error(
    `❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias não definidas: ${missingVars.join(", ")}`,
  );
  process.exit(1);
}

const environment = {
  // Ambiente de execução
  NODE_ENV: process.env.NODE_ENV || "development",
  isDevelopment: () => environment.NODE_ENV === "development",
  isTest: () => environment.NODE_ENV === "test",
  isProduction: () => environment.NODE_ENV === "production",

  // Validação: Produção NUNCA pode usar banco de testes
  validateProdEnvironment: () => {
    if (
      environment.isProduction() &&
      environment.MONGODB_DATABASE?.includes("test")
    ) {
      console.error(
        "❌ SEGURANÇA CRÍTICA: Produção não pode usar banco de testes!",
      );
      process.exit(1);
    }
  },

  // Porta HTTP
  PORT: parseInt(process.env.PORT, 10) || 8081,

  // MongoDB
  MONGO_URI: process.env.MONGO_URI || "",
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || "ceos_dev",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_in_prod",
  JWT_EXPIRY_ACCESS: process.env.JWT_EXPIRY_ACCESS || "15m",
  JWT_EXPIRY_REFRESH: process.env.JWT_EXPIRY_REFRESH || "7d",

  // Segurança
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  RATE_LIMIT_WINDOW_MS:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  RATE_LIMIT_MAX_ATTEMPTS:
    parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS, 10) || 5,
  LOGIN_LOCK_DURATION_MS:
    parseInt(process.env.LOGIN_LOCK_DURATION_MS, 10) || 30 * 60 * 1000, // 30 min

  // Cookies (segurança)
  COOKIE_SECURE: process.env.NODE_ENV === "production",
  COOKIE_HTTP_ONLY: true,
  COOKIE_SAME_SITE: "Strict",

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",

  // Logs
  LOG_LEVEL:
    process.env.LOG_LEVEL ||
    ((process.env.NODE_ENV || "development") === "development" ? "debug" : "info"),
};

// Validar produção
environment.validateProdEnvironment();

// Avisos para desenvolvimento
if (environment.isDevelopment()) {
  console.warn("⚠️  Desenvolvendo em modo DEV — não use valores de produção");
}

module.exports = environment;
