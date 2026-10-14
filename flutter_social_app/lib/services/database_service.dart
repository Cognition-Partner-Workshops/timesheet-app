class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  final List<Map<String, dynamic>> _users = [];
  final List<Map<String, dynamic>> _friendRequests = [];
  final List<Map<String, dynamic>> _messages = [];
  int _userIdCounter = 1;
  int _requestIdCounter = 1;
  int _messageIdCounter = 1;

  Future<int> insertUser(Map<String, dynamic> user) async {
    final id = _userIdCounter++;
    user['id'] = id;
    _users.add(Map<String, dynamic>.from(user));
    return id;
  }

  Future<List<Map<String, dynamic>>> queryUsers({
    String? where,
    List<dynamic>? whereArgs,
  }) async {
    if (where == null) return List.from(_users);

    if (where == 'username = ? OR email = ?') {
      return _users.where((u) =>
        u['username'] == whereArgs![0] || u['email'] == whereArgs[1]
      ).toList();
    }

    if (where == 'username = ?') {
      return _users.where((u) => u['username'] == whereArgs![0]).toList();
    }

    if (where.contains('LIKE') && where.contains('id != ?')) {
      final query = (whereArgs![0] as String).replaceAll('%', '').toLowerCase();
      final excludeId = whereArgs[2] as int;
      return _users.where((u) =>
        u['id'] != excludeId &&
        ((u['username'] as String).toLowerCase().contains(query) ||
         (u['display_name'] as String).toLowerCase().contains(query))
      ).toList();
    }

    return [];
  }

  Future<int> insertFriendRequest(Map<String, dynamic> request) async {
    final id = _requestIdCounter++;
    request['id'] = id;
    _friendRequests.add(Map<String, dynamic>.from(request));
    return id;
  }

  Future<List<Map<String, dynamic>>> queryFriendRequests({
    String? where,
    List<dynamic>? whereArgs,
  }) async {
    if (where == null) return List.from(_friendRequests);

    if (where.contains('sender_id = ? AND receiver_id = ?') && where.contains('OR')) {
      return _friendRequests.where((r) =>
        (r['sender_id'] == whereArgs![0] && r['receiver_id'] == whereArgs[1]) ||
        (r['sender_id'] == whereArgs[2] && r['receiver_id'] == whereArgs[3])
      ).toList();
    }

    return [];
  }

  Future<List<Map<String, dynamic>>> getPendingRequestsWithUsers(int userId) async {
    return _friendRequests
        .where((r) => r['receiver_id'] == userId && r['status'] == 'pending')
        .map((r) {
          final sender = _users.firstWhere((u) => u['id'] == r['sender_id']);
          final receiver = _users.firstWhere((u) => u['id'] == r['receiver_id']);
          return {
            ...r,
            'sender_name': sender['display_name'],
            'sender_username': sender['username'],
            'receiver_name': receiver['display_name'],
            'receiver_username': receiver['username'],
          };
        })
        .toList()
      ..sort((a, b) => (b['created_at'] as String).compareTo(a['created_at'] as String));
  }

  Future<List<Map<String, dynamic>>> getSentRequestsWithUsers(int userId) async {
    return _friendRequests
        .where((r) => r['sender_id'] == userId && r['status'] == 'pending')
        .map((r) {
          final sender = _users.firstWhere((u) => u['id'] == r['sender_id']);
          final receiver = _users.firstWhere((u) => u['id'] == r['receiver_id']);
          return {
            ...r,
            'sender_name': sender['display_name'],
            'sender_username': sender['username'],
            'receiver_name': receiver['display_name'],
            'receiver_username': receiver['username'],
          };
        })
        .toList()
      ..sort((a, b) => (b['created_at'] as String).compareTo(a['created_at'] as String));
  }

  Future<void> updateFriendRequestStatus(int requestId, String status) async {
    final index = _friendRequests.indexWhere((r) => r['id'] == requestId);
    if (index != -1) {
      _friendRequests[index]['status'] = status;
    }
  }

  Future<List<Map<String, dynamic>>> getFriends(int userId) async {
    final acceptedRequests = _friendRequests.where((r) =>
      r['status'] == 'accepted' &&
      (r['sender_id'] == userId || r['receiver_id'] == userId)
    );

    final friendIds = acceptedRequests.map((r) =>
      r['sender_id'] == userId ? r['receiver_id'] : r['sender_id']
    ).toSet();

    return _users.where((u) => friendIds.contains(u['id']))
        .toList()
      ..sort((a, b) => (a['display_name'] as String).compareTo(b['display_name'] as String));
  }

  Future<int> insertMessage(Map<String, dynamic> message) async {
    final id = _messageIdCounter++;
    message['id'] = id;
    _messages.add(Map<String, dynamic>.from(message));
    return id;
  }

  Future<List<Map<String, dynamic>>> getMessages(int userId, int friendId) async {
    final msgs = _messages.where((m) =>
      (m['sender_id'] == userId && m['receiver_id'] == friendId) ||
      (m['sender_id'] == friendId && m['receiver_id'] == userId)
    ).map((m) {
      final sender = _users.firstWhere((u) => u['id'] == m['sender_id']);
      return {...m, 'sender_name': sender['display_name']};
    }).toList()
      ..sort((a, b) => (a['created_at'] as String).compareTo(b['created_at'] as String));

    for (final m in _messages) {
      if (m['sender_id'] == friendId && m['receiver_id'] == userId && m['is_read'] == 0) {
        m['is_read'] = 1;
      }
    }

    return msgs;
  }

  Future<int> getUnreadCount(int userId) async {
    return _messages.where((m) =>
      m['receiver_id'] == userId && m['is_read'] == 0
    ).length;
  }

  Future<int> getUnreadCountFrom(int userId, int senderId) async {
    return _messages.where((m) =>
      m['receiver_id'] == userId && m['sender_id'] == senderId && m['is_read'] == 0
    ).length;
  }
}
