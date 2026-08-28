# frozen_string_literal: true

require 'net/http'

# Manages starting/stopping the Node.js backend server for E2E tests
module ServerManager
  SERVER_PORT = ENV.fetch('API_PORT', '3001')
  SERVER_HOST = 'localhost'
  STARTUP_TIMEOUT = 15

  def self.start
    return if server_running?

    @server_pid = spawn(
      { 'PORT' => SERVER_PORT, 'NODE_ENV' => 'test' },
      'node', 'test-server.js',
      chdir: File.expand_path('../../..', __dir__),
      out: '/dev/null',
      err: '/dev/null'
    )
    Process.detach(@server_pid)
    wait_for_server
  end

  def self.stop
    return unless @server_pid

    Process.kill('TERM', @server_pid)
    Process.wait(@server_pid, Process::WNOHANG)
  rescue Errno::ESRCH, Errno::ECHILD
    # Process already exited
  ensure
    @server_pid = nil
  end

  def self.server_running?
    uri = URI("http://#{SERVER_HOST}:#{SERVER_PORT}/health")
    response = Net::HTTP.get_response(uri)
    response.code == '200'
  rescue Errno::ECONNREFUSED, Errno::ECONNRESET, SocketError
    false
  end

  def self.wait_for_server
    STARTUP_TIMEOUT.times do
      return true if server_running?

      sleep 1
    end
    raise "Server failed to start within #{STARTUP_TIMEOUT} seconds"
  end
end
