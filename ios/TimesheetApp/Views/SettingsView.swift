import SwiftUI

struct SettingsView: View {
    @ObservedObject var session: SessionStore
    @State private var serverURL: String
    @State private var showingSignOutConfirmation = false

    init(session: SessionStore) {
        self.session = session
        _serverURL = State(initialValue: session.baseURLString)
    }

    var body: some View {
        Form {
            Section("Account") {
                LabeledContent("Signed-in email", value: session.email)
            }
            Section("Server") {
                TextField("Server URL", text: $serverURL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Save server URL") {
                    session.updateBaseURL(serverURL)
                }
            }
            Section {
                Button("Sign out", role: .destructive) {
                    showingSignOutConfirmation = true
                }
            }
        }
        .navigationTitle("Settings")
        .confirmationDialog("Sign out of Timesheet?", isPresented: $showingSignOutConfirmation) {
            Button("Sign out", role: .destructive) { session.signOut() }
        }
    }
}
