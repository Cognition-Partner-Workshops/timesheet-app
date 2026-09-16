import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session

    @State private var email = ""
    @State private var isSigningIn = false
    @State private var error: PresentableError?
    @State private var showsSettings = false
    @FocusState private var emailFocused: Bool

    private var canSubmit: Bool {
        !isSigningIn && SessionStore.looksLikeEmail(email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    header
                    form
                }
                .padding(.horizontal, 24)
                .padding(.top, 48)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(backgroundGradient.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsSettings = true
                    } label: {
                        Label("Server settings", systemImage: "gearshape")
                    }
                    .accessibilityIdentifier("login.settings")
                }
            }
            .sheet(isPresented: $showsSettings) {
                NavigationStack { SettingsView(showsAccountSection: false) }
            }
            .errorAlert($error)
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock.badge.checkmark.fill")
                .font(.system(size: 64))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(Color.accentColor)
                .accessibilityHidden(true)
            Text("Timesheet")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
            Text("Track hours across your clients, then export reports in a tap.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private var form: some View {
        VStack(spacing: 16) {
            TextField("you@company.com", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .focused($emailFocused)
                .onSubmit { if canSubmit { signIn() } }
                .padding()
                .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(emailFocused ? Color.accentColor : Color.secondary.opacity(0.25), lineWidth: 1.5)
                )
                .accessibilityIdentifier("login.email")

            Button(action: signIn) {
                Group {
                    if isSigningIn {
                        ProgressView().tint(.white)
                    } else {
                        Text("Continue")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 24)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!canSubmit)
            .accessibilityIdentifier("login.continue")

            VStack(spacing: 4) {
                Text("No password needed. Your email is your workspace; a new one is created on first sign-in.")
                Text("Server: \(session.baseURL.absoluteString)")
                    .font(.caption2.monospaced())
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
        .onAppear { emailFocused = true }
    }

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [Color.accentColor.opacity(0.18), Color(.systemGroupedBackground)],
            startPoint: .top,
            endPoint: .center
        )
    }

    private func signIn() {
        guard canSubmit else { return }
        isSigningIn = true
        Task {
            defer { isSigningIn = false }
            do {
                _ = try await session.signIn(email: email)
            } catch {
                self.error = PresentableError(error, title: "Couldn't sign in")
            }
        }
    }
}

#Preview {
    LoginView()
        .environment(SessionStore())
}
