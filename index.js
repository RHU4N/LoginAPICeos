require('dotenv').config(); // Certifique-se de que esta linha está no início do arquivo

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8081;

// Fail fast if required env is missing
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não está definido. Verifique o arquivo .env ou as variáveis de ambiente.');
  process.exit(1);
}

// Inicializa conexão com o banco
require('./src/infrastructure/db/db');

// Middlewares globais
app.use(bodyParser.json());
app.use(cors());

// Rotas de teste
app.get('/', (req, res) => res.send('Estou aqui'));

// Importa rotas (interface_adapters/routes)
const userRoutes = require('./src/interfaces/routes/UserRoutes');
const authRoutes = require('./src/interfaces/routes/AuthRoutes');

// Usa as rotas
app.use('/users', userRoutes); // CRUD de usuários
app.use('/auth', authRoutes);  // login / verify

// Middleware global de erro com mapeamento de erros de domínio
app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  // Errors from domain layer may expose a `status` property or `name`
  const status = err && err.status ? err.status : (err && err.name === 'ValidationError' ? 422 : 500);
  const message = (err && err.publicMessage) || (err && err.message) || 'Internal Server Error';
  res.status(status).json({ success: false, error: { message } });
});

// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));