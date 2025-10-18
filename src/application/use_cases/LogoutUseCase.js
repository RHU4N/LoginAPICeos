class LogoutUseCase {
  constructor(tokenStoreRepository) {
    this.tokenStoreRepository = tokenStoreRepository;
  }

  async execute(token) {
    if (!token) return false;
    return this.tokenStoreRepository.remove(token);
  }
}

module.exports = LogoutUseCase;
