import Foundation
import XCTest
@testable import TimesheetApp

final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?
    static var lastRequest: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastRequest = request
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

final class APIClientTests: XCTestCase {
    private var client: LiveAPIClient!

    override func setUp() {
        super.setUp()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)
        client = LiveAPIClient(
            baseURL: URL(string: "http://localhost:3001")!,
            emailProvider: { "person@example.com" },
            session: session
        )
        MockURLProtocol.lastRequest = nil
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        client = nil
        super.tearDown()
    }

    func testAuthenticatedHeadersAreSent() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "x-user-email"), "person@example.com")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            return Self.response(status: 200, body: #"{"clients":[]}"#)
        }
        _ = try await client.clients()
    }

    func testDecodesClientsEntriesAndReport() async throws {
        MockURLProtocol.requestHandler = { request in
            switch request.url?.path {
            case "/api/clients":
                return Self.response(status: 200, body: #"{"clients":[{"id":1,"name":"Acme","description":"A client","department":"Design","email":"a@acme.test","created_at":"2026-09-01T00:00:00Z","updated_at":"2026-09-01T00:00:00Z"}]}"#)
            case "/api/work-entries":
                return Self.response(status: 200, body: #"{"workEntries":[{"id":2,"client_id":1,"hours":2.5,"description":"Design","date":"2026-09-01","created_at":"2026-09-01T00:00:00Z","updated_at":"2026-09-01T00:00:00Z","client_name":"Acme"}]}"#)
            case "/api/reports/client/1":
                return Self.response(status: 200, body: #"{"client":{"id":1,"name":"Acme"},"workEntries":[{"id":2,"hours":2.5,"description":"Design","date":"2026-09-01T00:00:00Z","created_at":"2026-09-01T00:00:00Z","updated_at":"2026-09-01T00:00:00Z"}],"totalHours":2.5,"entryCount":1}"#)
            default:
                return Self.response(status: 404, body: #"{"error":"missing"}"#)
            }
        }
        let clients = try await client.clients()
        XCTAssertEqual(clients.first?.name, "Acme")
        let entries = try await client.workEntries(clientId: nil)
        XCTAssertEqual(entries.first?.clientID, 1)
        XCTAssertEqual(entries.first?.clientName, "Acme")
        XCTAssertEqual(entries.first?.hours, 2.5)
        let report = try await client.report(clientId: 1)
        XCTAssertEqual(report.totalHours, 2.5)
        XCTAssertEqual(report.entryCount, 1)
        XCTAssertEqual(report.workEntries.first?.id, 2)
    }

    func testCreateWorkEntryUsesCamelCaseAndDateOnly() async throws {
        MockURLProtocol.requestHandler = { request in
            let bodyData = try XCTUnwrap(Self.requestBodyData(request))
            let body = try XCTUnwrap(
                JSONSerialization.jsonObject(with: bodyData) as? [String: Any]
            )
            XCTAssertEqual(body["clientId"] as? Int, 3)
            XCTAssertEqual(body["date"] as? String, "2026-09-01")
            return Self.response(status: 201, body: #"{"workEntry":{"id":4,"client_id":3,"hours":1.25,"description":"Review","date":"2026-09-01"}}"#)
        }
        _ = try await client.createWorkEntry(
            WorkEntryPayload(clientID: 3, hours: 1.25, description: "Review", date: DateCoding.dateOnlyFormatter.date(from: "2026-09-01"))
        )
    }

    func testLenientDateDecoding() async throws {
        MockURLProtocol.requestHandler = { request in
            let date = request.url?.query == "full" ? "2026-09-01T12:30:00Z" : "2026-09-01"
            return Self.response(status: 200, body: #"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":""# + date + #""}]}"#)
        }
        let dateOnly = try await client.workEntries(clientId: nil)
        XCTAssertEqual(DateCoding.encode(dateOnly[0].date), "2026-09-01")
        let fullURL = URL(string: "http://localhost:3001")!
        let fullClient = LiveAPIClient(baseURL: fullURL, emailProvider: { "person@example.com" }, session: configuredSession())
        MockURLProtocol.requestHandler = { _ in
            Self.response(status: 200, body: #"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":"2026-09-01T12:30:00Z"}]}"#)
        }
        let full = try await fullClient.workEntries(clientId: nil)
        XCTAssertEqual(DateCoding.encode(full[0].date), "2026-09-01")
    }

    func testDecodesEpochMillisecondWorkEntryDate() async throws {
        MockURLProtocol.requestHandler = { _ in
            Self.response(status: 200, body: #"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":1788220800000}]}"#)
        }
        let entry = try await client.workEntries(clientId: nil)[0]
        XCTAssertEqual(DateCoding.encode(entry.date), "2026-09-01")
        XCTAssertEqual(Calendar.current.component(.year, from: entry.date), 2026)
        XCTAssertEqual(Calendar.current.component(.month, from: entry.date), 9)
        XCTAssertEqual(Calendar.current.component(.day, from: entry.date), 1)
    }

    func testDecodesEpochMillisecondReportDate() async throws {
        MockURLProtocol.requestHandler = { _ in
            Self.response(status: 200, body: #"{"client":{"id":1,"name":"Acme"},"workEntries":[{"id":2,"hours":2.5,"date":1788220800000}],"totalHours":2.5,"entryCount":1}"#)
        }
        let entry = try await client.report(clientId: 1).workEntries[0]
        XCTAssertEqual(DateCoding.encode(entry.date), "2026-09-01")
        XCTAssertEqual(Calendar.current.component(.year, from: entry.date), 2026)
        XCTAssertEqual(Calendar.current.component(.month, from: entry.date), 9)
        XCTAssertEqual(Calendar.current.component(.day, from: entry.date), 1)
    }

    func testDecodesISODateToSameLocalCalendarDay() async throws {
        MockURLProtocol.requestHandler = { _ in
            Self.response(status: 200, body: #"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":"2026-09-01T00:00:00.000Z"}]}"#)
        }
        let entry = try await client.workEntries(clientId: nil)[0]
        XCTAssertEqual(DateCoding.encode(entry.date), "2026-09-01")
        XCTAssertEqual(Calendar.current.component(.day, from: entry.date), 1)
    }

    func testMalformedDateSurfacesDecodingError() async {
        MockURLProtocol.requestHandler = { _ in
            Self.response(status: 200, body: #"{"workEntries":[{"id":1,"client_id":1,"hours":1,"date":true}]}"#)
        }
        do {
            _ = try await client.workEntries(clientId: nil)
            XCTFail("Expected a decoding error")
        } catch APIError.decoding {
            return
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDateOnlyRoundTripsInCurrentCalendar() throws {
        let decoded = try DateCoding.decode("2026-09-01")
        XCTAssertEqual(DateCoding.encode(decoded), "2026-09-01")
        XCTAssertEqual(Calendar.current.component(.day, from: decoded), 1)
    }

    func testErrorMapping() async {
        let statuses: [(Int, APIError)] = [(401, .unauthorized), (404, .notFound), (429, .rateLimited), (500, .server("boom"))]
        for (status, expected) in statuses {
            MockURLProtocol.requestHandler = { _ in
                Self.response(status: status, body: status == 500 ? #"{"error":"boom"}"# : #"{"error":"failure"}"#)
            }
            do {
                _ = try await client.clients()
                XCTFail("Expected an error for \(status)")
            } catch let error as APIError {
                switch (error, expected) {
                case (.unauthorized, .unauthorized), (.notFound, .notFound), (.rateLimited, .rateLimited):
                    break
                case (.server(let actual), .server(let wanted)):
                    XCTAssertEqual(actual, wanted)
                default:
                    XCTFail("Unexpected mapping for \(status): \(error)")
                }
            } catch {
                XCTFail("Unexpected error: \(error)")
            }
        }
    }

    private static func response(status: Int, body: String) -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(
            url: URL(string: "http://localhost:3001")!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        return (response, Data(body.utf8))
    }

    private func configuredSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    private static func requestBodyData(_ request: URLRequest) -> Data? {
        if let httpBody = request.httpBody {
            return httpBody
        }
        guard let stream = request.httpBodyStream else {
            return nil
        }

        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: bufferSize)
            guard count > 0 else { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
