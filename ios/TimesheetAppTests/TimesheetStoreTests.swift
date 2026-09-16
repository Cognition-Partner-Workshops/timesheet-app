import Foundation
import Testing
@testable import TimesheetApp

@Suite(.serialized)
@MainActor
struct TimesheetStoreTests {
    private func makeStore() -> TimesheetStore {
        TimesheetStore(api: APIClient(baseURL: URL(string: "http://example.test")!, userEmail: "me@example.com", session: MockURLProtocol.makeSession()))
    }

    @Test func refreshLoadsAndSortsClientsAndEntries() async throws {
        MockURLProtocol.handler = { request in
            switch request.url?.path {
            case "/api/clients":
                return .init(status: 200, body: Data(#"{"clients":[{"id":1,"name":"Zeta"},{"id":2,"name":"alpha"}]}"#.utf8))
            case "/api/work-entries":
                return .init(status: 200, body: Data(#"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":"2026-01-01","client_name":"Zeta"},{"id":2,"client_id":2,"hours":3,"date":"2026-01-05","client_name":"alpha"}]}"#.utf8))
            default:
                return .init(status: 404, body: Data())
            }
        }
        let store = makeStore()
        await store.refresh()
        #expect(store.state == .loaded)
        #expect(store.clients.map(\.name) == ["alpha", "Zeta"])
        #expect(store.entries.map(\.id) == [2, 1])
        #expect(store.totalHours == 4)
        #expect(store.hours(forClient: 2) == 3)
        #expect(store.hoursByClient().first?.client.id == 2)
    }

    @Test func refreshFailureRecordsMessage() async throws {
        MockURLProtocol.handler = { _ in .init(status: 500, body: Data(#"{"error":"Internal server error"}"#.utf8)) }
        let store = makeStore()
        await store.refresh()
        #expect(store.state == .failed("Internal server error (HTTP 500)"))
    }

    @Test func deletingClientRemovesItsEntries() async throws {
        MockURLProtocol.handler = { request in
            switch (request.httpMethod, request.url?.path) {
            case ("GET", "/api/clients"):
                return .init(status: 200, body: Data(#"{"clients":[{"id":1,"name":"A"},{"id":2,"name":"B"}]}"#.utf8))
            case ("GET", "/api/work-entries"):
                return .init(status: 200, body: Data(#"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":"2026-01-01"},{"id":2,"client_id":2,"hours":2,"date":"2026-01-01"}]}"#.utf8))
            case ("DELETE", "/api/clients/1"):
                return .init(status: 200, body: Data(#"{"message":"Client deleted successfully"}"#.utf8))
            default:
                return .init(status: 404, body: Data())
            }
        }
        let store = makeStore()
        await store.refresh()
        try await store.deleteClient(id: 1)
        #expect(store.clients.map(\.id) == [2])
        #expect(store.entries.map(\.id) == [2])
    }

    @Test func updatingClientRenamesCachedEntries() async throws {
        MockURLProtocol.handler = { request in
            switch (request.httpMethod, request.url?.path) {
            case ("GET", "/api/clients"):
                return .init(status: 200, body: Data(#"{"clients":[{"id":1,"name":"Old"}]}"#.utf8))
            case ("GET", "/api/work-entries"):
                return .init(status: 200, body: Data(#"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":"2026-01-01","client_name":"Old"}]}"#.utf8))
            case ("PUT", "/api/clients/1"):
                return .init(status: 200, body: Data(#"{"message":"ok","client":{"id":1,"name":"New"}}"#.utf8))
            default:
                return .init(status: 404, body: Data())
            }
        }
        let store = makeStore()
        await store.refresh()
        _ = try await store.updateClient(id: 1, ClientPayload(name: "New"))
        #expect(store.clients.first?.name == "New")
        #expect(store.entries.first?.clientName == "New")
    }

    @Test func dailyHoursBucketsEntriesIntoTrailingWindow() async throws {
        let store = makeStore()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = Date(timeIntervalSince1970: 1_789_430_400 + 3600) // 2026-09-15 01:00 UTC
        let buckets = store.dailyHours(days: 3, calendar: calendar, now: now)
        #expect(buckets.count == 3)
        #expect(buckets.allSatisfy { $0.hours == 0 })
        #expect(buckets.last?.day == Date(timeIntervalSince1970: 1_789_430_400))
    }
}
