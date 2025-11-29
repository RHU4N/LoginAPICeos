require('dotenv').config(); // Certifique-se de que esta linha está no início do arquivo

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8081;

// Ensure JWT_SECRET is set. In local/dev, fall back to a development secret
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET não está definido. Verifique o arquivo .env ou as variáveis de ambiente.');
    process.exit(1);
  }
  console.warn('Aviso: JWT_SECRET não definido — usando segredo de desenvolvimento temporário.');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_local';
}

// Inicializa conexão com o banco (skip when running tests)
if (process.env.NODE_ENV !== 'test') {
  require('./src/infrastructure/db/db');
}

// Middlewares globais
app.use(bodyParser.json());
app.use(cors());

// Simple request logger for local debugging
app.use((req, res, next) => {
  console.log('[Request] ', req.method, req.path, 'headers:', { authorization: req.headers.authorization });
  next();
});

// Rotas de teste
app.get('/', (req, res) => res.send('Estou aqui'));

// Importa rotas (interface_adapters/routes)
const userRoutes = require('./src/interfaces/routes/UserRoutes');
const authRoutes = require('./src/interfaces/routes/AuthRoutes');
const { setupSwagger } = require('./swagger/swaggerDocs');

// Usa as rotas
app.use('/users', userRoutes); // CRUD de usuários
app.use('/auth', authRoutes);  // login / verify

// Swagger (docs)
setupSwagger(app);

// Middleware global de erro com mapeamento de erros de domínio
app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  // Errors from domain layer may expose a `status` property or `name`
  const status = err && err.status ? err.status : (err && err.name === 'ValidationError' ? 422 : 500);
  const message = (err && err.publicMessage) || (err && err.message) || 'Internal Server Error';
  res.status(status).json({ success: false, error: { message } });
});

// Start server only if run directly. This allows tests to require the app without starting a listener.
if (require.main === module) {
  app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));
}

module.exports = app;