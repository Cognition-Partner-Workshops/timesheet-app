# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'Clients - /api/clients' do
  before(:all) do
    ApiClient.login(TestHelpers::TEST_EMAIL)
    ApiClient.login(TestHelpers::OTHER_EMAIL)

    res = ApiClient.post('/api/clients',
                         body: { name: 'Acme Corp', description: 'Primary client', department: 'Engineering', email: 'contact@acme.com' },
                         email: TestHelpers::TEST_EMAIL)
    @client_id = res.body['client']['id']

    res2 = ApiClient.post('/api/clients', body: { name: 'Beta Inc' }, email: TestHelpers::TEST_EMAIL)
    @second_client_id = res2.body['client']['id']
  end

  describe 'POST /api/clients' do
    it 'creates a client with all fields' do
      payload = { name: 'Test Corp', description: 'Test client', department: 'QA', email: 'test@corp.com' }
      res = ApiClient.post('/api/clients', body: payload, email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(201)
      expect(res.body['message']).to eq('Client created successfully')
      expect(res.body['client']['name']).to eq('Test Corp')
      expect(res.body['client']['id']).not_to be_nil
    end

    it 'creates a client with only required fields' do
      res = ApiClient.post('/api/clients', body: { name: 'Minimal Client' }, email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(201)
      expect(res.body['client']['name']).to eq('Minimal Client')
    end

    it 'returns 400 for missing name' do
      res = ApiClient.post('/api/clients', body: { description: 'No name given' }, email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Validation error')
    end

    it 'returns 401 without auth header' do
      res = ApiClient.post('/api/clients', body: { name: 'Unauthorized' })
      expect(res.status).to eq(401)
    end
  end

  describe 'GET /api/clients' do
    it 'lists all clients for the user' do
      res = ApiClient.get('/api/clients', email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['clients'].length).to be >= 2
    end

    it 'returns empty array for user with no clients' do
      email = 'ruby-no-clients@example.com'
      ApiClient.login(email)
      res = ApiClient.get('/api/clients', email: email)
      expect(res.status).to eq(200)
      expect(res.body['clients']).to eq([])
    end

    it 'isolates clients by user' do
      res = ApiClient.get('/api/clients', email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(200)
      names = res.body['clients'].map { |c| c['name'] }
      expect(names).not_to include('Acme Corp')
    end
  end

  describe 'GET /api/clients/:id' do
    it 'returns a specific client' do
      res = ApiClient.get("/api/clients/#{@client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['client']['id']).to eq(@client_id)
    end

    include_examples 'invalid ID handling', :get, '/api/clients'

    it "does not return another user's client" do
      res = ApiClient.get("/api/clients/#{@client_id}", email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end

  describe 'PUT /api/clients/:id' do
    it 'updates client fields' do
      res = ApiClient.put("/api/clients/#{@client_id}",
                          body: { name: 'Acme Corp Updated', department: 'Sales' },
                          email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['message']).to eq('Client updated successfully')
      expect(res.body['client']['name']).to eq('Acme Corp Updated')
      expect(res.body['client']['department']).to eq('Sales')
    end

    include_examples 'invalid ID handling', :put, '/api/clients', { name: 'Test' }

    it 'returns 400 when no fields provided' do
      res = ApiClient.put("/api/clients/#{@client_id}", body: {}, email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Validation error')
    end

    it "does not allow another user to update client" do
      res = ApiClient.put("/api/clients/#{@client_id}",
                          body: { name: 'Hijacked' },
                          email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end

  describe 'DELETE /api/clients/:id' do
    it 'deletes a specific client' do
      res = ApiClient.delete("/api/clients/#{@second_client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['message']).to eq('Client deleted successfully')

      check = ApiClient.get("/api/clients/#{@second_client_id}", email: TestHelpers::TEST_EMAIL)
      expect(check.status).to eq(404)
    end

    include_examples 'invalid ID handling', :delete, '/api/clients'
  end
end
