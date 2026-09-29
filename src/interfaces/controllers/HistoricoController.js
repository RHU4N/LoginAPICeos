/**
 * HistoricoController - Controlador de Histórico
 */

const { ValidationError } = require("../../errors/AppError");
const UserRepositoryImpl = require("../../infrastructure/repositories/UserRepositoryImpl");
const successResponse = require("../responses/successResponse");

class HistoricoController {
  constructor(userRepository = new UserRepositoryImpl()) {
    this.userRepository = userRepository;
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

      return successResponse(res, historico, "Histórico adicionado com sucesso", 201);
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

      return successResponse(
        res,
        paginados,
        "Histórico consultado com sucesso",
        200,
        {
          pagination: {
            page,
            limit,
            total: historicos.length,
            totalPages: Math.ceil(historicos.length / limit),
          },
        },
      );
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

      return successResponse(
        res,
        historicos,
        "Item do histórico removido com sucesso",
      );
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

      return successResponse(res, null, "Histórico limpo com sucesso");
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = HistoricoController;
