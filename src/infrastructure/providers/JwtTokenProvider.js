const jwt = require("jsonwebtoken");

class JwtTokenProvider {
  generate(payload) {
    if (!process.env.JWT_SECRET) {
      throw new Error('Erro: JWT_SECRET não está definido no arquivo .env');
    }
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "5h" });
  }

  verify(token) {
    if (!process.env.JWT_SECRET) {
      throw new Error('Erro: JWT_SECRET não está definido no arquivo .env');
    }
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

module.exports = JwtTokenProvider;