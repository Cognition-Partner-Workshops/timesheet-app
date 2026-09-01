import SwiftUI

struct ClientsListView: View {
    @ObservedObject var model: ClientsViewModel
    @State private var searchText = ""
    @State private var showingForm = false
    @State private var editingClient: Client?
    @State private var pendingDelete: Client?

    private var filteredClients: [Client] {
        guard !searchText.isEmpty else { return model.clients }
        return model.clients.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.department ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        Group {
            if case .loading = model.state, model.clients.isEmpty {
                LoadingView()
            } else if filteredClients.isEmpty {
                EmptyStateView(title: "No clients", description: "Add a client to start organizing your work.", systemImage: "person.2")
            } else {
                List {
                    ForEach(filteredClients) { client in
                        NavigationLink {
                            ClientReportView(api: model.api, client: client)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(client.name).font(.headline)
                                if let department = client.department, !department.isEmpty {
                                    Text(department).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                pendingDelete = client
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            Button {
                                editingClient = client
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .tint(.orange)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Clients")
        .searchable(text: $searchText, prompt: "Search clients")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingForm = true } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add client")
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
            ClientFormView { payload in await model.save(id: nil, payload: payload) }
        }
        .sheet(item: $editingClient) { client in
            ClientFormView(client: client) { payload in await model.save(id: client.id, payload: payload) }
        }
        .confirmationDialog("Delete \(pendingDelete?.name ?? "client")?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let pendingDelete, let index = model.clients.firstIndex(of: pendingDelete) {
                    Task { await model.delete(at: IndexSet(integer: index)) }
                }
                pendingDelete = nil
            }
        }
    }
}

struct ClientFormView: View {
    @Environment(\.dismiss) private var dismiss
    let client: Client?
    let onSave: (ClientPayload) async -> Void
    @State private var name: String
    @State private var description: String
    @State private var department: String
    @State private var email: String
    @State private var isSaving = false

    init(client: Client? = nil, onSave: @escaping (ClientPayload) async -> Void) {
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
                Section("Client details") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                    TextField("Department", text: $department)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                }
            }
            .navigationTitle(client == nil ? "New client" : "Edit client")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        isSaving = true
                        Task {
                            await onSave(ClientPayload(
                                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                                description: description.isEmpty ? nil : description,
                                department: department.isEmpty ? nil : department,
                                email: email.isEmpty ? nil : email
                            ))
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
    }
}

struct ClientReportView: View {
    let api: any APIClient
    let client: Client
    @StateObject private var model: ReportViewModel
    @State private var shareURL: URL?
    @State private var exportError: String?

    init(api: any APIClient, client: Client) {
        self.api = api
        self.client = client
        _model = StateObject(wrappedValue: ReportViewModel(api: api, clientID: client.id))
    }

    var body: some View {
        Group {
            if case .loading = model.state, model.report == nil {
                LoadingView()
            } else if let report = model.report {
                List {
                    Section {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("\(report.totalHours, specifier: "%.2f") h").font(.title.bold())
                                Text("\(report.entryCount) entries").foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                    Section("Entries") {
                        ForEach(report.workEntries) { entry in
                            VStack(alignment: .leading) {
                                HStack {
                                    Text(entry.date, format: .dateTime.year().month().day())
                                    Spacer()
                                    Text("\(entry.hours, specifier: "%.2f") h").monospacedDigit()
                                }
                                if let description = entry.description, !description.isEmpty {
                                    Text(description).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            } else {
                EmptyStateView(title: "No report", description: "There is no report data for this client.", systemImage: "doc.text")
            }
        }
        .navigationTitle(client.name)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Export CSV") { Task { await export(.csv) } }
                    Button("Export PDF") { Task { await export(.pdf) } }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Export report")
            }
        }
        .overlay(alignment: .top) {
            if let exportError {
                ErrorBanner(message: exportError)
            }
            if case .failed(let message) = model.state {
                ErrorBanner(message: message) { Task { await model.load() } }
            }
        }
        .refreshable { await model.load() }
        .task { await model.load() }
        .sheet(isPresented: Binding(
            get: { shareURL != nil },
            set: { if !$0 { shareURL = nil } }
        )) {
            if let shareURL {
                ShareSheet(url: shareURL)
            }
        }
    }

    private func export(_ format: ExportFormat) async {
        do {
            shareURL = try await model.export(format: format)
        } catch {
            exportError = error.localizedDescription
        }
    }
}

struct ShareSheet: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ShareLink(item: url) {
                Label("Share file", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding()
            .navigationTitle("Share report")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
