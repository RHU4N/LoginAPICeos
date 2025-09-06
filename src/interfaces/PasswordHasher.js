class PasswordHasher {
  hash(password) { throw new Error("Not implemented"); }
  compare(plain, hash) { throw new Error("Not implemented"); }
}
module.exports = PasswordHasher;