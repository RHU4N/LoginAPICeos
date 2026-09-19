/**
 * Middleware de Autenticação
 * Valida access token e extrai userId
 */

const JwtTokenProvider = require("../providers/JwtTokenProvider");
const User = require("../../domain/entities/User");
const {
  InvalidTokenError,
  TokenExpiredError,
} = require("../../errors/AppError");

const jwtProvider = new JwtTokenProvider();

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const cookieToken = req.cookies?.accessToken;

    if (!authHeader && !cookieToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: "NO_TOKEN",
          message: "Token não fornecido",
        },
      });
    }

    const parts = authHeader ? authHeader.split(" ") : null;
    if (authHeader && (parts.length !== 2 || parts[0] !== "Bearer")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_FORMAT",
          message: "Formato de token inválido. Use: Bearer <token>",
        },
      });
    }

    const token = cookieToken || parts[1];

    try {
      const decoded = jwtProvider.verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("+tokenVersion +role +ativo");
      if (!user || user.ativo === false || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
        throw new InvalidTokenError();
      }
      req.userId = user._id.toString();
      req.userEmail = user.email;
      req.userRole = user.role || "USER";
      next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "Token expirado. Faça refresh do token.",
          },
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token inválido",
        },
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Erro ao autenticar",
      },
    });
  }
}

module.exports = authMiddleware;
