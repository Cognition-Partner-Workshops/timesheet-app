import SwiftUI

@main
struct TimesheetApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isSignedIn {
                    RootTabView(session: session)
                } else {
                    LoginView(session: session)
                }
            }
            .tint(Color("AppAccent"))
        }
    }
}
