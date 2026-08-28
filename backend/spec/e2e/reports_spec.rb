# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'Reports - /api/reports' do
  before(:all) do
    ApiClient.login(TestHelpers::TEST_EMAIL)
    ApiClient.login(TestHelpers::OTHER_EMAIL)

    res = ApiClient.post('/api/clients', body: { name: 'Report Client' }, email: TestHelpers::TEST_EMAIL)
    @client_id = res.body['client']['id']
    ApiClient.post('/api/work-entries',
                   body: { clientId: @client_id, hours: 3, date: '2025-02-01', description: 'Design work' },
                   email: TestHelpers::TEST_EMAIL)
    ApiClient.post('/api/work-entries',
                   body: { clientId: @client_id, hours: 5, date: '2025-02-02', description: 'Implementation' },
                   email: TestHelpers::TEST_EMAIL)
  end

  describe 'GET /api/reports/client/:clientId' do
    it 'returns hourly report with totals' do
      res = ApiClient.get("/api/reports/client/#{@client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['client']['name']).to eq('Report Client')
      expect(res.body['totalHours']).to eq(8)
      expect(res.body['entryCount']).to eq(2)
      expect(res.body['workEntries'].length).to eq(2)
    end

    include_examples 'invalid ID handling', :get, '/api/reports/client'

    it "does not return report for another user's client" do
      res = ApiClient.get("/api/reports/client/#{@client_id}", email: TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(404)
    end
  end

  describe 'GET /api/reports/export/csv/:clientId' do
    it 'exports CSV file' do
      res = ApiClient.raw_get("/api/reports/export/csv/#{@client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.headers['content-type']).to match(/text\/csv|application\/octet-stream/)
      expect(res.body).to include('Date')
      expect(res.body).to include('Hours')
    end

    include_examples 'invalid ID handling', :get, '/api/reports/export/csv'
  end

  describe 'GET /api/reports/export/pdf/:clientId' do
    it 'exports PDF file' do
      res = ApiClient.raw_get("/api/reports/export/pdf/#{@client_id}", email: TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.headers['content-type']).to eq('application/pdf')
      expect(res.headers['content-disposition']).to match(/attachment.*\.pdf/)
      expect(res.body.length).to be > 0
    end

    include_examples 'invalid ID handling', :get, '/api/reports/export/pdf'
  end
end
