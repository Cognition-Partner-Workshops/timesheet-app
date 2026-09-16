import Foundation
import Observation

/// In-memory cache of the signed-in user's clients and work entries.
///
/// Every screen reads from this single store so a mutation made on one tab
/// (say, logging time from a client's detail page) is reflected everywhere
/// without a refetch. Mutations apply the server's response optimistically
/// into the cache and only fall back to a full reload on failure.
@MainActor
@Observable
final class TimesheetStore {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    private(set) var clients: [Client] = []
    private(set) var entries: [WorkEntry] = []
    private(set) var state: LoadState = .idle
    private(set) var lastRefreshed: Date?

    var api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    var isLoaded: Bool { state == .loaded }

    // MARK: Loading

    func loadIfNeeded() async {
        guard state == .idle || isFailed else { return }
        await refresh()
    }

    func refresh() async {
        if state != .loaded { state = .loading }
        do {
            async let clientsTask = api.clients()
            async let entriesTask = api.workEntries()
            let (fetchedClients, fetchedEntries) = try await (clientsTask, entriesTask)
            clients = fetchedClients.sorted(by: Self.clientOrder)
            entries = fetchedEntries.sorted(by: Self.entryOrder)
            lastRefreshed = .now
            state = .loaded
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func reset() {
        clients = []
        entries = []
        state = .idle
        lastRefreshed = nil
    }

    private var isFailed: Bool {
        if case .failed = state { return true }
        return false
    }

    // MARK: Clients

    func createClient(_ payload: ClientPayload) async throws -> Client {
        let created = try await api.createClient(payload)
        clients.append(created)
        clients.sort(by: Self.clientOrder)
        return created
    }

    func updateClient(id: Int, _ payload: ClientPayload) async throws -> Client {
        let updated = try await api.updateClient(id: id, payload)
        if let index = clients.firstIndex(where: { $0.id == id }) {
            clients[index] = updated
        } else {
            clients.append(updated)
        }
        clients.sort(by: Self.clientOrder)
        for index in entries.indices where entries[index].clientId == id {
            entries[index].clientName = updated.name
        }
        return updated
    }

    func deleteClient(id: Int) async throws {
        try await api.deleteClient(id: id)
        clients.removeAll { $0.id == id }
        entries.removeAll { $0.clientId == id }
    }

    func client(id: Int?) -> Client? {
        guard let id else { return nil }
        return clients.first { $0.id == id }
    }

    // MARK: Work entries

    func createEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry {
        var created = try await api.createWorkEntry(payload)
        if created.clientName == nil {
            created.clientName = client(id: created.clientId)?.name
        }
        entries.append(created)
        entries.sort(by: Self.entryOrder)
        return created
    }

    func updateEntry(id: Int, _ payload: WorkEntryPayload) async throws -> WorkEntry {
        var updated = try await api.updateWorkEntry(id: id, payload)
        if updated.clientName == nil {
            updated.clientName = client(id: updated.clientId)?.name
        }
        if let index = entries.firstIndex(where: { $0.id == id }) {
            entries[index] = updated
        } else {
            entries.append(updated)
        }
        entries.sort(by: Self.entryOrder)
        return updated
    }

    func deleteEntry(id: Int) async throws {
        try await api.deleteWorkEntry(id: id)
        entries.removeAll { $0.id == id }
    }

    func entries(forClient clientId: Int) -> [WorkEntry] {
        entries.filter { $0.clientId == clientId }
    }

    // MARK: Aggregates

    var totalHours: Double {
        entries.reduce(0) { $0 + $1.hours }
    }

    func hours(forClient clientId: Int) -> Double {
        entries(forClient: clientId).reduce(0) { $0 + $1.hours }
    }

    func hours(in interval: DateInterval) -> Double {
        entries
            .filter { interval.contains($0.localDate) }
            .reduce(0) { $0 + $1.hours }
    }

    /// Hours per calendar day across `days` days ending today (inclusive).
    func dailyHours(days: Int, calendar: Calendar = .current, now: Date = .now) -> [DailyHours] {
        let today = calendar.startOfDay(for: now)
        var buckets: [Date: Double] = [:]
        for offset in 0..<days {
            if let day = calendar.date(byAdding: .day, value: -offset, to: today) {
                buckets[day] = 0
            }
        }
        for entry in entries {
            let day = calendar.startOfDay(for: entry.localDate)
            if buckets[day] != nil {
                buckets[day, default: 0] += entry.hours
            }
        }
        return buckets
            .map { DailyHours(day: $0.key, hours: $0.value) }
            .sorted { $0.day < $1.day }
    }

    func hoursByClient() -> [ClientHours] {
        clients
            .map { ClientHours(client: $0, hours: hours(forClient: $0.id), entryCount: entries(forClient: $0.id).count) }
            .sorted { lhs, rhs in
                if lhs.hours != rhs.hours { return lhs.hours > rhs.hours }
                return lhs.client.name.localizedCaseInsensitiveCompare(rhs.client.name) == .orderedAscending
            }
    }

    // MARK: Ordering

    nonisolated static func clientOrder(_ lhs: Client, _ rhs: Client) -> Bool {
        lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

    nonisolated static func entryOrder(_ lhs: WorkEntry, _ rhs: WorkEntry) -> Bool {
        if lhs.date != rhs.date { return lhs.date > rhs.date }
        return lhs.id > rhs.id
    }
}

struct DailyHours: Identifiable, Hashable, Sendable {
    let day: Date
    let hours: Double
    var id: Date { day }
}

struct ClientHours: Identifiable, Hashable, Sendable {
    let client: Client
    let hours: Double
    let entryCount: Int
    var id: Int { client.id }
}
