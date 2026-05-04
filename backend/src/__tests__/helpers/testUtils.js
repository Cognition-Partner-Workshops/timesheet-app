function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function mockDbAll(mockDb, result, err = null) {
  mockDb.all.mockImplementation((query, params, callback) => callback(err, result));
}

function mockDbGet(mockDb, result, err = null) {
  mockDb.get.mockImplementation((query, params, callback) => callback(err, result));
}

function mockDbGetOnce(mockDb, result, err = null) {
  mockDb.get.mockImplementationOnce((query, params, callback) => callback(err, result));
}

function mockDbRunSuccess(mockDb, opts = {}) {
  const { lastID, changes } = opts;
  mockDb.run.mockImplementation(function(query, params, callback) {
    if (lastID !== undefined) this.lastID = lastID;
    if (changes !== undefined) this.changes = changes;
    callback.call(this, null);
  });
}

function mockDbRunError(mockDb, errorMsg = 'Database error') {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, new Error(errorMsg));
  });
}

module.exports = {
  createMockDb,
  mockDbAll,
  mockDbGet,
  mockDbGetOnce,
  mockDbRunSuccess,
  mockDbRunError
};
