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
  ,
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description: 'Cookie HttpOnly criado por POST /auth/login.'
      }
    },
    responses: {
      BadRequest: {
        description: 'Requisição inválida',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Parâmetros inválidos ou ausentes' } }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Não autorizado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Token não fornecido' } }
            }
          }
        }
      },
      Forbidden: {
        description: 'Proibido',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Acesso negado' } }
            }
          }
        }
      },
      NotFound: {
        description: 'Não encontrado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Recurso não encontrado' } }
            }
          }
        }
      },
      InternalError: {
        description: 'Erro interno no servidor',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Erro interno no servidor' } }
            }
          }
        }
      }
    }
  },
  security: [ { cookieAuth: [] } ]
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '..', 'src', 'interfaces', 'controllers', '*.js'), path.join(__dirname, '..', 'src', 'interfaces', 'routes', '*.js')]
};

module.exports = options;
