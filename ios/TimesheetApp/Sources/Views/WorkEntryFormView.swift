import SwiftUI

struct WorkEntryFormView: View {
    @Environment(\.dismiss) private var dismiss

    var entry: WorkEntry?
    var preselectedClientId: Int?
    var onSave: (WorkEntry) -> Void

    @State private var clients: [Client] = []
    @State private var selectedClientId: Int?
    @State private var hoursText = ""
    @State private var description = ""
    @State private var date = Date()
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(entry: WorkEntry? = nil, preselectedClientId: Int? = nil, onSave: @escaping (WorkEntry) -> Void) {
        self.entry = entry
        self.preselectedClientId = preselectedClientId
        self.onSave = onSave
        _selectedClientId = State(initialValue: entry?.clientId ?? preselectedClientId)
        _hoursText = State(initialValue: entry.map { String(format: "%g", $0.hours) } ?? "")
        _description = State(initialValue: entry?.description ?? "")
        _date = State(initialValue: entry?.dateValue ?? Date())
    }

    private var hours: Double? {
        Double(hoursText.replacingOccurrences(of: ",", with: "."))
    }

    private var isValid: Bool {
        guard let hours, hours > 0, hours <= 24, selectedClientId != nil else { return false }
        return true
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry Details") {
                    Picker("Client", selection: $selectedClientId) {
                        Text("Select a client").tag(nil as Int?)
                        ForEach(clients) { client in
                            Text(client.name).tag(client.id as Int?)
                        }
                    }
                    TextField("Hours (0–24)", text: $hoursText)
                        .keyboardType(.decimalPad)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
                Section("Description") {
                    TextField("What did you work on?", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(entry == nil ? "New Entry" : "Edit Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!isValid || isSaving)
                }
            }
            .task { await loadClients() }
        }
    }

    private func loadClients() async {
        do {
            clients = try await APIClient.shared.fetchClients()
            if selectedClientId == nil, clients.count == 1 {
                selectedClientId = clients.first?.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        guard let hours, let clientId = selectedClientId else { return }
        isSaving = true
        defer { isSaving = false }

        let payload = WorkEntryPayload(
            clientId: clientId,
            hours: (hours * 100).rounded() / 100,
            description: description,
            date: DateParsing.dayFormatter.string(from: date)
        )

        do {
            let saved: WorkEntry
            if let entry {
                saved = try await APIClient.shared.updateWorkEntry(id: entry.id, payload: payload)
            } else {
                saved = try await APIClient.shared.createWorkEntry(payload)
            }
            onSave(saved)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
