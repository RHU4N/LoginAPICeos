const {
  TokenNotProvidedError,
  InvalidTokenError
} = require("../errors/AuthErrors");

class VerifyTokenUseCase {
  constructor(tokenProvider) {
    this.tokenProvider = tokenProvider;
  }

  execute(token) {
    if (!token) throw new TokenNotProvidedError();

    try {
      return this.tokenProvider.verify(token);
    } catch (err) {
      throw new InvalidTokenError();
    }
  }
}

module.exports = VerifyTokenUseCase;