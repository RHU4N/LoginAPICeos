const { createHash, timingSafeEqual } = require('node:crypto');
const { AppError } = require('../../errors/AppError');

function serviceAuth(req, _res, next) {
  const expected = process.env.CEOS_SERVICE_KEY;
  if (!expected || expected.length < 32) return next(new AppError('Integração IoT indisponível.', 503, 'IOT_NOT_CONFIGURED'));
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return next(new AppError('HTTPS obrigatório.', 403, 'HTTPS_REQUIRED'));
  }
  const supplied = req.get('x-ceos-service-key') || '';
  const digest = (value) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(expected))) {
    return next(new AppError('Serviço não autorizado.', 401, 'SERVICE_UNAUTHORIZED'));
  }
  return next();
}
module.exports = serviceAuth;
