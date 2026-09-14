// flutter test test/widget_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:beacon_mobile/main.dart';
import 'package:beacon_mobile/data/api_client.dart';
import 'package:beacon_mobile/data/repository.dart';
import 'package:beacon_mobile/screens/prisms.dart';
import 'package:beacon_mobile/screens/control.dart';
import 'fake_backend.dart';

void main() {
  Future<BeaconRepository> launch(
    WidgetTester tester, {
    Size size = const Size(390, 844),
    bool login = true,
    bool siteGagal = false,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = BeaconRepository(
      persist: false,
      api: ApiClient(
        baseUrl: 'http://uji',
        client: backendPalsu(siteGagal: siteGagal),
      ),
    );
    addTearDown(repo.dispose);
    if (login) await repo.login('demo', 'rahasia');
    await tester.pumpWidget(BeaconApp(repo: repo));
    await tester.pumpAndSettle();
    return repo;
  }

  testWidgets('login memvalidasi isian lalu masuk ke Dashboard', (tester) async {
    await launch(tester, login: false);
    await tester.tap(find.text('Masuk'));
    await tester.pump();
    expect(find.text('Isi username'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first, 'demo');
    await tester.enterText(find.byType(TextFormField).last, 'rahasia');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Dashboard'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('login yang ditolak server memunculkan pesannya', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = BeaconRepository(
      persist: false,
      api: ApiClient(
        baseUrl: 'http://uji',
        client: backendPalsu(loginGagal: true),
      ),
    );
    addTearDown(repo.dispose);
    await tester.pumpWidget(BeaconApp(repo: repo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'demo');
    await tester.enterText(find.byType(TextFormField).last, 'salah');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Username atau password salah'), findsOneWidget);
    expect(find.widgetWithText(AppBar, 'Dashboard'), findsNothing);
  });

  for (final width in [320.0, 390.0, 600.0]) {
    testWidgets('empat tujuan navigasi muat di lebar $width', (tester) async {
      await launch(tester, size: Size(width, 844));
      for (final label in ['Dashboard', 'Kontrol', 'Prisma', 'Hasil']) {
        await tester.tap(find.text(label).last);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: label);
        await tester.drag(find.byType(ListView).first, const Offset(0, -450));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: 'digulir $label');
      }
      expect(find.text('Master Data'), findsNothing);
      expect(find.text('Visualisasi 3D'), findsNothing);
    });
  }

  testWidgets('judul halaman ikut tab dan hanya ada di header', (tester) async {
    await launch(tester);
    await tester.tap(find.text('Hasil').last);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Hasil pengukuran'), findsOneWidget);
    // Judul tidak boleh muncul dua kali: header saja, tidak di badan halaman.
    expect(find.text('Hasil pengukuran'), findsOneWidget);
  });

  testWidgets('pindah site mengunci ulang dan menampilkan site kosong', (
    tester,
  ) async {
    final repo = await launch(tester);
    await repo.unlock('123456');
    await tester.pumpAndSettle();
    await tester.tap(find.text('CPP 3').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Viewpoint').last);
    await tester.pumpAndSettle();
    expect(repo.site.id, 'viewpoint');
    expect(repo.unlocked, false);
    expect(tester.takeException(), isNull);
  });

  testWidgets('simpan prisma terkunci sampai pantulan sungguhan datang', (
    tester,
  ) async {
    final repo = await launch(tester);
    await repo.unlock('123456');
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
    final simpan = find.widgetWithText(FilledButton, 'Simpan prisma');
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);

    await tester.enterText(find.byType(TextFormField).first, 'PR-13');
    await tester.ensureVisible(find.text('Uji tembak FS'));
    await tester.tap(find.text('Uji tembak FS'));
    await tester.pump();

    // Perintah SUDAH terkirim, tapi belum ada pantulan: tetap terkunci.
    expect(find.text('Menunggu pantulan…'), findsOneWidget);
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);

    // Pantulan kosong = tidak ada prisma di sudut itu. Tetap terkunci.
    repo.masukkanBalasan({
      'MeasureFS': {'HADMS': '', 'VADMS': '', 'SDis': '', 'HD': ''},
    });
    await tester.pump();
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);
    expect(find.textContaining('tidak mendapat pantulan'), findsOneWidget);

    // Pantulan sungguhan: baru terbuka, dan angkanya ditampilkan apa adanya.
    // Labelnya kini "Uji tembak FS lagi" — tombol yang sama, ajakan berbeda.
    await tester.tap(find.textContaining('Uji tembak FS'));
    await tester.pump();
    repo.masukkanBalasan({
      'MeasureFS': {
        'HADMS': '151,38,71',
        'VADMS': '206,04,62',
        'SDis': '35.7679',
        'HD': '35.7',
      },
    });
    await tester.pump();
    expect(find.text('151,38,71 / 206,04,62'), findsOneWidget);
    expect(tester.widget<FilledButton>(simpan).onPressed, isNotNull);

    // Ganti nama → bukti tembakannya bukan milik konfigurasi ini lagi.
    await tester.enterText(find.byType(TextFormField).first, 'PR-14');
    await tester.pump();
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);
  });

  testWidgets('balasan jenis lain tidak membuka gerbang simpan', (
    tester,
  ) async {
    final repo = await launch(tester);
    await repo.unlock('123456');
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
    await tester.enterText(find.byType(TextFormField).first, 'PR-13');
    await tester.ensureVisible(find.text('Uji tembak FS'));
    await tester.tap(find.text('Uji tembak FS'));
    await tester.pump();

    // Balasan backsight datang saat yang diuji foresight — bukan jawabannya.
    repo.masukkanBalasan({
      'MeasureBS': {'HADMS': '1,2,3', 'VADMS': '4,5,6', 'SDis': '9', 'HD': '9'},
    });
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Simpan prisma'),
          )
          .onPressed,
      isNull,
    );
  });

  testWidgets('konfigurasi menolak nilai di luar batas protokol', (
    tester,
  ) async {
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
      (w) => w is TextFormField && w.controller?.text == '1',
    );
    await tester.enterText(retries.first, '99');
    await tester.ensureVisible(find.text('Simpan konfigurasi'));
    await tester.tap(find.text('Simpan konfigurasi'));
    await tester.pump();
    expect(find.text('Retries harus 1–15 (bilangan bulat)'), findsOneWidget);
    expect(repo.site.config['Retries'], '1');
  });

  testWidgets('galat muat menawarkan coba lagi', (tester) async {
    final repo = await launch(tester, login: false, siteGagal: true);
    await tester.enterText(find.byType(TextFormField).first, 'demo');
    await tester.enterText(find.byType(TextFormField).last, 'rahasia');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();
    expect(repo.error, isNotNull);
    expect(find.text('Coba lagi'), findsOneWidget);
  });
}
