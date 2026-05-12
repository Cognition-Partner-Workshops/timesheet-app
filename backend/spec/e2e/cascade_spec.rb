# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'Cascade delete - deleting client removes its work entries' do
  it 'work entries are removed when client is deleted' do
    email = 'ruby-cascade-test@example.com'
    login(email)

    cid = create_client('Cascade Client', email)
    create_work_entry(cid, 2, '2025-03-01', nil, email)

    before_res = authed_get('/api/work-entries', email)
    expect(before_res.body['workEntries'].length).to eq(1)

    authed_delete("/api/clients/#{cid}", email)

    after_res = authed_get('/api/work-entries', email)
    expect(after_res.body['workEntries'].length).to eq(0)
  end
end

RSpec.describe 'Unknown routes' do
  it 'returns 404 for unknown routes' do
    res = ApiClient.get('/api/nonexistent')
    expect(res.status).to eq(404)
    expect(res.body['error']).to eq('Route not found')
  end
end
