# frozen_string_literal: true

def nested_value(obj, path)
  path.split('.').reduce(obj) { |o, k| (o.is_a?(Hash) ? o[k] : nil) }
end

Then('the response status should be {int}') do |status|
  expect(@res.status).to eq(status)
end

Then('the response body {string} should equal {string}') do |field, value|
  expect(@res.body[field]).to eq(value)
end

Then('the response body {string} should be number {float}') do |field, value|
  expect(@res.body[field]).to eq(value)
end

Then('the response body {string} should be defined') do |field|
  expect(@res.body[field]).not_to be_nil
end

Then('the nested response {string} should equal {string}') do |json_path, value|
  expect(nested_value(@res.body, json_path)).to eq(value)
end

Then('the nested response {string} should be number {float}') do |json_path, value|
  actual = nested_value(@res.body, json_path)
  # Compare as integer if the value is a whole number
  if value == value.to_i
    expect(actual).to eq(value.to_i)
  else
    expect(actual).to eq(value)
  end
end

Then('the nested response {string} should have at least {int} items') do |json_path, count|
  expect(nested_value(@res.body, json_path).length).to be >= count
end

Then('the nested response {string} should be an empty array') do |json_path|
  expect(nested_value(@res.body, json_path)).to eq([])
end

Then('the nested response {string} should be an array') do |json_path|
  expect(nested_value(@res.body, json_path)).to be_an(Array)
end

Then('the client list should not contain {string}') do |name|
  names = (@res.body['clients'] || []).map { |c| c['name'] }
  expect(names).not_to include(name)
end

Then('that client should no longer exist for {string}') do |email|
  check = api_conn.get("/api/clients/#{@client_id}") do |req|
    req.headers['x-user-email'] = email
  end
  expect(check.status).to eq(404)
end

Then('that work entry should no longer exist for {string}') do |email|
  check = api_conn.get("/api/work-entries/#{@entry_id}") do |req|
    req.headers['x-user-email'] = email
  end
  expect(check.status).to eq(404)
end

Then('all returned work entries should belong to that client') do
  @res.body['workEntries'].each do |entry|
    expect(entry['client_id']).to eq(@client_id)
  end
end

Then('user {string} should have {int} work entries') do |email, count|
  r = api_conn.get('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
  end
  expect(r.body['workEntries'].length).to eq(count)
end

Then('the response content type should match csv') do
  expect(@res.headers['content-type']).to match(/text\/csv|application\/octet-stream/)
end

Then('the response text should contain {string}') do |text|
  body_text = @res.body.is_a?(String) ? @res.body : @res.body.to_s
  expect(body_text).to include(text)
end

Then('the response content type should be {string}') do |type|
  expect(@res.headers['content-type']).to eq(type)
end

Then('the response should have a PDF attachment header') do
  expect(@res.headers['content-disposition']).to match(/attachment.*\.pdf/)
end

Then('the response body should not be empty') do
  body = @res.body
  if body.is_a?(String)
    expect(body.length).to be > 0
  else
    expect(body).not_to be_nil
  end
end
