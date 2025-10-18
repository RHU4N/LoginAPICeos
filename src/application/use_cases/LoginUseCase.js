const {
  MissingCredentialsError,
  UserNotFoundError,
  InvalidPasswordError
} = require("../errors/AuthErrors");

class LoginUseCase {
  constructor(userUseCases, passwordHasher, tokenProvider, tokenStoreRepository) {
    this.userUseCases = userUseCases;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
    this.tokenStoreRepository = tokenStoreRepository;
  }

  async execute(email, senha) {
    if (!email || !senha) {
      throw new MissingCredentialsError();
    }

    const user = await this.userUseCases.getUserByEmail(email);
    if (!user) throw new UserNotFoundError();

    const valid = await this.passwordHasher.compare(senha, user.senha);
    if (!valid) throw new InvalidPasswordError();

    const token = this.tokenProvider.generate({ id: user._id });
    // store active token with expiry
    try {
      const payload = this.tokenProvider.decode(token);
      const expiresAt = payload && payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 1000 * 60 * 60);
      await this.tokenStoreRepository.add(token, user._id, expiresAt);
    } catch (err) {
      // ignore store errors but proceed to return token
    }

    return token;
  }
}

module.exports = LoginUseCase;