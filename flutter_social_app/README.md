# Social Connect - Flutter App

A Flutter-based social networking application where users can connect with friends, send friend requests, and chat with each other.

## Features

- **User Registration & Login** - Create an account with username, email, display name and password. Login with username and password.
- **Home Dashboard** - Quick access to all app features with a welcoming user profile card.
- **Friend List** - View all your accepted friends with option to chat.
- **User Search** - Search users by username or display name and send friend requests.
- **Friend Requests** - View received requests (accept/reject) and sent requests (pending status) with tabbed interface.
- **Real-time Chat** - Send and receive messages with friends in a chat bubble interface with auto-refresh.
- **Profile View** - View your profile information.

## Tech Stack

- **Flutter** 3.x with Dart
- **SQLite** (via sqflite) for local data persistence
- **Provider** for state management
- **Crypto** for password hashing (SHA-256)
- **Material Design 3** UI components

## Project Structure

```
lib/
  main.dart                          # App entry point with Provider setup
  models/
    user.dart                        # User data model
    friend_request.dart              # Friend request model with status enum
    message.dart                     # Chat message model
  services/
    database_service.dart            # SQLite database initialization & schema
    auth_service.dart                # Authentication (login/register/logout)
    friend_service.dart              # Friend requests, search, friend list
    message_service.dart             # Chat messaging service
  screens/
    login_screen.dart                # Login page
    register_screen.dart             # Registration page
    home_screen.dart                 # Home dashboard with action cards
    friends_list_screen.dart         # Friends list with chat access
    search_users_screen.dart         # User search with friend request
    friend_requests_screen.dart      # Received & sent requests (tabbed)
    chat_screen.dart                 # Chat interface with message bubbles
```

## Getting Started

### Prerequisites

- Flutter SDK 3.x or later
- Dart SDK 3.x or later

### Setup

```bash
cd flutter_social_app
flutter pub get
```

### Run

```bash
flutter run
```

### Analyze

```bash
flutter analyze
```

### Test

```bash
flutter test
```

## Architecture

- **Local-first**: All data is stored in a local SQLite database on the device. No external backend required.
- **Provider pattern**: Auth state is managed via Provider/ChangeNotifier for reactive UI updates.
- **Service layer**: Business logic is separated into service classes (AuthService, FriendService, MessageService).
- **Model classes**: Data models with `toMap()`/`fromMap()` for SQLite serialization.
