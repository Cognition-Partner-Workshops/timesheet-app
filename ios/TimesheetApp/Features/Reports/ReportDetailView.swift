import Charts
import SwiftUI
import UniformTypeIdentifiers

struct ReportDetailView: View {
    let clientId: Int

    @Environment(TimesheetStore.self) private var store

    @State private var report: ClientReport?
    @State private var isLoading = false
    @State private var exporting: ExportFormat?
    @State private var exportedFile: ExportedFile?
    @State private var error: PresentableError?

    var body: some View {
        Group {
            if let report {
                content(report)
            } else if isLoading {
                ProgressView("Building report…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                LoadFailureView(message: "The report could not be loaded.") { await load() }
            }
        }
        .navigationTitle(report?.client.name ?? store.client(id: clientId)?.name ?? "Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(ExportFormat.allCases) { format in
                        Button {
                            export(format)
                        } label: {
                            Label("Export \(format.title)", systemImage: format.systemImage)
                        }
                    }
                } label: {
                    if exporting != nil {
                        ProgressView()
                    } else {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                }
                .disabled(report == nil || exporting != nil)
                .accessibilityIdentifier("report.export")
            }
        }
        .task(id: store.entries) { await load() }
        .sheet(item: $exportedFile) { file in
            ShareSheet(items: [file.url])
                .presentationDetents([.medium, .large])
                .ignoresSafeArea()
        }
        .errorAlert($error)
    }

    private func content(_ report: ClientReport) -> some View {
        List {
            Section {
                HStack(spacing: 12) {
                    StatCard(title: "Total hours", value: HoursFormat.short(report.totalHours), systemImage: "sum")
                    StatCard(title: "Entries", value: "\(report.entryCount)", systemImage: "list.bullet.rectangle", tint: .teal)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            if !report.workEntries.isEmpty {
                Section("Hours by day") {
                    Chart(dailyTotals(report)) { item in
                        BarMark(x: .value("Day", item.day, unit: .day), y: .value("Hours", item.hours))
                            .foregroundStyle(Color.accentColor.gradient)
                            .cornerRadius(3)
                    }
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                            AxisGridLine()
                            AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        }
                    }
                    .frame(height: 160)
                    .padding(.vertical, 4)
                }
            }

            Section {
                if report.workEntries.isEmpty {
                    Text("No work entries yet.").foregroundStyle(.secondary)
                } else {
                    ForEach(report.workEntries) { entry in
                        WorkEntryRow(entry: entry, showsClient: false)
                    }
                }
            } header: {
                Text("Entries")
            } footer: {
                Text("Export a CSV to open in a spreadsheet, or a PDF to send to the client.")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    private func dailyTotals(_ report: ClientReport) -> [DailyHours] {
        Dictionary(grouping: report.workEntries) { Calendar.current.startOfDay(for: $0.localDate) }
            .map { DailyHours(day: $0.key, hours: $0.value.reduce(0) { $0 + $1.hours }) }
            .sorted { $0.day < $1.day }
    }

    private func load() async {
        isLoading = report == nil
        defer { isLoading = false }
        do {
            report = try await store.api.report(clientId: clientId)
        } catch {
            if report == nil {
                self.error = PresentableError(error, title: "Couldn't load report")
            }
        }
    }

    private func export(_ format: ExportFormat) {
        guard let report, exporting == nil else { return }
        exporting = format
        let api = store.api
        Task {
            defer { exporting = nil }
            do {
                let data = try await api.exportReport(clientId: clientId, format: format)
                exportedFile = try ExportedFile.write(data, clientName: report.client.name, format: format)
            } catch {
                self.error = PresentableError(error, title: "Couldn't export \(format.title)")
            }
        }
    }
}

struct ExportedFile: Identifiable {
    let url: URL
    var id: URL { url }

    static func write(_ data: Data, clientName: String, format: ExportFormat) throws -> ExportedFile {
        let safeName = clientName
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " -_")).inverted)
            .joined()
            .replacingOccurrences(of: " ", with: "_")
        let stamp = APIDate.dayString(from: .now)
        let directory = FileManager.default.temporaryDirectory.appending(path: "exports", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appending(path: "\(safeName.isEmpty ? "report" : safeName)_\(stamp).\(format.fileExtension)")
        try data.write(to: url, options: .atomic)
        return ExportedFile(url: url)
    }
}

/// `ShareLink` needs the file up-front; exports are fetched on demand, so the
/// UIKit activity controller is used once the file exists.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
