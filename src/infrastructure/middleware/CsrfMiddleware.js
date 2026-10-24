const authConfig = require("../../config/auth");

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfMiddleware(req, res, next) {
  // Só protege operações autenticadas por cookie. Clientes API com Bearer token
  // continuam podendo operar sem header Origin.
  const hasSessionCookie = req.cookies?.accessToken || req.cookies?.refreshToken;
  if (!unsafeMethods.has(req.method) || !hasSessionCookie) return next();

  if (!req.headers.origin || !authConfig.isCorsOriginAllowed(req.headers.origin)) {
    return res.status(403).json({
      success: false,
      error: { code: "CSRF_ORIGIN_DENIED", message: "Origem da requisição não permitida" },
    });
  }

  return next();
}

module.exports = csrfMiddleware;
