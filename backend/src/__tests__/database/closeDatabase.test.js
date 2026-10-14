describe('closeDatabase lifecycle', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.resetModules();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  const loadModuleWithClose = (close) => {
    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          if (callback) callback(null);
          return {
            serialize: jest.fn((cb) => cb()),
            run: jest.fn(),
            get: jest.fn(),
            all: jest.fn(),
            close
          };
        })
      }))
    }));

    return require('../../database/init');
  };

  test('should resolve immediately when no connection was ever opened', async () => {
    const { closeDatabase } = loadModuleWithClose(jest.fn());

    await expect(closeDatabase()).resolves.toBeUndefined();
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Database connection closed');
  });

  test('should resolve immediately when already closed', async () => {
    const close = jest.fn((callback) => callback(null));
    const { getDatabase, closeDatabase } = loadModuleWithClose(close);

    getDatabase();
    await closeDatabase();
    await closeDatabase();

    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should wait for an in-flight close instead of closing twice', async () => {
    let pendingCallback;
    const close = jest.fn((callback) => {
      pendingCallback = callback;
    });
    const { getDatabase, closeDatabase } = loadModuleWithClose(close);

    getDatabase();
    const first = closeDatabase();
    const second = closeDatabase();

    expect(close).toHaveBeenCalledTimes(1);

    pendingCallback(null);
    await Promise.all([first, second]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('Database connection closed');
  });

  test('should reopen a fresh connection after closing', async () => {
    const close = jest.fn((callback) => callback(null));
    const { getDatabase, closeDatabase } = loadModuleWithClose(close);

    const firstDb = getDatabase();
    await closeDatabase();
    const secondDb = getDatabase();

    expect(secondDb).not.toBe(firstDb);

    await closeDatabase();
    expect(close).toHaveBeenCalledTimes(2);
  });

  test('should resolve even when the driver reports a close error', async () => {
    const close = jest.fn((callback) => callback(new Error('Close error')));
    const { getDatabase, closeDatabase } = loadModuleWithClose(close);

    getDatabase();

    await expect(closeDatabase()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', expect.any(Error));
  });
});
