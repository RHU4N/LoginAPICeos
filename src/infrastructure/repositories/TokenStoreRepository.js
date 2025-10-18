const mongoose = require('mongoose');

const ActiveTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

const ActiveToken = mongoose.model('ActiveToken', ActiveTokenSchema);

class TokenStoreRepository {
  async add(token, userId, expiresAt) {
    const entry = new ActiveToken({ token, userId, expiresAt });
    await entry.save();
    return true;
  }

  async remove(token) {
    const res = await ActiveToken.deleteOne({ token });
    return res.deletedCount > 0;
  }

  async exists(token) {
    const found = await ActiveToken.findOne({ token }).lean();
    return !!found;
  }
}

module.exports = TokenStoreRepository;
