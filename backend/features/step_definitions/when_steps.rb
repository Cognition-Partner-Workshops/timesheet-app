# frozen_string_literal: true

# ─── Generic HTTP helpers (reused by all steps) ──────────────────────────────

def authed(method, path, email, body = nil)
  conn = method == :raw_get ? raw_conn : api_conn
  actual_method = method == :raw_get ? :get : method
  @res = conn.public_send(actual_method, path) do |r|
    r.headers['x-user-email'] = email if email
    r.body = body if body
  end
end

def table_to_hash(table)
  keys = table.raw[0]
  vals = table.raw[1]
  keys.zip(vals).to_h.transform_values { |v| v =~ /\A\d+\.\d+\z/ ? v.to_f : (v =~ /\A\d+\z/ ? v.to_i : v) }
end

def store_ids
  @client_id = @res.body.dig('client', 'id') if @res.body.is_a?(Hash) && @res.body['client']
  @entry_id  = @res.body.dig('workEntry', 'id') if @res.body.is_a?(Hash) && @res.body['workEntry']
end

# ─── Generic REST steps ──────────────────────────────────────────────────────

When('I GET {string}') { |url| @res = api_conn.get(url) }
When('I GET {string} as {string}') { |url, email| authed(:get, url, email) }
When('I DELETE {string} as {string}') { |url, email| authed(:delete, url, email) }

When('I POST {string} as {string} with:') do |url, email, table|
  authed(:post, url, email, table_to_hash(table))
  store_ids
end

When('I POST {string} without auth with:') do |url, table|
  @res = api_conn.post(url) { |r| r.body = table_to_hash(table) }
end

When('I PUT {string} as {string} with:') do |url, email, table|
  authed(:put, url, email, table_to_hash(table))
end

# ─── Auth ─────────────────────────────────────────────────────────────────────

When('I login as {string}') { |email| @res = api_conn.post('/api/auth/login') { |r| r.body = { email: email } } }
When('I login with email {string}') { |email| @res = api_conn.post('/api/auth/login') { |r| r.body = { email: email } } }
When('I login with an empty body') { @res = api_conn.post('/api/auth/login') { |r| r.body = {} } }

# ─── Client resource steps ───────────────────────────────────────────────────

When('I GET that client as {string}') { |email| authed(:get, "/api/clients/#{@client_id}", email) }

When('I PUT that client as {string} with:') do |email, table|
  authed(:put, "/api/clients/#{@client_id}", email, table_to_hash(table))
end

When('I PUT that client as {string} with empty body') { |email| authed(:put, "/api/clients/#{@client_id}", email, {}) }
When('I DELETE that client as {string}') { |email| authed(:delete, "/api/clients/#{@client_id}", email) }

# ─── Work Entry resource steps ───────────────────────────────────────────────

When('I create a work entry on that client as {string} with:') do |email, table|
  body = table_to_hash(table).merge(clientId: @client_id)
  authed(:post, '/api/work-entries', email, body)
  store_ids
end

When('I create a work entry on client {int} as {string} with:') do |cid, email, table|
  body = table_to_hash(table).merge(clientId: cid)
  authed(:post, '/api/work-entries', email, body)
end

When('I GET work entries filtered by that client as {string}') { |email| authed(:get, "/api/work-entries?clientId=#{@client_id}", email) }
When('I GET that work entry as {string}') { |email| authed(:get, "/api/work-entries/#{@entry_id}", email) }

When('I PUT that work entry as {string} with:') do |email, table|
  authed(:put, "/api/work-entries/#{@entry_id}", email, table_to_hash(table))
end

When('I PUT that work entry as {string} with empty body') { |email| authed(:put, "/api/work-entries/#{@entry_id}", email, {}) }

When('I reassign that work entry to the latest client as {string}') { |email| authed(:put, "/api/work-entries/#{@entry_id}", email, { clientId: @client_id }) }
When('I reassign that work entry to client {int} as {string}') { |cid, email| authed(:put, "/api/work-entries/#{@entry_id}", email, { clientId: cid }) }

When('I DELETE that work entry as {string}') { |email| authed(:delete, "/api/work-entries/#{@entry_id}", email) }

# ─── Report steps ────────────────────────────────────────────────────────────

When('I GET the report for that client as {string}') { |email| authed(:get, "/api/reports/client/#{@client_id}", email) }
When('I export CSV for that client as {string}') { |email| authed(:raw_get, "/api/reports/export/csv/#{@client_id}", email) }
When('I export CSV for client {string} as {string}') { |id, email| authed(:raw_get, "/api/reports/export/csv/#{id}", email) }
When('I export PDF for that client as {string}') { |email| authed(:raw_get, "/api/reports/export/pdf/#{@client_id}", email) }
When('I export PDF for client {string} as {string}') { |id, email| authed(:raw_get, "/api/reports/export/pdf/#{id}", email) }
