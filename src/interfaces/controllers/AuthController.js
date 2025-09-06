const AuthUseCases = require('../../application/use_cases/AuthUseCases')

// Controller de Autenticação (Login)
const login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const token = await AuthUseCases.login(email, senha);
        return res.json({ token });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
}

module.exports = { login }