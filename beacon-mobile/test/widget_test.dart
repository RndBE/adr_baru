import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:beacon_mobile/main.dart';
import 'package:beacon_mobile/data/demo_repository.dart';
import 'package:beacon_mobile/screens/prisms.dart';
import 'package:beacon_mobile/screens/control.dart';

void main() {
  Future<DemoRepository> launch(
    WidgetTester tester, {
    Size size = const Size(390, 844),
    bool login = true,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = DemoRepository(persist: false);
    addTearDown(repo.dispose);
    if (login) repo.login('operator', 'beacon123');
    await tester.pumpWidget(BeaconApp(repo: repo));
    await tester.pumpAndSettle();
    return repo;
  }

  testWidgets('login validates credentials and enters demo', (tester) async {
    await launch(tester, login: false);
    await tester.tap(find.text('Masuk'));
    await tester.pump();
    expect(find.text('Isi username'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first, 'wrong');
    await tester.enterText(find.byType(TextFormField).last, 'wrong');
    await tester.tap(find.text('Masuk'));
    await tester.pump();
    expect(find.textContaining('Gunakan akun demo'), findsOneWidget);
    await tester.ensureVisible(find.text('Jelajahi demo →'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Jelajahi demo →'));
    await tester.pumpAndSettle();
    expect(find.text('Kondisi lapangan,\ndalam jangkauan.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  for (final width in [320.0, 390.0, 600.0]) {
    testWidgets('four destinations fit width $width', (tester) async {
      await launch(tester, size: Size(width, 844));
      for (final label in ['Ringkasan', 'Kontrol', 'Prisma', 'Hasil']) {
        await tester.tap(find.text(label).last);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: label);
        await tester.drag(find.byType(ListView).first, const Offset(0, -450));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: 'scrolled $label');
      }
      expect(find.text('Master Data'), findsNothing);
      expect(find.text('Visualisasi 3D'), findsNothing);
    });
  }
  testWidgets('site selection resets lock and shows empty site', (
    tester,
  ) async {
    final repo = await launch(tester);
    repo.unlock('123456');
    await tester.tap(find.text('CCP').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Site Utara'));
    await tester.pumpAndSettle();
    expect(repo.site.id, 'north');
    expect(repo.unlocked, false);
    expect(find.text('Site Utara'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('slot edit needs successful measurement before save', (
    tester,
  ) async {
    final repo = await launch(tester);
    repo.unlock('123456');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PrismForm(repo: repo, prism: repo.site.prisms[12]),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final save = find.widgetWithText(FilledButton, 'Simpan prisma');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await tester.enterText(find.byType(TextFormField).first, 'PR-13');
    await tester.ensureVisible(find.text('Uji tembak FS'));
    await tester.tap(find.text('Uji tembak FS'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
    await tester.enterText(find.byType(TextFormField).first, 'PR-14');
    await tester.pump();
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
  });
  testWidgets('config validates instrument limits', (tester) async {
    final repo = await launch(tester);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: ConfigForm(repo: repo)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final retries = find.byWidgetPredicate(
      (w) => w is TextFormField && w.controller?.text == '3',
    );
    await tester.enterText(retries, '99');
    await tester.ensureVisible(find.text('Simpan konfigurasi'));
    await tester.tap(find.text('Simpan konfigurasi'));
    await tester.pump();
    expect(find.text('Retries harus 1–15 (bilangan bulat)'), findsOneWidget);
    expect(repo.site.config['Retries'], '3');
  });
  testWidgets('refresh error supports retry', (tester) async {
    final repo = await launch(tester);
    repo.refresh(fail: true);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Coba lagi'), findsOneWidget);
    await tester.tap(find.text('Coba lagi'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Kondisi lapangan,\ndalam jangkauan.'), findsOneWidget);
  });
}
