import Foundation

struct Client: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var description: String?
    var department: String?
    var email: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, department, email
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct WorkEntry: Codable, Identifiable, Hashable {
    let id: Int
    var clientId: Int
    var hours: Double
    var description: String?
    var date: String
    var clientName: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, hours, description, date
        case clientId = "client_id"
        case clientName = "client_name"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var dateValue: Date? {
        DateParsing.parse(date)
    }
}

struct ReportEntry: Codable, Identifiable, Hashable {
    let id: Int
    let hours: Double
    let description: String?
    let date: String
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, hours, description, date
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ClientReport: Codable {
    struct ReportClient: Codable {
        let id: Int
        let name: String
    }
    let client: ReportClient
    let workEntries: [ReportEntry]
    let totalHours: Double
    let entryCount: Int
}

struct User: Codable {
    let email: String
    let createdAt: String?
}

// MARK: - API envelopes

struct LoginResponse: Codable {
    let message: String
    let user: User
}

struct ClientsResponse: Codable { let clients: [Client] }
struct ClientResponse: Codable { let client: Client }
struct WorkEntriesResponse: Codable { let workEntries: [WorkEntry] }
struct WorkEntryResponse: Codable { let workEntry: WorkEntry }
struct APIErrorResponse: Codable { let error: String }

// MARK: - Request payloads

struct ClientPayload: Codable {
    var name: String
    var description: String?
    var department: String?
    var email: String?
}

struct WorkEntryPayload: Codable {
    var clientId: Int
    var hours: Double
    var description: String?
    var date: String
}

enum DateParsing {
    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    static func parse(_ raw: String) -> Date? {
        if let d = dayFormatter.date(from: String(raw.prefix(10))) {
            return d
        }
        return ISO8601DateFormatter().date(from: raw)
    }

    static func displayString(_ raw: String) -> String {
        guard let d = parse(raw) else { return raw }
        return d.formatted(date: .abbreviated, time: .omitted)
    }
}
