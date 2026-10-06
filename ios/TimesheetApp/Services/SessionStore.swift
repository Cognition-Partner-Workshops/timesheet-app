import Foundation
import Observation

/// Holds the signed-in identity and server address, persisted across launches.
///
/// The email lives in the Keychain; the server URL lives in `UserDefaults`.
/// Every change produces a fresh `APIClient` value so callers never hold a
/// stale identity.
@MainActor
@Observable
final class SessionStore {
    static let defaultBaseURL = URL(string: "http://localhost:3001")!

    private enum Keys {
        static let email = "signedInEmail"
        static let baseURL = "apiBaseURL"
    }

    private(set) var email: String?
    private(set) var baseURL: URL

    private let keychain: KeychainStore
    private let defaults: UserDefaults
    private let urlSession: URLSession

    init(
        keychain: KeychainStore = KeychainStore(),
        defaults: UserDefaults = .standard,
        urlSession: URLSession = .shared
    ) {
        self.keychain = keychain
        self.defaults = defaults
        self.urlSession = urlSession
        self.email = keychain.string(for: Keys.email)
        if let stored = defaults.string(forKey: Keys.baseURL), let url = URL(string: stored) {
            self.baseURL = url
        } else {
            self.baseURL = Self.defaultBaseURL
        }
    }

    var isSignedIn: Bool { email != nil }

    var api: APIClient {
        APIClient(baseURL: baseURL, userEmail: email, session: urlSession)
    }

    func signIn(email: String) async throws -> User {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Self.looksLikeEmail(normalized) else {
            throw APIError.validation("Enter a valid email address.", details: [])
        }
        let user = try await APIClient(baseURL: baseURL, userEmail: nil, session: urlSession).login(email: normalized)
        keychain.set(user.email, for: Keys.email)
        self.email = user.email
        return user
    }

    func signOut() {
        keychain.remove(Keys.email)
        email = nil
    }

    func updateBaseURL(_ raw: String) throws {
        var trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            trimmed = Self.defaultBaseURL.absoluteString
        }
        if !trimmed.contains("://") {
            trimmed = "http://" + trimmed
        }
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme), url.host() != nil else {
            throw APIError.invalidURL
        }
        defaults.set(url.absoluteString, forKey: Keys.baseURL)
        baseURL = url
    }

    static func looksLikeEmail(_ value: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return value.range(of: pattern, options: .regularExpression) != nil
    }
}
