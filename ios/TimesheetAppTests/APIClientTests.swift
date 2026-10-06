import Foundation
import Testing
@testable import TimesheetApp

@Suite(.serialized)
struct APIClientTests {
    private let baseURL = URL(string: "http://example.test:3001")!

    private func makeClient(email: String? = "me@example.com") -> APIClient {
        APIClient(baseURL: baseURL, userEmail: email, session: MockURLProtocol.makeSession())
    }

    @Test func sendsUserEmailHeaderAndDecodesClients() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/clients")
            #expect(request.httpMethod == "GET")
            #expect(request.value(forHTTPHeaderField: "x-user-email") == "me@example.com")
            let body = #"{"clients":[{"id":2,"name":"Globex","description":null,"department":null,"email":null,"created_at":"2026-01-01 00:00:00","updated_at":"2026-01-01 00:00:00"}]}"#
            return .init(status: 200, body: Data(body.utf8))
        }
        let clients = try await makeClient().clients()
        #expect(clients.map(\.name) == ["Globex"])
    }

    @Test func loginDoesNotRequireIdentityAndPostsEmail() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/auth/login")
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "x-user-email") == nil)
            let json = try JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]
            #expect(json?["email"] as? String == "new@example.com")
            let body = #"{"message":"User created and logged in successfully","user":{"email":"new@example.com","createdAt":"2026-09-16T12:43:48.799Z"}}"#
            return .init(status: 201, body: Data(body.utf8))
        }
        let user = try await makeClient(email: nil).login(email: "new@example.com")
        #expect(user.email == "new@example.com")
    }

    @Test func createWorkEntryEncodesPayloadAndFiltersByClient() async throws {
        MockURLProtocol.handler = { request in
            if request.httpMethod == "POST" {
                let json = try JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]
                #expect(json?["clientId"] as? Int == 1)
                #expect(json?["hours"] as? Double == 2.5)
                #expect(json?["date"] as? String == "2026-09-15")
                let body = #"{"message":"ok","workEntry":{"id":9,"client_id":1,"hours":2.5,"description":null,"date":1789430400000,"client_name":"Acme"}}"#
                return .init(status: 201, body: Data(body.utf8))
            }
            #expect(request.url?.query() == "clientId=1")
            return .init(status: 200, body: Data(#"{"workEntries":[]}"#.utf8))
        }
        let api = makeClient()
        var components = DateComponents()
        components.year = 2026
        components.month = 9
        components.day = 15
        let day = Calendar.current.date(from: components)!
        let created = try await api.createWorkEntry(WorkEntryPayload(clientId: 1, hours: 2.5, date: day))
        #expect(created.id == 9)
        let filtered = try await api.workEntries(clientId: 1)
        #expect(filtered.isEmpty)
    }

    @Test func mapsValidationErrorsWithDetails() async throws {
        MockURLProtocol.handler = { _ in
            .init(status: 400, body: Data(#"{"error":"Validation error","details":["\"hours\" must be less than or equal to 24"]}"#.utf8))
        }
        await #expect(throws: APIError.validation("Validation error", details: ["\"hours\" must be less than or equal to 24"])) {
            _ = try await makeClient().createWorkEntry(WorkEntryPayload(clientId: 1, hours: 30, date: .now))
        }
    }

    @Test func mapsNotFoundAndRateLimit() async throws {
        MockURLProtocol.handler = { request in
            if request.url?.path.hasSuffix("/404") == true {
                return .init(status: 404, body: Data(#"{"error":"Client not found"}"#.utf8))
            }
            return .init(status: 429, body: Data("Too many requests".utf8), headers: [:])
        }
        await #expect(throws: APIError.notFound("Client not found")) {
            _ = try await makeClient().client(id: 404)
        }
        await #expect(throws: APIError.rateLimited) {
            _ = try await makeClient().client(id: 1)
        }
    }

    @Test func missingIdentityFailsBeforeHittingNetwork() async throws {
        MockURLProtocol.handler = { _ in
            Issue.record("Request should not have been sent")
            return .init(status: 500, body: Data())
        }
        await #expect(throws: APIError.unauthorized) {
            _ = try await makeClient(email: nil).clients()
        }
    }

    @Test func exportReturnsRawBytes() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/reports/export/pdf/3")
            return .init(status: 200, body: Data([0x25, 0x50, 0x44, 0x46]), headers: ["Content-Type": "application/pdf"])
        }
        let data = try await makeClient().exportReport(clientId: 3, format: .pdf)
        #expect(String(decoding: data, as: UTF8.self) == "%PDF")
    }
}
