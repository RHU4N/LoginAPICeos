/**
 * Inicialização da conexão com MongoDB
 * DEPRECADO: Use connectDatabase() do config/database.js
 */

const { connectDatabase } = require("../../config/database");

// Para compatibilidade, conectar automaticamente se não estiver em testes
if (process.env.NODE_ENV !== "test") {
  connectDatabase().catch((error) => {
    console.error("Erro ao conectar ao banco de dados:", error.message);
    process.exit(1);
  });
}

module.exports = require("mongoose").connection;
