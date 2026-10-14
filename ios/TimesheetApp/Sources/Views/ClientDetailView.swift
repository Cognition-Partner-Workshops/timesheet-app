import SwiftUI

struct ClientDetailView: View {
    @State var client: Client
    var onChange: () -> Void

    @State private var report: ClientReport?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingEdit = false
    @State private var showingAddEntry = false
    @State private var exportedFileURL: URL?
    @State private var isExporting = false

    var body: some View {
        List {
            Section("Client") {
                LabeledContent("Name", value: client.name)
                if let department = client.department, !department.isEmpty {
                    LabeledContent("Department", value: department)
                }
                if let email = client.email, !email.isEmpty {
                    LabeledContent("Email", value: email)
                }
                if let description = client.description, !description.isEmpty {
                    Text(description).foregroundStyle(.secondary)
                }
            }

            if let report {
                Section("Summary") {
                    LabeledContent("Total Hours", value: String(format: "%.2f", report.totalHours))
                    LabeledContent("Entries", value: "\(report.entryCount)")
                }

                Section("Work Entries") {
                    if report.workEntries.isEmpty {
                        Text("No work entries yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(report.workEntries) { entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(DateParsing.displayString(entry.date))
                                    .font(.subheadline.weight(.medium))
                                if let description = entry.description, !description.isEmpty {
                                    Text(description)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            Spacer()
                            Text(String(format: "%.2f h", entry.hours))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.tint)
                        }
                    }
                }

                Section("Export Report") {
                    Button {
                        Task { await export(format: "pdf") }
                    } label: {
                        Label("Export as PDF", systemImage: "doc.richtext")
                    }
                    Button {
                        Task { await export(format: "csv") }
                    } label: {
                        Label("Export as CSV", systemImage: "tablecells")
                    }
                }
                .disabled(isExporting)
            } else if isLoading {
                Section { ProgressView("Loading report…") }
            }
        }
        .navigationTitle(client.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    showingAddEntry = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add Entry")
                Button("Edit") { showingEdit = true }
            }
        }
        .sheet(isPresented: $showingEdit) {
            ClientFormView(client: client) { updated in
                client = updated
                onChange()
                Task { await load() }
            }
        }
        .sheet(isPresented: $showingAddEntry) {
            WorkEntryFormView(preselectedClientId: client.id) { _ in
                Task { await load() }
            }
        }
        .sheet(item: $exportedFileURL) { url in
            ShareSheet(items: [url])
        }
        .refreshable { await load() }
        .task { await load() }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            report = try await APIClient.shared.fetchClientReport(clientId: client.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func export(format: String) async {
        isExporting = true
        defer { isExporting = false }
        do {
            exportedFileURL = try await APIClient.shared.downloadReport(clientId: client.id, format: format)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

extension URL: Identifiable {
    public var id: String { absoluteString }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
