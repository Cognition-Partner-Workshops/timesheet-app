# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'DELETE /api/clients (bulk delete)' do
  let(:email) { 'ruby-bulk-delete@example.com' }

  before do
    login(email)
    authed_post('/api/clients', { name: 'Bulk A' }, email)
    authed_post('/api/clients', { name: 'Bulk B' }, email)
  end

  it 'deletes all clients for the user' do
    res = authed_delete('/api/clients', email)
    expect(res.status).to eq(200)
    expect(res.body['message']).to eq('All clients deleted successfully')
    expect(res.body['deletedCount']).to eq(2)

    list = authed_get('/api/clients', email)
    expect(list.body['clients']).to eq([])
  end
end
