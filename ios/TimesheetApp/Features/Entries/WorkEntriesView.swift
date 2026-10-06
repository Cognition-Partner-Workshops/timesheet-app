import SwiftUI

struct WorkEntriesView: View {
    @Environment(TimesheetStore.self) private var store

    @State private var clientFilter: Int?
    @State private var showsNew = false
    @State private var editing: WorkEntry?
    @State private var error: PresentableError?

    private var visibleEntries: [WorkEntry] {
        guard let clientFilter else { return store.entries }
        return store.entries(forClient: clientFilter)
    }

    private var sections: [(day: Date, entries: [WorkEntry])] {
        let grouped = Dictionary(grouping: visibleEntries) { Calendar.current.startOfDay(for: $0.localDate) }
        return grouped.keys.sorted(by: >).map { (day: $0, entries: grouped[$0] ?? []) }
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
                        title: "Add a client first",
                        message: "Time is always logged against a client. Create one from the Clients tab.",
                        systemImage: "person.crop.circle.badge.plus"
                    )
                case .loaded where visibleEntries.isEmpty:
                    EmptyStateView(
                        title: clientFilter == nil ? "No time logged yet" : "Nothing for this client",
                        message: clientFilter == nil ? "Log your first work entry to see it here." : "Try another client or clear the filter.",
                        systemImage: "clock.badge.questionmark",
                        actionTitle: "Log Time",
                        action: { showsNew = true }
                    )
                case .loaded:
                    list
                }
            }
            .navigationTitle("Time")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    filterMenu
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsNew = true
                    } label: {
                        Label("Log Time", systemImage: "plus")
                    }
                    .disabled(store.clients.isEmpty)
                    .accessibilityIdentifier("entries.add")
                }
            }
            .sheet(isPresented: $showsNew) {
                WorkEntryFormView(mode: .create(clientId: clientFilter))
            }
            .sheet(item: $editing) { entry in
                WorkEntryFormView(mode: .edit(entry))
            }
            .errorAlert($error)
        }
    }

    private var filterMenu: some View {
        Menu {
            Picker("Client", selection: $clientFilter) {
                Text("All clients").tag(Int?.none)
                ForEach(store.clients) { client in
                    Text(client.name).tag(Int?.some(client.id))
                }
            }
        } label: {
            Label(
                store.client(id: clientFilter)?.name ?? "All clients",
                systemImage: clientFilter == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill"
            )
            .labelStyle(.titleAndIcon)
            .lineLimit(1)
        }
        .disabled(store.clients.isEmpty)
        .accessibilityIdentifier("entries.filter")
    }

    private var list: some View {
        List {
            Section {
                HStack {
                    Label("Total", systemImage: "sum")
                    Spacer()
                    Text(HoursFormat.long(visibleEntries.reduce(0) { $0 + $1.hours }))
                        .font(.body.weight(.semibold).monospacedDigit())
                }
            }
            ForEach(sections, id: \.day) { section in
                Section {
                    ForEach(section.entries) { entry in
                        Button {
                            editing = entry
                        } label: {
                            WorkEntryRow(entry: entry)
                        }
                        .buttonStyle(.plain)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                delete(entry)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            Button {
                                editing = entry
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .tint(.orange)
                        }
                        .accessibilityIdentifier("entries.row.\(entry.id)")
                    }
                } header: {
                    HStack {
                        Text(section.day.relativeDayLabel)
                        Spacer()
                        Text(HoursFormat.short(section.entries.reduce(0) { $0 + $1.hours }))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await store.refresh() }
    }

    private func delete(_ entry: WorkEntry) {
        Task {
            do { try await store.deleteEntry(id: entry.id) } catch {
                self.error = PresentableError(error, title: "Couldn't delete entry")
            }
        }
    }
}
