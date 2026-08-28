# frozen_string_literal: true

Given('a user {string} exists') do |email|
  api_conn.post('/api/auth/login') do |req|
    req.body = { email: email }
  end
end

Given('a client named {string} exists for {string}') do |name, email|
  res = api_conn.post('/api/clients') do |req|
    req.headers['x-user-email'] = email
    req.body = { name: name }
  end
  @client_id = res.body['client']['id'] if res.body['client']
end

Given('a work entry exists on that client for {string} with {float} hours on {string}') do |email, hours, date|
  res = api_conn.post('/api/work-entries') do |req|
    req.headers['x-user-email'] = email
    req.body = { clientId: @client_id, hours: hours, date: date }
  end
  @entry_id = res.body['workEntry']['id'] if res.body['workEntry']
end
