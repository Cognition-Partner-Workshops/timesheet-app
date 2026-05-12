# frozen_string_literal: true

# ─── General ──────────────────────────────────────────────────────────────────

When('I send a GET request to {string}') do |url|
  @res = api_conn.get(url)
end

# ─── Auth ─────────────────────────────────────────────────────────────────────

When('I login with email {string}') do |email|
  @res = api_conn.post('/api/auth/login') do |req|
    req.body = { email: email }
  end
end

When('I login with empty body') do
  @res = api_conn.post('/api/auth/login') do |req|
    req.body = {}
  end
end

When('I get my profile as {string}') do |email|
  @res = api_conn.get('/api/auth/me') do |req|
    req.headers['x-user-email'] = email
  end
end

# ─── Clients ──────────────────────────────────────────────────────────────────

When('I create a client {string} as {string} with department {string} and email {string}') do |name, email, dept, c_email|
  @res = api_conn.post('/api/clients') do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name, department: dept, email: c_email }
  end
  @client_id = @res.body.dig('client', 'id') if @res.body.is_a?(Hash)
end

When('I create a client named {string} as {string}') do |name, email|
  @res = api_conn.post('/api/clients') do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name }
  end
  @client_id = @res.body.dig('client', 'id') if @res.body.is_a?(Hash)
end

When('I create a client without name as {string}') do |email|
  @res = api_conn.post('/api/clients') do |req|
    req.headers['x-user-email'] = email
    req.body = { description: 'no name' }
  end
end

When('I send an unauthenticated POST to {string} with name {string}') do |url, name|
  @res = api_conn.post(url) do |req|
    req.body = { name: name }
  end
end

When('I list clients as {string}') do |email|
  @res = api_conn.get('/api/clients') do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get that client as {string}') do |email|
  @res = api_conn.get("/api/clients/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get client {int} as {string}') do |id, email|
  @res = api_conn.get("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get client {string} as {string}') do |id, email|
  @res = api_conn.get("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I update that client as {string} with name {string}') do |email, name|
  @res = api_conn.put("/api/clients/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name }
  end
end

When('I update client {int} as {string} with name {string}') do |id, email, name|
  @res = api_conn.put("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name }
  end
end

When('I update client {string} as {string} with name {string}') do |id, email, name|
  @res = api_conn.put("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name }
  end
end

When('I update that client as {string} with empty body') do |email|
  @res = api_conn.put("/api/clients/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = {}
  end
end

When('I delete that client as {string}') do |email|
  @res = api_conn.delete("/api/clients/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I delete client {int} as {string}') do |id, email|
  @res = api_conn.delete("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I delete client {string} as {string}') do |id, email|
  @res = api_conn.delete("/api/clients/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I delete all clients as {string}') do |email|
  @res = api_conn.delete('/api/clients') do |req|
    req.headers['x-user-email'] = email
  end
end

# ─── Work Entries ─────────────────────────────────────────────────────────────

When('I create a work entry on that client as {string} with {float} hours on {string} described {string}') do |email, hours, date, desc|
  @res = api_conn.post('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: @client_id, hours: hours, date: date, description: desc }
  end
  @entry_id = @res.body.dig('workEntry', 'id') if @res.body.is_a?(Hash)
end

When('I create a work entry on that client as {string} with {float} hours on {string}') do |email, hours, date|
  @res = api_conn.post('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: @client_id, hours: hours, date: date }
  end
  @entry_id = @res.body.dig('workEntry', 'id') if @res.body.is_a?(Hash)
end

When('I create a work entry on client {int} as {string} with {float} hours on {string}') do |cid, email, hours, date|
  @res = api_conn.post('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: cid, hours: hours, date: date }
  end
end

When(/^I send an authenticated POST to "([^"]*)" as "([^"]*)" with body (.+)$/) do |url, email, json_body|
  @res = api_conn.post(url) do |req|
    req.headers['x-user-email'] = email
    req.body = JSON.parse(json_body)
  end
end

When(/^I send an unauthenticated POST to "([^"]*)" with body (.+)$/) do |url, json_body|
  @res = api_conn.post(url) do |req|
    req.body = JSON.parse(json_body)
  end
end

When('I list work entries as {string}') do |email|
  @res = api_conn.get('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
  end
end

When('I list work entries filtered by that client as {string}') do |email|
  @res = api_conn.get("/api/work-entries?clientId=#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I send an authenticated GET to {string} as {string}') do |url, email|
  @res = api_conn.get(url) do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get that work entry as {string}') do |email|
  @res = api_conn.get("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get work entry {int} as {string}') do |id, email|
  @res = api_conn.get("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get work entry {string} as {string}') do |id, email|
  @res = api_conn.get("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I update that work entry as {string} with hours {float}') do |email, hours|
  @res = api_conn.put("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { hours: hours }
  end
end

When('I update work entry {int} as {string} with hours {float}') do |id, email, hours|
  @res = api_conn.put("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { hours: hours }
  end
end

When('I update work entry {string} as {string} with hours {float}') do |id, email, hours|
  @res = api_conn.put("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { hours: hours }
  end
end

When('I update that work entry as {string} with empty body') do |email|
  @res = api_conn.put("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = {}
  end
end

When('I reassign that work entry to the latest client as {string}') do |email|
  @res = api_conn.put("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: @client_id }
  end
end

When('I reassign that work entry to client {int} as {string}') do |cid, email|
  @res = api_conn.put("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: cid }
  end
end

When('I delete that work entry as {string}') do |email|
  @res = api_conn.delete("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I delete work entry {int} as {string}') do |id, email|
  @res = api_conn.delete("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I delete work entry {string} as {string}') do |id, email|
  @res = api_conn.delete("/api/work-entries/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

# ─── Reports ──────────────────────────────────────────────────────────────────

When('I get the report for that client as {string}') do |email|
  @res = api_conn.get("/api/reports/client/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get the report for client {int} as {string}') do |id, email|
  @res = api_conn.get("/api/reports/client/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I get the report for client {string} as {string}') do |id, email|
  @res = api_conn.get("/api/reports/client/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export CSV for that client as {string}') do |email|
  @res = raw_conn.get("/api/reports/export/csv/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export CSV for client {int} as {string}') do |id, email|
  @res = raw_conn.get("/api/reports/export/csv/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export CSV for client {string} as {string}') do |id, email|
  @res = raw_conn.get("/api/reports/export/csv/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export PDF for that client as {string}') do |email|
  @res = raw_conn.get("/api/reports/export/pdf/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export PDF for client {int} as {string}') do |id, email|
  @res = raw_conn.get("/api/reports/export/pdf/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end

When('I export PDF for client {string} as {string}') do |id, email|
  @res = raw_conn.get("/api/reports/export/pdf/#{id}") do |req|
    req.headers['x-user-email'] = email
  end
end
