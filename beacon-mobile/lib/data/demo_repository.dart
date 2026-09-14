import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

/// Local-only source of truth. No HTTP, MQTT, or production authentication.
class DemoRepository extends ChangeNotifier {
  DemoRepository({this.persist = true}) {
    sites = seedSites();
  }
  final bool persist;
  late List<SiteData> sites;
  int selected = 0;
  bool loggedIn = false, loading = false;
  String? error, storageError;
  bool unlocked = false;
  String? activeSiteId;
  int completed = 0;
  int totalTargets = 0;
  Timer? _timer;
  int _epoch = 0;
  Future<void> _writes = Future.value();
  final List<String> events = [];
  SiteData get site => sites[selected];
  bool get running => activeSiteId != null;
  List<Prism> get registered => site.prisms.where((p) => p.registered).toList();
  RunSession? get latest => site.sessions.isEmpty ? null : site.sessions.first;

  Future<void> load() async {
    if (!persist) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('beacon.demo.v1');
      if (raw != null) {
        final data = jsonDecode(raw) as List;
        final restored = data
            .map((e) => SiteData.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        if (restored.isNotEmpty) sites = restored;
        for (final site in sites) {
          for (final session in site.sessions) {
            if (session.state == 'Mengukur') session.state = 'Dihentikan';
          }
        }
      }
    } catch (_) {
      storageError = 'Data lokal tidak dapat dibaca. Data contoh ditampilkan.';
    }
    notifyListeners();
  }

  Future<void> save() async {
    notifyListeners();
    if (!persist) return;
    final snapshot = jsonEncode(sites.map((s) => s.toJson()).toList());
    _writes = _writes.then((_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        if (!await prefs.setString('beacon.demo.v1', snapshot)) {
          throw StateError('save');
        }
        storageError = null;
      } catch (_) {
        storageError = 'Perubahan belum tersimpan di perangkat. Coba lagi.';
      }
      notifyListeners();
    });
    await _writes;
  }

  void login(String username, String password) {
    if (username.trim() != 'operator' || password != 'beacon123') {
      throw StateError('Gunakan akun demo operator / beacon123.');
    }
    loggedIn = true;
    notifyListeners();
  }

  void logout() {
    stop();
    loggedIn = false;
    unlocked = false;
    _epoch++;
    notifyListeners();
  }

  void selectSite(int index) {
    selected = index;
    unlocked = false;
    error = null;
    _epoch++;
    notifyListeners();
  }

  bool unlock(String code) {
    unlocked = code == '123456';
    notifyListeners();
    return unlocked;
  }

  void lock() {
    unlocked = false;
    notifyListeners();
  }

  Future<void> refresh({bool fail = false}) async {
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 500));
    loading = false;
    if (epoch == _epoch) {
      error = fail ? 'Data demo gagal dimuat. Ketuk Coba lagi.' : null;
    }
    notifyListeners();
  }

  void log(String text) {
    events.insert(0, '${timeLabel(DateTime.now())} · ${site.name} · $text');
    if (events.length > 50) events.removeLast();
  }

  void power(bool on) {
    if (running) throw StateError('Hentikan sesi sebelum mengubah daya.');
    site.powered = on;
    log(on ? 'Daya dinyalakan (simulasi)' : 'Daya dimatikan (simulasi)');
    unawaited(save());
  }

  void requireInstrument() {
    if (!site.powered) throw StateError('Nyalakan RTS terlebih dahulu.');
    if (running) {
      throw StateError('Tunggu sesi selesai atau hentikan pengukuran.');
    }
  }

  void aim(double ha, double va) {
    requireInstrument();
    site.ha = (ha + 360) % 360;
    site.va = va.clamp(0, 180);
    log('Arah teleskop diperbarui');
    unawaited(save());
  }

  void setHome(String name) {
    requireInstrument();
    site.home = name;
    log('Home disimpan: $name');
    unawaited(save());
  }

  void start(String code) {
    requireInstrument();
    if (code != '123456') {
      throw StateError('Kode akses demo salah. Gunakan 123456.');
    }
    final targets = registered;
    if (targets.isEmpty) {
      throw StateError('Isi minimal satu slot prisma dahulu.');
    }
    final origin = site;
    final originIndex = selected;
    totalTargets = targets.length;
    activeSiteId = origin.id;
    completed = 0;
    log('Sesi dimulai (simulasi)');
    final run = RunSession(
      id: 'DEMO-${DateTime.now().microsecondsSinceEpoch}',
      time: DateTime.now(),
      readings: [],
      state: 'Mengukur',
    );
    origin.sessions.insert(0, run);
    notifyListeners();
    _timer = Timer.periodic(const Duration(milliseconds: 650), (_) {
      final p = targets[completed];
      run.readings.add(makeReading(p, p.slot - 1, 1.1, originIndex));
      completed++;
      if (completed == targets.length) {
        _timer?.cancel();
        activeSiteId = null;
        run.state = 'Selesai';
        unawaited(save());
      }
      notifyListeners();
    });
  }

  void stop() {
    if (!running) return;
    final origin = sites.firstWhere((s) => s.id == activeSiteId);
    _timer?.cancel();
    origin.sessions.first.state = 'Dihentikan';
    activeSiteId = null;
    unawaited(save());
  }

  void replay() {
    requireInstrument();
    if (site.sessions.isEmpty) {
      throw StateError('Belum ada sesi untuk diputar ulang.');
    }
    log(
      'Replay SD selesai: ${site.sessions.first.readings.length} pembacaan demo tersedia',
    );
    notifyListeners();
  }

  void deleteSession(RunSession run) {
    if (run.reference) throw StateError('Sesi acuan R0 tidak dapat dihapus.');
    if (run.state == 'Mengukur') throw StateError('Hentikan sesi dahulu.');
    site.sessions.remove(run);
    unawaited(save());
  }

  void savePrism(Prism p) {
    requireInstrument();
    if (!unlocked) throw StateError('Buka akses konfigurasi terlebih dahulu.');
    if (site.prisms.any(
      (v) =>
          v.slot != p.slot &&
          v.registered &&
          v.name.toLowerCase() == p.name.toLowerCase(),
    )) {
      throw StateError('Nama prisma sudah digunakan pada site ini.');
    }
    site.prisms[p.slot - 1] = p;
    log('Slot ${p.code} disimpan');
    unawaited(save());
  }

  void deletePrism(Prism p) {
    requireInstrument();
    if (!unlocked) throw StateError('Buka akses konfigurasi terlebih dahulu.');
    site.prisms[p.slot - 1] = Prism(p.slot);
    log('Slot ${p.code} dikosongkan');
    unawaited(save());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

Reading makeReading(Prism p, int index, double factor, int siteIndex) {
  final n0 = 9782000.0 + index * 17.3 + siteIndex * 400;
  final e0 = 512400.0 + math.sin(index * .7) * 170 + siteIndex * 250;
  final z0 = 132.0 + index * 2.1;
  final delta = p.kind == 'bs'
      ? 0.12 * factor
      : (index == 4
                ? 7.4
                : index == 8
                ? 11.8
                : 1.2 + index * .18) *
            factor;
  return Reading(
    slot: p.slot,
    name: p.name,
    n: n0 + delta * .0008,
    e: e0 + delta * .0005,
    z: z0 + delta * .0003,
    n0: n0,
    e0: e0,
    z0: z0,
    ha: p.ha,
    va: p.va,
    sd: 125 + index * 23.72,
    success: index != 10,
  );
}

List<SiteData> seedSites() {
  final today = DateTime.now();
  return List.generate(3, (s) {
    final prisms = List.generate(
      50,
      (i) => Prism(
        i + 1,
        name: i < 12
            ? '${i < 2 ? 'BS' : 'PR'}-${(i + 1).toString().padLeft(2, '0')}'
            : '',
        kind: i < 2 ? 'bs' : 'fs',
        registered: s < 2 && i < 12,
        ha: 35 + i * 11.2,
        va: 88 + i * .08,
      ),
    );
    final sessions = s == 2
        ? <RunSession>[]
        : List.generate(18, (i) {
            final time = DateTime(
              today.year,
              today.month,
              today.day,
              8,
            ).subtract(Duration(hours: i * 4));
            return RunSession(
              id: 'DEMO-${s + 1}-${18 - i}',
              time: time,
              reference: i == 17,
              readings: prisms
                  .where((p) => p.registered)
                  .toList()
                  .asMap()
                  .entries
                  .map(
                    (e) => makeReading(
                      e.value,
                      e.key,
                      i == 17 ? 0 : 1 - i * .035,
                      s,
                    ),
                  )
                  .toList(),
            );
          });
    return SiteData(
      id: ['ccp', 'pit', 'north'][s],
      name: ['CCP', 'Pit Selatan', 'Site Utara'][s],
      location: [
        'Area pemantauan CCP',
        'Lereng pit selatan',
        'Area observasi baru',
      ][s],
      logger: 'RTS-00${s + 1}',
      prisms: prisms,
      sessions: sessions,
      powered: s < 2,
    );
  });
}

String? validateConfig(String key, String value) {
  if (key == 'Job name') {
    return value.trim().isEmpty ? 'Nama job wajib diisi' : null;
  }
  if (key == 'Auto search') return null;
  final n = double.tryParse(value);
  if (n == null || !n.isFinite) return 'Masukkan angka yang valid';
  if (key == 'Retries' && (n < 1 || n > 15 || n != n.roundToDouble())) {
    return 'Retries harus 1–15 (bilangan bulat)';
  }
  if (key == 'Cycle time (ms)' &&
      (n < 1000 || n > 600000 || n != n.roundToDouble())) {
    return 'Rentang 1000–600000 ms';
  }
  if (key.startsWith('Sapuan')) {
    final max = key.contains('horizontal') ? 180 : 90;
    if (n < 0 || n > max || ((n / 1.5) - (n / 1.5).round()).abs() > 1e-8) {
      return '0–$max°, kelipatan 1.5°';
    }
  }
  if (key == 'Track every (menit)' && ![0, 5, 10, 15, 20, 30, 60].contains(n)) {
    return 'Pilih 0, 5, 10, 15, 20, 30, atau 60';
  }
  if ((key == 'TS high (m)' || key == 'Step record') && n <= 0) {
    return 'Nilai harus lebih dari 0';
  }
  return null;
}
