import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @AppStorage("userEmail") var userEmail: String = ""
    @AppStorage("serverURL") var serverURL: String = "http://localhost:3001"

    var isLoggedIn: Bool { !userEmail.isEmpty }

    func logout() {
        userEmail = ""
    }
}
