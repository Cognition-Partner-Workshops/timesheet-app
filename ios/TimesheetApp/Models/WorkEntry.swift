import Foundation

/// A logged block of hours against a client.
///
/// The backend stores `date` as a Joi-parsed `Date`, which SQLite persists as
/// milliseconds since the epoch. Older rows or other clients may store an ISO
/// `YYYY-MM-DD` string instead, so decoding accepts both representations.
struct WorkEntry: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var clientId: Int?
    var clientName: String?
    var hours: Double
    var description: String?
    var date: Date
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, hours, description, date
        case clientId = "client_id"
        case clientName = "client_name"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(
        id: Int,
        clientId: Int?,
        clientName: String? = nil,
        hours: Double,
        description: String? = nil,
        date: Date,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.clientId = clientId
        self.clientName = clientName
        self.hours = hours
        self.description = description
        self.date = date
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientId = try container.decodeIfPresent(Int.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)

        if let numeric = try? container.decode(Double.self, forKey: .hours) {
            hours = numeric
        } else {
            let raw = try container.decode(String.self, forKey: .hours)
            guard let parsed = Double(raw) else {
                throw DecodingError.dataCorruptedError(forKey: .hours, in: container, debugDescription: "Unparseable hours: \(raw)")
            }
            hours = parsed
        }

        date = try APIDate.decode(from: container, forKey: .date)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(clientId, forKey: .clientId)
        try container.encodeIfPresent(clientName, forKey: .clientName)
        try container.encode(hours, forKey: .hours)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encode(APIDate.dayString(from: date), forKey: .date)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }
}

struct WorkEntryPayload: Encodable, Equatable, Sendable {
    var clientId: Int
    var hours: Double
    var description: String?
    var date: String

    init(clientId: Int, hours: Double, description: String? = nil, date: Date) {
        self.clientId = clientId
        self.hours = (hours * 100).rounded() / 100
        let trimmed = description?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.description = (trimmed?.isEmpty ?? true) ? nil : trimmed
        self.date = APIDate.dayString(from: date)
    }
}

enum APIDate {
    private static let utc = TimeZone(identifier: "UTC")!

    private static var dayStyle: Date.ISO8601FormatStyle {
        Date.ISO8601FormatStyle(timeZone: utc).year().month().day()
    }

    /// Formats a calendar day as `YYYY-MM-DD` using the device's calendar so
    /// the day the user picked is the day that gets stored.
    static func dayString(from date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        guard let year = parts.year, let month = parts.month, let day = parts.day else {
            return dayStyle.format(date)
        }
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// Parses SQLite's `CURRENT_TIMESTAMP` output (`yyyy-MM-dd HH:mm:ss`, UTC)
    /// as well as the day and ISO 8601 forms accepted by `parse`.
    static func parseTimestamp(_ raw: String) -> Date? {
        let normalized = raw.replacingOccurrences(of: " ", with: "T")
        if !normalized.hasSuffix("Z"), let full = try? Date.ISO8601FormatStyle(timeZone: utc).parse(normalized + "Z") {
            return full
        }
        return parse(raw)
    }

    static func parse(_ raw: String) -> Date? {
        if let day = try? dayStyle.parse(raw) {
            return day
        }
        if let full = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(raw) {
            return full
        }
        if let full = try? Date.ISO8601FormatStyle().parse(raw) {
            return full
        }
        if let millis = Double(raw) {
            return Date(timeIntervalSince1970: millis / 1000)
        }
        return nil
    }

    static func decode<K: CodingKey>(from container: KeyedDecodingContainer<K>, forKey key: K) throws -> Date {
        if let millis = try? container.decode(Double.self, forKey: key) {
            return Date(timeIntervalSince1970: millis / 1000)
        }
        let raw = try container.decode(String.self, forKey: key)
        guard let parsed = parse(raw) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: container, debugDescription: "Unrecognised date: \(raw)")
        }
        return parsed
    }
}
