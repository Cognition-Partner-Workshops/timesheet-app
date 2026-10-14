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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const storeIds = (r) => {
  if (r.body.client) clientId = r.body.client.id;
  if (r.body.workEntry) entryId = r.body.workEntry.id;
};

function tableToObj(table) {
  // jest-cucumber passes tables as an array of row-objects [{key: val, ...}]
  if (Array.isArray(table) && table.length > 0 && typeof table[0] === 'object' && !Array.isArray(table[0])) {
    const obj = { ...table[0] };
    for (const [k, v] of Object.entries(obj)) {
      obj[k] = /^\d+\.\d+$/.test(v) ? Number(v) : /^\d+$/.test(v) ? Number(v) : v;
    }
    return obj;
  }
  // fallback: 2D array [[keys], [vals]]
  const keys = table[0];
  const vals = table[1];
  const obj = {};
  keys.forEach((k, i) => {
    const v = vals[i];
    obj[k] = /^\d+\.\d+$/.test(v) ? Number(v) : /^\d+$/.test(v) ? Number(v) : v;
  });
  return obj;
}

const steps = ({ given, when, then }) => {

  // ─── Given ───────────────────────────────────────────────────────────────────

  given(/^a user "(.*)" exists$/, async (email) => {
    await request(app).post('/api/auth/login').send({ email });
  });

  given(/^a client named "(.*)" exists for "(.*)"$/, async (name, email) => {
    const r = await request(app).post('/api/clients').set('x-user-email', email).send({ name });
    storeIds(r);
  });

  given(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, async (email, hours, date) => {
    const r = await request(app).post('/api/work-entries').set('x-user-email', email)
      .send({ clientId, hours: Number(hours), date });
    storeIds(r);
  });

  // ─── When: Generic REST ────────────────────────────────────────────────────

  when(/^I GET "([^"]*)"$/, async (url) => {
    res = await request(app).get(url);
  });

  when(/^I GET "([^"]*)" as "([^"]*)"$/, async (url, email) => {
    res = await request(app).get(url).set('x-user-email', email);
  });

  when(/^I DELETE "(.*)" as "(.*)"$/, async (url, email) => {
    res = await request(app).delete(url).set('x-user-email', email);
  });

  when(/^I POST "(.*)" as "(.*)" with:$/, async (url, email, table) => {
    res = await request(app).post(url).set('x-user-email', email).send(tableToObj(table));
    storeIds(res);
  });

  when(/^I POST "(.*)" without auth with:$/, async (url, table) => {
    res = await request(app).post(url).send(tableToObj(table));
  });

  when(/^I PUT "(.*)" as "(.*)" with:$/, async (url, email, table) => {
    res = await request(app).put(url).set('x-user-email', email).send(tableToObj(table));
  });

  // ─── When: Auth ─────────────────────────────────────────────────────────────

  when(/^I login as "(.*)"$/, async (email) => {
    res = await request(app).post('/api/auth/login').send({ email });
  });

  when(/^I login with email "(.*)"$/, async (email) => {
    res = await request(app).post('/api/auth/login').send({ email });
  });

  when(/^I login with an empty body$/, async () => {
    res = await request(app).post('/api/auth/login').send({});
  });

  // ─── When: Client resource ──────────────────────────────────────────────────

  when(/^I GET that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/clients/${clientId}`).set('x-user-email', email);
  });

  when(/^I PUT that client as "(.*)" with:$/, async (email, table) => {
    res = await request(app).put(`/api/clients/${clientId}`).set('x-user-email', email).send(tableToObj(table));
  });

  when(/^I PUT that client as "(.*)" with empty body$/, async (email) => {
    res = await request(app).put(`/api/clients/${clientId}`).set('x-user-email', email).send({});
  });

  when(/^I DELETE that client as "(.*)"$/, async (email) => {
    res = await request(app).delete(`/api/clients/${clientId}`).set('x-user-email', email);
  });

  // ─── When: Work Entry resource ──────────────────────────────────────────────

  when(/^I create a work entry on that client as "(.*)" with:$/, async (email, table) => {
    const body = { ...tableToObj(table), clientId };
    res = await request(app).post('/api/work-entries').set('x-user-email', email).send(body);
    storeIds(res);
  });

  when(/^I create a work entry on client (\d+) as "(.*)" with:$/, async (cid, email, table) => {
    const body = { ...tableToObj(table), clientId: Number(cid) };
    res = await request(app).post('/api/work-entries').set('x-user-email', email).send(body);
  });

  when(/^I GET work entries filtered by that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/work-entries?clientId=${clientId}`).set('x-user-email', email);
  });

  when(/^I GET that work entry as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/work-entries/${entryId}`).set('x-user-email', email);
  });

  when(/^I PUT that work entry as "(.*)" with:$/, async (email, table) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email).send(tableToObj(table));
  });

  when(/^I PUT that work entry as "(.*)" with empty body$/, async (email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email).send({});
  });

  when(/^I reassign that work entry to the latest client as "(.*)"$/, async (email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email).send({ clientId });
  });

  when(/^I reassign that work entry to client (\d+) as "(.*)"$/, async (cid, email) => {
    res = await request(app).put(`/api/work-entries/${entryId}`).set('x-user-email', email)
      .send({ clientId: Number(cid) });
  });

  when(/^I DELETE that work entry as "(.*)"$/, async (email) => {
    res = await request(app).delete(`/api/work-entries/${entryId}`).set('x-user-email', email);
  });

  // ─── When: Reports ──────────────────────────────────────────────────────────

  when(/^I GET the report for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/client/${clientId}`).set('x-user-email', email);
  });

  when(/^I export CSV for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/export/csv/${clientId}`).set('x-user-email', email);
  });

  when(/^I export CSV for client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/csv/${id}`).set('x-user-email', email);
  });

  when(/^I export PDF for that client as "(.*)"$/, async (email) => {
    res = await request(app).get(`/api/reports/export/pdf/${clientId}`).set('x-user-email', email);
  });

  when(/^I export PDF for client "(.*)" as "(.*)"$/, async (id, email) => {
    res = await request(app).get(`/api/reports/export/pdf/${id}`).set('x-user-email', email);
  });

  // ─── Then: Assertions ─────────────────────────────────────────────────────

  then(/^the status should be (\d+)$/, (status) => {
    expect(res.status).toBe(Number(status));
  });

  then(/^the response at "(.*)" should be "(.*)"$/, (jsonPath, value) => {
    expect(getNestedValue(res.body, jsonPath)).toBe(value);
  });

  then(/^the response at "(.*)" should be ([\d.]+)$/, (jsonPath, value) => {
    expect(getNestedValue(res.body, jsonPath)).toBe(Number(value));
  });

  then(/^the response at "(.*)" should exist$/, (jsonPath) => {
    expect(getNestedValue(res.body, jsonPath)).toBeDefined();
  });

  then(/^the response at "(.*)" should have at least (\d+) items$/, (jsonPath, count) => {
    expect(getNestedValue(res.body, jsonPath).length).toBeGreaterThanOrEqual(Number(count));
  });

  then(/^the response at "(.*)" should be an empty array$/, (jsonPath) => {
    expect(getNestedValue(res.body, jsonPath)).toEqual([]);
  });

  then(/^the response at "(.*)" should be an array$/, (jsonPath) => {
    expect(Array.isArray(getNestedValue(res.body, jsonPath))).toBe(true);
  });

  then(/^the response at "(.*)" should not contain name "(.*)"$/, (jsonPath, name) => {
    expect((getNestedValue(res.body, jsonPath) || []).map(c => c.name)).not.toContain(name);
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

  then(/^the content type should match csv$/, () => {
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });

  then(/^the response text should contain "(.*)"$/, (text) => {
    expect(res.text || res.body.toString()).toContain(text);
  });

  then(/^the content type should be "(.*)"$/, (type) => {
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
