const { loadFeature, autoBindSteps } = require('jest-cucumber');
const request = require('supertest');
const path = require('path');
const { getApp, teardown, getNestedValue } = require('./shared-setup');

const featuresDir = path.resolve(__dirname, '../features');
const features = ['health', 'auth', 'clients', 'work-entries', 'reports', 'cascade']
  .map(f => loadFeature(path.join(featuresDir, `${f}.feature`)));

let app, res, clientId, entryId;

beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await teardown(); });

const storeClient = (r) => { if (r.body.client) clientId = r.body.client.id; };
const storeEntry = (r) => { if (r.body.workEntry) entryId = r.body.workEntry.id; };

const steps = ({ given, when, then }) => {

  // ─── Given ───────────────────────────────────────────────────────────────────

  given(/^a user "(.*)" exists$/, async (email) => {
    await request(app).post('/api/auth/login').send({ email });
  });

  given(/^a client named "(.*)" exists for "(.*)"$/, async (name, email) => {
    storeClient(await request(app).post('/api/clients').set('x-user-email', email).send({ name }));
  });

  given(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, async (email, hours, date) => {
    storeEntry(await request(app).post('/api/work-entries').set('x-user-email', email)
      .send({ clientId, hours: Number(hours), date }));
  });

  // ─── When: Auth ──────────────────────────────────────────────────────────────

  when(/^I send a GET request to "(.*)"$/, async (url) => {
    res = await request(app).get(url);
  });

  when(/^I login with email "(.*)"$/, async (email) => {
    res = await request(app).post('/api/auth/login').send({ email });
  });

  when(/^I login with empty body$/, async () => {
    res = await request(app).post('/api/auth/login').send({});
  });

  when(/^I get my profile as "(.*)"$/, async (email) => {
    res = await request(app).get('/api/auth/me').set('x-user-email', email);
  });

  // ─── When: Clients ───────────────────────────────────────────────────────────

  when(/^I create a client "(.*)" as "(.*)" with department "(.*)" and email "(.*)"$/, async (name, email, dept, cEmail) => {
    res = await request(app).post('/api/clients').set('x-user-email', email)
      .send({ name, department: dept, email: cEmail });
    storeClient(res);
  });

  when(/^I create a client named "(.*)" as "(.*)"$/, async (name, email) => {
    res = await request(app).post('/api/clients').set('x-user-email', email).send({ name });
    storeClient(res);
  });

  when(/^I create a client without name as "(.*)"$/, async (email) => {
    res = await request(app).post('/api/clients').set('x-user-email', email).send({ description: 'No name' });
  });

  when(/^I send an unauthenticated POST to "(.*)" with name "(.*)"$/, async (url, name) => {
    res = await request(app).post(url).send({ name });
  });

  when(/^I send an unauthenticated POST to "(.*)" with body (.+)$/, async (url, jsonStr) => {
    res = await request(app).post(url).send(JSON.parse(jsonStr));
  });

  when(/^I list clients as "(.*)"$/, async (email) => {
    res = await request(app).get('/api/clients').set('x-user-email', email);
  });

  when(/^I get that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/clients/${clientId}`).set('x-user-email', email);
  });

  when(/^I get client (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/clients/${id}`).set('x-user-email', email);
  });

  when(/^I get client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/clients/${id}`).set('x-user-email', email);
  });

  when(/^I update that client as "(.*)" with name "(.*)"$/, async (email, name) => {
    res = await request(app).put(`/api/clients/${clientId}`).set('x-user-email', email).send({ name });
  });

  when(/^I update that client as "(.*)" with empty body$/, async (email) => {
    res = await request(app).put(`/api/clients/${clientId}`).set('x-user-email', email).send({});
  });

  when(/^I update client (\d+) as "(.*)" with name "(.*)"$/, async (id, email, name) => {
    res = await request(app).put(`/api/clients/${id}`).set('x-user-email', email).send({ name });
  });

  when(/^I update client "(.*)" as "(.*)" with name "(.*)"$/, async (id, email, name) => {
    res = await request(app).put(`/api/clients/${id}`).set('x-user-email', email).send({ name });
  });

  when(/^I delete that client as "(.*)"$/, async (email) => {
    res = await request(app).delete(`/api/clients/${clientId}`).set('x-user-email', email);
  });

  when(/^I delete client (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).delete(`/api/clients/${id}`).set('x-user-email', email);
  });

  when(/^I delete client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).delete(`/api/clients/${id}`).set('x-user-email', email);
  });

  when(/^I delete all clients as "(.*)"$/, async (email) => {
    res = await request(app).delete('/api/clients').set('x-user-email', email);
  });

  // ─── When: Work Entries ──────────────────────────────────────────────────────

  when(/^I create a work entry on that client as "(.*)" with ([\d.]+) hours on "(.*)" described "(.*)"$/, async (email, hours, date, desc) => {
    res = await request(app).post('/api/work-entries').set('x-user-email', email)
      .send({ clientId, hours: Number(hours), date, description: desc });
    storeEntry(res);
  });

  when(/^I create a work entry on that client as "([^"]*)" with ([\d.]+) hours on "([^"]*)"$/, async (email, hours, date) => {
    res = await request(app).post('/api/work-entries').set('x-user-email', email)
      .send({ clientId, hours: Number(hours), date });
    storeEntry(res);
  });

  when(/^I create a work entry on client (\d+) as "(.*)" with ([\d.]+) hours on "(.*)"$/, async (cid, email, hours, date) => {
    res = await request(app).post('/api/work-entries').set('x-user-email', email)
      .send({ clientId: Number(cid), hours: Number(hours), date });
  });

  when(/^I send an authenticated POST to "(.*)" as "(.*)" with body (.+)$/, async (url, email, jsonStr) => {
    res = await request(app).post(url).set('x-user-email', email).send(JSON.parse(jsonStr));
  });

  when(/^I list work entries as "(.*)"$/, async (email) => {
    res = await request(app).get('/api/work-entries').set('x-user-email', email);
  });

  when(/^I list work entries filtered by that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/work-entries?clientId=${clientId}`).set('x-user-email', email);
  });

  when(/^I send an authenticated GET to "(.*)" as "(.*)"$/, async (url, email) => {
    res = await request(app).get(url).set('x-user-email', email);
  });

  when(/^I get that work entry as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/work-entries/${entryId}`).set('x-user-email', email);
  });

  when(/^I get work entry (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/work-entries/${id}`).set('x-user-email', email);
  });

  when(/^I get work entry "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/work-entries/${id}`).set('x-user-email', email);
  });

  when(/^I update that work entry as "(.*)" with hours (\d+)$/, async (email, hours) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email)
      .send({ hours: Number(hours) });
  });

  when(/^I update that work entry as "(.*)" with empty body$/, async (email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email).send({});
  });

  when(/^I reassign that work entry to the latest client as "(.*)"$/, async (email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email).send({ clientId });
  });

  when(/^I reassign that work entry to client (\d+) as "(.*)"$/, async (cid, email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email)
      .send({ clientId: Number(cid) });
  });

  when(/^I update work entry (\d+) as "(.*)" with hours (\d+)$/, async (id, email, hours) => {
    res = await request(app).put(`/api/work-entries/${id}`).set('x-user-email', email).send({ hours: Number(hours) });
  });

  when(/^I update work entry "(.*)" as "(.*)" with hours (\d+)$/, async (id, email, hours) => {
    res = await request(app).put(`/api/work-entries/${id}`).set('x-user-email', email).send({ hours: Number(hours) });
  });

  when(/^I delete that work entry as "(.*)"$/, async (email) => {
    res = await request(app).delete(`/api/work-entries/${entryId}`).set('x-user-email', email);
  });

  when(/^I delete work entry (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).delete(`/api/work-entries/${id}`).set('x-user-email', email);
  });

  when(/^I delete work entry "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).delete(`/api/work-entries/${id}`).set('x-user-email', email);
  });

  // ─── When: Reports ───────────────────────────────────────────────────────────

  when(/^I get the report for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/client/${clientId}`).set('x-user-email', email);
  });

  when(/^I get the report for client (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/client/${id}`).set('x-user-email', email);
  });

  when(/^I get the report for client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/client/${id}`).set('x-user-email', email);
  });

  when(/^I export CSV for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/export/csv/${clientId}`).set('x-user-email', email);
  });

  when(/^I export CSV for client (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/csv/${id}`).set('x-user-email', email);
  });

  when(/^I export CSV for client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/csv/${id}`).set('x-user-email', email);
  });

  when(/^I export PDF for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/export/pdf/${clientId}`).set('x-user-email', email);
  });

  when(/^I export PDF for client (\d+) as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/pdf/${id}`).set('x-user-email', email);
  });

  when(/^I export PDF for client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/pdf/${id}`).set('x-user-email', email);
  });

  // ─── Then: Assertions ────────────────────────────────────────────────────────

  then(/^the response status should be (\d+)$/, (status) => {
    expect(res.status).toBe(Number(status));
  });

  then(/^the response body "(.*)" should equal "(.*)"$/, (field, value) => {
    expect(res.body[field]).toBe(value);
  });

  then(/^the response body "(.*)" should be number (.+)$/, (field, value) => {
    expect(res.body[field]).toBe(Number(value));
  });

  then(/^the response body "(.*)" should be defined$/, (field) => {
    expect(res.body[field]).toBeDefined();
  });

  then(/^the nested response "(.*)" should equal "(.*)"$/, (jsonPath, value) => {
    expect(getNestedValue(res.body, jsonPath)).toBe(value);
  });

  then(/^the nested response "(.*)" should be number (.+)$/, (jsonPath, value) => {
    expect(getNestedValue(res.body, jsonPath)).toBe(Number(value));
  });

  then(/^the nested response "(.*)" should have at least (\d+) items$/, (jsonPath, count) => {
    expect(getNestedValue(res.body, jsonPath).length).toBeGreaterThanOrEqual(Number(count));
  });

  then(/^the nested response "(.*)" should be an empty array$/, (jsonPath) => {
    expect(getNestedValue(res.body, jsonPath)).toEqual([]);
  });

  then(/^the nested response "(.*)" should be an array$/, (jsonPath) => {
    expect(Array.isArray(getNestedValue(res.body, jsonPath))).toBe(true);
  });

  then(/^the client list should not contain "(.*)"$/, (name) => {
    expect((res.body.clients || []).map(c => c.name)).not.toContain(name);
  });

  then(/^that client should no longer exist for "(.*)"$/, async (email) => {
    const check = await request(app).get(`/api/clients/${clientId}`).set('x-user-email', email);
    expect(check.status).toBe(404);
  });

  then(/^that work entry should no longer exist for "(.*)"$/, async (email) => {
    const check = await request(app).get(`/api/work-entries/${entryId}`).set('x-user-email', email);
    expect(check.status).toBe(404);
  });

  then(/^all returned work entries should belong to that client$/, () => {
    res.body.workEntries.forEach(entry => { expect(entry.client_id).toBe(clientId); });
  });

  then(/^user "(.*)" should have (\d+) work entries$/, async (email, count) => {
    const r = await request(app).get('/api/work-entries').set('x-user-email', email);
    expect(r.body.workEntries).toHaveLength(Number(count));
  });

  then(/^the response content type should match csv$/, () => {
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });

  then(/^the response text should contain "(.*)"$/, (text) => {
    expect(res.text || res.body.toString()).toContain(text);
  });

  then(/^the response content type should be "(.*)"$/, (type) => {
    expect(res.headers['content-type']).toBe(type);
  });

  then(/^the response should have a PDF attachment header$/, () => {
    expect(res.headers['content-disposition']).toMatch(/attachment.*\.pdf/);
  });

  then(/^the response body should not be empty$/, () => {
    expect(res.body.length).toBeGreaterThan(0);
  });
};

autoBindSteps(features, [steps]);
