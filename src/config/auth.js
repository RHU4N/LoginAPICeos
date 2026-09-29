/**
 * Configuração centralizada de autenticação e segurança
 */

const environment = require("./environment");

const authConfig = {
  /**
   * Configurações de JWT
   */
  jwt: {
    secret: environment.JWT_SECRET,
    algorithms: ["HS256"],
    expiryAccess: environment.JWT_EXPIRY_ACCESS,
    expiryRefresh: environment.JWT_EXPIRY_REFRESH,

    /**
     * Validar que o secret está seguro em produção
     */
    validateSecret: () => {
      if (environment.isProduction()) {
        if (
          environment.JWT_SECRET === "dev_secret_change_in_prod" ||
          environment.JWT_SECRET.length < 32
        ) {
          throw new Error(
            "JWT_SECRET não é seguro o suficiente para produção!",
          );
        }
      }
    },
  },

  /**
   * Configurações de senha (Bcrypt)
   */
  password: {
    hashRounds: environment.BCRYPT_ROUNDS,
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,

    /**
     * Validar força da senha
     */
    isStrong: (password) => {
      if (!password || password.length < authConfig.password.minLength)
        return false;
      if (authConfig.password.requireUppercase && !/[A-Z]/.test(password))
        return false;
      if (authConfig.password.requireNumbers && !/\d/.test(password))
        return false;
      if (
        authConfig.password.requireSpecialChars &&
        !/[!@#$%^&*]/.test(password)
      )
        return false;
      return true;
    },

    /**
     * Mensagem de requisitos
     */
    getRequirements: () =>
      `Mínimo 8 caracteres, pelo menos 1 maiúscula, 1 número e 1 caractere especial (!@#$%^&*)`,
  },

  /**
   * Proteção contra brute force
   */
  bruteForce: {
    windowMs: environment.RATE_LIMIT_WINDOW_MS,
    maxAttempts: environment.RATE_LIMIT_MAX_ATTEMPTS,
    lockDurationMs: environment.LOGIN_LOCK_DURATION_MS,
  },

  /**
   * Cookies (HttpOnly + Secure)
   */
  cookies: {
    accessToken: {
      name: "accessToken",
      secure: environment.COOKIE_SECURE,
      httpOnly: environment.COOKIE_HTTP_ONLY,
      sameSite: environment.COOKIE_SAME_SITE,
      maxAge: 15 * 60 * 1000, // 15 min
    },
    refreshToken: {
      name: "refreshToken",
      secure: environment.COOKIE_SECURE,
      httpOnly: environment.COOKIE_HTTP_ONLY,
      sameSite: environment.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  },

  /**
   * CORS
   */
  cors: {
    origin: environment.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
};

module.exports = authConfig;
