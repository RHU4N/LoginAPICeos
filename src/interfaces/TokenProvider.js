class TokenProvider {
  generate(payload) { throw new Error("Not implemented"); }
  verify(token) { throw new Error("Not implemented"); }
}

module.exports = TokenProvider;
