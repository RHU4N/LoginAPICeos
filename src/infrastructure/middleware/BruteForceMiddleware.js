/**
 * Middleware de Rate Limiting e Proteção contra Brute Force
 */

const authConfig = require("../../config/auth");

/**
 * Store em memória para rastreamento de tentativas
 * Em produção, usar Redis
 */
/**
 * Normaliza o e-mail da mesma forma que o modelo User (trim + minúsculas),
 * para que variações de caixa/espaços não criem contadores independentes.
 */
function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

class BruteForceStore {
  constructor() {
    this.attempts = new Map();
  }

  /**
   * Reserva ATÔMICA de uma tentativa. Como o Node executa este método de forma
   * síncrona, requisições simultâneas não ultrapassam o limite enquanto o
   * bcrypt ainda está comparando a senha. Mantém a semântica sequencial:
   * a tentativa só é recusada quando o contador já excede o limite.
   */
  reserveAttempt(email) {
    if (this.isBlocked(email)) return { allowed: false };
    const { attempts } = this.recordAttempt(email);
    return { allowed: true, attempts };
  }

  /**
   * Devolve uma reserva quando a tentativa falhou por motivo que não é
   * credencial inválida (ex.: indisponibilidade do banco).
   */
  releaseAttempt(email) {
    const key = `login:${normalizeEmail(email)}`;
    const record = this.attempts.get(key);
    if (!record) return;
    record.count -= 1;
    if (record.count <= 0) this.attempts.delete(key);
  }

  /**
   * Registrar tentativa de login para um email
   */
  recordAttempt(email) {
    const key = `login:${normalizeEmail(email)}`;
    const now = Date.now();
    const record = this.attempts.get(key) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
    };

    // Resetar se passou a janela de tempo
    if (now - record.firstAttempt > authConfig.bruteForce.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: now, lastAttempt: now });
      return { attempts: 1, isBlocked: false };
    }

    record.count++;
    record.lastAttempt = now;
    this.attempts.set(key, record);

    const isBlocked = record.count > authConfig.bruteForce.maxAttempts;
    return { attempts: record.count, isBlocked };
  }

  /**
   * Resetar tentativas (login bem-sucedido)
   */
  resetAttempts(email) {
    this.attempts.delete(`login:${normalizeEmail(email)}`);
  }

  /**
   * Verificar se está bloqueado
   */
  isBlocked(email) {
    const key = `login:${normalizeEmail(email)}`;
    const record = this.attempts.get(key);

    if (!record) return false;

    const now = Date.now();
    if (now - record.firstAttempt > authConfig.bruteForce.windowMs) {
      this.attempts.delete(key);
      return false;
    }

    return record.count > authConfig.bruteForce.maxAttempts;
  }

  /**
   * Obter tempo restante de bloqueio (em minutos)
   */
  getRemainingLockTime(email) {
    const key = `login:${normalizeEmail(email)}`;
    const record = this.attempts.get(key);

    if (!record) return 0;

    const elapsed = Date.now() - record.firstAttempt;
    const remaining = authConfig.bruteForce.windowMs - elapsed;

    if (remaining <= 0) {
      this.attempts.delete(key);
      return 0;
    }

    return Math.ceil(remaining / 60000); // Converter para minutos
  }

  /**
   * Limpar entries expirados (para não acumular na memória)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.firstAttempt > authConfig.bruteForce.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}

// Instância global
const bruteForceStore = new BruteForceStore();

// Limpar a cada 5 minutos. O timer não deve manter um processo HTTP/teste vivo
// sozinho quando não há mais trabalho pendente.
const cleanupInterval = setInterval(() => bruteForceStore.cleanup(), 5 * 60 * 1000);
cleanupInterval.unref();

/**
 * Middleware para verificar brute force
 */
function bruteForceMiddleware(req, res, next) {
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: "MISSING_EMAIL",
        message: "Email é obrigatório",
      },
    });
  }

  if (bruteForceStore.isBlocked(email)) {
    const minutosRestantes = bruteForceStore.getRemainingLockTime(email);
    return res.status(429).json({
      success: false,
      error: {
        code: "BRUTE_FORCE_LOCKED",
        message: `Muitas tentativas. Tente novamente em ${minutosRestantes} minuto(s).`,
      },
    });
  }

  next();
}

/**
 * Reservar atomicamente uma tentativa de login (antes de validar a senha).
 */
function reserveLoginAttempt(email) {
  return bruteForceStore.reserveAttempt(email).allowed;
}

/**
 * Liberar reserva por falha que não é credencial inválida.
 */
function releaseLoginAttempt(email) {
  bruteForceStore.releaseAttempt(email);
}

/**
 * Registrar tentativa falhada
 */
function recordFailedAttempt(email) {
  const result = bruteForceStore.recordAttempt(email);
  return result;
}

/**
 * Resetar tentativas (login bem-sucedido)
 */
function resetAttempts(email) {
  bruteForceStore.resetAttempts(email);
}

/**
 * Verificar se conta está bloqueada
 */
function isAccountBlocked(email) {
  return bruteForceStore.isBlocked(email);
}

module.exports = {
  bruteForceMiddleware,
  recordFailedAttempt,
  reserveLoginAttempt,
  releaseLoginAttempt,
  resetAttempts,
  isAccountBlocked,
  normalizeEmail,
  BruteForceStore,
};
