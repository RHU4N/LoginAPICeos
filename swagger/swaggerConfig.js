const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'LoginAPI',
    version: '1.0.0',
    description: 'API de autenticação e gerenciamento de usuários (Clean Architecture)'
  },
  servers: [
    { url: 'http://localhost:8081', description: 'Local server' }
  ]
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '..', 'src', 'interfaces', 'controllers', '*.js'), path.join(__dirname, '..', 'src', 'interfaces', 'routes', '*.js')]
};

module.exports = options;
