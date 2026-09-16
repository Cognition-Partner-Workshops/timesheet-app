import Foundation

/// Thin, value-typed HTTP client for the timesheet backend.
///
/// The backend identifies users through the `x-user-email` header; there is
/// no token exchange. Create a new client whenever the base URL or signed-in
/// email changes (see `SessionStore.api`).
struct APIClient: Sendable {
    enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case delete = "DELETE"
    }

    static let userEmailHeader = "x-user-email"

    let baseURL: URL
    let userEmail: String?
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL, userEmail: String?, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.userEmail = userEmail
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: Auth

    func login(email: String) async throws -> User {
        struct Body: Encodable { let email: String }
        let response: LoginResponse = try await request(.post, "/api/auth/login", body: Body(email: email), authenticated: false)
        return response.user
    }

    func currentUser() async throws -> User {
        let response: UserResponse = try await request(.get, "/api/auth/me")
        return response.user
    }

    func health() async throws -> Bool {
        struct Health: Decodable { let status: String }
        let response: Health = try await request(.get, "/health", authenticated: false)
        return response.status == "OK"
    }

    // MARK: Clients

    func clients() async throws -> [Client] {
        let response: ClientsResponse = try await request(.get, "/api/clients")
        return response.clients
    }

    func client(id: Int) async throws -> Client {
        let response: ClientResponse = try await request(.get, "/api/clients/\(id)")
        return response.client
    }

    func createClient(_ payload: ClientPayload) async throws -> Client {
        let response: ClientResponse = try await request(.post, "/api/clients", body: payload)
        return response.client
    }

    func updateClient(id: Int, _ payload: ClientPayload) async throws -> Client {
        let response: ClientResponse = try await request(.put, "/api/clients/\(id)", body: payload)
        return response.client
    }

    func deleteClient(id: Int) async throws {
        let _: MessageResponse = try await request(.delete, "/api/clients/\(id)")
    }

    // MARK: Work entries

    func workEntries(clientId: Int? = nil) async throws -> [WorkEntry] {
        var query: [URLQueryItem] = []
        if let clientId {
            query.append(URLQueryItem(name: "clientId", value: String(clientId)))
        }
        let response: WorkEntriesResponse = try await request(.get, "/api/work-entries", query: query)
        return response.workEntries
    }

    func createWorkEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry {
        let response: WorkEntryResponse = try await request(.post, "/api/work-entries", body: payload)
        return response.workEntry
    }

    func updateWorkEntry(id: Int, _ payload: WorkEntryPayload) async throws -> WorkEntry {
        let response: WorkEntryResponse = try await request(.put, "/api/work-entries/\(id)", body: payload)
        return response.workEntry
    }

    func deleteWorkEntry(id: Int) async throws {
        let _: MessageResponse = try await request(.delete, "/api/work-entries/\(id)")
    }

    // MARK: Reports

    func report(clientId: Int) async throws -> ClientReport {
        try await request(.get, "/api/reports/client/\(clientId)")
    }

    /// Downloads an exported report and returns the raw file bytes.
    func exportReport(clientId: Int, format: ExportFormat) async throws -> Data {
        let (data, _) = try await send(.get, "/api/reports/export/\(format.rawValue)/\(clientId)", query: [], body: nil, authenticated: true)
        return data
    }

    // MARK: Plumbing

    private func request<Response: Decodable>(
        _ method: Method,
        _ path: String,
        query: [URLQueryItem] = [],
        body: (any Encodable & Sendable)? = nil,
        authenticated: Bool = true
    ) async throws -> Response {
        let (data, _) = try await send(method, path, query: query, body: body, authenticated: authenticated)
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private func send(
        _ method: Method,
        _ path: String,
        query: [URLQueryItem],
        body: (any Encodable & Sendable)?,
        authenticated: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.path = (components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path) + path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw APIError.invalidURL }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.timeoutInterval = 15
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        if authenticated {
            guard let userEmail, !userEmail.isEmpty else { throw APIError.unauthorized }
            urlRequest.setValue(userEmail, forHTTPHeaderField: Self.userEmailHeader)
        }
        if let body {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch let urlError as URLError {
            throw APIError.transport(Self.describe(urlError))
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("The server returned a non-HTTP response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw Self.mapFailure(status: http.statusCode, data: data, decoder: decoder)
        }
        return (data, http)
    }

    private static func mapFailure(status: Int, data: Data, decoder: JSONDecoder) -> APIError {
        let envelope = try? decoder.decode(ErrorEnvelope.self, from: data)
        let message = envelope?.error ?? envelope?.message ?? HTTPURLResponse.localizedString(forStatusCode: status).capitalized
        switch status {
        case 401: return .unauthorized
        case 404: return .notFound(message)
        case 400, 422: return .validation(message, details: envelope?.details ?? [])
        case 429: return .rateLimited
        default: return .server(status: status, message: message)
        }
    }

    private static func describe(_ error: URLError) -> String {
        switch error.code {
        case .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed:
            "Can't reach the server. Check the server address in Settings and make sure the backend is running."
        case .notConnectedToInternet, .networkConnectionLost:
            "You appear to be offline."
        case .timedOut:
            "The server took too long to respond."
        default:
            error.localizedDescription
        }
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        encodeClosure = { encoder in try value.encode(to: encoder) }
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
