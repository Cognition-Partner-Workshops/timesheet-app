import SwiftUI

struct SettingsView: View {
    var showsAccountSection = true

    @Environment(SessionStore.self) private var session
    @Environment(TimesheetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var serverURL = ""
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var error: PresentableError?
    @State private var confirmSignOut = false

    enum ConnectionStatus: Equatable {
        case unknown, checking, reachable, unreachable(String)
    }

    var body: some View {
        Form {
            Section {
                TextField("http://localhost:3001", text: $serverURL)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityIdentifier("settings.serverURL")
                Button("Save & Test Connection") { saveAndTest() }
                    .disabled(connectionStatus == .checking)
                    .accessibilityIdentifier("settings.save")
                statusRow
            } header: {
                Text("Server")
            } footer: {
                Text("Address of the timesheet backend. The Simulator can reach a backend on this Mac at http://localhost:3001; a physical device needs your Mac's LAN address.")
            }

            if showsAccountSection {
                Section("Account") {
                    LabeledContent("Signed in as", value: session.email ?? "—")
                    if let refreshed = store.lastRefreshed {
                        LabeledContent("Last synced", value: refreshed.formatted(.relative(presentation: .named)))
                    }
                    Button("Sign Out", role: .destructive) { confirmSignOut = true }
                        .accessibilityIdentifier("settings.signOut")
                }
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.shortVersion)
                LabeledContent("Backend", value: "timesheet-app API")
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .onAppear { serverURL = session.baseURL.absoluteString }
        .confirmationDialog("Sign out of \(session.email ?? "this account")?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) {
                session.signOut()
                dismiss()
            }
        } message: {
            Text("Your data stays on the server. Sign back in with the same email to see it again.")
        }
        .errorAlert($error)
    }

    @ViewBuilder
    private var statusRow: some View {
        switch connectionStatus {
        case .unknown:
            EmptyView()
        case .checking:
            HStack { ProgressView(); Text("Checking…").foregroundStyle(.secondary) }
        case .reachable:
            Label("Connected", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
        case .unreachable(let message):
            Label(message, systemImage: "xmark.octagon.fill").foregroundStyle(.red)
        }
    }

    private func saveAndTest() {
        do {
            try session.updateBaseURL(serverURL)
            serverURL = session.baseURL.absoluteString
        } catch {
            self.error = PresentableError(error, title: "Invalid server address")
            return
        }
        connectionStatus = .checking
        let api = session.api
        Task {
            do {
                let ok = try await api.health()
                connectionStatus = ok ? .reachable : .unreachable("Server responded but is not healthy.")
            } catch {
                connectionStatus = .unreachable((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }
}

extension Bundle {
    var shortVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
