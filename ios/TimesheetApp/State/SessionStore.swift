import Foundation
import SwiftUI

@MainActor
final class SessionStore: ObservableObject {
    @AppStorage("timesheet.userEmail") var email = ""
    @AppStorage("timesheet.baseURL") var baseURLString = "http://localhost:3001"
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?

    @Published private(set) var apiClient: any APIClient

    init(apiClient: (any APIClient)? = nil) {
        self.apiClient = apiClient ?? Self.makeClient(baseURLString: UserDefaults.standard.string(forKey: "timesheet.baseURL") ?? "http://localhost:3001")
    }

    var isSignedIn: Bool { !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    func signIn(email newEmail: String) async {
        let normalized = newEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Self.isValidEmail(normalized) else {
            errorMessage = "Enter a valid email address."
            return
        }
        guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)),
              baseURL.scheme != nil else {
            errorMessage = APIError.invalidURL.localizedDescription
            return
        }
        isSigningIn = true
        errorMessage = nil
        apiClient = Self.makeClient(baseURLString: baseURL.absoluteString)
        do {
            let user = try await apiClient.login(email: normalized)
            email = user.email
        } catch {
            errorMessage = error.localizedDescription
        }
        isSigningIn = false
    }

    func updateBaseURL(_ value: String) {
        baseURLString = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let _ = URL(string: baseURLString) {
            apiClient = Self.makeClient(baseURLString: baseURLString)
        }
    }

    func signOut() {
        email = ""
        errorMessage = nil
    }

    private static func makeClient(baseURLString: String) -> any APIClient {
        let url = URL(string: baseURLString) ?? URL(fileURLWithPath: "/")
        return LiveAPIClient(baseURL: url, emailProvider: {
            UserDefaults.standard.string(forKey: "timesheet.userEmail")
        })
    }

    static func isValidEmail(_ value: String) -> Bool {
        value.contains("@") && value.contains(".") && !value.contains(" ")
    }
}
