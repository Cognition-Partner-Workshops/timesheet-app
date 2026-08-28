# frozen_string_literal: true

def nested_value(obj, path)
  path.split('.').reduce(obj) { |o, k| o.is_a?(Hash) ? o[k] : nil }
end

def auto_cast(value)
  return value.to_f if value =~ /\A\d+\.\d+\z/
  return value.to_i if value =~ /\A\d+\z/

  value
end

# ─── Status & response assertions (unified naming) ───────────────────────────

Then('the status should be {int}') { |s| expect(@res.status).to eq(s) }

Then('the response at {string} should be {string}') do |path, value|
  expect(nested_value(@res.body, path)).to eq(value)
end

Then(/^the response at "([^"]*)" should be ([\d.]+)$/) do |path, value|
  expected = value.include?('.') ? value.to_f : value.to_i
  expect(nested_value(@res.body, path)).to eq(expected)
end

Then('the response at {string} should exist') do |path|
  expect(nested_value(@res.body, path)).not_to be_nil
end

Then('the response at {string} should have at least {int} items') do |path, count|
  expect(nested_value(@res.body, path).length).to be >= count
end

Then('the response at {string} should be an empty array') do |path|
  expect(nested_value(@res.body, path)).to eq([])
end

Then('the response at {string} should be an array') do |path|
  expect(nested_value(@res.body, path)).to be_an(Array)
end

Then('the response at {string} should not contain name {string}') do |path, name|
  names = (nested_value(@res.body, path) || []).map { |c| c['name'] }
  expect(names).not_to include(name)
end

# ─── Resource-existence checks ────────────────────────────────────────────────

Then('that client should no longer exist for {string}') do |email|
  check = api_conn.get("/api/clients/#{@client_id}") { |r| r.headers['x-user-email'] = email }
  expect(check.status).to eq(404)
end

Then('that work entry should no longer exist for {string}') do |email|
  check = api_conn.get("/api/work-entries/#{@entry_id}") { |r| r.headers['x-user-email'] = email }
  expect(check.status).to eq(404)
end

Then('all returned work entries should belong to that client') do
  @res.body['workEntries'].each { |e| expect(e['client_id']).to eq(@client_id) }
end

Then('user {string} should have {int} work entries') do |email, count|
  r = api_conn.get('/api/work-entries') { |req| req.headers['x-user-email'] = email }
  expect(r.body['workEntries'].length).to eq(count)
end

# ─── Content-type assertions ─────────────────────────────────────────────────

Then('the content type should match csv') do
  expect(@res.headers['content-type']).to match(/text\/csv|application\/octet-stream/)
end

Then('the response text should contain {string}') do |text|
  body_text = @res.body.is_a?(String) ? @res.body : @res.body.to_s
  expect(body_text).to include(text)
end

Then('the content type should be {string}') do |type|
  expect(@res.headers['content-type']).to eq(type)
end

Then('the response should have a PDF attachment header') do
  expect(@res.headers['content-disposition']).to match(/attachment.*\.pdf/)
end

Then('the response body should not be empty') do
  body = @res.body
  body.is_a?(String) ? (expect(body.length).to be > 0) : (expect(body).not_to be_nil)
end
