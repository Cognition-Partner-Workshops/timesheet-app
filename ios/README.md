# Timesheet iOS app

Native SwiftUI client for the timesheet backend in `../backend`. It covers the same
workflows as the web frontend: email sign-in, client management, time entries,
per-client reports, and CSV/PDF export (shared through the iOS share sheet).

## Requirements

- Xcode 16 or newer (iOS 17.0 deployment target, Swift 6 with strict concurrency)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- The backend running locally: `cd ../backend && npm install && npm run dev`

## Getting started

```bash
cd ios
xcodegen generate          # creates TimesheetApp.xcodeproj from project.yml
open TimesheetApp.xcodeproj
```

Run the `TimesheetApp` scheme on any iPhone or iPad simulator. The app talks to
`http://localhost:3001` by default; change the server URL from the gear button on
the sign-in screen (or Settings after signing in) when the backend runs elsewhere,
e.g. on a LAN address for a physical device.

Sign in with any email. The backend creates the account on first login and every
request afterwards carries the `x-user-email` header the API expects.

## Command line

```bash
xcodebuild -project TimesheetApp.xcodeproj -scheme TimesheetApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' build

xcodebuild -project TimesheetApp.xcodeproj -scheme TimesheetApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

## Layout

```
TimesheetApp/
  App/          entry point, root/tab navigation
  Features/     one folder per screen: Auth, Dashboard, Clients, Entries, Reports, Settings
  Models/       Codable models mirroring the API (Client, WorkEntry, ClientReport, envelopes)
  Networking/   APIClient (URLSession + async/await) and typed APIError
  Services/     KeychainStore, SessionStore (identity + server URL), TimesheetStore (shared cache)
  Shared/       formatting helpers and reusable views
TimesheetAppTests/
  Swift Testing suites for decoding, APIClient (via a mock URLProtocol), and TimesheetStore
```

## Notes

- `WorkEntry.date` accepts the millisecond timestamps the API returns as well as
  `YYYY-MM-DD` / ISO 8601 strings; outgoing dates are always sent as `YYYY-MM-DD`.
- The signed-in email lives in the Keychain; the server URL lives in `UserDefaults`.
- `NSAllowsLocalNetworking` is enabled so the simulator can reach the plain-HTTP dev server.
- Interactive controls carry accessibility identifiers (`login.email`, `clients.add`,
  `entryForm.save`, ...) for UI automation.
