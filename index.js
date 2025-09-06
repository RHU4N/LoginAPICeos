const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8081;

// Inicializa conexão com o banco
require('./src/infrastructure/db/db');

// Middlewares globais
app.use(bodyParser.json());
app.use(cors());

// Rotas de teste
app.get('/', (req, res) => res.send('Estou aqui'));

// Importa rotas (interface_adapters/routes)
const userRoutes = require('./src/interface_adapters/routes/userRoutes');
const authRoutes = require('./src/interface_adapters/routes/authRoutes');

// Usa as rotas
app.use('/users', userRoutes); // CRUD de usuários
app.use('/auth', authRoutes);  // login / verify

// Middleware global de erro
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo deu errado!');
});

// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));