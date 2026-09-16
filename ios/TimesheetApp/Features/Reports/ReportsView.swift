import SwiftUI

struct ReportsView: View {
    @Environment(TimesheetStore.self) private var store

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
                        title: "Nothing to report",
                        message: "Reports are generated per client. Add a client and log some time first.",
                        systemImage: "chart.bar.doc.horizontal"
                    )
                case .loaded:
                    list
                }
            }
            .navigationTitle("Reports")
            .navigationDestination(for: Client.self) { client in
                ReportDetailView(clientId: client.id)
            }
        }
    }

    private var list: some View {
        let ranked = store.hoursByClient()
        let maxHours = max(ranked.first?.hours ?? 0, 0.01)
        return List {
            Section {
                HStack {
                    StatCard(title: "All clients", value: HoursFormat.short(store.totalHours), systemImage: "sum")
                    StatCard(title: "Entries", value: "\(store.entries.count)", systemImage: "list.bullet.rectangle", tint: .teal)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
            Section("Hours by client") {
                ForEach(ranked) { item in
                    NavigationLink(value: item.client) {
                        HStack(spacing: 12) {
                            ClientAvatar(client: item.client, size: 36)
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(item.client.name).font(.body.weight(.medium))
                                    Spacer()
                                    Text(HoursFormat.short(item.hours))
                                        .font(.subheadline.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                ProgressView(value: item.hours, total: maxHours)
                                Text("\(item.entryCount) \(item.entryCount == 1 ? "entry" : "entries")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .accessibilityIdentifier("reports.row.\(item.client.id)")
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await store.refresh() }
    }
}
