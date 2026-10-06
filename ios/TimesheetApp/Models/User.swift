import Foundation

struct User: Codable, Hashable, Sendable {
    let email: String
    let createdAt: String?
}

struct LoginResponse: Decodable, Sendable {
    let message: String
    let user: User
}

struct MessageResponse: Decodable, Sendable {
    let message: String
}

struct ClientsResponse: Decodable, Sendable {
    let clients: [Client]
}

struct ClientResponse: Decodable, Sendable {
    let client: Client
}

struct WorkEntriesResponse: Decodable, Sendable {
    let workEntries: [WorkEntry]
}

struct WorkEntryResponse: Decodable, Sendable {
    let workEntry: WorkEntry
}

struct UserResponse: Decodable, Sendable {
    let user: User
}
