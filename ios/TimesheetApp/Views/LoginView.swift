import SwiftUI

struct LoginView: View {
    @ObservedObject var session: SessionStore
    @State private var email: String
    @State private var serverURL: String
    @State private var showAdvanced = false

    init(session: SessionStore) {
        self.session = session
        _email = State(initialValue: session.email)
        _serverURL = State(initialValue: session.baseURLString)
    }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var emailIsValid: Bool {
        SessionStore.isValidEmail(trimmedEmail)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "clock.badge.checkmark")
                    .font(.system(size: 64))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)
                VStack(spacing: 8) {
                    Text("Timesheet")
                        .font(.largeTitle.bold())
                    Text("Track your work, wherever you are.")
                        .foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.emailAddress)
                        .textFieldStyle(.roundedBorder)
                    if !trimmedEmail.isEmpty && !emailIsValid {
                        Text("Enter a valid email address.")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                DisclosureGroup("Advanced", isExpanded: $showAdvanced) {
                    TextField("Server URL", text: $serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                        .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let error = session.errorMessage {
                    ErrorBanner(message: error)
                        .padding(.horizontal, -16)
                }
                Button {
                    session.updateBaseURL(serverURL)
                    Task { await session.signIn(email: email) }
                } label: {
                    Group {
                        if session.isSigningIn {
                            ProgressView().tint(.white)
                        } else {
                            Text("Sign in")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(trimmedEmail.isEmpty || !emailIsValid || session.isSigningIn)
                Spacer()
            }
            .padding(24)
            .navigationBarHidden(true)
        }
    }
}
