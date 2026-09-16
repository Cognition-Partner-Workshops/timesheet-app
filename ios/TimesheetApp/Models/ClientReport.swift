import Foundation

/// Aggregated hours for a single client. The backend only returns `id` and
/// `name` for the client in this payload, so it uses its own summary type.
struct ClientReport: Decodable, Sendable {
    struct ClientSummary: Decodable, Hashable, Sendable {
        let id: Int
        let name: String
    }

    let client: ClientSummary
    let workEntries: [WorkEntry]
    let totalHours: Double
    let entryCount: Int
}

enum ExportFormat: String, CaseIterable, Identifiable, Sendable {
    case csv
    case pdf

    var id: String { rawValue }

    var title: String {
        switch self {
        case .csv: "CSV"
        case .pdf: "PDF"
        }
    }

    var fileExtension: String { rawValue }

    var systemImage: String {
        switch self {
        case .csv: "tablecells"
        case .pdf: "doc.richtext"
        }
    }
}
