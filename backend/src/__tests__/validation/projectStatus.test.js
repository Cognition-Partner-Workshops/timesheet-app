const {
  PROJECT_STATUSES,
  DEFAULT_PROJECT_STATUS,
  isValidStatusTransition
} = require('../../validation/projectStatus');

describe('Project status transitions', () => {
  test('projects default to active', () => {
    expect(DEFAULT_PROJECT_STATUS).toBe('active');
    expect(PROJECT_STATUSES).toEqual(['active', 'on_hold', 'completed', 'archived']);
  });

  test.each([
    ['active', 'on_hold'],
    ['active', 'completed'],
    ['active', 'archived'],
    ['on_hold', 'active'],
    ['on_hold', 'completed'],
    ['completed', 'active'],
    ['completed', 'archived'],
    ['archived', 'active']
  ])('allows %s -> %s', (current, next) => {
    expect(isValidStatusTransition(current, next)).toBe(true);
  });

  test.each([
    ['archived', 'completed'],
    ['archived', 'on_hold'],
    ['completed', 'on_hold']
  ])('rejects %s -> %s', (current, next) => {
    expect(isValidStatusTransition(current, next)).toBe(false);
  });

  test('re-applying the same status is a no-op', () => {
    PROJECT_STATUSES.forEach((status) => {
      expect(isValidStatusTransition(status, status)).toBe(true);
    });
  });

  test('unknown current status has no transitions', () => {
    expect(isValidStatusTransition('paused', 'active')).toBe(false);
  });
});
