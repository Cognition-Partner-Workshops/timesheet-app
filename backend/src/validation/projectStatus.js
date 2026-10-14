// Project lifecycle: projects are created 'active' and may only move along
// the transitions below. Re-applying the current status is always a no-op.
const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'];

const DEFAULT_PROJECT_STATUS = 'active';

const PROJECT_STATUS_TRANSITIONS = {
  active: ['on_hold', 'completed', 'archived'],
  on_hold: ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active']
};

function isValidStatusTransition(current, next) {
  if (current === next) {
    return true;
  }

  return (PROJECT_STATUS_TRANSITIONS[current] || []).includes(next);
}

module.exports = {
  PROJECT_STATUSES,
  DEFAULT_PROJECT_STATUS,
  PROJECT_STATUS_TRANSITIONS,
  isValidStatusTransition
};
