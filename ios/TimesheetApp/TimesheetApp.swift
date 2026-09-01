import SwiftUI

@main
struct TimesheetApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isSignedIn {
                    RootTabView(session: session)
                        .id(session.baseURLString)
                } else {
                    LoginView(session: session)
                }
            }
            .tint(Color("AppAccent"))
        }
    }
}
