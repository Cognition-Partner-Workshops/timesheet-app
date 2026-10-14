import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case server(String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL. Check Settings."
        case .server(let message): return message
        case .decoding: return "Unexpected response from server."
        case .transport(let error): return error.localizedDescription
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }()

    var baseURLString: String {
        UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3001"
    }

    var userEmail: String? {
        UserDefaults.standard.string(forKey: "userEmail")
    }

    // MARK: - Auth

    func login(email: String) async throws -> User {
        let body = try JSONEncoder().encode(["email": email])
        let response: LoginResponse = try await request("api/auth/login", method: "POST", body: body, authenticated: false)
        return response.user
    }

    // MARK: - Clients

    func fetchClients() async throws -> [Client] {
        let response: ClientsResponse = try await request("api/clients")
        return response.clients
    }

    func createClient(_ payload: ClientPayload) async throws -> Client {
        let body = try JSONEncoder().encode(payload)
        let response: ClientResponse = try await request("api/clients", method: "POST", body: body)
        return response.client
    }

    func updateClient(id: Int, payload: ClientPayload) async throws -> Client {
        let body = try JSONEncoder().encode(payload)
        let response: ClientResponse = try await request("api/clients/\(id)", method: "PUT", body: body)
        return response.client
    }

    func deleteClient(id: Int) async throws {
        let _: MessageResponse = try await request("api/clients/\(id)", method: "DELETE")
    }

    // MARK: - Work entries

    func fetchWorkEntries(clientId: Int? = nil) async throws -> [WorkEntry] {
        var path = "api/work-entries"
        if let clientId { path += "?clientId=\(clientId)" }
        let response: WorkEntriesResponse = try await request(path)
        return response.workEntries
    }

    func createWorkEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry {
        let body = try JSONEncoder().encode(payload)
        let response: WorkEntryResponse = try await request("api/work-entries", method: "POST", body: body)
        return response.workEntry
    }

    func updateWorkEntry(id: Int, payload: WorkEntryPayload) async throws -> WorkEntry {
        let body = try JSONEncoder().encode(payload)
        let response: WorkEntryResponse = try await request("api/work-entries/\(id)", method: "PUT", body: body)
        return response.workEntry
    }

    func deleteWorkEntry(id: Int) async throws {
        let _: MessageResponse = try await request("api/work-entries/\(id)", method: "DELETE")
    }

    // MARK: - Reports

    func fetchClientReport(clientId: Int) async throws -> ClientReport {
        try await request("api/reports/client/\(clientId)")
    }

    func downloadReport(clientId: Int, format: String) async throws -> URL {
        let trimmedBase = baseURLString.hasSuffix("/") ? String(baseURLString.dropLast()) : baseURLString
        guard let url = URL(string: "\(trimmedBase)/api/reports/export/\(format)/\(clientId)") else {
            throw APIError.invalidURL
        }
        var urlRequest = URLRequest(url: url)
        if let userEmail { urlRequest.setValue(userEmail, forHTTPHeaderField: "x-user-email") }

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.server("Failed to export report.")
        }

        let ext = format == "pdf" ? "pdf" : "csv"
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("client-\(clientId)-report")
            .appendingPathExtension(ext)
        try data.write(to: fileURL)
        return fileURL
    }

    // MARK: - Core

    private struct MessageResponse: Codable { let message: String }

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Data? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        let trimmedBase = baseURLString.hasSuffix("/") ? String(baseURLString.dropLast()) : baseURLString
        guard let url = URL(string: "\(trimmedBase)/\(path)") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authenticated, let userEmail {
            urlRequest.setValue(userEmail, forHTTPHeaderField: "x-user-email")
        }
        urlRequest.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.server("Invalid response from server.")
        }

        guard (200..<300).contains(http.statusCode) else {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIError.server(apiError.error)
            }
            throw APIError.server("Request failed (HTTP \(http.statusCode)).")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
