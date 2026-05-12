// Mock mysql2 globally to avoid real database connections in tests
jest.mock('mysql2', () => {
  const mockPool = {
    query: jest.fn((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
      }
      if (typeof callback === 'function') {
        callback(null, []);
      }
    }),
    promise: jest.fn(() => ({
      query: jest.fn().mockResolvedValue([[], []])
    })),
    end: jest.fn((callback) => callback && callback(null))
  };

  return {
    createPool: jest.fn(() => mockPool)
  };
});
