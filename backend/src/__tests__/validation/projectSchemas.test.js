const {
  projectSchema,
  updateProjectSchema
} = require('../../validation/schemas');

describe('Project Validation Schemas', () => {
  describe('projectSchema', () => {
    test('should validate valid project data with all fields', () => {
      const validProject = {
        name: 'Test Project',
        description: 'A test project',
        clientId: 1,
        startDate: '2024-01-15',
        status: 'in_progress'
      };

      const { error } = projectSchema.validate(validProject);
      expect(error).toBeUndefined();
    });

    test('should validate project with only required fields (name)', () => {
      const project = {
        name: 'Minimal Project'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should reject missing name', () => {
      const project = {
        description: 'No name'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should reject empty name', () => {
      const project = {
        name: ''
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should reject name longer than 255 characters', () => {
      const project = {
        name: 'a'.repeat(256)
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should reject description longer than 1000 characters', () => {
      const project = {
        name: 'Test',
        description: 'a'.repeat(1001)
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should reject invalid status values', () => {
      const project = {
        name: 'Test',
        status: 'cancelled'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should accept in_progress status', () => {
      const project = {
        name: 'Test',
        status: 'in_progress'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should accept completed status', () => {
      const project = {
        name: 'Test',
        status: 'completed'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should accept on_hold status', () => {
      const project = {
        name: 'Test',
        status: 'on_hold'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should default status to in_progress when not provided', () => {
      const project = {
        name: 'Test'
      };

      const { value } = projectSchema.validate(project);
      expect(value.status).toBe('in_progress');
    });

    test('should reject negative clientId', () => {
      const project = {
        name: 'Test',
        clientId: -1
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });

    test('should accept null clientId', () => {
      const project = {
        name: 'Test',
        clientId: null
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should accept valid ISO date for startDate', () => {
      const project = {
        name: 'Test',
        startDate: '2024-06-15'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeUndefined();
    });

    test('should reject invalid date format', () => {
      const project = {
        name: 'Test',
        startDate: '15/06/2024'
      };

      const { error } = projectSchema.validate(project);
      expect(error).toBeDefined();
    });
  });

  describe('updateProjectSchema', () => {
    test('should accept partial updates', () => {
      const update = {
        name: 'Updated Name'
      };

      const { error } = updateProjectSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should accept status update only', () => {
      const update = {
        status: 'completed'
      };

      const { error } = updateProjectSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should accept multiple field update', () => {
      const update = {
        name: 'New Name',
        description: 'New Description',
        status: 'on_hold'
      };

      const { error } = updateProjectSchema.validate(update);
      expect(error).toBeUndefined();
    });

    test('should reject empty object', () => {
      const update = {};

      const { error } = updateProjectSchema.validate(update);
      expect(error).toBeDefined();
    });

    test('should reject invalid status in update', () => {
      const update = {
        status: 'cancelled'
      };

      const { error } = updateProjectSchema.validate(update);
      expect(error).toBeDefined();
    });
  });
});
