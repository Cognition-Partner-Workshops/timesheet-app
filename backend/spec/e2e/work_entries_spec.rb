# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'Work Entries - /api/work-entries' do
  before(:all) do
    ApiClient.login(TestHelpers::TEST_EMAIL)
    ApiClient.login(TestHelpers::OTHER_EMAIL)

    @client_id = ApiClient.post('/api/clients', body: { name: 'Work Client A' }, email: TestHelpers::TEST_EMAIL)
                          .body['client']['id']
    @second_client_id = ApiClient.post('/api/clients', body: { name: 'Work Client B' }, email: TestHelpers::TEST_EMAIL)
                                 .body['client']['id']

    @entry_id = ApiClient.post('/api/work-entries',
                               body: { clientId: @client_id, hours: 4.5, date: '2025-01-15', description: 'Backend development' },
                               email: TestHelpers::TEST_EMAIL).body['workEntry']['id']
    @second_entry_id = ApiClient.post('/api/work-entries',
                                      body: { clientId: @second_client_id, hours: 2, date: '2025-01-16', description: 'Code review' },
                                      email: TestHelpers::TEST_EMAIL).body['workEntry']['id']
  end

  describe 'POST /api/work-entries' do
    it 'creates a work entry' do
      res = ApiClient.post('/api/work-entries',
                           body: { clientId: @client_id, hours: 3, date: '2025-01-20', description: 'New task' },
                           email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(201)
      expect(res.body['message']).to eq('Work entry created successfully')
      expect(res.body['workEntry']['hours']).to eq(3)
      expect(res.body['workEntry']['client_name']).to eq('Work Client A')
    end

    it 'creates a work entry without description' do
      res = ApiClient.post('/api/work-entries',
                           body: { clientId: @client_id, hours: 1, date: '2025-01-17' },
                           email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(201)
    end

    it 'returns 400 for missing required fields' do
      res = ApiClient.post('/api/work-entries',
                           body: { description: 'No hours or client' },
                           email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Validation error')
    end

    it 'returns 400 for invalid hours (> 24)' do
      res = ApiClient.post('/api/work-entries',
                           body: { clientId: @client_id, hours: 25, date: '2025-01-15' },
                           email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
    end

    it 'returns 400 for non-existent client' do
      res = ApiClient.post('/api/work-entries',
                           body: { clientId: 99_999, hours: 1, date: '2025-01-15' },
                           email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Client not found or does not belong to user')
    end

    it 'returns 401 without auth header' do
      res = ApiClient.post('/api/work-entries',
                           body: { clientId: @client_id, hours: 1, date: '2025-01-15' })
      expect(res.status).to eq(401)
    end
  end

  describe 'GET /api/work-entries' do
    it 'lists all work entries for the user' do
      res = ApiClient.get('/api/work-entries', email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['workEntries'].length).to be >= 2
    end

    it 'filters work entries by clientId' do
      res = ApiClient.get("/api/work-entries?clientId=#{@client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      res.body['workEntries'].each do |entry|
        expect(entry['client_id']).to eq(@client_id)
      end
    end

    it 'returns 400 for invalid clientId query param' do
      res = ApiClient.get('/api/work-entries?clientId=abc', email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
    end

    it 'isolates work entries by user' do
      res = ApiClient.get('/api/work-entries', email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['workEntries']).to eq([])
    end
  end

  describe 'GET /api/work-entries/:id' do
    it 'returns a specific work entry' do
      res = ApiClient.get("/api/work-entries/#{@entry_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['workEntry']['id']).to eq(@entry_id)
      expect(res.body['workEntry']['hours']).to eq(4.5)
      expect(res.body['workEntry']['client_name']).to eq('Work Client A')
    end

    include_examples 'invalid ID handling', :get, '/api/work-entries'

    it "does not return another user's entry" do
      res = ApiClient.get("/api/work-entries/#{@entry_id}", email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end

  describe 'PUT /api/work-entries/:id' do
    it 'updates work entry fields' do
      res = ApiClient.put("/api/work-entries/#{@entry_id}",
                          body: { hours: 6, description: 'Updated work' },
                          email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['message']).to eq('Work entry updated successfully')
      expect(res.body['workEntry']['hours']).to eq(6)
      expect(res.body['workEntry']['description']).to eq('Updated work')
    end

    it 'updates work entry client assignment' do
      res = ApiClient.put("/api/work-entries/#{@entry_id}",
                          body: { clientId: @second_client_id },
                          email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['workEntry']['client_id']).to eq(@second_client_id)
      expect(res.body['workEntry']['client_name']).to eq('Work Client B')
      # Reassign back
      ApiClient.put("/api/work-entries/#{@entry_id}",
                    body: { clientId: @client_id },
                    email: TestHelpers::TEST_EMAIL)
    end

    include_examples 'invalid ID handling', :put, '/api/work-entries', { hours: 1 }

    it 'returns 400 when no fields provided' do
      res = ApiClient.put("/api/work-entries/#{@entry_id}",
                          body: {},
                          email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
    end

    it 'returns 400 for assigning to non-existent client' do
      res = ApiClient.put("/api/work-entries/#{@entry_id}",
                          body: { clientId: 99_999 },
                          email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(400)
    end

    it "does not allow another user to update entry" do
      res = ApiClient.put("/api/work-entries/#{@entry_id}",
                          body: { hours: 1 },
                          email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end

  describe 'DELETE /api/work-entries/:id' do
    it 'deletes a work entry' do
      res = ApiClient.delete("/api/work-entries/#{@second_entry_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['message']).to eq('Work entry deleted successfully')

      check = ApiClient.get("/api/work-entries/#{@second_entry_id}", email: TestHelpers::TEST_EMAIL)
      expect(check.status).to eq(404)
    end

    include_examples 'invalid ID handling', :delete, '/api/work-entries'

    it "does not allow another user to delete entry" do
      res = ApiClient.delete("/api/work-entries/#{@entry_id}", email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end
end
