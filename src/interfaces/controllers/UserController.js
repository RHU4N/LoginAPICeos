const { UserErrors } = require('../../application/errors/UserErrors');
const successResponse = require('../responses/successResponse');

class UserController {
  constructor(userUseCases) {
    this.userUseCases = userUseCases;
  }

  async getAll(req, res) {
    try {
      const users = await this.userUseCases.getAllUsers();
      successResponse(res, users, 'Usuários consultados com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getById(req, res) {
    try {
      const user = await this.userUseCases.getUserById(req.params.id);
      successResponse(res, user, 'Usuário consultado com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async create(req, res) {
    try {
      await this.userUseCases.registerUser(req.body);
      successResponse(res, null, 'Usuário cadastrado com sucesso', 201);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async update(req, res) {
    try {
      await this.userUseCases.updateUser(req.params.id, req.body);
      successResponse(res, null, 'Usuário atualizado com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async delete(req, res) {
    try {
      await this.userUseCases.deleteUser(req.params.id);
      successResponse(res, null, 'Usuário excluído com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async addHistorico(req, res) {
    try {
      const { tipo, valores, resultado } = req.body;
      if (!tipo || !valores || !resultado)
        return res.status(400).json({ error: "Campos obrigatórios faltando" });

      await this.userUseCases.addHistorico(req.userId, { tipo, valores, resultado });
      successResponse(res, null, 'Histórico salvo com sucesso', 201);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getHistorico(req, res) {
    try {
      console.log('[UserController] getHistorico called for userId:', req.userId);
      const historico = await this.userUseCases.getHistorico(req.userId);
      successResponse(res, historico, 'Histórico consultado com sucesso');
    } catch (err) {
      console.error('[UserController] getHistorico error:', err && err.stack ? err.stack : err);
      this.handleError(err, res);
    }
  }

  async clearHistorico(req, res) {
    try {
      const historico = await this.userUseCases.clearHistorico(req.userId);
      return successResponse(res, historico, 'Histórico removido com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async deleteHistoricoItem(req, res) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID do histórico é obrigatório' });
      const historico = await this.userUseCases.deleteHistoricoItem(req.userId, id);
      return successResponse(res, historico, 'Item do histórico removido com sucesso');
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async login(req, res) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const result = await this.userUseCases.login(email, senha);
      res.status(200).json(result);
    } catch (err) {
      if (err.message === 'Credenciais inválidas') {
        return res.status(401).json({ error: err.message });
      }
      this.handleError(err, res);
    }
  }

  // Tratamento de erros para os Users
  handleError(err, res) {
    if (err instanceof UserErrors){
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Erro inesperado: ", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
}

module.exports = UserController;