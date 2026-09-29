/**
 * Rotas de Histórico - Operações do Usuário
 */

const express = require("express");
const router = express.Router();
const authMiddleware = require("../../infrastructure/middleware/AuthMiddleware");
const HistoricoController = require("../controllers/HistoricoController");

// Controllers
const UserRepositoryImpl = require("../../infrastructure/repositories/UserRepositoryImpl");
const historicoController = new HistoricoController(new UserRepositoryImpl());

/**
 * POST /historicos
 * Adicionar entrada ao histórico
 */
router.post("/", authMiddleware, (req, res, next) => {
  return historicoController.add(req, res, next);
});

/**
 * GET /historicos
 * Listar histórico do usuário
 */
router.get("/", authMiddleware, (req, res, next) => {
  return historicoController.list(req, res, next);
});

/**
 * DELETE /historicos/:id
 * Deletar item do histórico
 */
router.delete("/:id", authMiddleware, (req, res, next) => {
  return historicoController.delete(req, res, next);
});

/**
 * DELETE /historicos
 * Limpar todo o histórico
 */
router.delete("/", authMiddleware, (req, res, next) => {
  return historicoController.clear(req, res, next);
});

module.exports = router;
