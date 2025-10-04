const bcrypt = require("bcrypt");

class BcryptPasswordHasher {
  async hash(password) {
    return bcrypt.hash(password, 10);
  }
  async compare(plain, hash) {
    return bcrypt.compare(plain, hash);
  }
}
module.exports = BcryptPasswordHasher;