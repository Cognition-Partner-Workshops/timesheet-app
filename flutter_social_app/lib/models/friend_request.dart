enum FriendRequestStatus { pending, accepted, rejected }

class FriendRequest {
  final int? id;
  final int senderId;
  final int receiverId;
  final FriendRequestStatus status;
  final DateTime createdAt;
  final String? senderName;
  final String? receiverName;
  final String? senderUsername;
  final String? receiverUsername;

  FriendRequest({
    this.id,
    required this.senderId,
    required this.receiverId,
    this.status = FriendRequestStatus.pending,
    DateTime? createdAt,
    this.senderName,
    this.receiverName,
    this.senderUsername,
    this.receiverUsername,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sender_id': senderId,
      'receiver_id': receiverId,
      'status': status.name,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory FriendRequest.fromMap(Map<String, dynamic> map) {
    return FriendRequest(
      id: map['id'] as int?,
      senderId: map['sender_id'] as int,
      receiverId: map['receiver_id'] as int,
      status: FriendRequestStatus.values.firstWhere(
        (e) => e.name == (map['status'] as String),
      ),
      createdAt: DateTime.parse(map['created_at'] as String),
      senderName: map['sender_name'] as String?,
      receiverName: map['receiver_name'] as String?,
      senderUsername: map['sender_username'] as String?,
      receiverUsername: map['receiver_username'] as String?,
    );
  }
}
