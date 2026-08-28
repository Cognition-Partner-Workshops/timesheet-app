# frozen_string_literal: true

require 'faraday'
require 'json'

# Shared HTTP client for E2E API tests
module ApiClient
  BASE_URL = ENV.fetch('API_BASE_URL', 'http://localhost:3001')

  def self.conn
    @conn ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json, content_type: /\bjson$/
      f.adapter Faraday.default_adapter
    end
  end

  def self.raw_conn
    @raw_conn ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.adapter Faraday.default_adapter
    end
  end

  def self.get(path, email: nil)
    conn.get(path) do |req|
      req.headers['x-user-email'] = email if email
    end
  end

  def self.post(path, body: {}, email: nil)
    conn.post(path) do |req|
      req.headers['x-user-email'] = email if email
      req.body = body
    end
  end

  def self.put(path, body: {}, email: nil)
    conn.put(path) do |req|
      req.headers['x-user-email'] = email if email
      req.body = body
    end
  end

  def self.delete(path, email: nil)
    conn.delete(path) do |req|
      req.headers['x-user-email'] = email if email
    end
  end

  def self.raw_get(path, email: nil)
    raw_conn.get(path) do |req|
      req.headers['x-user-email'] = email if email
    end
  end

  def self.login(email)
    post('/api/auth/login', body: { email: email })
  end

  def self.reset!
    @conn = nil
    @raw_conn = nil
  end
end
