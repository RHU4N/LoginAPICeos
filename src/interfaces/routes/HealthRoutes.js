const express = require('express');
const successResponse = require('../responses/successResponse');

// Estados do driver (mongoose.connection.readyState). Informativos: NAO equivalem a um teste do banco.
const DRIVER_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

/**
 * /health  = liveness: leve, sem I/O, sempre 200 enquanto o processo responde. E o probe do App Service e do
 *            teste de disponibilidade. Nao depende do MongoDB, para que uma queda temporaria do Atlas nao retire
 *            todas as instancias de rotacao. Informa o estado do driver sem afirmar que o banco foi verificado.
 * /ready   = readiness: executa "ping" no MongoDB com timeout curto e cache breve. 200 se respondeu; 503 caso
 *            contrario. Destinado a monitoramento/alerta externo, NAO ao Health Check do App Service.
 */
function createHealthRouter({ connection, environment, timeoutMs = 2000, cacheMs = 5000, now = Date.now } = {}) {
  const router = express.Router();
  let cached = null;

  const driverState = () => DRIVER_STATES[connection?.readyState] || 'unknown';

  async function checkDatabase() {
    if (cached && now() - cached.at < cacheMs) return cached.result;
    const started = now();
    let result;
    if (!connection || connection.readyState !== 1 || !connection.db) {
      result = { ok: false, reason: 'not_connected' };
    } else {
      let timer;
      try {
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
        await Promise.race([connection.db.admin().command({ ping: 1 }), timeout]);
        result = { ok: true, latencyMs: now() - started };
      } catch (error) {
        // Nunca devolve a mensagem do driver (pode conter host/cluster).
        result = { ok: false, reason: error && error.message === 'timeout' ? 'timeout' : 'ping_failed' };
      } finally {
        clearTimeout(timer);
      }
    }
    cached = { at: now(), result };
    return result;
  }

  router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return successResponse(res, {
      status: 'OK',
      check: 'liveness',
      environment,
      database: driverState(),
      databaseVerified: false,
      readiness: '/ready',
      timestamp: new Date().toISOString(),
    }, 'API em funcionamento');
  });

  router.get('/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = await checkDatabase();
    const body = {
      status: db.ok ? 'READY' : 'NOT_READY',
      check: 'readiness',
      database: db.ok ? 'ok' : (db.reason || 'unavailable'),
      latencyMs: db.ok ? db.latencyMs : undefined,
      timestamp: new Date().toISOString(),
    };
    if (db.ok) return successResponse(res, body, 'Dependências críticas disponíveis');
    return res.status(503).json({ success: false, message: 'Dependência crítica indisponível', data: body });
  });

  return router;
}

module.exports = { createHealthRouter, DRIVER_STATES };
