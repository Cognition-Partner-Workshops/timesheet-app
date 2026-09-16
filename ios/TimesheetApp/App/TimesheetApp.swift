import SwiftUI

@main
struct TimesheetApp: App {
    @State private var session: SessionStore
    @State private var store: TimesheetStore

    init() {
        let session = SessionStore()
        _session = State(initialValue: session)
        _store = State(initialValue: TimesheetStore(api: session.api))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(store)
        }
    }
}
