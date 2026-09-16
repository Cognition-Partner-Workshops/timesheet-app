import Foundation
import Testing
@testable import TimesheetApp

struct ModelDecodingTests {
    private let decoder = JSONDecoder()

    @Test func decodesWorkEntryWithEpochMillisecondDate() throws {
        let json = """
        {"id":1,"client_id":1,"hours":2.5,"description":"x","date":1789430400000,
         "created_at":"2026-09-16 12:43:49","updated_at":"2026-09-16 12:43:49","client_name":"Acme"}
        """
        let entry = try decoder.decode(WorkEntry.self, from: Data(json.utf8))
        #expect(entry.id == 1)
        #expect(entry.clientId == 1)
        #expect(entry.clientName == "Acme")
        #expect(entry.hours == 2.5)
        #expect(entry.date == Date(timeIntervalSince1970: 1_789_430_400))
        #expect(APIDate.dayString(from: entry.localDate) == "2026-09-15")
    }

    @Test func decodesWorkEntryWithDayStringAndStringHours() throws {
        let json = """
        {"id":7,"client_id":3,"hours":"1.25","description":null,"date":"2026-01-31"}
        """
        let entry = try decoder.decode(WorkEntry.self, from: Data(json.utf8))
        #expect(entry.hours == 1.25)
        #expect(entry.description == nil)
        #expect(APIDate.dayString(from: entry.localDate) == "2026-01-31")
    }

    @Test func decodesReportWithPartialClient() throws {
        let json = """
        {"client":{"id":1,"name":"Acme"},
         "workEntries":[{"id":1,"hours":2.5,"description":"x","date":1789430400000}],
         "totalHours":2.5,"entryCount":1}
        """
        let report = try decoder.decode(ClientReport.self, from: Data(json.utf8))
        #expect(report.client.name == "Acme")
        #expect(report.workEntries.count == 1)
        #expect(report.workEntries[0].clientId == nil)
        #expect(report.totalHours == 2.5)
    }

    @Test func decodesClientsEnvelope() throws {
        let json = """
        {"clients":[{"id":1,"name":"Acme","description":null,"department":"Eng","email":null,
                     "created_at":"2026-09-16 12:43:49","updated_at":"2026-09-16 12:43:49"}]}
        """
        let response = try decoder.decode(ClientsResponse.self, from: Data(json.utf8))
        #expect(response.clients.first?.department == "Eng")
        #expect(response.clients.first?.initials == "A")
    }

    @Test func clientPayloadDropsBlankOptionalFields() throws {
        let payload = ClientPayload(name: "  Acme ", description: "   ", department: "Eng", email: "")
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]
        #expect(json?["name"] as? String == "Acme")
        #expect(json?["department"] as? String == "Eng")
        #expect(json?["description"] == nil)
        #expect(json?["email"] == nil)
    }

    @Test func workEntryPayloadRoundsHoursAndFormatsDay() throws {
        var components = DateComponents()
        components.year = 2026
        components.month = 3
        components.day = 9
        components.hour = 23
        let date = Calendar.current.date(from: components)!
        let payload = WorkEntryPayload(clientId: 4, hours: 1.239, description: " notes ", date: date)
        #expect(payload.hours == 1.24)
        #expect(payload.date == "2026-03-09")
        #expect(payload.description == "notes")
    }

    @Test func parsesSQLiteTimestamps() {
        let date = APIDate.parseTimestamp("2026-09-16 12:43:49")
        #expect(date == Date(timeIntervalSince1970: 1_789_562_629))
    }

    @Test func formatsHours() {
        #expect(HoursFormat.short(8) == "8 h")
        #expect(HoursFormat.short(1.5) == "1.5 h")
        #expect(HoursFormat.long(1.5) == "1h 30m")
        #expect(HoursFormat.long(0.25) == "15 min")
        #expect(HoursFormat.long(2) == "2 hours")
    }
}
