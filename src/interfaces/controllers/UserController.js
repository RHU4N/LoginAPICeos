const { UserErrors } = require('../../application/errors/UserErrors');

class UserController {
  constructor(userUseCases) {
    this.userUseCases = userUseCases;
  }

  async getAll(req, res) {
    try {
      const users = await this.userUseCases.getAllUsers();
      res.status(200).json(users);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getById(req, res) {
    try {
      const user = await this.userUseCases.getUserById(req.params.id);
      res.status(200).json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async create(req, res) {
    try {
      await this.userUseCases.registerUser(req.body);
      res.status(201).json({ message: "Cadastrado com sucesso" });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async update(req, res) {
    try {
      await this.userUseCases.updateUser(req.params.id, req.body);
      res.status(200).json({ message: "Atualizado com sucesso" });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async delete(req, res) {
    try {
      await this.userUseCases.deleteUser(req.params.id);
      res.status(200).json({ message: "Excluído com sucesso" });
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
      res.status(201).json({ message: "Histórico salvo com sucesso" });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getHistorico(req, res) {
    try {
      const historico = await this.userUseCases.getHistorico(req.userId);
      res.status(200).json(historico);
    } catch (err) {
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