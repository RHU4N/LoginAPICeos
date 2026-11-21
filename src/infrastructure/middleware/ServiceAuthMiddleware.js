const { createHash, timingSafeEqual } = require('node:crypto');
const { AppError } = require('../../errors/AppError');

const MIN_LENGTH = 32;
const digest = (value) => createHash('sha256').update(value).digest();

// Chaves aceitas: CEOS_SERVICE_KEY (atual) e, apenas durante uma rotação coordenada,
// CEOS_SERVICE_KEY_PREVIOUS (anterior). Remover a anterior encerra a janela de transição.
function acceptedKeys(env = process.env) {
  const current = env.CEOS_SERVICE_KEY;
  if (!current || current.length < MIN_LENGTH) return null;
  const keys = [current];
  const previous = env.CEOS_SERVICE_KEY_PREVIOUS;
  if (previous && previous.length >= MIN_LENGTH && previous !== current) keys.push(previous);
  return keys;
}

function serviceAuth(req, _res, next) {
  const keys = acceptedKeys();
  if (!keys) return next(new AppError('Integração IoT indisponível.', 503, 'IOT_NOT_CONFIGURED'));
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return next(new AppError('HTTPS obrigatório.', 403, 'HTTPS_REQUIRED'));
  }
  const supplied = digest(req.get('x-ceos-service-key') || '');
  // Compara com todas as chaves aceitas (sem curto-circuito) em tempo constante por chave.
  let ok = false;
  for (const key of keys) ok = timingSafeEqual(supplied, digest(key)) || ok;
  if (!ok) return next(new AppError('Serviço não autorizado.', 401, 'SERVICE_UNAUTHORIZED'));
  return next();
}
module.exports = serviceAuth;
module.exports.acceptedKeys = acceptedKeys;
