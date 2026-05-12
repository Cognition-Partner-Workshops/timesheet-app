# frozen_string_literal: true

# ─── Helpers to reduce duplication ────────────────────────────────────────────

def authed_get(path, email)
  @res = api_conn.get(path) { |r| r.headers['x-user-email'] = email }
end

def authed_post(path, email, body)
  @res = api_conn.post(path) { |r| r.headers['x-user-email'] = email; r.body = body }
end

def authed_put(path, email, body)
  @res = api_conn.put(path) { |r| r.headers['x-user-email'] = email; r.body = body }
end

def authed_delete(path, email)
  @res = api_conn.delete(path) { |r| r.headers['x-user-email'] = email }
end

def raw_authed_get(path, email)
  @res = raw_conn.get(path) { |r| r.headers['x-user-email'] = email }
end

def store_client_id
  @client_id = @res.body.dig('client', 'id') if @res.body.is_a?(Hash)
end

def store_entry_id
  @entry_id = @res.body.dig('workEntry', 'id') if @res.body.is_a?(Hash)
end

# ─── General ──────────────────────────────────────────────────────────────────

When('I send a GET request to {string}') { |url| @res = api_conn.get(url) }

# ─── Auth ─────────────────────────────────────────────────────────────────────

When('I login with email {string}') { |email| @res = api_conn.post('/api/auth/login') { |r| r.body = { email: email } } }
When('I login with empty body') { @res = api_conn.post('/api/auth/login') { |r| r.body = {} } }
When('I get my profile as {string}') { |email| authed_get('/api/auth/me', email) }

# ─── Clients ──────────────────────────────────────────────────────────────────

When('I create a client {string} as {string} with department {string} and email {string}') do |name, email, dept, c_email|
  authed_post('/api/clients', email, { name: name, department: dept, email: c_email })
  store_client_id
end

When('I create a client named {string} as {string}') do |name, email|
  authed_post('/api/clients', email, { name: name })
  store_client_id
end

When('I create a client without name as {string}') { |email| authed_post('/api/clients', email, { description: 'no name' }) }

When('I send an unauthenticated POST to {string} with name {string}') do |url, name|
  @res = api_conn.post(url) { |r| r.body = { name: name } }
end

When('I list clients as {string}') { |email| authed_get('/api/clients', email) }
When('I get that client as {string}') { |email| authed_get("/api/clients/#{@client_id}", email) }
When('I get client {int} as {string}') { |id, email| authed_get("/api/clients/#{id}", email) }
When('I get client {string} as {string}') { |id, email| authed_get("/api/clients/#{id}", email) }

When('I update that client as {string} with name {string}') { |email, name| authed_put("/api/clients/#{@client_id}", email, { name: name }) }
When('I update client {int} as {string} with name {string}') { |id, email, name| authed_put("/api/clients/#{id}", email, { name: name }) }
When('I update client {string} as {string} with name {string}') { |id, email, name| authed_put("/api/clients/#{id}", email, { name: name }) }
When('I update that client as {string} with empty body') { |email| authed_put("/api/clients/#{@client_id}", email, {}) }

When('I delete that client as {string}') { |email| authed_delete("/api/clients/#{@client_id}", email) }
When('I delete client {int} as {string}') { |id, email| authed_delete("/api/clients/#{id}", email) }
When('I delete client {string} as {string}') { |id, email| authed_delete("/api/clients/#{id}", email) }
When('I delete all clients as {string}') { |email| authed_delete('/api/clients', email) }

# ─── Work Entries ─────────────────────────────────────────────────────────────

When('I create a work entry on that client as {string} with {float} hours on {string} described {string}') do |email, hours, date, desc|
  authed_post('/api/work-entries', email, { clientId: @client_id, hours: hours, date: date, description: desc })
  store_entry_id
end

When('I create a work entry on that client as {string} with {float} hours on {string}') do |email, hours, date|
  authed_post('/api/work-entries', email, { clientId: @client_id, hours: hours, date: date })
  store_entry_id
end

When('I create a work entry on client {int} as {string} with {float} hours on {string}') do |cid, email, hours, date|
  authed_post('/api/work-entries', email, { clientId: cid, hours: hours, date: date })
end

When(/^I send an authenticated POST to "([^"]*)" as "([^"]*)" with body (.+)$/) do |url, email, json_body|
  authed_post(url, email, JSON.parse(json_body))
end

When(/^I send an unauthenticated POST to "([^"]*)" with body (.+)$/) do |url, json_body|
  @res = api_conn.post(url) { |r| r.body = JSON.parse(json_body) }
end

When('I list work entries as {string}') { |email| authed_get('/api/work-entries', email) }
When('I list work entries filtered by that client as {string}') { |email| authed_get("/api/work-entries?clientId=#{@client_id}", email) }
When('I send an authenticated GET to {string} as {string}') { |url, email| authed_get(url, email) }

When('I get that work entry as {string}') { |email| authed_get("/api/work-entries/#{@entry_id}", email) }
When('I get work entry {int} as {string}') { |id, email| authed_get("/api/work-entries/#{id}", email) }
When('I get work entry {string} as {string}') { |id, email| authed_get("/api/work-entries/#{id}", email) }

When('I update that work entry as {string} with hours {float}') { |email, hours| authed_put("/api/work-entries/#{@entry_id}", email, { hours: hours }) }
When('I update work entry {int} as {string} with hours {float}') { |id, email, hours| authed_put("/api/work-entries/#{id}", email, { hours: hours }) }
When('I update work entry {string} as {string} with hours {float}') { |id, email, hours| authed_put("/api/work-entries/#{id}", email, { hours: hours }) }
When('I update that work entry as {string} with empty body') { |email| authed_put("/api/work-entries/#{@entry_id}", email, {}) }

When('I reassign that work entry to the latest client as {string}') { |email| authed_put("/api/work-entries/#{@entry_id}", email, { clientId: @client_id }) }
When('I reassign that work entry to client {int} as {string}') { |cid, email| authed_put("/api/work-entries/#{@entry_id}", email, { clientId: cid }) }

When('I delete that work entry as {string}') { |email| authed_delete("/api/work-entries/#{@entry_id}", email) }
When('I delete work entry {int} as {string}') { |id, email| authed_delete("/api/work-entries/#{id}", email) }
When('I delete work entry {string} as {string}') { |id, email| authed_delete("/api/work-entries/#{id}", email) }

# ─── Reports ──────────────────────────────────────────────────────────────────

When('I get the report for that client as {string}') { |email| authed_get("/api/reports/client/#{@client_id}", email) }
When('I get the report for client {int} as {string}') { |id, email| authed_get("/api/reports/client/#{id}", email) }
When('I get the report for client {string} as {string}') { |id, email| authed_get("/api/reports/client/#{id}", email) }

When('I export CSV for that client as {string}') { |email| raw_authed_get("/api/reports/export/csv/#{@client_id}", email) }
When('I export CSV for client {int} as {string}') { |id, email| raw_authed_get("/api/reports/export/csv/#{id}", email) }
When('I export CSV for client {string} as {string}') { |id, email| raw_authed_get("/api/reports/export/csv/#{id}", email) }

When('I export PDF for that client as {string}') { |email| raw_authed_get("/api/reports/export/pdf/#{@client_id}", email) }
When('I export PDF for client {int} as {string}') { |id, email| raw_authed_get("/api/reports/export/pdf/#{id}", email) }
When('I export PDF for client {string} as {string}') { |id, email| raw_authed_get("/api/reports/export/pdf/#{id}", email) }
