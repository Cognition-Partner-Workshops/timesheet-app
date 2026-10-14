# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe 'Auth - /api/auth' do
  describe 'POST /api/auth/login' do
    it 'creates a new user on first login' do
      res = login(TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(201)
      expect(res.body['message']).to eq('User created and logged in successfully')
      expect(res.body['user']['email']).to eq(TestHelpers::TEST_EMAIL)
      expect(res.body['user']['createdAt']).not_to be_nil
    end

    it 'logs in existing user' do
      res = login(TestHelpers::TEST_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['message']).to eq('Login successful')
      expect(res.body['user']['email']).to eq(TestHelpers::TEST_EMAIL)
    end

    it 'returns 400 for invalid email format' do
      res = ApiClient.post('/api/auth/login', body: { email: 'not-an-email' })
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Validation error')
    end

    it 'returns 400 for missing email' do
      res = ApiClient.post('/api/auth/login', body: {})
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Validation error')
    end
  end

  describe 'GET /api/auth/me' do
    it 'returns current user info' do
      res = authed_get('/api/auth/me')
      expect(res.status).to eq(200)
      expect(res.body['user']['email']).to eq(TestHelpers::TEST_EMAIL)
      expect(res.body['user']['createdAt']).not_to be_nil
    end

    it 'returns 401 without x-user-email header' do
      res = ApiClient.get('/api/auth/me')
      expect(res.status).to eq(401)
      expect(res.body['error']).to eq('User email required in x-user-email header')
    end

    it 'returns 400 for invalid email in header' do
      res = authed_get('/api/auth/me', 'bad-email')
      expect(res.status).to eq(400)
      expect(res.body['error']).to eq('Invalid email format')
    end

    it 'auto-provisions a new user via auth middleware' do
      res = authed_get('/api/auth/me', TestHelpers::OTHER_EMAIL)
      expect(res.status).to eq(200)
      expect(res.body['user']['email']).to eq(TestHelpers::OTHER_EMAIL)
    end
  end
end
