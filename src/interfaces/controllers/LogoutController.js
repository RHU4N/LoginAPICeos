class LogoutController {
  constructor(logoutUseCase) {
    this.logoutUseCase = logoutUseCase;
  }

  async logout(req, res) {
    try {
      // token can come from Authorization header or body
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1] ? authHeader.split(' ')[1] : req.body && req.body.token;
      await this.logoutUseCase.execute(token);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = LogoutController;
