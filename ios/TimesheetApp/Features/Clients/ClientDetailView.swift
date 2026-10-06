import SwiftUI

struct ClientDetailView: View {
    let clientId: Int

    @Environment(TimesheetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var editing: Client?
    @State private var logTime = false
    @State private var editingEntry: WorkEntry?
    @State private var confirmDelete = false
    @State private var error: PresentableError?

    private var client: Client? { store.client(id: clientId) }
    private var entries: [WorkEntry] { store.entries(forClient: clientId) }

    var body: some View {
        if let client {
            List {
                Section {
                    header(for: client)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                if client.department != nil || client.email != nil || client.description != nil {
                    Section("Details") {
                        if let department = client.department, !department.isEmpty {
                            LabeledContent("Department", value: department)
                        }
                        if let email = client.email, !email.isEmpty {
                            LabeledContent("Email") {
                                if let url = URL(string: "mailto:\(email)") {
                                    Link(email, destination: url)
                                } else {
                                    Text(email)
                                }
                            }
                        }
                        if let description = client.description, !description.isEmpty {
                            Text(description).font(.subheadline)
                        }
                    }
                }

                Section {
                    if entries.isEmpty {
                        Text("No time logged for this client yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(entries) { entry in
                            Button {
                                editingEntry = entry
                            } label: {
                                WorkEntryRow(entry: entry, showsClient: false)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    delete(entry)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                } header: {
                    HStack {
                        Text("Work entries")
                        Spacer()
                        Text("\(entries.count)")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(client.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    NavigationLink {
                        ReportDetailView(clientId: client.id)
                    } label: {
                        Label("Report", systemImage: "chart.bar.doc.horizontal")
                    }
                    Menu {
                        Button {
                            editing = client
                        } label: {
                            Label("Edit Client", systemImage: "pencil")
                        }
                        Button(role: .destructive) {
                            confirmDelete = true
                        } label: {
                            Label("Delete Client", systemImage: "trash")
                        }
                    } label: {
                        Label("More", systemImage: "ellipsis.circle")
                    }
                    .accessibilityIdentifier("clientDetail.more")
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    logTime = true
                } label: {
                    Label("Log Time", systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding()
                .background(.bar)
                .accessibilityIdentifier("clientDetail.logTime")
            }
            .sheet(item: $editing) { client in
                ClientFormView(mode: .edit(client))
            }
            .sheet(isPresented: $logTime) {
                WorkEntryFormView(mode: .create(clientId: client.id))
            }
            .sheet(item: $editingEntry) { entry in
                WorkEntryFormView(mode: .edit(entry))
            }
            .confirmationDialog("Delete \(client.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Client and Its Entries", role: .destructive) { deleteClient(client) }
            } message: {
                Text("All \(entries.count) work entries for this client will be deleted too.")
            }
            .errorAlert($error)
        } else {
            ContentUnavailableView("Client not found", systemImage: "person.crop.circle.badge.questionmark")
        }
    }

    private func header(for client: Client) -> some View {
        VStack(spacing: 16) {
            ClientAvatar(client: client, size: 72)
            VStack(spacing: 4) {
                Text(client.name).font(.title2.weight(.semibold))
                Text("Client since \(joinedText(client))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                StatCard(title: "Total hours", value: HoursFormat.short(store.hours(forClient: client.id)), systemImage: "sum")
                StatCard(title: "This month", value: HoursFormat.short(monthHours), systemImage: "calendar", tint: .indigo)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var monthHours: Double {
        let interval = DateInterval.thisMonth()
        return entries.filter { interval.contains($0.localDate) }.reduce(0) { $0 + $1.hours }
    }

    private func joinedText(_ client: Client) -> String {
        guard let raw = client.createdAt, let date = APIDate.parseTimestamp(raw) else {
            return "—"
        }
        return date.formatted(.dateTime.month(.wide).year())
    }

    private func delete(_ entry: WorkEntry) {
        Task {
            do { try await store.deleteEntry(id: entry.id) } catch {
                self.error = PresentableError(error, title: "Couldn't delete entry")
            }
        }
    }

    private func deleteClient(_ client: Client) {
        Task {
            do {
                try await store.deleteClient(id: client.id)
                dismiss()
            } catch {
                self.error = PresentableError(error, title: "Couldn't delete client")
            }
        }
    }
}
