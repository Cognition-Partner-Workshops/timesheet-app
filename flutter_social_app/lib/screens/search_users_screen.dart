import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/friend_service.dart';

class SearchUsersScreen extends StatefulWidget {
  const SearchUsersScreen({super.key});

  @override
  State<SearchUsersScreen> createState() => _SearchUsersScreenState();
}

class _SearchUsersScreenState extends State<SearchUsersScreen> {
  final FriendService _friendService = FriendService();
  final TextEditingController _searchController = TextEditingController();
  List<User> _searchResults = [];
  Map<int, String> _friendshipStatuses = {};
  bool _isSearching = false;
  bool _hasSearched = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    final currentUser = context.read<AuthService>().currentUser;
    if (currentUser?.id == null) return;

    setState(() {
      _isSearching = true;
      _hasSearched = true;
    });

    final results = await _friendService.searchUsers(query, currentUser!.id!);
    final statuses = <int, String>{};
    for (final user in results) {
      final status =
          await _friendService.getFriendshipStatus(currentUser.id!, user.id!);
      if (status != null) {
        statuses[user.id!] = status;
      }
    }

    if (!mounted) return;
    setState(() {
      _searchResults = results;
      _friendshipStatuses = statuses;
      _isSearching = false;
    });
  }

  Future<void> _sendFriendRequest(User targetUser) async {
    final currentUser = context.read<AuthService>().currentUser;
    if (currentUser?.id == null || targetUser.id == null) return;

    final error = await _friendService.sendFriendRequest(
      currentUser!.id!,
      targetUser.id!,
    );

    if (!mounted) return;

    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: Colors.orange),
      );
    } else {
      setState(() {
        _friendshipStatuses[targetUser.id!] = 'request_sent';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Friend request sent!'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Widget _buildStatusButton(User user) {
    final status = _friendshipStatuses[user.id!];

    if (status == 'friends') {
      return Chip(
        label: const Text('Friends'),
        avatar: const Icon(Icons.check_circle, size: 18, color: Colors.green),
        backgroundColor: Colors.green[50],
      );
    }

    if (status == 'request_sent') {
      return Chip(
        label: const Text('Pending'),
        avatar: const Icon(Icons.hourglass_top, size: 18, color: Colors.orange),
        backgroundColor: Colors.orange[50],
      );
    }

    if (status == 'request_received') {
      return Chip(
        label: const Text('Respond'),
        avatar: const Icon(Icons.mail, size: 18, color: Colors.blue),
        backgroundColor: Colors.blue[50],
      );
    }

    return ElevatedButton.icon(
      onPressed: () => _sendFriendRequest(user),
      icon: const Icon(Icons.person_add, size: 18),
      label: const Text('Add Friend'),
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Find People'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by username or name...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _search,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onSubmitted: (_) => _search(),
            ),
          ),
          Expanded(
            child: _isSearching
                ? const Center(child: CircularProgressIndicator())
                : !_hasSearched
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.person_search,
                                size: 80, color: Colors.grey[300]),
                            const SizedBox(height: 16),
                            Text(
                              'Search for people',
                              style: TextStyle(
                                fontSize: 18,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Find friends by username or display name',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          ],
                        ),
                      )
                    : _searchResults.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.search_off,
                                    size: 60, color: Colors.grey[300]),
                                const SizedBox(height: 16),
                                Text(
                                  'No users found',
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            itemCount: _searchResults.length,
                            itemBuilder: (context, index) {
                              final user = _searchResults[index];
                              return Card(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: Colors.deepPurple[100],
                                    child: Text(
                                      user.displayName[0].toUpperCase(),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.deepPurple,
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    user.displayName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  subtitle: Text('@${user.username}'),
                                  trailing: _buildStatusButton(user),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
