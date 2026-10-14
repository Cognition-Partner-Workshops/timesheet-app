import 'package:flutter_test/flutter_test.dart';

import 'package:social_connect/main.dart';

void main() {
  testWidgets('App renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const SocialConnectApp());
    await tester.pumpAndSettle();

    expect(find.text('Social Connect'), findsOneWidget);
    expect(find.text('Login'), findsOneWidget);
  });
}
