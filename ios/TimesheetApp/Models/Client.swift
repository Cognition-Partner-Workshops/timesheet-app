import Foundation

struct Client: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var name: String
    var description: String?
    var department: String?
    var email: String?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, department, email
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var initials: String {
        let words = name.split(separator: " ").prefix(2)
        let letters = words.compactMap { $0.first }.map(String.init)
        return letters.joined().uppercased()
    }
}

struct ClientPayload: Encodable, Equatable, Sendable {
    var name: String
    var description: String?
    var department: String?
    var email: String?

    init(name: String, description: String? = nil, department: String? = nil, email: String? = nil) {
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        self.description = Self.normalize(description)
        self.department = Self.normalize(department)
        self.email = Self.normalize(email)
    }

    private static func normalize(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }
}
