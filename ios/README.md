# TimesheetApp iOS client

## Prerequisites

- macOS with Xcode 26.6 or later
- XcodeGen (`/opt/homebrew/bin/xcodegen`)
- An iOS 17 or later simulator

The app uses only Foundation, SwiftUI, and system frameworks. XcodeGen is the
source of truth for the Xcode project:

```sh
cd ios
xcodegen generate
```

## Run the backend

From the repository root:

```sh
cd backend
npm install
npm run dev
```

The development backend listens on port 3001. The simulator can reach a
backend running on the Mac at `http://localhost:3001`.

## Point the app at another host

On the login screen, expand **Advanced** and edit **Server URL**. The value is
stored in the app's settings for the next launch. For a physical device, use
the Mac's LAN IP and ensure the backend is bound to an address reachable by the
device.

## Build and test

```sh
xcodebuild -project TimesheetApp.xcodeproj \
  -scheme TimesheetApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

xcodebuild -project TimesheetApp.xcodeproj \
  -scheme TimesheetApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```
