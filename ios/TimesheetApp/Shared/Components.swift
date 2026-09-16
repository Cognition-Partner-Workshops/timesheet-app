import SwiftUI

/// Wraps an error message so it can drive `.alert(item:)`.
struct PresentableError: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String

    init(_ error: Error, title: String = "Something went wrong") {
        self.title = title
        self.message = (error as? APIError)?.errorDescription ?? error.localizedDescription
    }

    init(title: String, message: String) {
        self.title = title
        self.message = message
    }
}

extension View {
    func errorAlert(_ error: Binding<PresentableError?>) -> some View {
        alert(item: error) { presented in
            Alert(title: Text(presented.title), message: Text(presented.message), dismissButton: .default(Text("OK")))
        }
    }
}

struct ClientAvatar: View {
    let client: Client
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(color.gradient)
            Text(client.initials.isEmpty ? "?" : client.initials)
                .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var color: Color {
        let palette: [Color] = [.blue, .indigo, .purple, .pink, .orange, .teal, .green, .mint]
        return palette[abs(client.id) % palette.count]
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let systemImage: String
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(tint)
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(message)
        } actions: {
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

struct LoadFailureView: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Couldn't load your data", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Try Again") { Task { await retry() } }
                .buttonStyle(.borderedProminent)
        }
    }
}

struct WorkEntryRow: View {
    let entry: WorkEntry
    var showsClient = true

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                if showsClient {
                    Text(entry.clientName ?? "Unknown client")
                        .font(.body.weight(.medium))
                }
                if let description = entry.description, !description.isEmpty {
                    Text(description)
                        .font(showsClient ? .subheadline : .body)
                        .foregroundStyle(showsClient ? .secondary : .primary)
                        .lineLimit(2)
                } else if !showsClient {
                    Text("No notes")
                        .font(.body)
                        .foregroundStyle(.tertiary)
                }
                if !showsClient {
                    Text(entry.localDate.relativeDayLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            Text(HoursFormat.short(entry.hours))
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.accentColor)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
