import SwiftUI

struct ClientFormView: View {
    @Environment(\.dismiss) private var dismiss

    var client: Client?
    var onSave: (Client) -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var department = ""
    @State private var email = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(client: Client? = nil, onSave: @escaping (Client) -> Void) {
        self.client = client
        self.onSave = onSave
        _name = State(initialValue: client?.name ?? "")
        _description = State(initialValue: client?.description ?? "")
        _department = State(initialValue: client?.department ?? "")
        _email = State(initialValue: client?.email ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Client Details") {
                    TextField("Name (required)", text: $name)
                    TextField("Department", text: $department)
                    TextField("Contact email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section("Description") {
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(client == nil ? "New Client" : "Edit Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let payload = ClientPayload(
            name: name.trimmingCharacters(in: .whitespaces),
            description: description,
            department: department,
            email: email.isEmpty ? nil : email
        )

        do {
            let saved: Client
            if let client {
                saved = try await APIClient.shared.updateClient(id: client.id, payload: payload)
            } else {
                saved = try await APIClient.shared.createClient(payload)
            }
            onSave(saved)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
