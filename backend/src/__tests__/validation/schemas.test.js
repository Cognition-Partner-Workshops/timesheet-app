const {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  projectSchema,
  updateProjectSchema,
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

  describe('projectSchema', () => {
    const validProject = {
      name: 'Test Project',
      description: 'A test project',
      clientId: 1,
      startDate: '2024-01-15'
    };

    test('should validate valid project data', () => {
      const { error } = projectSchema.validate(validProject);
      expect(error).toBeUndefined();
    });

    test('should default status to active', () => {
      const { error, value } = projectSchema.validate(validProject);
      expect(error).toBeUndefined();
      expect(value.status).toBe('active');
    });

    test('should accept valid statuses', () => {
      for (const status of ['active', 'completed', 'on-hold']) {
        const { error } = projectSchema.validate({ ...validProject, status });
        expect(error).toBeUndefined();
      }
    });

    test('should reject invalid status', () => {
      const { error } = projectSchema.validate({ ...validProject, status: 'bogus' });
      expect(error).toBeDefined();
    });

    test('should reject missing name', () => {
      const { name, ...rest } = validProject;
      const { error } = projectSchema.validate(rest);
      expect(error).toBeDefined();
    });

    test('should reject missing clientId', () => {
      const { clientId, ...rest } = validProject;
      const { error } = projectSchema.validate(rest);
      expect(error).toBeDefined();
    });

    test('should reject negative clientId', () => {
      const { error } = projectSchema.validate({ ...validProject, clientId: -1 });
      expect(error).toBeDefined();
    });

    test('should reject missing startDate', () => {
      const { startDate, ...rest } = validProject;
      const { error } = projectSchema.validate(rest);
      expect(error).toBeDefined();
    });

    test('should reject invalid startDate format', () => {
      const { error } = projectSchema.validate({ ...validProject, startDate: '01/15/2024' });
      expect(error).toBeDefined();
    });

    test('should reject startDate with timestamp', () => {
      const { error } = projectSchema.validate({ ...validProject, startDate: '2026-01-15T10:00:00Z' });
      expect(error).toBeDefined();
    });

    test('should reject impossible calendar date (Feb 30)', () => {
      const { error } = projectSchema.validate({ ...validProject, startDate: '2026-02-30' });
      expect(error).toBeDefined();
    });

    test('should reject invalid month', () => {
      const { error } = projectSchema.validate({ ...validProject, startDate: '2026-13-01' });
      expect(error).toBeDefined();
    });

    test('should accept valid date-only startDate', () => {
      const { error, value } = projectSchema.validate({ ...validProject, startDate: '2026-01-15' });
      expect(error).toBeUndefined();
      expect(value.startDate).toBe('2026-01-15');
    });

    test('should keep startDate as raw string', () => {
      const { error, value } = projectSchema.validate(validProject);
      expect(error).toBeUndefined();
      expect(value.startDate).toBe('2024-01-15');
    });

    test('should allow empty description', () => {
      const { error } = projectSchema.validate({ ...validProject, description: '' });
      expect(error).toBeUndefined();
    });

    test('should allow missing description', () => {
      const { description, ...rest } = validProject;
      const { error } = projectSchema.validate(rest);
      expect(error).toBeUndefined();
    });

    test('should reject name longer than 255 characters', () => {
      const { error } = projectSchema.validate({ ...validProject, name: 'a'.repeat(256) });
      expect(error).toBeDefined();
    });
  });

  describe('updateProjectSchema', () => {
    test('should validate partial update', () => {
      const { error } = updateProjectSchema.validate({ name: 'Updated Name' });
      expect(error).toBeUndefined();
    });

    test('should validate status update', () => {
      const { error } = updateProjectSchema.validate({ status: 'completed' });
      expect(error).toBeUndefined();
    });

    test('should validate clientId update', () => {
      const { error } = updateProjectSchema.validate({ clientId: 2 });
      expect(error).toBeUndefined();
    });

    test('should validate startDate update', () => {
      const { error, value } = updateProjectSchema.validate({ startDate: '2026-01-15' });
      expect(error).toBeUndefined();
      expect(value.startDate).toBe('2026-01-15');
    });

    test('should reject startDate update with timestamp', () => {
      const { error } = updateProjectSchema.validate({ startDate: '2026-01-15T10:00:00Z' });
      expect(error).toBeDefined();
    });

    test('should reject impossible calendar date in update (Feb 30)', () => {
      const { error } = updateProjectSchema.validate({ startDate: '2026-02-30' });
      expect(error).toBeDefined();
    });

    test('should reject invalid month in update', () => {
      const { error } = updateProjectSchema.validate({ startDate: '2026-13-01' });
      expect(error).toBeDefined();
    });

    test('should reject empty update', () => {
      const { error } = updateProjectSchema.validate({});
      expect(error).toBeDefined();
    });

    test('should reject invalid status', () => {
      const { error } = updateProjectSchema.validate({ status: 'invalid' });
      expect(error).toBeDefined();
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
  });
});
