import SwiftUI

struct ClientFormView: View {
    enum Mode: Identifiable {
        case create
        case edit(Client)

        var id: String {
            switch self {
            case .create: "create"
            case .edit(let client): "edit-\(client.id)"
            }
        }
    }

    let mode: Mode
    var onSaved: ((Client) -> Void)? = nil

    @Environment(TimesheetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var department = ""
    @State private var email = ""
    @State private var description = ""
    @State private var isSaving = false
    @State private var error: PresentableError?
    @FocusState private var focusedField: Field?

    private enum Field { case name, department, email, description }

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var emailIsValid: Bool {
        let value = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty || SessionStore.looksLikeEmail(value)
    }

    private var canSave: Bool {
        !isSaving && !trimmedName.isEmpty && trimmedName.count <= 255 && emailIsValid && description.count <= 1000
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                        .textContentType(.organizationName)
                        .focused($focusedField, equals: .name)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .department }
                        .accessibilityIdentifier("clientForm.name")
                    TextField("Department (optional)", text: $department)
                        .focused($focusedField, equals: .department)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .email }
                        .accessibilityIdentifier("clientForm.department")
                    TextField("Contact email (optional)", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .description }
                        .accessibilityIdentifier("clientForm.email")
                } footer: {
                    if !emailIsValid {
                        Text("Enter a valid email address or leave it blank.").foregroundStyle(.red)
                    }
                }

                Section("Notes") {
                    TextField("What do you do for this client?", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                        .focused($focusedField, equals: .description)
                        .accessibilityIdentifier("clientForm.description")
                }
            }
            .navigationTitle(isEditing ? "Edit Client" : "New Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if isSaving { ProgressView() } else { Text(isEditing ? "Save" : "Create").fontWeight(.semibold) }
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("clientForm.save")
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear(perform: populate)
            .errorAlert($error)
        }
    }

    private func populate() {
        if case .edit(let client) = mode {
            name = client.name
            department = client.department ?? ""
            email = client.email ?? ""
            description = client.description ?? ""
        } else {
            focusedField = .name
        }
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        let payload = ClientPayload(name: name, description: description, department: department, email: email)
        Task {
            defer { isSaving = false }
            do {
                let saved: Client
                switch mode {
                case .create:
                    saved = try await store.createClient(payload)
                case .edit(let client):
                    saved = try await store.updateClient(id: client.id, payload)
                }
                onSaved?(saved)
                dismiss()
            } catch {
                self.error = PresentableError(error, title: isEditing ? "Couldn't update client" : "Couldn't create client")
            }
        }
    }
}
