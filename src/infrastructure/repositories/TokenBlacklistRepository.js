const mongoose = require('mongoose');

const TokenBlacklistSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index
});

const TokenBlacklist = mongoose.model('TokenBlacklist', TokenBlacklistSchema);

class TokenBlacklistRepository {
  async add(token, expiresAt) {
    try {
      const entry = new TokenBlacklist({ token, expiresAt });
      await entry.save();
      return true;
    } catch (err) {
      // duplicate key or other error; ignore duplicate
      if (err && err.code === 11000) return true;
      throw err;
    }
  }

  async exists(token) {
    const found = await TokenBlacklist.findOne({ token }).lean();
    return !!found;
  }
}

module.exports = TokenBlacklistRepository;
