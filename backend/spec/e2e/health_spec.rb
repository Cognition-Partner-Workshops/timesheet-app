# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'GET /health' do
  it 'returns 200 with status OK' do
    res = ApiClient.get('/health')
    expect(res.status).to eq(200)
    expect(res.body['status']).to eq('OK')
    expect(res.body['timestamp']).not_to be_nil
  end
end
