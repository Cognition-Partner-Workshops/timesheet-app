// Shared SQL fragments reused across route handlers.

// Columns selected for a client record.
const CLIENT_COLUMNS = 'id, name, description, department, email, created_at, updated_at';

// SELECT ... FROM ... JOIN prefix for a work entry enriched with its client
// name. Callers append the WHERE/ORDER BY clauses they need.
const WORK_ENTRY_SELECT = `
  SELECT we.id, we.client_id, we.hours, we.description, we.date,
         we.created_at, we.updated_at, c.name as client_name
  FROM work_entries we
  JOIN clients c ON we.client_id = c.id
`;

module.exports = {
  CLIENT_COLUMNS,
  WORK_ENTRY_SELECT
};
