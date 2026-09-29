/**
 * HistoricoController - Controlador de Histórico
 */

const { ValidationError } = require("../../errors/AppError");
const UserRepositoryImpl = require("../../infrastructure/repositories/UserRepositoryImpl");

class HistoricoController {
  constructor() {
    this.userRepository = new UserRepositoryImpl();
  }

  /**
   * POST /historicos
   * Adicionar entrada ao histórico
   */
  async add(req, res, next) {
    try {
      const userId = req.userId;
      const { tipo, valores, resultado } = req.body;

      if (!tipo || !valores || !resultado) {
        throw new ValidationError("tipo, valores e resultado são obrigatórios");
      }

      const historico = await this.userRepository.addHistorico(userId, {
        tipo,
        valores,
        resultado,
      });

      return res.status(201).json({
        success: true,
        message: "Histórico adicionado com sucesso",
        data: historico,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /historicos
   * Listar histórico do usuário
   */
  async list(req, res, next) {
    try {
      const userId = req.userId;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

      const historicos = await this.userRepository.getHistorico(userId);

      // Paginar
      const skip = (page - 1) * limit;
      const paginados = historicos.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        data: paginados,
        pagination: {
          page,
          limit,
          total: historicos.length,
          totalPages: Math.ceil(historicos.length / limit),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /historicos/:id
   * Deletar item do histórico
   */
  async delete(req, res, next) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!id) {
        throw new ValidationError("ID do histórico é obrigatório");
      }

      const historicos = await this.userRepository.deleteHistoricoItem(
        userId,
        id,
      );

      return res.status(200).json({
        success: true,
        message: "Item do histórico removido com sucesso",
        data: historicos,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /historicos
   * Limpar todo o histórico
   */
  async clear(req, res, next) {
    try {
      const userId = req.userId;

      const confirmed = req.query.confirmed === "true";
      if (!confirmed) {
        return res.status(400).json({
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: "Use ?confirmed=true para confirmar limpeza do histórico",
          },
        });
      }

      await this.userRepository.clearHistorico(userId);

      return res.status(200).json({
        success: true,
        message: "Histórico limpo com sucesso",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = HistoricoController;
