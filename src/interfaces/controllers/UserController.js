const { CreateUserDTO, UpdateUserDTO, UserResponseDTO } = require("../../dto");

class UserController {
  constructor(userUseCases) { this.userUseCases = userUseCases; }
  async getAll(_req, res, next) { try { const users = await this.userUseCases.getAllUsers(); res.json({ success: true, data: users.map((user) => new UserResponseDTO(user)) }); } catch (error) { next(error); } }
  async getById(req, res, next) { try { const user = await this.userUseCases.getUserById(req.params.id); res.json({ success: true, data: new UserResponseDTO(user) }); } catch (error) { next(error); } }
  async create(req, res, next) { try { const dto = new CreateUserDTO(req.body); dto.validate(); const user = await this.userUseCases.registerUser(dto); res.status(201).json({ success: true, data: new UserResponseDTO(user) }); } catch (error) { next(error); } }
  async update(req, res, next) { try { const dto = new UpdateUserDTO(req.body); dto.validate(); const user = await this.userUseCases.updateUser(req.params.id, dto); res.json({ success: true, data: new UserResponseDTO(user) }); } catch (error) { next(error); } }
  async delete(req, res, next) { try { await this.userUseCases.deleteUser(req.params.id); res.status(204).send(); } catch (error) { next(error); } }
}
module.exports = UserController;
