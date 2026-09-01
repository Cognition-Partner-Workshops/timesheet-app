import Foundation

enum ExportFormat: String, Sendable {
    case csv
    case pdf
}

protocol APIClient: Sendable {
    func login(email: String) async throws -> User
    func currentUser() async throws -> User
    func clients() async throws -> [Client]
    func createClient(_ payload: ClientPayload) async throws -> Client
    func updateClient(id: Int, payload: ClientPayload) async throws -> Client
    func deleteClient(id: Int) async throws
    func workEntries(clientId: Int?) async throws -> [WorkEntry]
    func createWorkEntry(_ payload: WorkEntryPayload) async throws -> WorkEntry
    func updateWorkEntry(id: Int, payload: WorkEntryPayload) async throws -> WorkEntry
    func deleteWorkEntry(id: Int) async throws
    func report(clientId: Int) async throws -> ClientReport
    func exportFile(clientId: Int, format: ExportFormat) async throws -> URL
}
