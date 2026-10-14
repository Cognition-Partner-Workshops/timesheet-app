const express = require('express');
const request = require('supertest');

// Prevent the server from binding a port when server.js is required.
const listenSpy = jest
  .spyOn(express.application, 'listen')
  .mockImplementation(function (port, callback) {
    if (typeof callback === 'function') callback();
    return { close: jest.fn() };
  });

jest.mock('../database/init');
jest.mock('../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const { initializeDatabase, getDatabase } = require('../database/init');

describe('Server application', () => {
  let app;
  let consoleLogSpy, consoleErrorSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    initializeDatabase.mockResolvedValue(undefined);
    getDatabase.mockReturnValue({ all: jest.fn(), get: jest.fn(), run: jest.fn() });
    app = require('../server');
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    listenSpy.mockRestore();
  });

  test('should initialize the database and start listening', () => {
    expect(initializeDatabase).toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalled();
  });

  test('GET /health should report status OK with a timestamp', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Route not found' });
  });

  test.each([
    ['/api/auth/me'],
    ['/api/clients'],
    ['/api/work-entries'],
    ['/api/reports/client/1']
  ])('should mount routes under %s', async (url) => {
    getDatabase.mockReturnValue({
      all: jest.fn((query, params, callback) => callback(null, [])),
      get: jest.fn((query, params, callback) => callback(null, { id: 1, name: 'Client' })),
      run: jest.fn()
    });

    const response = await request(app).get(url);

    expect(response.status).not.toBe(404);
  });

  test('should reject a JSON body larger than the 10mb limit', async () => {
    const response = await request(app)
      .post('/api/clients')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'a'.repeat(11 * 1024 * 1024) }));

    expect(response.status).toBe(413);
  });

  test('should set security headers from helmet', async () => {
    const response = await request(app).get('/health');

    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
  });
});
