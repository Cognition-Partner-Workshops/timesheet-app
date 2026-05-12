const { loadFeature, defineFeature } = require('jest-cucumber');
const request = require('supertest');
const path = require('path');
const { getApp, teardown, getNestedValue } = require('./shared-setup');

const featuresDir = path.resolve(__dirname, '../features');

const healthFeature = loadFeature(path.join(featuresDir, 'health.feature'));
const authFeature = loadFeature(path.join(featuresDir, 'auth.feature'));
const clientsFeature = loadFeature(path.join(featuresDir, 'clients.feature'));
const workEntriesFeature = loadFeature(path.join(featuresDir, 'work-entries.feature'));
const reportsFeature = loadFeature(path.join(featuresDir, 'reports.feature'));
const cascadeFeature = loadFeature(path.join(featuresDir, 'cascade.feature'));

let app;
let response;
let lastClientId;
let lastWorkEntryId;
let previousClientId;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await teardown();
});

// ─── Shared Step Helpers ─────────────────────────────────────────────────────

function defineSharedSteps(test) {
  let scenarioResponse;
  let scenarioClientId;
  let scenarioEntryId;
  let scenarioPreviousClientId;

  const getRes = () => scenarioResponse || response;
  const setRes = (r) => { scenarioResponse = r; response = r; };
  const getClientId = () => scenarioClientId || lastClientId;
  const setClientId = (id) => { scenarioClientId = id; lastClientId = id; };
  const getEntryId = () => scenarioEntryId || lastWorkEntryId;
  const setEntryId = (id) => { scenarioEntryId = id; lastWorkEntryId = id; };
  const getPrevClientId = () => scenarioPreviousClientId || previousClientId;
  const setPrevClientId = (id) => { scenarioPreviousClientId = id; previousClientId = id; };

  return {
    getRes, setRes, getClientId, setClientId,
    getEntryId, setEntryId, getPrevClientId, setPrevClientId
  };
}

function bindCommonSteps(ctx) {
  return {
    userExists: async (email) => {
      await request(app).post('/api/auth/login').send({ email });
    },

    clientExists: async (name, email) => {
      ctx.setPrevClientId(ctx.getClientId());
      const res = await request(app)
        .post('/api/clients')
        .set('x-user-email', email)
        .send({ name });
      ctx.setClientId(res.body.client.id);
    },

    workEntryExists: async (hours, date, email) => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', email)
        .send({ clientId: ctx.getClientId(), hours: Number(hours), date });
      ctx.setEntryId(res.body.workEntry.id);
    },

    expectStatus: (status) => {
      expect(ctx.getRes().status).toBe(Number(status));
    },

    expectBodyField: (field, value) => {
      const actual = ctx.getRes().body[field];
      const num = Number(value);
      if (!isNaN(num) && value.trim && value.trim() !== '') {
        expect(actual).toBe(num);
      } else {
        expect(actual).toBe(value);
      }
    },

    expectBodyPath: (jsonPath, value) => {
      const actual = getNestedValue(ctx.getRes().body, jsonPath);
      const num = Number(value);
      if (!isNaN(num) && typeof value === 'string' && value.trim() !== '') {
        expect(actual).toBe(num);
      } else {
        expect(actual).toBe(value);
      }
    },

    expectBodyFieldDefined: (field) => {
      expect(ctx.getRes().body[field]).toBeDefined();
    }
  };
}

// ─── Health Feature ──────────────────────────────────────────────────────────

defineFeature(healthFeature, (test) => {
  test('Service is healthy', ({ when, then, and }) => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);

    when(/^I send a GET request to "(.*)"$/, async (url) => {
      ctx.setRes(await request(app).get(url));
    });

    then(/^the response status should be (\d+)$/, (status) => {
      common.expectStatus(status);
    });

    and(/^the response body "(.*)" should equal "(.*)"$/, (field, value) => {
      common.expectBodyField(field, value);
    });

    and(/^the response body "(.*)" should be defined$/, (field) => {
      common.expectBodyFieldDefined(field);
    });
  });
});

// ─── Auth Feature ────────────────────────────────────────────────────────────

defineFeature(authFeature, (test) => {
  const scenarioSetup = () => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);
    return { ctx, common };
  };

  test('First-time login creates a new user', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I login with email "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).post('/api/auth/login').send({ email }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Returning user login', ({ given, when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    given(/^a user "(.*)" exists$/, async (email) => common.userExists(email));
    when(/^I login with email "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).post('/api/auth/login').send({ email }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Login with invalid email format', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I login with email "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).post('/api/auth/login').send({ email }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Login with missing email', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I login with empty body$/, async () => {
      ctx.setRes(await request(app).post('/api/auth/login').send({}));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Get current user info', ({ given, when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    given(/^a user "(.*)" exists$/, async (email) => common.userExists(email));
    when(/^I get my profile as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/auth/me').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Get current user without auth header', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I send a GET request to "(.*)"$/, async (url) => {
      ctx.setRes(await request(app).get(url));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Get current user with invalid email header', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I get my profile as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/auth/me').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Auth middleware auto-provisions new user', ({ when, then, and }) => {
    const { ctx, common } = scenarioSetup();

    when(/^I get my profile as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/auth/me').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });
});

// ─── Clients Feature ─────────────────────────────────────────────────────────

defineFeature(clientsFeature, (test) => {
  const setup = () => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);
    return { ctx, common };
  };

  test('Create a client with all fields', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I create a client "(.*)" as "(.*)" with department "(.*)" and email "(.*)"$/, async (name, email, dept, cEmail) => {
      ctx.setRes(await request(app).post('/api/clients').set('x-user-email', email)
        .send({ name, department: dept, email: cEmail }));
      if (ctx.getRes().body.client) ctx.setClientId(ctx.getRes().body.client.id);
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Create a client with only name', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I create a client named "(.*)" as "(.*)"$/, async (name, email) => {
      ctx.setRes(await request(app).post('/api/clients').set('x-user-email', email).send({ name }));
      if (ctx.getRes().body.client) ctx.setClientId(ctx.getRes().body.client.id);
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Fail to create a client without name', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I create a client without name as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).post('/api/clients').set('x-user-email', email)
        .send({ description: 'No name' }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Fail to create a client without authentication', ({ when, then }) => {
    const { ctx, common } = setup();
    when(/^I send an unauthenticated POST to "(.*)" with name "(.*)"$/, async (url, name) => {
      ctx.setRes(await request(app).post(url).send({ name }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('List all clients for the user', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I list clients as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/clients').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should have at least (\d+) items$/, (p, count) => {
      expect(getNestedValue(ctx.getRes().body, p).length).toBeGreaterThanOrEqual(Number(count));
    });
  });

  test('Empty client list for a new user', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I list clients as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/clients').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should be an empty array$/, (p) => {
      expect(getNestedValue(ctx.getRes().body, p)).toEqual([]);
    });
  });

  test('Clients are isolated between users', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I list clients as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/clients').set('x-user-email', email));
    });
    then(/^the client list should not contain "(.*)"$/, (name) => {
      const names = (ctx.getRes().body.clients || []).map(c => c.name);
      expect(names).not.toContain(name);
    });
  });

  test('Get a specific client by ID', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I get that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Get non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get client (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/clients/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Get client with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get client "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/clients/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot access another user\'s client', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I get that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update client fields', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I update that client as "(.*)" with name "(.*)"$/, async (email, name) => {
      ctx.setRes(await request(app).put(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email).send({ name }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Update non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I update client (\d+) as "(.*)" with name "(.*)"$/, async (id, email, name) => {
      ctx.setRes(await request(app).put(`/api/clients/${id}`).set('x-user-email', email).send({ name }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update client with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I update client "(.*)" as "(.*)" with name "(.*)"$/, async (id, email, name) => {
      ctx.setRes(await request(app).put(`/api/clients/${id}`).set('x-user-email', email).send({ name }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update client with empty body returns 400', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I update that client as "(.*)" with empty body$/, async (email) => {
      ctx.setRes(await request(app).put(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email).send({}));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot update another user\'s client', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I update that client as "(.*)" with name "(.*)"$/, async (email, name) => {
      ctx.setRes(await request(app).put(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email).send({ name }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Delete a specific client', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I delete that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).delete(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^that client should no longer exist for "(.*)"$/, async (email) => {
      const check = await request(app).get(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email);
      expect(check.status).toBe(404);
    });
  });

  test('Delete non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I delete client (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).delete(`/api/clients/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Delete client with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I delete client "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).delete(`/api/clients/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Bulk delete all clients for a user', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I delete all clients as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).delete('/api/clients').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body "(.*)" should equal (\d+)$/, (f, v) => {
      expect(ctx.getRes().body[f]).toBe(Number(v));
    });
  });
});

// ─── Work Entries Feature ────────────────────────────────────────────────────

defineFeature(workEntriesFeature, (test) => {
  const setup = () => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);
    return { ctx, common };
  };

  test('Create a work entry', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I create a work entry on that client as "(.*)" with ([\d.]+) hours on "(.*)" described "(.*)"$/, async (email, hours, date, desc) => {
      ctx.setRes(await request(app).post('/api/work-entries').set('x-user-email', email)
        .send({ clientId: ctx.getClientId(), hours: Number(hours), date, description: desc }));
      if (ctx.getRes().body.workEntry) ctx.setEntryId(ctx.getRes().body.workEntry.id);
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body path "(.*)" should equal (.+)$/, (p, v) => common.expectBodyPath(p, v));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Create a work entry without description', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I create a work entry on that client as "(.*)" with ([\d.]+) hours on "(.*)"$/, async (email, hours, date) => {
      ctx.setRes(await request(app).post('/api/work-entries').set('x-user-email', email)
        .send({ clientId: ctx.getClientId(), hours: Number(hours), date }));
      if (ctx.getRes().body.workEntry) ctx.setEntryId(ctx.getRes().body.workEntry.id);
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Fail to create with missing required fields', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I send an authenticated POST to "(.*)" as "(.*)" with body (.+)$/, async (url, email, jsonStr) => {
      ctx.setRes(await request(app).post(url).set('x-user-email', email).send(JSON.parse(jsonStr)));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Fail to create with hours exceeding 24', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I create a work entry on that client as "(.*)" with ([\d.]+) hours on "(.*)"$/, async (email, hours, date) => {
      ctx.setRes(await request(app).post('/api/work-entries').set('x-user-email', email)
        .send({ clientId: ctx.getClientId(), hours: Number(hours), date }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Fail to create for non-existent client', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I create a work entry on client (\d+) as "(.*)" with ([\d.]+) hours on "(.*)"$/, async (cid, email, hours, date) => {
      ctx.setRes(await request(app).post('/api/work-entries').set('x-user-email', email)
        .send({ clientId: Number(cid), hours: Number(hours), date }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });

  test('Fail to create without authentication', ({ when, then }) => {
    const { ctx, common } = setup();
    when(/^I send an unauthenticated POST to "(.*)" with body (.+)$/, async (url, jsonStr) => {
      ctx.setRes(await request(app).post(url).send(JSON.parse(jsonStr)));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('List all work entries', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I list work entries as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/work-entries').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should be an array$/, (p) => {
      expect(Array.isArray(getNestedValue(ctx.getRes().body, p))).toBe(true);
    });
  });

  test('Filter work entries by clientId', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I list work entries filtered by that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/work-entries?clientId=${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^all returned work entries should belong to that client$/, () => {
      ctx.getRes().body.workEntries.forEach(entry => {
        expect(entry.client_id).toBe(ctx.getClientId());
      });
    });
  });

  test('Filter with invalid clientId returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I send an authenticated GET to "(.*)" as "(.*)"$/, async (url, email) => {
      ctx.setRes(await request(app).get(url).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Work entries are isolated between users', ({ given, when, then, and }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I list work entries as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get('/api/work-entries').set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should be an empty array$/, (p) => {
      expect(getNestedValue(ctx.getRes().body, p)).toEqual([]);
    });
  });

  test('Get a specific work entry by ID', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I get that work entry as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal (.+)$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Get non-existent work entry returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get work entry (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/work-entries/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Get work entry with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get work entry "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/work-entries/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot access another user\'s work entry', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I get that work entry as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update work entry fields', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I update that work entry as "(.*)" with hours (\d+)$/, async (email, hours) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email)
        .send({ hours: Number(hours) }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^the response body path "(.*)" should equal (.+)$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Update work entry client assignment', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    when(/^I reassign that work entry to the latest client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email)
        .send({ clientId: ctx.getClientId() }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Update non-existent work entry returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I update work entry (\d+) as "(.*)" with hours (\d+)$/, async (id, email, hours) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${id}`).set('x-user-email', email).send({ hours: Number(hours) }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update work entry with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I update work entry "(.*)" as "(.*)" with hours (\d+)$/, async (id, email, hours) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${id}`).set('x-user-email', email).send({ hours: Number(hours) }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Update work entry with empty body returns 400', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I update that work entry as "(.*)" with empty body$/, async (email) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email).send({}));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot reassign to non-existent client', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I reassign that work entry to client (\d+) as "(.*)"$/, async (cid, email) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email)
        .send({ clientId: Number(cid) }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot update another user\'s work entry', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I update that work entry as "(.*)" with hours (\d+)$/, async (email, hours) => {
      ctx.setRes(await request(app).put(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email)
        .send({ hours: Number(hours) }));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Delete a work entry', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I delete that work entry as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).delete(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
    and(/^that work entry should no longer exist for "(.*)"$/, async (email) => {
      const check = await request(app).get(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email);
      expect(check.status).toBe(404);
    });
  });

  test('Delete non-existent work entry returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I delete work entry (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).delete(`/api/work-entries/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Delete work entry with invalid ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I delete work entry "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).delete(`/api/work-entries/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot delete another user\'s work entry', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I delete that work entry as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).delete(`/api/work-entries/${ctx.getEntryId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });
});

// ─── Reports Feature ─────────────────────────────────────────────────────────

defineFeature(reportsFeature, (test) => {
  const setup = () => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);
    return { ctx, common };
  };

  test('Get hourly report with totals', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I get the report for that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/reports/client/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body path "(.*)" should equal "(.*)"$/, (p, v) => common.expectBodyPath(p, v));
    and(/^the response body path "(.*)" should equal (.+)$/, (p, v) => common.expectBodyPath(p, v));
    and(/^the response body path "(.*)" should equal (.+)$/, (p, v) => common.expectBodyPath(p, v));
  });

  test('Report for non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get the report for client (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/client/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Report with invalid client ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get the report for client "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/client/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Cannot access another user\'s report', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I get the report for that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/reports/client/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Export CSV report', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I export CSV for that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/csv/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response content type should match csv$/, () => {
      expect(ctx.getRes().headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
    });
    and(/^the response text should contain "(.*)"$/, (text) => {
      const body = ctx.getRes().text || ctx.getRes().body.toString();
      expect(body).toContain(text);
    });
    and(/^the response text should contain "(.*)"$/, (text) => {
      const body = ctx.getRes().text || ctx.getRes().body.toString();
      expect(body).toContain(text);
    });
  });

  test('CSV export for non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I export CSV for client (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/csv/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('CSV export with invalid client ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I export CSV for client "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/csv/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('Export PDF report', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I export PDF for that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/pdf/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response content type should be "(.*)"$/, (type) => {
      expect(ctx.getRes().headers['content-type']).toBe(type);
    });
    and(/^the response should have a PDF attachment header$/, () => {
      expect(ctx.getRes().headers['content-disposition']).toMatch(/attachment.*\.pdf/);
    });
    and(/^the response body should not be empty$/, () => {
      expect(ctx.getRes().body.length).toBeGreaterThan(0);
    });
  });

  test('PDF export for non-existent client returns 404', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I export PDF for client (\d+) as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/pdf/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });

  test('PDF export with invalid client ID returns 400', ({ given, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    when(/^I export PDF for client "(.*)" as "(.*)"$/, async (id, email) => {
      ctx.setRes(await request(app).get(`/api/reports/export/pdf/${id}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
  });
});

// ─── Cascade Feature ─────────────────────────────────────────────────────────

defineFeature(cascadeFeature, (test) => {
  const setup = () => {
    const ctx = defineSharedSteps(test);
    const common = bindCommonSteps(ctx);
    return { ctx, common };
  };

  test('Deleting a client cascades to its work entries', ({ given, and, when, then }) => {
    const { ctx, common } = setup();
    given(/^a user "(.*)" exists$/, (e) => common.userExists(e));
    and(/^a client named "(.*)" exists for "(.*)"$/, (n, e) => common.clientExists(n, e));
    and(/^a work entry exists on that client for "(.*)" with ([\d.]+) hours on "(.*)"$/, (e, h, d) => common.workEntryExists(h, d, e));
    when(/^I delete that client as "(.*)"$/, async (email) => {
      ctx.setRes(await request(app).delete(`/api/clients/${ctx.getClientId()}`).set('x-user-email', email));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^user "(.*)" should have (\d+) work entries$/, async (email, count) => {
      const res = await request(app).get('/api/work-entries').set('x-user-email', email);
      expect(res.body.workEntries).toHaveLength(Number(count));
    });
  });

  test('Unknown route returns 404', ({ when, then, and }) => {
    const { ctx, common } = setup();
    when(/^I send a GET request to "(.*)"$/, async (url) => {
      ctx.setRes(await request(app).get(url));
    });
    then(/^the response status should be (\d+)$/, (s) => common.expectStatus(s));
    and(/^the response body "(.*)" should equal "(.*)"$/, (f, v) => common.expectBodyField(f, v));
  });
});
