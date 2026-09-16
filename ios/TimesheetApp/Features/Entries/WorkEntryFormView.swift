import SwiftUI

struct WorkEntryFormView: View {
    enum Mode: Identifiable {
        case create(clientId: Int?)
        case edit(WorkEntry)

        var id: String {
            switch self {
            case .create(let clientId): "create-\(clientId.map(String.init) ?? "any")"
            case .edit(let entry): "edit-\(entry.id)"
            }
        }
    }

    static let maxHours = 24.0
    static let quickHours: [Double] = [0.5, 1, 2, 4, 8]

    let mode: Mode

    @Environment(TimesheetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var clientId: Int?
    @State private var hoursText = ""
    @State private var date = Date()
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: PresentableError?
    @FocusState private var hoursFocused: Bool

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var hours: Double? {
        let normalized = hoursText.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        guard let value = Double(normalized) else { return nil }
        return (value * 100).rounded() / 100
    }

    private var hoursProblem: String? {
        guard !hoursText.isEmpty else { return nil }
        guard let hours else { return "Enter hours as a number, like 1.5." }
        if hours <= 0 { return "Hours must be greater than zero." }
        if hours > Self.maxHours { return "You can log at most 24 hours per entry." }
        return nil
    }

    private var canSave: Bool {
        guard !isSaving, clientId != nil, let hours, hoursProblem == nil, hours > 0 else { return false }
        return notes.count <= 1000
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Client", selection: $clientId) {
                        if clientId == nil {
                            Text("Choose a client").tag(Int?.none)
                        }
                        ForEach(store.clients) { client in
                            Text(client.name).tag(Int?.some(client.id))
                        }
                    }
                    .pickerStyle(.menu)
                    .accessibilityIdentifier("entryForm.client")

                    DatePicker("Date", selection: $date, in: ...Date.now.addingTimeInterval(86_400 * 366), displayedComponents: .date)
                        .accessibilityIdentifier("entryForm.date")
                }

                Section {
                    HStack {
                        TextField("0", text: $hoursText)
                            .keyboardType(.decimalPad)
                            .font(.system(.largeTitle, design: .rounded, weight: .semibold).monospacedDigit())
                            .focused($hoursFocused)
                            .accessibilityIdentifier("entryForm.hours")
                        Text("hours")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Self.quickHours, id: \.self) { value in
                                Button(HoursFormat.number(value)) {
                                    hoursText = HoursFormat.number(value)
                                }
                                .buttonStyle(.bordered)
                                .buttonBorderShape(.capsule)
                                .tint(hours == value ? .accentColor : .secondary)
                                .accessibilityIdentifier("entryForm.quick.\(value)")
                            }
                            Stepper("Adjust by 15 minutes", value: Binding(
                                get: { hours ?? 0 },
                                set: { hoursText = HoursFormat.number(min(max($0, 0), Self.maxHours)) }
                            ), in: 0...Self.maxHours, step: 0.25)
                            .labelsHidden()
                        }
                    }
                    .listRowSeparator(.hidden)
                } header: {
                    Text("Duration")
                } footer: {
                    if let hoursProblem {
                        Text(hoursProblem).foregroundStyle(.red)
                    } else if let hours, hours > 0 {
                        Text(HoursFormat.long(hours))
                    }
                }

                Section("Notes") {
                    TextField("What did you work on?", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                        .accessibilityIdentifier("entryForm.notes")
                }
            }
            .navigationTitle(isEditing ? "Edit Entry" : "Log Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if isSaving { ProgressView() } else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("entryForm.save")
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { hoursFocused = false }
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear(perform: populate)
            .errorAlert($error)
        }
    }

    private func populate() {
        switch mode {
        case .create(let preselected):
            clientId = preselected ?? (store.clients.count == 1 ? store.clients.first?.id : nil)
            date = .now
            hoursFocused = true
        case .edit(let entry):
            clientId = entry.clientId
            hoursText = HoursFormat.number(entry.hours)
            date = entry.localDate
            notes = entry.description ?? ""
        }
    }

    private func save() {
        guard canSave, let clientId, let hours else { return }
        isSaving = true
        let payload = WorkEntryPayload(clientId: clientId, hours: hours, description: notes, date: date)
        Task {
            defer { isSaving = false }
            do {
                switch mode {
                case .create:
                    _ = try await store.createEntry(payload)
                case .edit(let entry):
                    _ = try await store.updateEntry(id: entry.id, payload)
                }
                dismiss()
            } catch {
                self.error = PresentableError(error, title: isEditing ? "Couldn't update entry" : "Couldn't log time")
            }
        }
    }
}
