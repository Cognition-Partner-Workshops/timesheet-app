# frozen_string_literal: true

require 'faraday'
require 'json'

BASE_URL = ENV.fetch('API_BASE_URL', 'http://localhost:3001')

# HTTP client for Cucumber steps
def api_conn
  @api_conn ||= Faraday.new(url: BASE_URL) do |f|
    f.request :json
    f.response :json, content_type: /\bjson$/
    f.adapter Faraday.default_adapter
  end
end

def raw_conn
  @raw_conn ||= Faraday.new(url: BASE_URL) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end
end

# Shared state across steps
Before do
  @res = nil
  @client_id = nil
  @entry_id = nil
end

# Server management
require_relative '../../spec/e2e/support/server_manager'

at_exit { ServerManager.stop }
ServerManager.start
