import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @State private var email = ""
    @State private var serverURL = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showServerField = false

    private var isValidEmail: Bool {
        email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 8) {
                    Image(systemName: "clock.badge.checkmark.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(.tint)
                    Text("Timesheet")
                        .font(.largeTitle.bold())
                    Text("Track your hours across clients")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 16) {
                    TextField("Email address", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    if showServerField {
                        TextField("Server URL", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button {
                        Task { await login() }
                    } label: {
                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isValidEmail || isLoading)

                    Button(showServerField ? "Hide server settings" : "Server settings") {
                        withAnimation { showServerField.toggle() }
                    }
                    .font(.footnote)
                }
                .padding(.horizontal, 32)

                Spacer()
                Spacer()
            }
            .onAppear { serverURL = appState.serverURL }
        }
    }

    private func login() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        if !serverURL.isEmpty {
            appState.serverURL = serverURL
        }

        do {
            let user = try await APIClient.shared.login(email: email.trimmingCharacters(in: .whitespaces))
            appState.userEmail = user.email
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
