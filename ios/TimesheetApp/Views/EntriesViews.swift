import SwiftUI

struct EntriesListView: View {
    @ObservedObject var model: EntriesViewModel
    let clients: [Client]
    @State private var showingForm = false
    @State private var editingEntry: WorkEntry?

    var body: some View {
        Group {
            if case .loading = model.state, model.entries.isEmpty {
                LoadingView()
            } else if model.entries.isEmpty {
                EmptyStateView(title: "No work entries", description: "Log time to keep your timesheet up to date.", systemImage: "clock")
            } else {
                List {
                    ForEach(model.groupedEntries, id: \.0) { date, entries in
                        Section {
                            ForEach(entries) { entry in
                                EntryListRow(entry: entry,
                                             onEdit: { editingEntry = entry },
                                             onDelete: { delete(entry) })
                            }
                        } header: {
                            Text(date, format: .dateTime.year().month().day())
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Entries")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Button("All clients") { model.clientFilter = nil; Task { await model.load() } }
                    ForEach(clients) { client in
                        Button(client.name) { model.clientFilter = client.id; Task { await model.load() } }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
                .accessibilityLabel("Filter entries by client")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingForm = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add work entry")
            }
        }
        .overlay(alignment: .top) {
            if case .failed(let message) = model.state {
                ErrorBanner(message: message) { Task { await model.load() } }
            }
        }
        .refreshable { await model.load() }
        .task { await model.load() }
        .sheet(isPresented: $showingForm) {
            WorkEntryFormView(clients: clients) { payload in await model.save(id: nil, payload: payload) }
        }
        .sheet(item: $editingEntry) { entry in
            WorkEntryFormView(clients: clients, entry: entry) { payload in await model.save(id: entry.id, payload: payload) }
        }
    }

    private func delete(_ entry: WorkEntry) {
        guard let index = model.entries.firstIndex(where: { $0.id == entry.id }) else { return }
        Task { await model.delete(at: IndexSet(integer: index)) }
    }
}

private struct EntryListRow: View {
    let entry: WorkEntry
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        Button(action: onEdit) {
            EntryRow(entry: entry)
                .foregroundStyle(.primary)
        }
        .swipeActions {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

struct WorkEntryFormView: View {
    @Environment(\.dismiss) private var dismiss
    let clients: [Client]
    let entry: WorkEntry?
    let onSave: (WorkEntryPayload) async -> Void
    @State private var clientID: Int?
    @State private var hours = ""
    @State private var description = ""
    @State private var date: Date
    @State private var isSaving = false
    @State private var validationMessage: String?

    init(clients: [Client], entry: WorkEntry? = nil, onSave: @escaping (WorkEntryPayload) async -> Void) {
        self.clients = clients
        self.entry = entry
        self.onSave = onSave
        _clientID = State(initialValue: entry?.clientID ?? clients.first?.id)
        _hours = State(initialValue: entry.map { String(format: "%.2f", $0.hours) } ?? "")
        _description = State(initialValue: entry?.description ?? "")
        _date = State(initialValue: entry?.date ?? .now)
    }

    private var parsedHours: Double? { Double(hours.replacingOccurrences(of: ",", with: ".")) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Work entry") {
                    Picker("Client", selection: $clientID) {
                        Text("Select a client").tag(nil as Int?)
                        ForEach(clients) { client in
                            Text(client.name).tag(client.id as Int?)
                        }
                    }
                    TextField("Hours", text: $hours)
                        .keyboardType(.decimalPad)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Description", text: $description, axis: .vertical)
                }
                if let validationMessage {
                    Text(validationMessage).foregroundStyle(.red)
                }
            }
            .navigationTitle(entry == nil ? "Log hours" : "Edit entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving)
                }
            }
        }
    }

    private func save() {
        guard let clientID, let parsedHours, parsedHours > 0, parsedHours <= 24 else {
            validationMessage = "Choose a client and enter hours greater than 0 and no more than 24."
            return
        }
        guard parsedHours * 100 == parsedHours.rounded() * 100 else {
            validationMessage = "Hours can have at most two decimal places."
            return
        }
        validationMessage = nil
        isSaving = true
        Task {
            await onSave(WorkEntryPayload(clientID: clientID, hours: parsedHours, description: description.isEmpty ? nil : description, date: date))
            isSaving = false
            dismiss()
        }
    }
}
