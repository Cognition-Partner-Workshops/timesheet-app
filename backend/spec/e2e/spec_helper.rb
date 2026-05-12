# frozen_string_literal: true

require_relative 'support/server_manager'
require_relative 'support/api_client'

RSpec.configure do |config|
  config.formatter = :documentation

  config.before(:suite) do
    ServerManager.start
  end

  config.after(:suite) do
    ServerManager.stop
  end
end

# Shared test helpers
module TestHelpers
  TEST_EMAIL  = 'e2e-ruby-test@example.com'
  OTHER_EMAIL = 'ruby-other-user@example.com'

  def authed_get(path, email = TEST_EMAIL)
    ApiClient.get(path, email: email)
  end

  def authed_post(path, body, email = TEST_EMAIL)
    ApiClient.post(path, body: body, email: email)
  end

  def authed_put(path, body, email = TEST_EMAIL)
    ApiClient.put(path, body: body, email: email)
  end

  def authed_delete(path, email = TEST_EMAIL)
    ApiClient.delete(path, email: email)
  end

  def login(email)
    ApiClient.login(email)
  end

  def create_client(name, email = TEST_EMAIL)
    res = authed_post('/api/clients', { name: name }, email)
    res.body['client']['id']
  end

  def create_work_entry(client_id, hours, date, description = nil, email = TEST_EMAIL)
    body = { clientId: client_id, hours: hours, date: date }
    body[:description] = description if description
    authed_post('/api/work-entries', body, email)
  end
end

RSpec.configure do |config|
  config.include TestHelpers
end

# Shared examples for 404/400 ID error tests
RSpec.shared_examples 'invalid ID handling' do |method, base_path, body|
  it 'returns 404 for non-existent ID' do
    if body
      res = ApiClient.send(method, "#{base_path}/99999", body: body, email: TestHelpers::TEST_EMAIL)
    else
      res = ApiClient.send(method, "#{base_path}/99999", email: TestHelpers::TEST_EMAIL)
    end
    expect(res.status).to eq(404)
  end

  it 'returns 400 for invalid ID' do
    if body
      res = ApiClient.send(method, "#{base_path}/abc", body: body, email: TestHelpers::TEST_EMAIL)
    else
      res = ApiClient.send(method, "#{base_path}/abc", email: TestHelpers::TEST_EMAIL)
    end
    expect(res.status).to eq(400)
  end
end
