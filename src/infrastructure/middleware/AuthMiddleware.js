const jwt = require('jsonwebtoken');
const TokenRepository = require('../repositories/TokenRepository');

const tokenRepo = new TokenRepository();

async function auth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    // Check blacklist first
    const blacklisted = await tokenRepo.isBlacklisted(token);
    if (blacklisted) return res.status(403).json({ error: 'Token inválido' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Token inválido' });

      req.userId = user.id;
      next();
    });
  } catch (err) {
    console.error('Auth middleware error', err);
    return res.status(500).json({ error: 'Erro no servidor de autenticação' });
  }
}

module.exports = auth;