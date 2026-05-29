const ALLOWED_COLUMNS = new Set([
  'name', 'description', 'department', 'email',
  'client_id', 'project_id', 'start_date', 'end_date',
  'status', 'budget_hours', 'hours', 'date'
]);

/**
 * Build a parameterized UPDATE query from validated field mappings.
 * Only columns present in the ALLOWED_COLUMNS whitelist are accepted.
 *
 * @param {string} table - Table name (must be a known literal)
 * @param {Array<{column: string, value: *}>} fields - Validated column/value pairs
 * @param {{id: number, userEmail: string}} where - Row identity for WHERE clause
 * @returns {{sql: string, params: Array}} Parameterized query and bound values
 */
function buildUpdateQuery(table, fields, where) {
  const ALLOWED_TABLES = ['clients', 'projects', 'work_entries'];
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  const setClauses = [];
  const params = [];

  for (const { column, value } of fields) {
    if (!ALLOWED_COLUMNS.has(column)) {
      throw new Error(`Invalid column: ${column}`);
    }
    setClauses.push(`${column} = ?`);
    params.push(value);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  params.push(where.id, where.userEmail);

  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ? AND user_email = ?`;
  return { sql, params };
}

/**
 * Build a SELECT query with optional dynamic WHERE filters.
 * Only columns in ALLOWED_COLUMNS are accepted as filter keys.
 *
 * @param {string} baseQuery - The base SELECT ... FROM ... WHERE part
 * @param {Array} baseParams - Parameters for the base query
 * @param {Array<{column: string, value: *, prefix?: string}>} filters - Optional filters
 * @param {string} [orderBy] - Optional ORDER BY clause
 * @returns {{sql: string, params: Array}}
 */
function buildFilteredQuery(baseQuery, baseParams, filters, orderBy) {
  let sql = baseQuery;
  const params = [...baseParams];

  for (const { column, value, prefix } of filters) {
    if (!ALLOWED_COLUMNS.has(column)) {
      throw new Error(`Invalid filter column: ${column}`);
    }
    const qualified = prefix ? `${prefix}.${column}` : column;
    sql += ` AND ${qualified} = ?`;
    params.push(value);
  }

  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }

  return { sql, params };
}

module.exports = { buildUpdateQuery, buildFilteredQuery, ALLOWED_COLUMNS };
