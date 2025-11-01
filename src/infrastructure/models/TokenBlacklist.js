const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TokenBlacklistSchema = new Schema({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { collection: 'TokenBlacklist' });

const TokenBlacklist = mongoose.model('TokenBlacklist', TokenBlacklistSchema);
module.exports = TokenBlacklist;
