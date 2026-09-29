/**
 * Rotas de Histórico - Operações do Usuário
 */

const express = require("express");
const router = express.Router();
const authMiddleware = require("../../infrastructure/middleware/AuthMiddleware");
const HistoricoController = require("../controllers/HistoricoController");

// Controllers
const userRepository = require("../../infrastructure/repositories/UserRepositoryImpl");
const historicoController = new HistoricoController(userRepository);

/**
 * POST /historicos
 * Adicionar entrada ao histórico
 */
router.post("/", authMiddleware, (req, res, next) => {
  historicoController.add(req, res).catch(next);
});

/**
 * GET /historicos
 * Listar histórico do usuário
 */
router.get("/", authMiddleware, (req, res, next) => {
  historicoController.list(req, res).catch(next);
});

/**
 * DELETE /historicos/:id
 * Deletar item do histórico
 */
router.delete("/:id", authMiddleware, (req, res, next) => {
  historicoController.delete(req, res).catch(next);
});

/**
 * DELETE /historicos
 * Limpar todo o histórico
 */
router.delete("/", authMiddleware, (req, res, next) => {
  historicoController.clear(req, res).catch(next);
});

module.exports = router;
