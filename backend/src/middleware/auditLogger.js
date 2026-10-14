const { getDatabase } = require('../database/init');

/**
 * Logs an audit event to the audit_logs table.
 * @param {string} userEmail - The email of the user performing the action.
 * @param {string} action - The action performed (CREATE, READ, UPDATE, DELETE).
 * @param {string} entityType - The type of entity (client, work_entry).
 * @param {string|number|null} entityId - The ID of the affected entity.
 * @param {object|null} details - Additional details about the action.
 */
function logAudit(userEmail, action, entityType, entityId, details) {
  const db = getDatabase();
  const detailsJson = details ? JSON.stringify(details) : null;

  db.run(
    'INSERT INTO audit_logs (user_email, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [userEmail, action, entityType, entityId ? String(entityId) : null, detailsJson],
    (err) => {
      if (err) {
        console.error('Failed to write audit log:', err);
      }
    }
  );
}

module.exports = { logAudit };
