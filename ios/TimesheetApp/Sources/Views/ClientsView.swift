import SwiftUI

struct ClientsView: View {
    @State private var clients: [Client] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingAddClient = false
    @State private var searchText = ""

    private var filteredClients: [Client] {
        guard !searchText.isEmpty else { return clients }
        return clients.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && clients.isEmpty {
                    ProgressView("Loading clients…")
                } else if clients.isEmpty {
                    ContentUnavailableCompatView(
                        title: "No Clients",
                        systemImage: "person.2",
                        description: "Add your first client to start tracking time."
                    )
                } else {
                    List {
                        ForEach(filteredClients) { client in
                            NavigationLink(value: client) {
                                ClientRow(client: client)
                            }
                        }
                        .onDelete(perform: deleteClients)
                    }
                    .searchable(text: $searchText, prompt: "Search clients")
                }
            }
            .navigationTitle("Clients")
            .navigationDestination(for: Client.self) { client in
                ClientDetailView(client: client, onChange: { Task { await load() } })
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddClient = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Add Client")
                }
            }
            .sheet(isPresented: $showingAddClient) {
                ClientFormView { _ in Task { await load() } }
            }
            .refreshable { await load() }
            .task { await load() }
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
            clients = try await APIClient.shared.fetchClients()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteClients(at offsets: IndexSet) {
        let toDelete = offsets.map { filteredClients[$0] }
        Task {
            do {
                for client in toDelete {
                    try await APIClient.shared.deleteClient(id: client.id)
                }
                await load()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct ClientRow: View {
    let client: Client

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(client.name)
                .font(.headline)
            if let department = client.department, !department.isEmpty {
                Text(department)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let description = client.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }
}

/// Simple stand-in for ContentUnavailableView (iOS 17+) that works on iOS 16.
struct ContentUnavailableCompatView: View {
    let title: String
    let systemImage: String
    let description: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title2.bold())
            Text(description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}
