import Charts
import SwiftUI

struct DashboardView: View {
    @ObservedObject var model: DashboardViewModel
    @ObservedObject var clientsModel: ClientsViewModel
    @ObservedObject var entriesModel: EntriesViewModel
    @State private var showingEntryForm = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if case .failed(let message) = model.state {
                    ErrorBanner(message: message) { Task { await model.load() } }
                }
                HStack(spacing: 12) {
                    MetricCard(title: "This week", value: model.hoursThisWeek, suffix: "h", systemImage: "calendar")
                    MetricCard(title: "This month", value: model.hoursThisMonth, suffix: "h", systemImage: "calendar.badge.clock")
                }
                HStack(spacing: 12) {
                    MetricCard(title: "Entries", value: Double(model.totalEntries), suffix: "", systemImage: "list.bullet")
                    Spacer()
                }
                Button { showingEntryForm = true } label: {
                    Label("Log hours", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityLabel("Log hours")
                if !model.lastSevenDaysByDay.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Last 7 days").font(.headline)
                        Chart(model.lastSevenDaysByDay, id: \.0) { day, hours in
                            BarMark(x: .value("Day", day, unit: .day), y: .value("Hours", hours))
                                .foregroundStyle(.tint)
                        }
                        .frame(height: 180)
                    }
                }
                if !model.lastThirtyDaysByClient.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Last 30 days by client").font(.headline)
                        ForEach(model.lastThirtyDaysByClient, id: \.0) { client, hours in
                            HStack {
                                Text(client).lineLimit(1)
                                Spacer()
                                Text("\(hours, specifier: "%.2f") h").monospacedDigit()
                            }
                            ProgressView(value: hours, total: max(model.lastThirtyDaysByClient.map(\.1).max() ?? 1, 1))
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent entries").font(.headline)
                    if model.recentEntries.isEmpty {
                        EmptyStateView(title: "No entries yet", description: "Log your first work entry to see it here.", systemImage: "clock")
                    } else {
                        ForEach(model.recentEntries) { entry in
                            EntryRow(entry: entry)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Dashboard")
        .refreshable { await model.load() }
        .task { await model.load() }
        .sheet(isPresented: $showingEntryForm) {
            WorkEntryFormView(clients: clientsModel.clients) { payload in
                await entriesModel.save(id: nil, payload: payload)
                await model.load()
            }
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: Double
    let suffix: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("\(value, specifier: "%.2f")\(suffix)")
                .font(.title2.bold())
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct EntryRow: View {
    let entry: WorkEntry

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.clientName ?? "Client")
                    .font(.headline)
                if let description = entry.description, !description.isEmpty {
                    Text(description).foregroundStyle(.secondary).lineLimit(1)
                }
                Text(entry.date, format: .dateTime.year().month().day())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(entry.hours, specifier: "%.2f") h")
                .font(.headline)
                .monospacedDigit()
        }
        .padding(.vertical, 4)
    }
}
