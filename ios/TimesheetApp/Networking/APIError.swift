import Foundation

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case unauthorized
    case rateLimited
    case notFound
    case server(String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "The server URL is invalid."
        case .unauthorized: return "Your session is not authorized. Please sign in again."
        case .rateLimited: return "Too many requests. Please try again later."
        case .notFound: return "The requested item could not be found."
        case .server(let message): return message
        case .decoding(let error): return "The server returned an unexpected response: \(error.localizedDescription)"
        case .transport(let error): return "Network error: \(error.localizedDescription)"
        }
    }

}
