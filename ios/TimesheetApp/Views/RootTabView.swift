import SwiftUI

struct RootTabView: View {
    @ObservedObject var session: SessionStore
    @StateObject private var clientsModel: ClientsViewModel
    @StateObject private var entriesModel: EntriesViewModel
    @StateObject private var dashboardModel: DashboardViewModel

    init(session: SessionStore) {
        self.session = session
        let api = session.apiClient
        _clientsModel = StateObject(wrappedValue: ClientsViewModel(api: api))
        _entriesModel = StateObject(wrappedValue: EntriesViewModel(api: api))
        _dashboardModel = StateObject(wrappedValue: DashboardViewModel(api: api))
    }

    var body: some View {
        TabView {
            NavigationStack {
                DashboardView(model: dashboardModel, clientsModel: clientsModel, entriesModel: entriesModel)
            }
            .tabItem { Label("Dashboard", systemImage: "chart.bar.xaxis") }
            NavigationStack {
                ClientsListView(model: clientsModel)
            }
            .tabItem { Label("Clients", systemImage: "person.2") }
            NavigationStack {
                EntriesListView(model: entriesModel, clientsModel: clientsModel)
            }
            .tabItem { Label("Entries", systemImage: "clock") }
            NavigationStack {
                SettingsView(session: session)
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .id(session.baseURLString)
    }
}
