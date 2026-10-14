import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var serverURL = ""
    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Signed in as", value: appState.userEmail)
                    Button("Sign Out", role: .destructive) {
                        showLogoutConfirmation = true
                    }
                }

                Section {
                    TextField("Server URL", text: $serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Save Server URL") {
                        appState.serverURL = serverURL.trimmingCharacters(in: .whitespaces)
                    }
                    .disabled(serverURL.trimmingCharacters(in: .whitespaces).isEmpty)
                } header: {
                    Text("Server")
                } footer: {
                    Text("Use http://localhost:3001 when running the backend on this Mac with the iOS Simulator.")
                }

                Section("About") {
                    LabeledContent("App", value: "Timesheet iOS Client")
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }
            }
            .navigationTitle("Settings")
            .onAppear { serverURL = appState.serverURL }
            .confirmationDialog("Sign out of Timesheet?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { appState.logout() }
            }
        }
    }
}
