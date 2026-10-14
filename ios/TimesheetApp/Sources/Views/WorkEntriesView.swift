import SwiftUI

struct WorkEntriesView: View {
    @State private var entries: [WorkEntry] = []
    @State private var clients: [Client] = []
    @State private var selectedClientId: Int?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingAddEntry = false
    @State private var editingEntry: WorkEntry?

    private var totalHours: Double {
        entries.reduce(0) { $0 + $1.hours }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && entries.isEmpty {
                    ProgressView("Loading entries…")
                } else if entries.isEmpty {
                    ContentUnavailableCompatView(
                        title: "No Work Entries",
                        systemImage: "clock",
                        description: "Log your first hours to see them here."
                    )
                } else {
                    List {
                        Section {
                            LabeledContent("Total Hours", value: String(format: "%.2f", totalHours))
                                .font(.headline)
                        }
                        Section {
                            ForEach(entries) { entry in
                                Button {
                                    editingEntry = entry
                                } label: {
                                    WorkEntryRow(entry: entry)
                                }
                                .buttonStyle(.plain)
                            }
                            .onDelete(perform: deleteEntries)
                        }
                    }
                }
            }
            .navigationTitle("Work Entries")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("All Clients") { selectedClientId = nil }
                        ForEach(clients) { client in
                            Button(client.name) { selectedClientId = client.id }
                        }
                    } label: {
                        Label(
                            selectedClientId.flatMap { id in clients.first { $0.id == id }?.name } ?? "All Clients",
                            systemImage: "line.3.horizontal.decrease.circle"
                        )
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddEntry = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Add Entry")
                }
            }
            .sheet(isPresented: $showingAddEntry) {
                WorkEntryFormView { _ in Task { await load() } }
            }
            .sheet(item: $editingEntry) { entry in
                WorkEntryFormView(entry: entry) { _ in Task { await load() } }
            }
            .refreshable { await load() }
            .task { await load() }
            .onChange(of: selectedClientId) { _ in
                Task { await load() }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let entriesTask = APIClient.shared.fetchWorkEntries(clientId: selectedClientId)
            async let clientsTask = APIClient.shared.fetchClients()
            entries = try await entriesTask
            clients = try await clientsTask
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteEntries(at offsets: IndexSet) {
        let toDelete = offsets.map { entries[$0] }
        Task {
            do {
                for entry in toDelete {
                    try await APIClient.shared.deleteWorkEntry(id: entry.id)
                }
                await load()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct WorkEntryRow: View {
    let entry: WorkEntry

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.clientName ?? "Unknown Client")
                    .font(.headline)
                Text(DateParsing.displayString(entry.date))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let description = entry.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            Text(String(format: "%.2f h", entry.hours))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.tint)
        }
        .contentShape(Rectangle())
        .padding(.vertical, 2)
    }
}
