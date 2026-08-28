import '../models/message.dart';
import 'database_service.dart';

class MessageService {
  final DatabaseService _db = DatabaseService();

  Future<void> sendMessage({
    required int senderId,
    required int receiverId,
    required String content,
  }) async {
    final message = ChatMessage(
      senderId: senderId,
      receiverId: receiverId,
      content: content,
    );
    await _db.insertMessage(message.toMap());
  }

  Future<List<ChatMessage>> getMessages(int userId, int friendId) async {
    final results = await _db.getMessages(userId, friendId);
    return results.map((map) => ChatMessage.fromMap(map)).toList();
  }

  Future<int> getUnreadCount(int userId) async {
    return _db.getUnreadCount(userId);
  }

  Future<int> getUnreadCountFrom(int userId, int senderId) async {
    return _db.getUnreadCountFrom(userId, senderId);
  }
}
