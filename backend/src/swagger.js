const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Time Tracking API',
      version: '1.0.0',
      description: 'REST API for employee time tracking application. Manages clients, work entries, and reports.',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        EmailAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-User-Email',
          description: 'User email address for authentication'
        }
      },
      schemas: {
        Client: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Acme Corp' },
            description: { type: 'string', example: 'Software consulting project', nullable: true },
            department: { type: 'string', example: 'Engineering', nullable: true },
            email: { type: 'string', format: 'email', example: 'contact@acme.com', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CreateClientRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255, example: 'Acme Corp' },
            description: { type: 'string', maxLength: 1000, example: 'Software consulting project' },
            department: { type: 'string', maxLength: 255, example: 'Engineering' },
            email: { type: 'string', format: 'email', maxLength: 255, example: 'contact@acme.com' }
          }
        },
        UpdateClientRequest: {
          type: 'object',
          minProperties: 1,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255, example: 'Acme Corp Updated' },
            description: { type: 'string', maxLength: 1000, example: 'Updated description' },
            department: { type: 'string', maxLength: 255, example: 'Marketing' },
            email: { type: 'string', format: 'email', maxLength: 255, example: 'new@acme.com' }
          }
        },
        WorkEntry: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            client_id: { type: 'integer', example: 1 },
            client_name: { type: 'string', example: 'Acme Corp' },
            hours: { type: 'number', format: 'float', example: 4.5 },
            description: { type: 'string', example: 'Frontend development', nullable: true },
            date: { type: 'string', format: 'date', example: '2024-01-15' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CreateWorkEntryRequest: {
          type: 'object',
          required: ['clientId', 'hours', 'date'],
          properties: {
            clientId: { type: 'integer', example: 1 },
            hours: { type: 'number', format: 'float', minimum: 0, maximum: 24, example: 4.5 },
            description: { type: 'string', maxLength: 1000, example: 'Frontend development' },
            date: { type: 'string', format: 'date', example: '2024-01-15' }
          }
        },
        UpdateWorkEntryRequest: {
          type: 'object',
          minProperties: 1,
          properties: {
            clientId: { type: 'integer', example: 2 },
            hours: { type: 'number', format: 'float', minimum: 0, maximum: 24, example: 6.0 },
            description: { type: 'string', maxLength: 1000, example: 'Updated description' },
            date: { type: 'string', format: 'date', example: '2024-01-16' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' }
          }
        },
        User: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ClientReport: {
          type: 'object',
          properties: {
            client: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                name: { type: 'string', example: 'Acme Corp' }
              }
            },
            workEntries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  hours: { type: 'number', format: 'float' },
                  description: { type: 'string', nullable: true },
                  date: { type: 'string', format: 'date' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            },
            totalHours: { type: 'number', format: 'float', example: 32.5 },
            entryCount: { type: 'integer', example: 8 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error message' }
          }
        }
      }
    },
    security: [
      { EmailAuth: [] }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
