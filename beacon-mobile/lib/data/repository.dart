/// Sumber data aplikasi: backend asaba-nextjs lewat HTTP.
///
/// Menggantikan repository simulasi yang sebelumnya menyimpan semuanya di
/// SharedPreferences. Yang tersisa di perangkat hanyalah token sesi; site,
/// slot prisma, sesi pengukuran, konfigurasi, dan jadwal semuanya milik server.
///
/// Perintah instrumen TIDAK menunggu konfirmasi alat. Backend menerbitkan
/// perintah ke `sub_<idAlat>` lalu langsung menjawab; balasan alat datang di
/// `pub_<idAlat>` yang di web di-subscribe langsung oleh peramban lewat WSS.
/// Aplikasi ini tidak punya klien MQTT, jadi hasil perintah dibaca dengan
/// menarik ulang `/api/kontrol/dashboard`.
///
/// ponytail: kemajuan sesi dipantau dengan polling 5 detik, bukan MQTT. Cukup
/// untuk sesi yang berjalan menit-an; kalau nanti perlu real-time, tambahkan
/// klien MQTT WSS dan subscribe `pub_<idAlat>` seperti halaman web.
library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import 'beacon_api.dart';
import 'models.dart';
import 'mqtt_balasan.dart';
import 'status_rts.dart';

const _kunciToken = 'beacon.token.v1';

/// Ditampilkan selagi daftar site belum ada, supaya layar tidak perlu
/// memeriksa null di setiap pembacaan `repo.site`.
final _siteKosong = SiteData(
  id: '',
  name: '—',
  location: '',
  logger: '',
  prisms: List.generate(50, (i) => Prism(i + 1)),
  sessions: [],
  powered: false,
);

class BeaconRepository extends ChangeNotifier {
  BeaconRepository({required this.api, this.persist = true, this.mqtt});

  final ApiClient api;
  final bool persist;

  /// Pendengar balasan alat. Null pada tes dan pada lingkungan tanpa MQTT —
  /// perintah tetap terkirim, hanya hasilnya yang tidak terbaca.
  final MqttBalasan? mqtt;

  final _balasan = StreamController<Map<String, dynamic>>.broadcast();

  /// Balasan mentah dari `pub_<idAlat>`, sudah diurai JSON.
  ///
  /// Yang menafsirkannya adalah layar, memakai pembaca di `protokol_rts.dart`:
  /// satu topik membawa balasan semua perintah, jadi penyaringannya bergantung
  /// pada perintah apa yang sedang ditunggu.
  Stream<Map<String, dynamic>> get balasan => _balasan.stream;

  /// Dipanggil klien MQTT saat paket tiba. Juga jalan masuk bagi tes, yang
  /// memasukkan paket contoh tanpa broker.
  void masukkanBalasan(Map<String, dynamic> paket) {
    if (!_balasan.isClosed) _balasan.add(paket);
  }

  StreamSubscription<Map<String, dynamic>>? _langgananMqtt;

  List<SiteData> sites = [];
  int selected = 0;
  bool loggedIn = false, loading = false, unlocked = false;

  /// Fakta yang TERPISAH dari `site.powered`: logger bisa melapor rajin dengan
  /// instrumen mati, dan sebaliknya.
  bool loggerTerhubung = false;

  /// Label status seragam dengan website: "Sedang mengukur" / "Menyala, siap" /
  /// "Tidak aktif".
  String labelRts = 'Tidak aktif';
  String? error, storageError;
  String? activeSiteId;
  int completed = 0, totalTargets = 0;
  /// Riwayat perintah, DIBACA DARI BACKEND.
  ///
  /// Dulu daftar ini disusun di memori oleh `log()` — hilang saat aplikasi
  /// ditutup, dan tidak pernah memuat perintah yang dikirim dari web. Sekarang
  /// sumbernya `log_aktivitas`, yang diisi backend di `publishMqtt()` sehingga
  /// perintah dari ponsel maupun dari web sama-sama tercatat.
  List<Aktivitas> events = [];

  /// id_log → pembacaan. Sesi yang sudah ditarik tidak ditarik dua kali.
  final Map<String, List<Reading>> _bacaan = {};

  /// slug site → id_logger, dibutuhkan `/api/kontrol/stop`.
  final Map<String, String> _logger = {};

  Timer? _polling;
  int _epoch = 0;

  SiteData get site =>
      sites.isEmpty ? _siteKosong : sites[selected.clamp(0, sites.length - 1)];
  bool get running => activeSiteId != null;
  List<Prism> get registered => site.prisms.where((p) => p.registered).toList();
  RunSession? get latest => site.sessions.isEmpty ? null : site.sessions.first;

  // ── Sesi pengguna ────────────────────────────────────────────────────────

  /// Memulihkan token dari perangkat lalu memuat data.
  ///
  /// Token disimpan, bukan kredensialnya: operator lapangan tidak perlu
  /// mengetik ulang tiap membuka aplikasi, dan password tidak pernah menyentuh
  /// penyimpanan perangkat.
  Future<void> load() async {
    if (!persist) return;
    String? token;
    try {
      token = (await SharedPreferences.getInstance()).getString(_kunciToken);
    } catch (_) {
      storageError = 'Sesi tersimpan tidak dapat dibaca.';
    }
    if (token != null && token.isNotEmpty) {
      api.pakaiToken(token);
      loggedIn = true;
      notifyListeners();
      await muatSemua();
    } else {
      notifyListeners();
    }
  }

  Future<void> _simpanToken(String? token) async {
    if (!persist) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (token == null) {
        await prefs.remove(_kunciToken);
      } else {
        await prefs.setString(_kunciToken, token);
      }
      storageError = null;
    } catch (_) {
      storageError = 'Sesi belum tersimpan di perangkat.';
    }
  }

  Future<void> login(String username, String password) async {
    await api.login(username, password);
    loggedIn = true;
    await _simpanToken(api.token);
    notifyListeners();
    await muatSemua();
  }

  Future<void> logout() async {
    _polling?.cancel();
    _polling = null;
    api.logout();
    await _simpanToken(null);
    loggedIn = false;
    unlocked = false;
    activeSiteId = null;
    sites = [];
    _bacaan.clear();
    _epoch++;
    notifyListeners();
  }

  // ── Pemuatan ─────────────────────────────────────────────────────────────

  void selectSite(int index) {
    selected = index;
    unlocked = false;
    error = null;
    _epoch++;
    notifyListeners();
    unawaited(muatSite());
  }

  Future<void> refresh() => muatSemua();

  /// Daftar site + isi site yang sedang dipilih.
  Future<void> muatSemua() async {
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final rows = await api.get('/api/sites', {'with_logger': '1'}) as List;
      if (epoch != _epoch) return;
      final baru = <SiteData>[];
      for (final r in rows) {
        final j = Map<String, dynamic>.from(r as Map);
        final slug = (j['slug'] ?? '').toString();
        final idLogger = j['id_logger'];
        if (idLogger != null) _logger[slug] = idLogger.toString();
        // Isi site yang sudah ditarik dipertahankan supaya refresh tidak
        // mengosongkan layar yang sedang dibaca.
        final lama = sites.where((s) => s.id == slug).firstOrNull;
        baru.add(
          siteDariApi(j, prisms: lama?.prisms, sessions: lama?.sessions),
        );
      }
      sites = baru;
      if (selected >= sites.length) selected = 0;
      loading = false;
      notifyListeners();
      await muatSite();
    } on ApiException catch (e) {
      if (epoch != _epoch) return;
      loading = false;
      error = e.message;
      if (e.status == 401) await _paksaKeluar();
      notifyListeners();
    }
  }

  /// Slot, sesi, konfigurasi, jadwal, dan keadaan instrumen satu site.
  Future<void> muatSite() async {
    if (sites.isEmpty) return;
    final epoch = _epoch;
    final aktif = site;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final hasil = await Future.wait([
        api.get('/api/prism-config', {'site': aktif.id}),
        api.get('/api/log-kontrol', {'site': aktif.id}),
        api.get('/api/kontrol/dashboard', {'site': aktif.id}),
      ]);
      if (epoch != _epoch) return;

      aktif.prisms
        ..clear()
        ..addAll(slotDariApi(hasil[0] as List));

      final sesi = (hasil[1] as List)
          .map((e) => sesiDariApi(Map<String, dynamic>.from(e as Map)))
          .toList()
        ..sort((a, b) => b.time.compareTo(a.time));
      aktif.sessions
        ..clear()
        ..addAll(sesi);

      _terapkanDashboard(aktif, Map<String, dynamic>.from(hasil[2] as Map));

      loading = false;
      notifyListeners();
      unawaited(muatLog());
      await _muatPembacaan(aktif, epoch);
    } on ApiException catch (e) {
      if (epoch != _epoch) return;
      loading = false;
      error = e.message;
      if (e.status == 401) await _paksaKeluar();
      notifyListeners();
    }
  }

  void _terapkanDashboard(SiteData s, Map<String, dynamic> d) {
    // Aturannya milik status_rts.dart, bukan ditebak di sini. Versi sebelumnya
    // membaca `Power_RTS` sebagai keadaan daya — parameter itu memetakan
    // sensor23, salah satu kolom tilt bernilai pecahan, jadi instrumen yang
    // menyala terbaca mati di ponsel sementara website menyebutnya siap.
    final status = statusRtsDariDashboard(d);
    loggerTerhubung = status.loggerTerhubung;
    s.powered = status.rtsAktif;
    labelRts = status.label;
    activeSiteId = status.rtsMengukur ? s.id : null;

    final rts = d['data_rts'];
    if (rts is Map) {
      double nilai(String k) => nfloat((rts[k] as Map?)?['nilai']);
      s.ha = nilai('HA');
      s.va = nilai('VA');
      // Nol dari alat yang belum pernah melapor tidak sama dengan nol volt.
      double? opsional(String k) {
        final v = (rts[k] as Map?)?['nilai'];
        if (v == null || v.toString().trim().isEmpty) return null;
        final n = nfloat(v);
        return n == 0 ? null : n;
      }

      s.battery = opsional('Battery_Logger');
      s.temperature = opsional('Temperature_Logger');
    }
    final cfg = d['config_adr'];
    if (cfg is Map) {
      s.config = {
        ...s.config,
        ...konfigurasiDariApi(Map<String, dynamic>.from(cfg)),
      };
    }
    final jadwal = d['schedule_all'] ?? d['schedule'];
    if (jadwal is List) {
      s.schedule = jadwal
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    final idLogger = d['id_logger'];
    if (idLogger != null) {
      _logger[s.id] = idLogger.toString();
      unawaited(_pantauBalasan(idLogger.toString()));
    }
    totalTargets = (d['jumlah_prisma'] as num?)?.toInt() ?? registered.length;
  }

  /// Pembacaan tiap sesi ditarik dari `/api/deformasi`, bukan dihitung di sini.
  ///
  /// `data_kirim` pada log_kontrol hanya berisi E/N mentah; pergeseran yang
  /// benar memerlukan rotasi terhadap acuan R0, dan rumus itu tinggal di
  /// backend. Menyalinnya ke Dart berarti dua salinan yang akan menyimpang.
  ///
  /// ponytail: satu permintaan per sesi, dibatasi 40 sesi terbaru dan 6
  /// permintaan sekaligus. Kalau daftar sesi tumbuh jauh lebih panjang,
  /// tambahkan endpoint yang mengembalikan beberapa id_log sekaligus.
  Future<void> _muatPembacaan(SiteData s, int epoch) async {
    const batas = 40, serentak = 6;
    final antre = s.sessions.take(batas).toList();
    for (var i = 0; i < antre.length; i += serentak) {
      if (epoch != _epoch) return;
      final potong = antre.skip(i).take(serentak);
      await Future.wait(
        potong.map((sesi) async {
          if (_bacaan.containsKey(sesi.id)) {
            sesi.readings
              ..clear()
              ..addAll(_bacaan[sesi.id]!);
            return;
          }
          try {
            final d = await api.get('/api/deformasi', {'id_log': sesi.id});
            final r = pembacaanDariDeformasi(Map<String, dynamic>.from(d as Map));
            _bacaan[sesi.id] = r;
            sesi.readings
              ..clear()
              ..addAll(r);
          } on ApiException {
            // Satu sesi yang gagal tidak boleh mengosongkan seluruh daftar;
            // sesi itu tampil tanpa pembacaan.
          }
        }),
      );
      if (epoch == _epoch) notifyListeners();
    }
  }

  /// Berlangganan balasan alat site yang sedang dibuka.
  ///
  /// Dipasang setelah dashboard menjawab, karena di situlah id alat diketahui.
  /// Kegagalan menyambung tidak dilaporkan sebagai galat: perintah tetap bisa
  /// dikirim, dan layar memakai timeout protokol sebagai jaring pengaman.
  Future<void> _pantauBalasan(String idLogger) async {
    final m = mqtt;
    if (m == null) return;
    await m.pantau(idLogger);
    _langgananMqtt ??= m.pesan.listen(masukkanBalasan);
  }

  Future<void> _paksaKeluar() async {
    api.logout();
    await _simpanToken(null);
    loggedIn = false;
    sites = [];
  }

  // ── Akses konfigurasi ────────────────────────────────────────────────────

  Future<bool> unlock(String code) async {
    await api.post('/api/kontrol/verify-access', {'kode_akses': code});
    unlocked = true;
    notifyListeners();
    return true;
  }

  void lock() {
    unlocked = false;
    notifyListeners();
  }

  // ── Perintah instrumen ───────────────────────────────────────────────────

  /// Menarik ulang riwayat perintah milik alat site ini.
  ///
  /// Dipanggil setelah setiap perintah: perintahnya baru saja dicatat backend,
  /// dan menyusun barisnya sendiri di sini akan menampilkan sesuatu yang belum
  /// tentu sama dengan yang tersimpan.
  Future<void> muatLog() async {
    if (site.id.isEmpty) return;
    try {
      final rows = await api.get('/api/log-aktivitas', {
        'site': site.id,
        'limit': '50',
      });
      events = (rows as List)
          .map((e) => aktivitasDariApi(Map<String, dynamic>.from(e as Map)))
          .toList();
      notifyListeners();
    } on ApiException {
      // Riwayat yang gagal dimuat tidak boleh menutupi hasil perintahnya.
    }
  }

  void requireInstrument() {
    if (!site.powered) throw StateError('Nyalakan RTS terlebih dahulu.');
    if (running) {
      throw StateError('Tunggu sesi selesai atau hentikan pengukuran.');
    }
  }

  Future<void> power(bool on) async {
    if (running) throw StateError('Hentikan sesi sebelum mengubah daya.');
    await api.post('/api/kontrol/power', {
      'action': on ? 'on' : 'off',
      'site': site.id,
    });
    site.powered = on;
    unawaited(muatLog());
    notifyListeners();
  }

  /// Menggeser teleskop SEBESAR selisih yang diberikan, bukan ke sudut itu.
  ///
  /// `/api/kontrol/jog` meneruskan angkanya apa adanya ke kunci `jog` firmware,
  /// dan menurut protokol itu pergeseran RELATIF dalam derajat desimal.
  /// Sebelumnya aplikasi mengirim sudut absolut ke sana: menekan "jog kanan"
  /// saat HA 124,5° mengirim 125,0 sebagai SELISIH — teleskop diperintahkan
  /// berputar 125 derajat, bukan setengah derajat.
  ///
  /// `va` adalah sudut zenit: nilai positif membuat teleskop menunduk.
  Future<void> jog(double deltaHa, double deltaVa) async {
    requireInstrument();
    await api.post('/api/kontrol/jog', {
      'site': site.id,
      'ha': deltaHa,
      'va': deltaVa,
    });
    // Posisi diperkirakan di sini supaya tombol berikutnya punya acuan; angka
    // sebenarnya baru diketahui saat dashboard ditarik ulang.
    site.ha = (site.ha + deltaHa + 360) % 360;
    site.va = (site.va + deltaVa).clamp(0, 180);
    unawaited(muatLog());
    notifyListeners();
  }

  /// Menuju sudut absolut dengan mengirim selisihnya dari posisi sekarang.
  ///
  /// Protokol tidak punya perintah "pergi ke sudut ini" untuk HA/VA bebas —
  /// yang ada hanya jog relatif dan go-to-target per slot. Jadi selisihnya
  /// dihitung di sini, terhadap posisi terakhir yang dilaporkan alat.
  Future<void> aimAbsolut(double ha, double va) =>
      jog(((ha - site.ha + 540) % 360) - 180, va - site.va);

  Future<void> setHome(String name) async {
    requireInstrument();
    await api.post('/api/kontrol/set-home', {
      'site': site.id,
      'namaHome': name,
    });
    site.home = name;
    unawaited(muatLog());
    notifyListeners();
  }

  Future<Map<String, dynamic>> bacaTilt() async {
    requireInstrument();
    final d = await api.post('/api/kontrol/get-tilt', {'site': site.id});
    return d is Map ? Map<String, dynamic>.from(d) : {};
  }

  Future<void> start(String code) async {
    requireInstrument();
    if (registered.isEmpty) {
      throw StateError('Isi minimal satu slot prisma dahulu.');
    }
    await api.post('/api/kontrol/start', {
      'kode_akses': code,
      'site': site.id,
    });
    activeSiteId = site.id;
    completed = 0;
    totalTargets = registered.length;
    unawaited(muatLog());
    notifyListeners();
    _mulaiPolling();
  }

  Future<void> stop() async {
    if (!running) return;
    final idLogger = _logger[activeSiteId] ?? _logger[site.id];
    await api.post('/api/kontrol/stop', {
      'id_logger': idLogger,
      'action': 'stop',
    });
    activeSiteId = null;
    _polling?.cancel();
    _polling = null;
    unawaited(muatLog());
    notifyListeners();
    unawaited(muatSite());
  }

  /// Alat mengerjakan perintah di luar jangkauan HTTP, jadi keadaannya ditarik
  /// berkala sampai `RTS_Running` padam.
  void _mulaiPolling() {
    _polling?.cancel();
    _polling = Timer.periodic(const Duration(seconds: 5), (t) async {
      if (!running) {
        t.cancel();
        return;
      }
      try {
        final d = await api.get('/api/kontrol/dashboard', {'site': site.id});
        final map = Map<String, dynamic>.from(d as Map);
        final log = map['log_kontrol'];
        if (log is Map && log['data_kirim'] is List) {
          completed = (log['data_kirim'] as List).length;
        }
        final rts = map['data_rts'];
        final masihJalan =
            rts is Map && nfloat((rts['RTS_Running'] as Map?)?['nilai']) > 0;
        if (!masihJalan) {
          activeSiteId = null;
          t.cancel();
          _polling = null;
          unawaited(muatSite());
        }
        notifyListeners();
      } on ApiException {
        // Jaringan putus sesaat bukan alasan menyatakan sesi selesai.
      }
    });
  }

  /// Menyuruh alat menembak BS atau FS sekarang.
  ///
  /// Perintahnya fire-and-forget seperti perintah RTS lainnya: backend
  /// menerbitkan ke `sub_<idAlat>` lalu langsung menjawab. Hasil tembakannya
  /// pulang lewat `pub_<idAlat>` — topik yang belum di-subscribe aplikasi ini —
  /// jadi yang bisa dipastikan hanyalah perintahnya terkirim, bukan bahwa
  /// prismanya kena.
  Future<void> ukur(String jenis) async {
    requireInstrument();
    await api.post('/api/kontrol/measure', {'site': site.id, 'jenis': jenis});
    unawaited(muatLog());
  }

  Future<void> autoSearch({int? slot}) async {
    requireInstrument();
    await api.post('/api/kontrol/auto-search', {
      'site': site.id,
      'slot_id': ?slot,
    });
    unawaited(muatLog());
  }

  /// Membidik slot lewat firmware, bukan lewat jog ke sudut tersimpan.
  ///
  /// `slot_id` dikirim apa adanya: alat yang tahu sudut slot itu sekarang,
  /// sementara nilai HA/VA di aplikasi bisa tertinggal dari yang terakhir
  /// dikalibrasi di lapangan.
  Future<void> goToTarget(int slot) async {
    requireInstrument();
    await api.post('/api/kontrol/go-to-target', {
      'site': site.id,
      'slot_id': slot,
    });
    unawaited(muatLog());
  }

  /// Membaca sudut instrumen SEKARANG. Tidak menggerakkan apa pun.
  ///
  /// Protokol menyebutnya alat diagnosis tercepat: panggil beberapa kali tanpa
  /// menggerakkan instrumen, lalu bandingkan dengan angka di layarnya. Kalau
  /// instrumen diam, kedua sudutnya pulang sebagai "000,00,00" — penanda gagal,
  /// bukan sudut sungguhan.
  Future<void> bacaSudut() async {
    if (!site.powered) throw StateError('Nyalakan RTS terlebih dahulu.');
    await api.post('/api/kontrol/manual-hava', {'site': site.id});
    unawaited(muatLog());
  }

  Future<void> replay() async {
    requireInstrument();
    await api.post('/api/kontrol/replay', {'site': site.id});
    unawaited(muatLog());
    notifyListeners();
  }

  Future<void> setSearchArea(double hor, double ver) async {
    requireInstrument();
    await api.post('/api/kontrol/search-area', {
      'site': site.id,
      'hor': hor,
      'ver': ver,
    });
  }

  Future<void> setTrackEvery(int menit) async {
    requireInstrument();
    await api.post('/api/kontrol/track-every', {
      'site': site.id,
      'menit': menit,
    });
  }

  Future<void> simpanKonfigurasi(Map<String, String> config) async {
    await api.put('/api/config-adr', konfigurasiKeApi(site.id, config));
    // Sapuan dan Track every bukan kolom config_adr — keduanya perintah MQTT
    // tersendiri. Dikirim hanya kalau alat menyala, karena perintah ke alat
    // mati tidak akan pernah sampai.
    if (site.powered && !running) {
      final hor = double.tryParse(config[labelSapuanHor] ?? '');
      final ver = double.tryParse(config[labelSapuanVer] ?? '');
      if (hor != null && ver != null) await setSearchArea(hor, ver);
      final menit = int.tryParse(config[labelTrackEvery] ?? '');
      if (menit != null) await setTrackEvery(menit);
    }
    site.config = {...site.config, ...config};
    unawaited(muatLog());
    notifyListeners();
  }

  Future<void> simpanJadwal(List<Map<String, dynamic>> jadwal) async {
    await api.put('/api/scheduling', {
      'schedules': jadwal
          .map(
            (j) => {
              'id': j['id'],
              'status': j['status'],
              'time': j['time'],
            },
          )
          .toList(),
    });
    site.schedule = jadwal;
    unawaited(muatLog());
    notifyListeners();
  }

  // ── Sesi dan prisma ──────────────────────────────────────────────────────

  Future<void> deleteSession(RunSession run) async {
    if (run.reference) throw StateError('Sesi acuan R0 tidak dapat dihapus.');
    if (run.state == 'Mengukur') throw StateError('Hentikan sesi dahulu.');
    await api.delete('/api/log-kontrol/${run.id}');
    site.sessions.remove(run);
    _bacaan.remove(run.id);
    notifyListeners();
  }

  Future<void> savePrism(Prism p) async {
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
    final body = {
      'site': site.id,
      'id_prisma': 'P${p.slot}',
      'nama_prisma': p.name,
      'jenis': p.kind,
      'target_height': p.height,
      'HA': p.ha,
      'VA': p.va,
    };
    // POST membuat slot baru, PUT mengubah yang sudah ada. Slot yang belum
    // terdaftar tidak punya baris untuk di-update.
    final sudahAda = site.prisms[p.slot - 1].registered;
    if (sudahAda) {
      await api.put('/api/prism-config', body);
    } else {
      await api.post('/api/prism-config', body);
    }
    site.prisms[p.slot - 1] = p;
    unawaited(muatLog());
    notifyListeners();
  }

  Future<void> deletePrism(Prism p) async {
    requireInstrument();
    if (!unlocked) throw StateError('Buka akses konfigurasi terlebih dahulu.');
    await api.delete('/api/prism-config?site=${site.id}&id_prisma=P${p.slot}');
    site.prisms[p.slot - 1] = Prism(p.slot);
    unawaited(muatLog());
    notifyListeners();
  }

  @override
  void dispose() {
    _polling?.cancel();
    unawaited(_langgananMqtt?.cancel());
    mqtt?.dispose();
    unawaited(_balasan.close());
    super.dispose();
  }
}

String? validateConfig(String key, String value) {
  if (key == 'Job name') {
    return value.trim().isEmpty ? 'Nama job wajib diisi' : null;
  }
  if (key == labelAutoSearch) return null;
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
  if (key == labelTrackEvery && ![0, 5, 10, 15, 20, 30, 60].contains(n)) {
    return 'Pilih 0, 5, 10, 15, 20, 30, atau 60';
  }
  if ((key == 'TS high (m)' || key == 'Step record') && n <= 0) {
    return 'Nilai harus lebih dari 0';
  }
  return null;
}
