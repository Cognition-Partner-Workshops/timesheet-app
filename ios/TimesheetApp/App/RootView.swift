import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(TimesheetStore.self) private var store

    var body: some View {
        Group {
            if session.isSignedIn {
                MainTabView()
                    .transition(.opacity)
            } else {
                LoginView()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: session.isSignedIn)
        .onChange(of: session.email) { _, _ in
            store.api = session.api
            store.reset()
        }
        .onChange(of: session.baseURL) { _, _ in
            store.api = session.api
            store.reset()
        }
    }
}

struct MainTabView: View {
    enum Tab: Hashable {
        case dashboard, clients, entries, reports
    }

    @State private var selection: Tab = .dashboard
    @Environment(TimesheetStore.self) private var store
    @Environment(SessionStore.self) private var session

    var body: some View {
        TabView(selection: $selection) {
            DashboardView(selectTab: { selection = $0 })
                .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }
                .tag(Tab.dashboard)

            ClientsView()
                .tabItem { Label("Clients", systemImage: "person.2") }
                .tag(Tab.clients)

            WorkEntriesView()
                .tabItem { Label("Time", systemImage: "clock") }
                .tag(Tab.entries)

            ReportsView()
                .tabItem { Label("Reports", systemImage: "chart.bar.doc.horizontal") }
                .tag(Tab.reports)
        }
        .task(id: session.email) {
            await store.loadIfNeeded()
        }
        .onChange(of: store.state) { _, newState in
            if case .failed(let message) = newState, message == APIError.unauthorized.errorDescription {
                session.signOut()
            }
        }
    }
}
