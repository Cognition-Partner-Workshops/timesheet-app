const {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
} = require('../../validation/schemas');

describe('Validation Schemas', () => {
  describe('clientSchema', () => {
    test('should validate valid client data', () => {
      const validClient = {
        name: 'Test Client',
        description: 'A test client'
      };

      const { error } = clientSchema.validate(validClient);
      expect(error).toBeUndefined();
    });

    test('should allow empty description', () => {
      const client = {
        name: 'Test Client',
        description: ''
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should allow missing description', () => {
      const client = {
        name: 'Test Client'
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should reject missing name', () => {
      const client = {
        description: 'No name'
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should reject empty name', () => {
      const client = {
        name: '',
        description: 'Empty name'
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should reject name longer than 255 characters', () => {
      const client = {
        name: 'a'.repeat(256)
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should reject description longer than 1000 characters', () => {
      const client = {
        name: 'Test',
        description: 'a'.repeat(1001)
      };

      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should trim whitespace from name', () => {
      const client = {
        name: '  Test Client  '
      };

      const { value } = clientSchema.validate(client);
      expect(value.name).toBe('Test Client');
    });
  });

  describe('workEntrySchema', () => {
    test('should validate valid work entry', () => {
      const validEntry = {
        clientId: 1,
        hours: 5.5,
        description: 'Development work',
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(validEntry);
      expect(error).toBeUndefined();
    });

    test('should allow empty description', () => {
      const entry = {
        clientId: 1,
        hours: 5,
        description: '',
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });

    test('should reject missing clientId', () => {
      const entry = {
        hours: 5,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject negative clientId', () => {
      const entry = {
        clientId: -1,
        hours: 5,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject zero clientId', () => {
      const entry = {
        clientId: 0,
        hours: 5,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject missing hours', () => {
      const entry = {
        clientId: 1,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject negative hours', () => {
      const entry = {
        clientId: 1,
        hours: -5,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject hours greater than 24', () => {
      const entry = {
        clientId: 1,
        hours: 25,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should accept decimal hours', () => {
      const entry = {
        clientId: 1,
        hours: 7.75,
        date: '2024-01-15'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });

    test('should reject missing date', () => {
      const entry = {
        clientId: 1,
        hours: 5
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should reject invalid date format', () => {
      const entry = {
        clientId: 1,
        hours: 5,
        date: '01/15/2024'
      };

      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });
  });

  describe('updateWorkEntrySchema', () => {
    test('should validate partial update', () => {
      const update = {
        hours: 8
      };

      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should validate multiple field update', () => {
      const update = {
        hours: 8,
        description: 'Updated description'
      };

      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should reject empty update', () => {
      const update = {};

      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should validate clientId update', () => {
      const update = {
        clientId: 2
      };

      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should validate date update', () => {
      const update = {
        date: '2024-02-01'
      };

      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });
  });

  describe('updateClientSchema', () => {
    test('should validate name update', () => {
      const update = {
        name: 'Updated Name'
      };

      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should validate description update', () => {
      const update = {
        description: 'Updated description'
      };

      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should reject empty update', () => {
      const update = {};

      const { error } = updateClientSchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should validate both fields update', () => {
      const update = {
        name: 'New Name',
        description: 'New Description'
      };

      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });
  });

  describe('emailSchema', () => {
    test('should validate valid email', () => {
      const data = {
        email: 'test@example.com'
      };

      const { error } = emailSchema.validate(data);
      expect(error).toBeUndefined();
    });

    test('should reject invalid email', () => {
      const data = {
        email: 'not-an-email'
      };

      const { error } = emailSchema.validate(data);
      expect(error).toBeDefined();
    });

    test('should reject missing email', () => {
      const data = {};

      const { error } = emailSchema.validate(data);
      expect(error).toBeDefined();
    });

    test('should accept email with subdomain', () => {
      const data = {
        email: 'user@mail.example.com'
      };

      const { error } = emailSchema.validate(data);
      expect(error).toBeUndefined();
    });

    test('should reject empty string email', () => {
      const data = { email: '' };
      const { error } = emailSchema.validate(data);
      expect(error).toBeDefined();
    });

    test('should reject email with spaces', () => {
      const data = { email: 'user @example.com' };
      const { error } = emailSchema.validate(data);
      expect(error).toBeDefined();
    });
  });

  describe('clientSchema - Extended Edge Cases', () => {
    test('should accept name at max length (255 chars)', () => {
      const client = { name: 'a'.repeat(255) };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should accept description at max length (1000 chars)', () => {
      const client = { name: 'Test', description: 'a'.repeat(1000) };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should validate department field', () => {
      const client = { name: 'Test', department: 'Engineering' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should validate email field in client schema', () => {
      const client = { name: 'Test', email: 'client@example.com' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should allow empty department', () => {
      const client = { name: 'Test', department: '' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should allow empty email in client schema', () => {
      const client = { name: 'Test', email: '' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeUndefined();
    });

    test('should reject invalid email in client schema', () => {
      const client = { name: 'Test', email: 'not-an-email' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should reject department longer than 255 characters', () => {
      const client = { name: 'Test', department: 'a'.repeat(256) };
      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });

    test('should reject name with only whitespace', () => {
      const client = { name: '   ' };
      const { error } = clientSchema.validate(client);
      expect(error).toBeDefined();
    });
  });

  describe('workEntrySchema - Extended Edge Cases', () => {
    test('should accept exactly 24 hours', () => {
      const entry = { clientId: 1, hours: 24, date: '2024-01-15' };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });

    test('should reject 0 hours', () => {
      const entry = { clientId: 1, hours: 0, date: '2024-01-15' };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should accept hours with precision of 2 decimal places', () => {
      const entry = { clientId: 1, hours: 7.75, date: '2024-01-15' };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });

    test('should reject non-integer clientId', () => {
      const entry = { clientId: 1.5, hours: 5, date: '2024-01-15' };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should accept description at max length (1000 chars)', () => {
      const entry = { clientId: 1, hours: 5, date: '2024-01-15', description: 'a'.repeat(1000) };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });

    test('should reject description longer than 1000 characters', () => {
      const entry = { clientId: 1, hours: 5, date: '2024-01-15', description: 'a'.repeat(1001) };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeDefined();
    });

    test('should accept ISO date format', () => {
      const entry = { clientId: 1, hours: 5, date: '2024-12-31' };
      const { error } = workEntrySchema.validate(entry);
      expect(error).toBeUndefined();
    });
  });

  describe('updateWorkEntrySchema - Extended Edge Cases', () => {
    test('should reject negative hours in update', () => {
      const update = { hours: -1 };
      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should reject hours greater than 24 in update', () => {
      const update = { hours: 25 };
      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should accept update with all fields', () => {
      const update = { clientId: 2, hours: 8, description: 'Updated', date: '2024-03-01' };
      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should allow empty description in update', () => {
      const update = { description: '' };
      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should reject invalid date format in update', () => {
      const update = { date: '15/01/2024' };
      const { error } = updateWorkEntrySchema.validate(update);
      expect(error).toBeDefined();
    });
  });

  describe('updateClientSchema - Extended Edge Cases', () => {
    test('should validate department update', () => {
      const update = { department: 'Engineering' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should validate email update', () => {
      const update = { email: 'new@example.com' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should allow empty department in update', () => {
      const update = { department: '' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should allow empty email in update', () => {
      const update = { email: '' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should reject invalid email in update', () => {
      const update = { email: 'not-an-email' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should reject name longer than 255 characters in update', () => {
      const update = { name: 'a'.repeat(256) };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should accept all fields in update', () => {
      const update = { name: 'New', description: 'Desc', department: 'Eng', email: 'a@b.com' };
      const { error } = updateClientSchema.validate(update);
      expect(error).toBeUndefined();
    });
  });
});
