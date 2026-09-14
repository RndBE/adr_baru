import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:excel/excel.dart';
import 'package:beacon_mobile/data/demo_repository.dart';
import 'package:beacon_mobile/data/models.dart';
import 'package:beacon_mobile/data/export_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('50 slots and per-site isolation', () {
    final r = DemoRepository(persist: false);
    addTearDown(r.dispose);
    expect(r.site.prisms.length, 50);
    expect(r.unlock('no'), false);
    expect(r.unlock('123456'), true);
    r.savePrism(Prism(13, name: 'NEW', registered: true));
    r.selectSite(1);
    expect(r.unlocked, false);
    expect(r.site.prisms[12].registered, false);
    r.selectSite(0);
    expect(r.site.prisms[12].name, 'NEW');
  });
  test('locked, offline, duplicate, and reference guards', () {
    final r = DemoRepository(persist: false);
    addTearDown(r.dispose);
    expect(() => r.savePrism(Prism(13, name: 'NEW')), throwsStateError);
    r.unlock('123456');
    expect(
      () => r.savePrism(
        Prism(13, name: r.site.prisms.first.name, registered: true),
      ),
      throwsStateError,
    );
    expect(() => r.deleteSession(r.site.sessions.last), throwsStateError);
    r.power(false);
    expect(() => r.start('123456'), throwsStateError);
  });
  testWidgets('session completes on original site after site switch', (
    t,
  ) async {
    final r = DemoRepository(persist: false);
    addTearDown(r.dispose);
    r.start('123456');
    expect(r.running, true);
    expect(() => r.start('123456'), throwsStateError);
    expect(() => r.power(false), throwsStateError);
    r.selectSite(1);
    for (var i = 0; i < 13; i++) {
      await t.pump(const Duration(milliseconds: 650));
    }
    expect(r.running, false);
    expect(r.sites[0].sessions.first.readings.length, 12);
    expect(r.sites[0].sessions.first.state, 'Selesai');
    expect(r.sites[1].sessions.length, 18);
  });
  testWidgets('stop keeps partial data and logout clears access', (t) async {
    final r = DemoRepository(persist: false);
    addTearDown(r.dispose);
    r.login('operator', 'beacon123');
    r.start('123456');
    await t.pump(const Duration(milliseconds: 700));
    r.stop();
    expect(r.latest!.state, 'Dihentikan');
    expect(r.latest!.readings.length, 1);
    r.logout();
    expect(r.loggedIn, false);
    expect(r.unlocked, false);
  });
  test('persistence restores slots and config', () async {
    SharedPreferences.setMockInitialValues({});
    final r = DemoRepository();
    r.site.config['Retries'] = '7';
    r.unlock('123456');
    r.savePrism(Prism(13, name: 'TEST', registered: true));
    await r.save();
    final restored = DemoRepository();
    await restored.load();
    expect(restored.site.config['Retries'], '7');
    expect(restored.site.prisms[12].name, 'TEST');
    expect(restored.loggedIn, false);
    r.dispose();
    restored.dispose();
  });
  test('configuration validates protocol units', () {
    expect(validateConfig('Retries', '0'), isNotNull);
    expect(validateConfig('Retries', '15'), isNull);
    expect(validateConfig('Cycle time (ms)', '999'), isNotNull);
    expect(validateConfig('Sapuan horizontal (°)', '2'), isNotNull);
    expect(validateConfig('Sapuan horizontal (°)', '180'), isNull);
    expect(validateConfig('Track every (menit)', '7'), isNotNull);
    expect(validateConfig('Coordinate X (m)', 'NaN'), isNotNull);
  });
  test('Excel is a real workbook with units and failed readings blank', () {
    final r = DemoRepository(persist: false);
    addTearDown(r.dispose);
    final bytes = measurementWorkbook(r.site, [r.latest!]);
    final workbook = Excel.decodeBytes(bytes);
    final rows = workbook['Pengukuran'].rows;
    expect(rows.length, 14);
    expect(rows[1][10]!.value.toString(), 'ΔN (mm)');
    expect(rows.last[7]!.value, isNotNull);
    expect(rows[12][7]?.value, isNull);
    expect(rows.first.first!.value.toString(), contains('SIMULASI'));
  });
  test(
    'meters converted to millimeters and bearing is clockwise from north',
    () {
      final reading = Reading(
        slot: 1,
        name: 'A',
        n: 100.003,
        e: 100.004,
        z: 1,
        n0: 100,
        e0: 100,
        z0: 1,
        ha: 0,
        va: 90,
        sd: 10,
      );
      expect(reading.displacement, closeTo(5, 1e-6));
      expect(reading.bearing, closeTo(53.1301, .001));
    },
  );
}
