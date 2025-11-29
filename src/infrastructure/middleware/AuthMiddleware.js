const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log('[AuthMiddleware] authorization header:', authHeader);
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log('[AuthMiddleware] no token provided');
    return res.status(401).json({ error: "Token não fornecido" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[AuthMiddleware] jwt.verify error:', err && err.message);
      return res.status(403).json({ error: "Token inválido" });
    }

    console.log('[AuthMiddleware] token valid, decoded payload:', user);
    req.userId = user.id;
    next();
  });
}

module.exports = auth;