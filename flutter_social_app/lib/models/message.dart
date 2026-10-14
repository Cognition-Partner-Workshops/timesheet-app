class ChatMessage {
  final int? id;
  final int senderId;
  final int receiverId;
  final String content;
  final DateTime createdAt;
  final bool isRead;
  final String? senderName;

  ChatMessage({
    this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    DateTime? createdAt,
    this.isRead = false,
    this.senderName,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sender_id': senderId,
      'receiver_id': receiverId,
      'content': content,
      'created_at': createdAt.toIso8601String(),
      'is_read': isRead ? 1 : 0,
    };
  }

  factory ChatMessage.fromMap(Map<String, dynamic> map) {
    return ChatMessage(
      id: map['id'] as int?,
      senderId: map['sender_id'] as int,
      receiverId: map['receiver_id'] as int,
      content: map['content'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
      isRead: (map['is_read'] as int) == 1,
      senderName: map['sender_name'] as String?,
    );
  }
}
