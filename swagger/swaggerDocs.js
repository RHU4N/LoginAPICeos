const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const options = require('./swaggerConfig');

const swaggerSpec = swaggerJSDoc(options);

function filterInternal(spec) {
  // Return a deep clone with any operation that has x-internal === true removed.
  const filtered = JSON.parse(JSON.stringify(spec || {}));
  for (const pathKey of Object.keys(spec.paths || {})) {
    const ops = spec.paths[pathKey] || {};
    for (const method of Object.keys(ops)) {
      const op = ops[method];
      if (op && op['x-internal']) {
        // delete the operation in the cloned spec
        if (filtered.paths && filtered.paths[pathKey]) {
          delete filtered.paths[pathKey][method];
        }
      }
    }
    // remove the path entirely if no operations remain
    if (filtered.paths && filtered.paths[pathKey] && Object.keys(filtered.paths[pathKey]).length === 0) {
      delete filtered.paths[pathKey];
    }
  }
  return filtered;
}

function setupSwagger(app) {
  // Serve a public docs UI where operations annotated with x-internal: true are omitted.
  const publicSpec = filterInternal(swaggerSpec);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(publicSpec));
}

module.exports = { setupSwagger, swaggerSpec };
