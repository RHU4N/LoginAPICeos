const successResponse = require("../responses/successResponse");
const { CreateUserDTO, UpdateUserDTO, UserResponseDTO } = require("../../dto");

class UserController {
  constructor(userUseCases) {
    this.userUseCases = userUseCases;
  }

  async getAll(_req, res, next) {
    try {
      const users = await this.userUseCases.getAllUsers();
      return successResponse(
        res,
        users.map((user) => new UserResponseDTO(user)),
        "Usuários consultados com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const user = await this.userUseCases.getUserById(req.params.id);
      return successResponse(
        res,
        new UserResponseDTO(user),
        "Usuário consultado com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const dto = new CreateUserDTO(req.body);
      dto.validate();
      const user = await this.userUseCases.registerUser(dto);
      return successResponse(
        res,
        new UserResponseDTO(user),
        "Usuário cadastrado com sucesso",
        201,
      );
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const dto = new UpdateUserDTO(req.body);
      dto.validate();
      const user = await this.userUseCases.updateUser(req.params.id, dto);
      return successResponse(
        res,
        new UserResponseDTO(user),
        "Usuário atualizado com sucesso",
      );
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.userUseCases.deleteUser(req.params.id);
      return successResponse(res, null, "Usuário excluído com sucesso");
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = UserController;
