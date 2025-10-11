// Controller de Autenticação (Login)
/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Endpoints de autenticação
 */
class AuthController {
    constructor(loginUseCase) {
        this.loginUseCase = loginUseCase;
    }

    async login(req, res) {
        try {
            const { email, senha } = req.body;
            const token = await this.loginUseCase.execute(email, senha);
            return res.json({ token });
        } catch (error) {
            return res.status(error.statusCode || 500).json({ error: error.message });
        }
    }
}

module.exports = AuthController;