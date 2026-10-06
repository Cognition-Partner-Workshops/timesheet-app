import Charts
import SwiftUI

struct DashboardView: View {
    let selectTab: (MainTabView.Tab) -> Void

    @Environment(TimesheetStore.self) private var store
    @Environment(SessionStore.self) private var session

    @State private var showsLogTime = false
    @State private var showsNewClient = false
    @State private var showsSettings = false

    var body: some View {
        NavigationStack {
            Group {
                switch store.state {
                case .idle, .loading:
                    ProgressView("Loading your timesheet…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failed(let message):
                    LoadFailureView(message: message) { await store.refresh() }
                case .loaded:
                    content
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsSettings = true
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .accessibilityIdentifier("dashboard.settings")
                }
            }
            .sheet(isPresented: $showsLogTime) {
                WorkEntryFormView(mode: .create(clientId: nil))
            }
            .sheet(isPresented: $showsNewClient) {
                ClientFormView(mode: .create)
            }
            .sheet(isPresented: $showsSettings) {
                NavigationStack { SettingsView() }
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                greeting
                stats
                quickActions
                if store.entries.isEmpty {
                    EmptyStateView(
                        title: store.clients.isEmpty ? "Add your first client" : "No time logged yet",
                        message: store.clients.isEmpty
                            ? "Clients are who you bill hours to. Create one, then start logging time."
                            : "Log your first work entry and it will show up here.",
                        systemImage: store.clients.isEmpty ? "person.crop.circle.badge.plus" : "clock.badge.questionmark",
                        actionTitle: store.clients.isEmpty ? "Add Client" : "Log Time",
                        action: { if store.clients.isEmpty { showsNewClient = true } else { showsLogTime = true } }
                    )
                    .frame(maxWidth: .infinity)
                } else {
                    activityChart
                    topClients
                    recentEntries
                }
            }
            .padding()
        }
        .refreshable { await store.refresh() }
        .background(Color(.systemGroupedBackground))
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greetingText)
                .font(.title2.weight(.semibold))
            Text(session.email ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    private var stats: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(title: "This week", value: HoursFormat.short(store.hours(in: .thisWeek())), systemImage: "calendar")
            StatCard(title: "This month", value: HoursFormat.short(store.hours(in: .thisMonth())), systemImage: "calendar.badge.clock", tint: .indigo)
            StatCard(title: "Clients", value: "\(store.clients.count)", systemImage: "person.2", tint: .teal)
            StatCard(title: "All time", value: HoursFormat.short(store.totalHours), systemImage: "sum", tint: .orange)
        }
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            Button {
                showsLogTime = true
            } label: {
                Label("Log Time", systemImage: "plus.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(store.clients.isEmpty)
            .accessibilityIdentifier("dashboard.logTime")

            Button {
                showsNewClient = true
            } label: {
                Label("Add Client", systemImage: "person.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .accessibilityIdentifier("dashboard.addClient")
        }
    }

    private var activityChart: some View {
        let daily = store.dailyHours(days: 14)
        return VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Last 14 days", detail: HoursFormat.short(daily.reduce(0) { $0 + $1.hours }))
            Chart(daily) { day in
                BarMark(
                    x: .value("Day", day.day, unit: .day),
                    y: .value("Hours", day.hours)
                )
                .foregroundStyle(Color.accentColor.gradient)
                .cornerRadius(4)
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 2)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.day(), centered: true)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let hours = value.as(Double.self) {
                            Text(HoursFormat.number(hours))
                        }
                    }
                }
            }
            .frame(height: 160)
            .accessibilityLabel("Hours logged per day over the last 14 days")
        }
        .padding()
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var topClients: some View {
        let ranked = store.hoursByClient().filter { $0.hours > 0 }.prefix(4)
        let maxHours = ranked.first?.hours ?? 1
        return VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Top clients") { selectTab(.reports) }
            ForEach(Array(ranked)) { item in
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
                            ProgressView(value: item.hours, total: max(maxHours, 0.01))
                                .tint(Color.accentColor)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .navigationDestination(for: Client.self) { client in
            ClientDetailView(clientId: client.id)
        }
    }

    private var recentEntries: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Recent activity") { selectTab(.entries) }
            ForEach(store.entries.prefix(5)) { entry in
                VStack(alignment: .leading, spacing: 4) {
                    WorkEntryRow(entry: entry)
                    Text(entry.localDate.relativeDayLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if entry.id != store.entries.prefix(5).last?.id {
                    Divider()
                }
            }
        }
        .padding()
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func sectionHeader(_ title: String, detail: String? = nil, seeAll: (() -> Void)? = nil) -> some View {
        HStack {
            Text(title).font(.headline)
            Spacer()
            if let detail {
                Text(detail).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            if let seeAll {
                Button("See all", action: seeAll).font(.subheadline)
            }
        }
    }
}
