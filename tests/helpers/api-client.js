/**
 * Test API client helper for making authenticated requests.
 * Wraps supertest with common patterns for the timesheet API.
 */
const request = require('supertest');

const DEFAULT_USER_EMAIL = 'testuser@example.com';

class TestApiClient {
  constructor(app, userEmail = DEFAULT_USER_EMAIL) {
    this.app = app;
    this.userEmail = userEmail;
  }

  /** Set the authenticated user email for subsequent requests. */
  as(email) {
    return new TestApiClient(this.app, email);
  }

  // --- Auth ---

  login(email) {
    return request(this.app)
      .post('/api/auth/login')
      .send({ email: email || this.userEmail });
  }

  getMe() {
    return request(this.app)
      .get('/api/auth/me')
      .set('x-user-email', this.userEmail);
  }

  // --- Clients ---

  getClients() {
    return request(this.app)
      .get('/api/clients')
      .set('x-user-email', this.userEmail);
  }

  getClient(id) {
    return request(this.app)
      .get(`/api/clients/${id}`)
      .set('x-user-email', this.userEmail);
  }

  createClient(data) {
    return request(this.app)
      .post('/api/clients')
      .set('x-user-email', this.userEmail)
      .send(data);
  }

  updateClient(id, data) {
    return request(this.app)
      .put(`/api/clients/${id}`)
      .set('x-user-email', this.userEmail)
      .send(data);
  }

  deleteClient(id) {
    return request(this.app)
      .delete(`/api/clients/${id}`)
      .set('x-user-email', this.userEmail);
  }

  // --- Work Entries ---

  getWorkEntries(clientId) {
    const req = request(this.app)
      .get('/api/work-entries')
      .set('x-user-email', this.userEmail);
    if (clientId) {
      req.query({ clientId });
    }
    return req;
  }

  getWorkEntry(id) {
    return request(this.app)
      .get(`/api/work-entries/${id}`)
      .set('x-user-email', this.userEmail);
  }

  createWorkEntry(data) {
    return request(this.app)
      .post('/api/work-entries')
      .set('x-user-email', this.userEmail)
      .send(data);
  }

  updateWorkEntry(id, data) {
    return request(this.app)
      .put(`/api/work-entries/${id}`)
      .set('x-user-email', this.userEmail)
      .send(data);
  }

  deleteWorkEntry(id) {
    return request(this.app)
      .delete(`/api/work-entries/${id}`)
      .set('x-user-email', this.userEmail);
  }

  // --- Reports ---

  getClientReport(clientId) {
    return request(this.app)
      .get(`/api/reports/client/${clientId}`)
      .set('x-user-email', this.userEmail);
  }

  exportCsv(clientId) {
    return request(this.app)
      .get(`/api/reports/export/csv/${clientId}`)
      .set('x-user-email', this.userEmail);
  }

  exportPdf(clientId) {
    return request(this.app)
      .get(`/api/reports/export/pdf/${clientId}`)
      .set('x-user-email', this.userEmail);
  }

  // --- Health ---

  healthCheck() {
    return request(this.app).get('/health');
  }
}

module.exports = { TestApiClient, DEFAULT_USER_EMAIL };
