// swagger.js

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0', // OpenAPI version
    info: {
      title: 'SaaS Backend API',
      version: '1.0.0',
      description: 'API documentation for the SaaS backend application',
      contact: {
        name: 'Support',
        url: 'http://www.example.com/support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000', // Your server URL
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = function(app) {
  // Serve Swagger API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};