import type { ProjectStatus } from '../types/api';

// Mirrors backend/src/validation/projectStatus.js
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  active: ['on_hold', 'completed', 'archived'],
  on_hold: ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, 'success' | 'warning' | 'info' | 'default'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'info',
  archived: 'default',
};

export const allowedStatuses = (current: ProjectStatus): ProjectStatus[] => [
  current,
  ...PROJECT_STATUS_TRANSITIONS[current],
];
