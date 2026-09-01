import Foundation

actor LiveAPIClient: APIClient {
    let baseURL: URL
    private let emailProvider: @Sendable () -> String?
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(baseURL: URL, emailProvider: @escaping @Sendable () -> String?, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.emailProvider = emailProvider
        self.session = session
    }

    func login(email: String) async throws -> User {
        try await send(path: "/api/auth/login", method: "POST", body: LoginPayload(email: email), response: LoginResponse.self).user
    }

    func currentUser() async throws -> User {
        try await send(path: "/api/auth/me", response: UserResponse.self).user
    }

    func clients() async throws -> [Client] {
        try await send(path: "/api/clients", response: ClientsResponse.self).clients
    }

    func createClient(_ payload: ClientPayload) async throws -> Client {
        try await send(path: "/api/clients", method: "POST", body: payload, response: ClientResponse.self).client
    }

    func updateClient(id: Int, payload: ClientPayload) async throws -> Client {
        try await send(path: "/api/clients/\(id)", method: "PUT", body: payload, response: ClientResponse.self).client
    }

    func deleteClient(id: Int) async throws {
        _ = try await send(path: "/api/clients/\(id)", method: "DELETE", response: EmptyResponse.self)
    }

    func workEntries(clientId: Int?) async throws -> [WorkEntry] {
        var path = "/api/work-entries"
        if let clientId {
            path += "?clientId=\(clientId)"
        }
        return try await send(path: path, response: WorkEntriesResponse.self).workEntries
    }

    func createWorkEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry {
        try await send(path: "/api/work-entries", method: "POST", body: payload, response: WorkEntryResponse.self).workEntry
    }

    func updateWorkEntry(id: Int, payload: WorkEntryPayload) async throws -> WorkEntry {
        try await send(path: "/api/work-entries/\(id)", method: "PUT", body: payload, response: WorkEntryResponse.self).workEntry
    }

    func deleteWorkEntry(id: Int) async throws {
        _ = try await send(path: "/api/work-entries/\(id)", method: "DELETE", response: EmptyResponse.self)
    }

    func report(clientId: Int) async throws -> ClientReport {
        try await send(path: "/api/reports/client/\(clientId)", response: ClientReport.self)
    }

    func exportFile(clientId: Int, format: ExportFormat) async throws -> URL {
        let request = try makeRequest(path: "/api/reports/export/\(format.rawValue)/\(clientId)", method: "GET", body: nil)
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
        try validate(response: response, data: data)
        let extensionName = format.rawValue
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("timesheet-\(clientId)-\(UUID().uuidString).\(extensionName)")
        do {
            try data.write(to: fileURL, options: .atomic)
        } catch {
            throw APIError.transport(error)
        }
        return fileURL
    }

    private func send<T: Decodable, Body: Encodable>(
        path: String, method: String = "GET", body: Body? = nil, response: T.Type
    ) async throws -> T {
        let bodyData = try body.map { try encoder.encode($0) }
        let request = try makeRequest(path: path, method: method, body: bodyData)
        let data: Data
        let urlResponse: URLResponse
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
        try validate(response: urlResponse, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func send<T: Decodable>(
        path: String, method: String = "GET", response: T.Type
    ) async throws -> T {
        let request = try makeRequest(path: path, method: method, body: nil)
        let data: Data
        let urlResponse: URLResponse
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
        try validate(response: urlResponse, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func makeRequest(path: String, method: String, body: Data?) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let email = emailProvider(), !email.isEmpty {
            request.setValue(email, forHTTPHeaderField: "x-user-email")
        }
        request.httpBody = body
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.transport(NSError(domain: "TimesheetApp", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Invalid server response."
            ]))
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            switch httpResponse.statusCode {
            case 401: throw APIError.unauthorized
            case 404: throw APIError.notFound
            case 429: throw APIError.rateLimited
            default:
                let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data).error) ?? "The server returned HTTP \(httpResponse.statusCode)."
                throw APIError.server(message)
            }
        }
    }

    private struct LoginPayload: Encodable { let email: String }
    private struct UserResponse: Decodable { let user: User }
    private struct LoginResponse: Decodable { let user: User }
    private struct ClientsResponse: Decodable { let clients: [Client] }
    private struct ClientResponse: Decodable { let client: Client }
    private struct WorkEntriesResponse: Decodable { let workEntries: [WorkEntry] }
    private struct WorkEntryResponse: Decodable { let workEntry: WorkEntry }
    private struct ErrorResponse: Decodable { let error: String }
    private struct EmptyResponse: Decodable {}
}
