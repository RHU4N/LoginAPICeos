/**
 * LoginAPICeos - Ponto de entrada principal
 * Refatorado com nova arquitetura segura e escalável
 */

// DEVE SER A PRIMEIRA LINHA: carregar variáveis de ambiente
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Importar configurações centralizadas
const environment = require("./src/config/environment");
const { connectDatabase } = require("./src/config/database");
const authConfig = require("./src/config/auth");
const errorHandler = require("./src/infrastructure/middleware/ErrorHandler");

// Criar app Express
const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Parser pequeno para cookies; evita depender de dados de autenticação no body.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
      const separator = part.indexOf("=");
      return [decodeURIComponent(part.slice(0, separator).trim()), decodeURIComponent(part.slice(separator + 1).trim())];
    }).filter(([name]) => name),
  );
  next();
});

// ============================================================================
// MIDDLEWARES GLOBAIS
// ============================================================================

// Body parser
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// CORS
app.use(cors(authConfig.cors));

// Log de requisições (desenvolvimento)
if (environment.isDevelopment()) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "OK",
      environment: environment.NODE_ENV,
      database: "connected",
      timestamp: new Date().toISOString(),
    },
  });
});

// Raiz
app.get("/", (req, res) => {
  res.json({
    message: "LoginAPICeos - API de Autenticação",
    status: "Estou aqui",
    version: "2.0.0",
    environment: environment.NODE_ENV,
  });
});

// ============================================================================
// ROTAS
// ============================================================================

const authRoutes = require("./src/interfaces/routes/AuthRoutes");
const userRoutes = require("./src/interfaces/routes/UserRoutes");
const favoriteRoutes = require("./src/interfaces/routes/FavoriteRoutes");
const customFunctionRoutes = require("./src/interfaces/routes/CustomFunctionRoutes");
const iotRoutes = require("./src/interfaces/routes/IoTRoutes");
const historicoRoutes = require("./src/interfaces/routes/HistoricoRoutes");

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/favorites", favoriteRoutes);
app.use("/custom-functions", customFunctionRoutes);
app.use("/iot", iotRoutes);
app.use("/historicos", historicoRoutes);

// Swagger/API Docs: ativado localmente por padrão; desativado em produção.
if (environment.ENABLE_SWAGGER) {
  const { setupSwagger } = require("./swagger/swaggerDocs");
  setupSwagger(app);
}

// ============================================================================
// TRATAMENTO DE ERROS
// ============================================================================

// 404 - Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint não encontrado",
    },
  });
});

// Handler de erros global
app.use(errorHandler);

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

/**
 * Conectar ao banco e iniciar servidor (apenas se executado direto)
 */
async function startServer() {
  try {
    // Conectar ao banco de dados
    await connectDatabase();

    // Iniciar server
    const port = environment.PORT;
    app.listen(port, () => {
      console.log(`\n✅ Servidor rodando na porta ${port}`);
      console.log(`🌍 Ambiente: ${environment.NODE_ENV}`);
      console.log(`📚 Documentação: http://localhost:${port}/api-docs\n`);
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error.message);
    process.exit(1);
  }
}

// Iniciar apenas se for executado diretamente (não importado)
if (require.main === module) {
  startServer();
}

module.exports = app;
