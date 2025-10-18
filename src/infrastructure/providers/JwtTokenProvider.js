const jwt = require('jsonwebtoken');

class JwtTokenProvider {
  generate(payload) {
    if (!process.env.JWT_SECRET) {
      throw new Error('Erro: JWT_SECRET não está definido no arquivo .env');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  verify(token) {
    if (!process.env.JWT_SECRET) {
      throw new Error('Erro: JWT_SECRET não está definido no arquivo .env');
    }
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  decode(token) {
    // jwt.decode does not verify signature, used to read exp
    return jwt.decode(token);
  }
}

module.exports = JwtTokenProvider;