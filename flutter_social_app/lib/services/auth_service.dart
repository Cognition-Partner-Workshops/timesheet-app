import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import '../models/user.dart';
import 'database_service.dart';

class AuthService extends ChangeNotifier {
  User? _currentUser;
  final DatabaseService _db = DatabaseService();

  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  String _hashPassword(String password) {
    final bytes = utf8.encode(password);
    return sha256.convert(bytes).toString();
  }

  Future<String?> register({
    required String username,
    required String email,
    required String password,
    required String displayName,
  }) async {
    final existing = await _db.queryUsers(
      where: 'username = ? OR email = ?',
      whereArgs: [username, email],
    );

    if (existing.isNotEmpty) {
      final existingUser = existing.first;
      if (existingUser['username'] == username) {
        return 'Username already taken';
      }
      return 'Email already registered';
    }

    final user = User(
      username: username,
      email: email,
      passwordHash: _hashPassword(password),
      displayName: displayName,
    );

    final id = await _db.insertUser(user.toMap());
    _currentUser = user.copyWith(id: id);
    notifyListeners();
    return null;
  }

  Future<String?> login({
    required String username,
    required String password,
  }) async {
    final results = await _db.queryUsers(
      where: 'username = ?',
      whereArgs: [username],
    );

    if (results.isEmpty) {
      return 'User not found';
    }

    final user = User.fromMap(results.first);
    if (user.passwordHash != _hashPassword(password)) {
      return 'Invalid password';
    }

    _currentUser = user;
    notifyListeners();
    return null;
  }

  void logout() {
    _currentUser = null;
    notifyListeners();
  }
}
