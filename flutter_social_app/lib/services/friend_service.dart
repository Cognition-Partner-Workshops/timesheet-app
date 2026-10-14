import '../models/friend_request.dart';
import '../models/user.dart';
import 'database_service.dart';

class FriendService {
  final DatabaseService _db = DatabaseService();

  Future<List<User>> searchUsers(String query, int currentUserId) async {
    final results = await _db.queryUsers(
      where: '(username LIKE ? OR display_name LIKE ?) AND id != ?',
      whereArgs: ['%$query%', '%$query%', currentUserId],
    );
    return results.map((map) => User.fromMap(map)).toList();
  }

  Future<String?> sendFriendRequest(int senderId, int receiverId) async {
    final existing = await _db.queryFriendRequests(
      where: '(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      whereArgs: [senderId, receiverId, receiverId, senderId],
    );

    if (existing.isNotEmpty) {
      final status = existing.first['status'] as String;
      if (status == 'accepted') return 'Already friends';
      if (status == 'pending') return 'Request already pending';
    }

    final request = FriendRequest(
      senderId: senderId,
      receiverId: receiverId,
    );

    await _db.insertFriendRequest(request.toMap());
    return null;
  }

  Future<List<FriendRequest>> getPendingRequests(int userId) async {
    final results = await _db.getPendingRequestsWithUsers(userId);
    return results.map((map) => FriendRequest.fromMap(map)).toList();
  }

  Future<List<FriendRequest>> getSentRequests(int userId) async {
    final results = await _db.getSentRequestsWithUsers(userId);
    return results.map((map) => FriendRequest.fromMap(map)).toList();
  }

  Future<void> acceptFriendRequest(int requestId) async {
    await _db.updateFriendRequestStatus(requestId, 'accepted');
  }

  Future<void> rejectFriendRequest(int requestId) async {
    await _db.updateFriendRequestStatus(requestId, 'rejected');
  }

  Future<List<User>> getFriends(int userId) async {
    final results = await _db.getFriends(userId);
    return results.map((map) => User.fromMap(map)).toList();
  }

  Future<String?> getFriendshipStatus(int userId, int otherUserId) async {
    final results = await _db.queryFriendRequests(
      where: '(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      whereArgs: [userId, otherUserId, otherUserId, userId],
    );

    if (results.isEmpty) return null;

    final request = results.first;
    final status = request['status'] as String;
    if (status == 'accepted') return 'friends';
    if (status == 'pending') {
      if (request['sender_id'] == userId) return 'request_sent';
      return 'request_received';
    }
    return null;
  }
}
