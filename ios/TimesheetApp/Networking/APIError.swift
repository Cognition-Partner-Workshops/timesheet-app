import Foundation

enum APIError: Error, LocalizedError, Equatable, Sendable {
    case invalidURL
    case unauthorized
    case notFound(String)
    case validation(String, details: [String])
    case rateLimited
    case server(status: Int, message: String)
    case transport(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "The server address is not a valid URL."
        case .unauthorized:
            "Your session is no longer valid. Please sign in again."
        case .notFound(let message):
            message
        case .validation(let message, let details):
            details.isEmpty ? message : details.joined(separator: "\n")
        case .rateLimited:
            "Too many requests. Wait a moment and try again."
        case .server(let status, let message):
            "\(message) (HTTP \(status))"
        case .transport(let message):
            message
        case .decoding(let message):
            "Unexpected response from the server: \(message)"
        }
    }

    var isAuthFailure: Bool {
        if case .unauthorized = self { return true }
        return false
    }
}

struct ErrorEnvelope: Decodable, Sendable {
    let error: String
    let details: [String]?
    let message: String?
}
