/**
 * Reusable test data fixtures for the timesheet application.
 */

const users = {
  primary: { email: 'testuser@example.com' },
  secondary: { email: 'otheruser@example.com' },
};

const clients = {
  acme: {
    name: 'Acme Corp',
    description: 'Main consulting client',
    department: 'Engineering',
    email: 'contact@acme.com',
  },
  globex: {
    name: 'Globex Inc',
    description: 'Product development partner',
    department: 'R&D',
    email: 'info@globex.com',
  },
  minimal: {
    name: 'Minimal Client',
  },
};

const workEntries = {
  standard: {
    hours: 8,
    description: 'Feature development',
    date: '2025-01-15',
  },
  halfDay: {
    hours: 4,
    description: 'Code review and meetings',
    date: '2025-01-16',
  },
  minimal: {
    hours: 1,
    date: '2025-01-17',
  },
};

module.exports = { users, clients, workEntries };
