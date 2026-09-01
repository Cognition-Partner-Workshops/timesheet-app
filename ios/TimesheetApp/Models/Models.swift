import Foundation

enum DateCoding {
    static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func decode(_ value: String) throws -> Date {
        if let date = dateOnlyFormatter.date(from: value) {
            return date
        }
        if let date = isoFormatter.date(from: value) {
            return date
        }
        let fallback = ISO8601DateFormatter()
        if let date = fallback.date(from: value) {
            return date
        }
        throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Invalid date: \(value)"))
    }

    static func encode(_ date: Date) -> String {
        dateOnlyFormatter.string(from: date)
    }
}

struct User: Codable, Identifiable, Hashable, Sendable {
    var id: String { email }
    let email: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case email
        case createdAt = "created_at"
    }
}

struct Client: Codable, Identifiable, Hashable, Sendable {
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

struct ClientPayload: Codable, Hashable, Sendable {
    var name: String?
    var description: String?
    var department: String?
    var email: String?
}

struct WorkEntry: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var clientID: Int?
    var hours: Double
    var description: String?
    var date: Date
    let createdAt: String?
    let updatedAt: String?
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clientID = "client_id"
        case hours, description, date
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case clientName = "client_name"
    }

    init(id: Int, clientID: Int?, hours: Double, description: String?, date: Date,
         createdAt: String? = nil, updatedAt: String? = nil, clientName: String? = nil) {
        self.id = id
        self.clientID = clientID
        self.hours = hours
        self.description = description
        self.date = date
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.clientName = clientName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientID = try container.decodeIfPresent(Int.self, forKey: .clientID)
        hours = try container.decode(Double.self, forKey: .hours)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        let dateValue = try container.decode(String.self, forKey: .date)
        date = try DateCoding.decode(dateValue)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(clientID, forKey: .clientID)
        try container.encode(hours, forKey: .hours)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encode(DateCoding.encode(date), forKey: .date)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(clientName, forKey: .clientName)
    }
}

struct WorkEntryPayload: Codable, Hashable, Sendable {
    var clientID: Int?
    var hours: Double?
    var description: String?
    var date: Date?

    enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case hours, description, date
    }

    init(clientID: Int? = nil, hours: Double? = nil, description: String? = nil, date: Date? = nil) {
        self.clientID = clientID
        self.hours = hours
        self.description = description
        self.date = date
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(clientID, forKey: .clientID)
        try container.encodeIfPresent(hours, forKey: .hours)
        try container.encodeIfPresent(description, forKey: .description)
        if let date {
            try container.encode(DateCoding.encode(date), forKey: .date)
        }
    }
}

struct ClientReport: Codable, Hashable, Sendable {
    let client: ReportClient
    let workEntries: [ReportEntry]
    let totalHours: Double
    let entryCount: Int

    struct ReportClient: Codable, Hashable, Sendable {
        let id: Int
        let name: String
    }

    struct ReportEntry: Codable, Identifiable, Hashable, Sendable {
        let id: Int
        let hours: Double
        let description: String?
        let date: Date
        let createdAt: String?
        let updatedAt: String?

        enum CodingKeys: String, CodingKey {
            case id, hours, description, date
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int.self, forKey: .id)
            hours = try container.decode(Double.self, forKey: .hours)
            description = try container.decodeIfPresent(String.self, forKey: .description)
            date = try DateCoding.decode(container.decode(String.self, forKey: .date))
            createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
            updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        }
    }
}
