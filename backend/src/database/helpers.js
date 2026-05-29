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

function verifyOwnership(db, table, conditions, callback) {
  const ALLOWED_TABLES = ['clients', 'projects', 'work_entries'];
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  const clauses = [];
  const params = [];
  for (const [col, val] of Object.entries(conditions)) {
    if (!ALLOWED_COLUMNS.has(col) && col !== 'id' && col !== 'user_email') {
      throw new Error(`Invalid condition column: ${col}`);
    }
    clauses.push(`${col} = ?`);
    params.push(val);
  }

  db.get(
    `SELECT id FROM ${table} WHERE ${clauses.join(' AND ')}`,
    params,
    (err, row) => {
      if (err) return callback(err);
      callback(null, !!row);
    }
  );
}

function collectUpdateFields(value, fieldMap) {
  const fields = [];
  for (const [key, config] of Object.entries(fieldMap)) {
    if (value[key] !== undefined) {
      const val = config.nullable ? (value[key] != null ? value[key] : null) : value[key];
      fields.push({ column: config.column, value: val });
    }
  }
  return fields;
}

function parseIntFilter(value) {
  if (!value) return null;
  const num = parseInt(value);
  return isNaN(num) ? false : num;
}

function queryAll(db, sql, params, res, key) {
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ [key]: rows });
  });
}

module.exports = { buildUpdateQuery, buildFilteredQuery, verifyOwnership, collectUpdateFields, parseIntFilter, queryAll, ALLOWED_COLUMNS };
