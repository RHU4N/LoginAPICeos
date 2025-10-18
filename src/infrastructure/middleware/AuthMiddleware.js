const jwt = require("jsonwebtoken");
const TokenStoreRepository = require('../repositories/TokenStoreRepository');

const tokenStore = new TokenStoreRepository();

function auth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  tokenStore.exists(token).then(isActive => {
    if (!isActive) return res.status(401).json({ error: "Token inválido" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: "Token inválido" });

      req.userId = user.id;
      next();
    });
  }).catch(err => {
    console.error('Error checking token store', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  });
}

module.exports = auth;