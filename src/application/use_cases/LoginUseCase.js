const {
  MissingCredentialsError,
  UserNotFoundError,
  InvalidPasswordError
} = require("../errors/AuthErrors");

class LoginUseCase {
  constructor(userUseCases, passwordHasher, tokenProvider) {
    this.userUseCases = userUseCases;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
  }

  async execute(email, senha) {
    if (!email || !senha) {
      throw new MissingCredentialsError();
    }

    const user = await this.userUseCases.getUserByEmail(email);
    if (!user) throw new UserNotFoundError();

    const valid = await this.passwordHasher.compare(senha, user.senha);
    if (!valid) throw new InvalidPasswordError();

    return this.tokenProvider.generate({ id: user._id });
  }
}

module.exports = LoginUseCase;