import Foundation

enum LoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded
    case failed(String)
}

@MainActor
final class ClientsViewModel: ObservableObject {
    @Published private(set) var clients: [Client] = []
    @Published private(set) var state: LoadState = .idle
    let api: any APIClient

    init(api: any APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            clients = try await api.clients()
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func save(id: Int?, payload: ClientPayload) async {
        do {
            if let id {
                _ = try await api.updateClient(id: id, payload: payload)
            } else {
                _ = try await api.createClient(payload)
            }
            await load()
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func delete(at offsets: IndexSet) async {
        let ids = offsets.compactMap { clients.indices.contains($0) ? clients[$0].id : nil }
        do {
            for id in ids { try await api.deleteClient(id: id) }
            clients.remove(atOffsets: offsets)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

@MainActor
final class EntriesViewModel: ObservableObject {
    @Published private(set) var entries: [WorkEntry] = []
    @Published private(set) var state: LoadState = .idle
    @Published var clientFilter: Int?
    private let api: any APIClient

    init(api: any APIClient, clientFilter: Int? = nil) {
        self.api = api
        self.clientFilter = clientFilter
    }

    func load() async {
        state = .loading
        do {
            entries = try await api.workEntries(clientId: clientFilter).sorted { $0.date > $1.date }
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func save(id: Int?, payload: WorkEntryPayload) async {
        do {
            if let id {
                _ = try await api.updateWorkEntry(id: id, payload: payload)
            } else {
                _ = try await api.createWorkEntry(payload)
            }
            await load()
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func delete(at offsets: IndexSet) async {
        let ids = offsets.compactMap { entries.indices.contains($0) ? entries[$0].id : nil }
        do {
            for id in ids { try await api.deleteWorkEntry(id: id) }
            entries.remove(atOffsets: offsets)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    var groupedEntries: [(Date, [WorkEntry])] {
        Dictionary(grouping: entries) { Calendar.current.startOfDay(for: $0.date) }
            .sorted { $0.key > $1.key }
    }
}

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var entries: [WorkEntry] = []
    @Published private(set) var state: LoadState = .idle
    private let api: any APIClient

    init(api: any APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            entries = try await api.workEntries(clientId: nil).sorted { $0.date > $1.date }
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    var totalEntries: Int { entries.count }

    var hoursThisWeek: Double {
        let start = Calendar.current.dateInterval(of: .weekOfYear, for: .now)?.start ?? .now
        return entries.filter { $0.date >= start }.reduce(0) { $0 + $1.hours }
    }

    var hoursThisMonth: Double {
        let start = Calendar.current.dateInterval(of: .month, for: .now)?.start ?? .now
        return entries.filter { $0.date >= start }.reduce(0) { $0 + $1.hours }
    }

    var lastThirtyDaysByClient: [(String, Double)] {
        let start = Calendar.current.date(byAdding: .day, value: -30, to: .now) ?? .now
        let groups = Dictionary(grouping: entries.filter { $0.date >= start }) { $0.clientName ?? "Unknown client" }
        return groups.map { ($0.key, $0.value.reduce(0) { $0 + $1.hours }) }.sorted { $0.1 > $1.1 }
    }

    var recentEntries: [WorkEntry] { Array(entries.prefix(5)) }

    var lastSevenDaysByDay: [(Date, Double)] {
        let calendar = Calendar.current
        return (0..<7).compactMap { offset in
            guard let date = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: .now)) else { return nil }
            let total = entries.filter { calendar.isDate($0.date, inSameDayAs: date) }.reduce(0) { $0 + $1.hours }
            return (date, total)
        }.reversed()
    }
}

@MainActor
final class ReportViewModel: ObservableObject {
    @Published private(set) var report: ClientReport?
    @Published private(set) var state: LoadState = .idle
    private let api: any APIClient
    let clientID: Int

    init(api: any APIClient, clientID: Int) {
        self.api = api
        self.clientID = clientID
    }

    func load() async {
        state = .loading
        do {
            report = try await api.report(clientId: clientID)
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func export(format: ExportFormat) async throws -> URL {
        try await api.exportFile(clientId: clientID, format: format)
    }
}
