const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const options = require('./swaggerConfig');

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };
