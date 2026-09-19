const router = require("express").Router();
const UserController = require("../controllers/UserController");
const UserRepository = require("../../infrastructure/repositories/UserRepositoryImpl");
const UserUseCases = require("../../application/use_cases/UserUseCases");
const PasswordHasher = require("../../infrastructure/providers/BcryptPasswordHasher");
const auth = require("../../infrastructure/middleware/AuthMiddleware");
const { ForbiddenError } = require("../../errors/AppError");
const controller = new UserController(new UserUseCases(new UserRepository(), new PasswordHasher()));

function ownerOrAdmin(req, _res, next) {
  if (req.userRole === "ADMIN" || req.userId === req.params.id) return next();
  return next(new ForbiddenError());
}
function admin(req, _res, next) {
  if (req.userRole === "ADMIN") return next();
  return next(new ForbiddenError());
}

router.post("/", (req, res, next) => controller.create(req, res, next));
router.get("/", auth, admin, (req, res, next) => controller.getAll(req, res, next));
router.get("/:id", auth, ownerOrAdmin, (req, res, next) => controller.getById(req, res, next));
router.patch("/:id", auth, ownerOrAdmin, (req, res, next) => controller.update(req, res, next));
router.delete("/:id", auth, ownerOrAdmin, (req, res, next) => controller.delete(req, res, next));
module.exports = router;
