const environment = require("../../config/environment");

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfMiddleware(req, res, next) {
  // Só protege operações autenticadas por cookie. Clientes API com Bearer token
  // continuam podendo operar sem header Origin.
  const hasSessionCookie = req.cookies?.accessToken || req.cookies?.refreshToken;
  if (!unsafeMethods.has(req.method) || !hasSessionCookie) return next();

  const allowedOrigins = [environment.CORS_ORIGIN];
  if (environment.isDevelopment()) allowedOrigins.push(`http://localhost:${environment.PORT}`);

  if (!req.headers.origin || !allowedOrigins.includes(req.headers.origin)) {
    return res.status(403).json({
      success: false,
      error: { code: "CSRF_ORIGIN_DENIED", message: "Origem da requisição não permitida" },
    });
  }

  return next();
}

module.exports = csrfMiddleware;
