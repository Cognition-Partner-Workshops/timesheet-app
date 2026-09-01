import Foundation
import Combine
import XCTest
@testable import TimesheetApp

actor StubAPIClient: APIClient {
    var storedClients: [Client] = [
        Client(id: 1, name: "Acme", description: nil, department: nil, email: nil, createdAt: nil, updatedAt: nil)
    ]
    var storedEntries: [WorkEntry] = [
        WorkEntry(id: 1, clientID: 1, hours: 2, description: "Build", date: .now, clientName: "Acme")
    ]
    var shouldFail = false

    func login(email: String) async throws -> User { User(email: email, createdAt: nil) }
    func currentUser() async throws -> User { User(email: "person@example.com", createdAt: nil) }
    func clients() async throws -> [Client] {
        if shouldFail { throw APIError.server("load failed") }
        return storedClients
    }
    func createClient(_ payload: ClientPayload) async throws -> Client {
        let client = Client(id: (storedClients.map(\.id).max() ?? 0) + 1, name: payload.name ?? "New", description: payload.description, department: payload.department, email: payload.email, createdAt: nil, updatedAt: nil)
        storedClients.append(client)
        return client
    }
    func updateClient(id: Int, payload: ClientPayload) async throws -> Client { storedClients[0] }
    func deleteClient(id: Int) async throws { storedClients.removeAll { $0.id == id } }
    func workEntries(clientId: Int?) async throws -> [WorkEntry] {
        if shouldFail { throw APIError.server("load failed") }
        return storedEntries.filter { clientId == nil || $0.clientID == clientId }
    }
    func createWorkEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry { storedEntries[0] }
    func updateWorkEntry(id: Int, payload: WorkEntryPayload) async throws -> WorkEntry { storedEntries[0] }
    func deleteWorkEntry(id: Int) async throws { storedEntries.removeAll { $0.id == id } }
    func report(clientId: Int) async throws -> ClientReport {
        ClientReport(client: .init(id: clientId, name: "Acme"), workEntries: [], totalHours: 0, entryCount: 0)
    }
    func exportFile(clientId: Int, format: ExportFormat) async throws -> URL { URL(fileURLWithPath: "/tmp/report.\(format.rawValue)") }
}

@MainActor
final class ViewModelTests: XCTestCase {
    func testClientsLoadFailureAndDelete() async {
        let stub = StubAPIClient()
        let model = ClientsViewModel(api: stub)
        await model.load()
        XCTAssertEqual(model.state, .loaded)
        XCTAssertEqual(model.clients.count, 1)
        await model.delete(at: IndexSet(integer: 0))
        XCTAssertTrue(model.clients.isEmpty)

        await stub.setShouldFail()
        await model.load()
        XCTAssertEqual(model.state, .failed("load failed"))
    }

    func testEntriesLoadTransitionsToLoadedAndFailed() async {
        let stub = StubAPIClient()
        let model = EntriesViewModel(api: stub)
        await model.load()
        XCTAssertEqual(model.state, .loaded)
        XCTAssertEqual(model.entries.count, 1)
        await stub.setShouldFail()
        await model.load()
        XCTAssertEqual(model.state, .failed("load failed"))
    }

    func testWorkEntryValidation() {
        XCTAssertNil(WorkEntryValidator.validate(clientID: 1, hours: 7.5))
        XCTAssertNil(WorkEntryValidator.validate(clientID: 1, hours: 1.25))
        XCTAssertNotNil(WorkEntryValidator.validate(clientID: 1, hours: 0))
        XCTAssertNotNil(WorkEntryValidator.validate(clientID: 1, hours: 24.5))
        XCTAssertNotNil(WorkEntryValidator.validate(clientID: 1, hours: 1.234))
    }

    func testSessionStorePublishesBaseURLUpdates() {
        let defaults = UserDefaults.standard
        let previousBaseURL = defaults.string(forKey: "timesheet.baseURL")
        defer {
            if let previousBaseURL {
                defaults.set(previousBaseURL, forKey: "timesheet.baseURL")
            } else {
                defaults.removeObject(forKey: "timesheet.baseURL")
            }
        }

        let session = SessionStore(apiClient: StubAPIClient())
        let expectation = expectation(description: "SessionStore publishes base URL changes")
        var didPublish = false
        let cancellable = session.objectWillChange.sink {
            guard !didPublish else { return }
            didPublish = true
            expectation.fulfill()
        }

        session.updateBaseURL("http://example.test:3001")

        wait(for: [expectation], timeout: 1)
        XCTAssertTrue(didPublish)
        XCTAssertEqual(session.baseURLString, "http://example.test:3001")
        XCTAssertEqual(defaults.string(forKey: "timesheet.baseURL"), "http://example.test:3001")
        _ = cancellable
    }
}

private extension StubAPIClient {
    func setShouldFail() { shouldFail = true }
}
