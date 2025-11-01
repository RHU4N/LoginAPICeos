const TokenBlacklist = require('../models/TokenBlacklist');

class TokenRepository {
  async add(token, expiresAt) {
    try {
      const doc = new TokenBlacklist({ token, expiresAt });
      await doc.save();
      return true;
    } catch (err) {
      // ignore duplicate key or other save issues
      return false;
    }
  }

  async isBlacklisted(token) {
    const found = await TokenBlacklist.findOne({ token });
    return !!found;
  }
}

module.exports = TokenRepository;
