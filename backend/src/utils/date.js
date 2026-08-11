// Joi coerces validated `date` fields into JS Date objects, which the sqlite3
// driver binds as epoch milliseconds. Work entry dates are day-granular, so
// normalize them to a YYYY-MM-DD string before they reach the database.
function toDateOnly(value) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  return value;
}

module.exports = {
  toDateOnly
};
