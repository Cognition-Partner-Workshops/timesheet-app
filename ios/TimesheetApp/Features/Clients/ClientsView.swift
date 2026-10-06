import SwiftUI

struct ClientsView: View {
    @Environment(TimesheetStore.self) private var store

    @State private var searchText = ""
    @State private var showsNewClient = false
    @State private var pendingDelete: Client?
    @State private var error: PresentableError?

    private var filtered: [Client] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return store.clients }
        return store.clients.filter { client in
            client.name.localizedCaseInsensitiveContains(query)
                || (client.department?.localizedCaseInsensitiveContains(query) ?? false)
                || (client.email?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                switch store.state {
                case .idle, .loading:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failed(let message):
                    LoadFailureView(message: message) { await store.refresh() }
                case .loaded where store.clients.isEmpty:
                    EmptyStateView(
                        title: "No clients yet",
                        message: "Clients are who you bill hours to. Add one to start tracking time.",
                        systemImage: "person.crop.circle.badge.plus",
                        actionTitle: "Add Client",
                        action: { showsNewClient = true }
                    )
                case .loaded:
                    list
                }
            }
            .navigationTitle("Clients")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsNewClient = true
                    } label: {
                        Label("Add Client", systemImage: "plus")
                    }
                    .accessibilityIdentifier("clients.add")
                }
            }
            .sheet(isPresented: $showsNewClient) {
                ClientFormView(mode: .create)
            }
            .navigationDestination(for: Client.self) { client in
                ClientDetailView(clientId: client.id)
            }
            .confirmationDialog(
                "Delete \(pendingDelete?.name ?? "client")?",
                isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
                titleVisibility: .visible
            ) {
                Button("Delete Client and Its Entries", role: .destructive) {
                    if let client = pendingDelete { delete(client) }
                }
            } message: {
                Text("All work entries logged against this client will be deleted too. This can't be undone.")
            }
            .errorAlert($error)
        }
    }

    private var list: some View {
        List {
            ForEach(filtered) { client in
                NavigationLink(value: client) {
                    ClientRow(client: client, hours: store.hours(forClient: client.id))
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        pendingDelete = client
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .accessibilityIdentifier("clients.row.\(client.id)")
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $searchText, prompt: "Search clients")
        .overlay {
            if filtered.isEmpty {
                ContentUnavailableView.search(text: searchText)
            }
        }
        .refreshable { await store.refresh() }
    }

    private func delete(_ client: Client) {
        Task {
            do {
                try await store.deleteClient(id: client.id)
            } catch {
                self.error = PresentableError(error, title: "Couldn't delete client")
            }
        }
    }
}

struct ClientRow: View {
    let client: Client
    let hours: Double

    var body: some View {
        HStack(spacing: 12) {
            ClientAvatar(client: client)
            VStack(alignment: .leading, spacing: 2) {
                Text(client.name).font(.body.weight(.medium))
                if let department = client.department, !department.isEmpty {
                    Text(department).font(.subheadline).foregroundStyle(.secondary)
                } else if let email = client.email, !email.isEmpty {
                    Text(email).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(HoursFormat.short(hours))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
