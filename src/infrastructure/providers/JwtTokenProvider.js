/**
 * JWT Token Provider - Gerencia access e refresh tokens
 */

const jwt = require("jsonwebtoken");
const authConfig = require("../../config/auth");
const {
  InvalidTokenError,
  TokenExpiredError,
} = require("../../errors/AppError");

class JwtTokenProvider {
  generate(payload) {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
    return this.generateAccessToken(payload);
  }
  verify(token) { return this.verifyAccessToken(token); }
  /**
   * Gerar access token (curta duração)
   */
  generateAccessToken(payload) {
    authConfig.jwt.validateSecret();

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiryAccess,
      algorithm: authConfig.jwt.algorithms[0],
      issuer: "ceos-api",
    });
  }

  /**
   * Gerar refresh token (longa duração)
   */
  generateRefreshToken(payload) {
    authConfig.jwt.validateSecret();

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiryRefresh,
      algorithm: authConfig.jwt.algorithms[0],
      issuer: "ceos-api",
    });
  }

  /**
   * Gerar ambos os tokens (após login bem-sucedido)
   */
  generateTokenPair(userId, email, tokenVersion, role = "USER") {
    const payload = { id: userId, email, tokenVersion, role };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verificar access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, authConfig.jwt.secret, {
        algorithms: authConfig.jwt.algorithms,
        issuer: "ceos-api",
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Verificar refresh token
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, authConfig.jwt.secret, {
        algorithms: authConfig.jwt.algorithms,
        issuer: "ceos-api",
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Decodificar token sem validar (apenas para debug)
   */
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = JwtTokenProvider;
