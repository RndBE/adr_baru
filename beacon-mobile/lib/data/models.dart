import 'dart:math' as math;

class Prism {
  final int slot;
  String name, kind;
  double height, ha, va;
  bool registered;
  Prism(
    this.slot, {
    this.name = '',
    this.kind = 'fs',
    this.height = 1.5,
    this.ha = 0,
    this.va = 90,
    this.registered = false,
  });
  String get code => 'P$slot';
  Map<String, dynamic> toJson() => {
    'slot': slot,
    'name': name,
    'kind': kind,
    'height': height,
    'ha': ha,
    'va': va,
    'registered': registered,
  };
  factory Prism.fromJson(Map<String, dynamic> j) => Prism(
    j['slot'],
    name: j['name'],
    kind: j['kind'],
    height: (j['height'] as num).toDouble(),
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    registered: j['registered'],
  );
}

class Reading {
  final int slot;
  final String name;
  final double n, e, z, n0, e0, z0, ha, va, sd;

  /// Selisih terhadap acuan R0, MILIMETER, DARI BACKEND.
  ///
  /// Dulu dihitung di sini sebagai `(n - n0) * 1000`. Itu salah pada data yang
  /// acuannya belum ada: di produksi `N0`/`E0` bisa 0, dan pengurangan itu
  /// menghasilkan koordinat UTM utuh dalam milimeter — satu prisma terbaca
  /// bergeser 9.150 km. Backend sendiri menolak menyatakan angka dalam keadaan
  /// itu: `/api/deformasi` mengembalikan `DN`/`DE`/`DZ` = "0.000000",
  /// `linear` = 0, dan `arah_pergeseran` = "-".
  ///
  /// Jadi nilainya diambil, bukan diturunkan ulang. `n`/`e`/`z` tetap koordinat
  /// terukur apa adanya supaya kolom "Hasil N / E / Z" menunjukkan yang benar-
  /// benar dibaca alat.
  final double dn, de, dz;

  final bool success;

  /// Angka HARIAN dari `daily` milik `/api/deformasi`, apa adanya.
  ///
  /// Backend sudah menghitung pergeseran harian, lajunya, dan kedua statusnya
  /// memakai ambang milik site. Menurunkannya ulang di sini berarti salinan
  /// aturan yang bisa lepas sinkron — dan kalau angka di ponsel berbeda dari
  /// angka di layar web, operator berhenti mempercayai keduanya.
  ///
  /// Null berarti tidak ada data harian yang bisa dibandingkan dengan acuan R0;
  /// web menuliskannya "—", bukan nol.
  final double? geserHarianMm, lajuHarianMmd;
  final String? statusGeserHarian, statusLajuHarian;

  /// Apakah prisma ini punya acuan R0 sama sekali.
  ///
  /// Di produksi ada prisma dengan `N0`/`E0` = 0: belum pernah diikat ke sesi
  /// acuan. Pergeserannya bukan nol — melainkan TIDAK DIKETAHUI, dan menyebutnya
  /// "Normal" adalah pernyataan yang tidak pernah diukur siapa pun.
  final bool punyaAcuan;

  Reading({
    required this.slot,
    required this.name,
    required this.n,
    required this.e,
    required this.z,
    required this.n0,
    required this.e0,
    required this.z0,
    required this.ha,
    required this.va,
    required this.sd,
    required this.dn,
    required this.de,
    required this.dz,
    this.success = true,
    this.punyaAcuan = true,
    this.geserHarianMm,
    this.lajuHarianMmd,
    this.statusGeserHarian,
    this.statusLajuHarian,
  });
  double get displacement => math.sqrt(dn * dn + de * de);

  /// Status yang dipakai SELURUH layar: filter, kartu, denah, dan Ringkasan.
  ///
  /// Jawaban backend didahulukan. Ia hanya ada untuk agregat harian; untuk satu
  /// sesi tunggal — yang dipakai denah dan mode Event — website tidak punya
  /// padanannya sama sekali (petanya tidak mewarnai menurut status). Di situ
  /// ambang milik site diterapkan di sini, memakai perbandingan yang sama
  /// dengan `statusPergeseran()` di `src/lib/ambang.ts`.
  ///
  /// Satu fungsi supaya keempat tempat itu tidak bisa lagi menjawab berbeda
  /// untuk pembacaan yang sama.
  String statusUntuk(SiteData site) => !success
      ? 'Gagal'
      : statusGeserHarian ??
            (punyaAcuan ? site.status(displacement) : 'Belum ada acuan');
  double get linear3d => math.sqrt(dn * dn + de * de + dz * dz);
  double get bearing => (math.atan2(de, dn) * 180 / math.pi + 360) % 360;
  Map<String, dynamic> toJson() => {
    'slot': slot,
    'name': name,
    'n': n,
    'e': e,
    'z': z,
    'n0': n0,
    'e0': e0,
    'z0': z0,
    'ha': ha,
    'va': va,
    'sd': sd,
    'dn': dn,
    'de': de,
    'dz': dz,
    'success': success,
  };
  factory Reading.fromJson(Map<String, dynamic> j) => Reading(
    slot: j['slot'],
    name: j['name'],
    n: (j['n'] as num).toDouble(),
    e: (j['e'] as num).toDouble(),
    z: (j['z'] as num).toDouble(),
    n0: (j['n0'] as num).toDouble(),
    e0: (j['e0'] as num).toDouble(),
    z0: (j['z0'] as num).toDouble(),
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    sd: (j['sd'] as num).toDouble(),
    dn: (j['dn'] as num).toDouble(),
    de: (j['de'] as num).toDouble(),
    dz: (j['dz'] as num).toDouble(),
    success: j['success'],
  );
}

class RunSession {
  final String id;
  final DateTime time;
  final List<Reading> readings;
  final bool reference;
  String state;
  RunSession({
    required this.id,
    required this.time,
    required this.readings,
    this.reference = false,
    this.state = 'Selesai',
  });
  Map<String, dynamic> toJson() => {
    'id': id,
    'time': time.toIso8601String(),
    'readings': readings.map((e) => e.toJson()).toList(),
    'reference': reference,
    'state': state,
  };
  factory RunSession.fromJson(Map<String, dynamic> j) => RunSession(
    id: j['id'],
    time: DateTime.parse(j['time']),
    readings: (j['readings'] as List)
        .map((e) => Reading.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    reference: j['reference'],
    state: j['state'],
  );
}

/// Satu perintah yang dikirim ke alat, dari `GET /api/log-aktivitas`.
class Aktivitas {
  Aktivitas({
    required this.perintah,
    required this.waktu,
    required this.terkirim,
  });
  final String perintah;
  final DateTime waktu;
  /// Perintah yang GAGAL terbit ke MQTT ikut tercatat — justru itu yang perlu
  /// terlihat saat alat tidak merespons.
  final bool terkirim;
}

class SiteData {
  final String id, name, location, logger;
  /// Ambang pergeseran (mm), dari kolom `geser_*_max`.
  ///
  /// Ambang LAJU tidak ikut disimpan: statusnya datang jadi dari backend
  /// (`daily.status_kecepatan`), jadi menyimpan angkanya di sini hanya
  /// mengundang orang menghitungnya sendiri lagi.
  final double warning, alert, danger;
  final List<Prism> prisms;
  final List<RunSession> sessions;
  Map<String, String> config;
  List<Map<String, dynamic>> schedule;
  bool powered;
  double ha, va;
  String home;
  /// Null berarti alat belum melaporkannya — ditampilkan sebagai "—", bukan 0.
  double? battery, temperature;
  SiteData({
    required this.id,
    required this.name,
    required this.location,
    required this.logger,
    required this.prisms,
    required this.sessions,
    this.warning = 5,
    this.alert = 8,
    this.danger = 10,
    this.powered = true,
    this.ha = 124.5,
    this.va = 89.2,
    this.home = '',
    Map<String, String>? config,
    List<Map<String, dynamic>>? schedule,
  }) : config =
           config ??
           {
             'Job name': 'BEACON_MONITOR',
             'Prisma const (mm)': '0',
             'TS high (m)': '1.5',
             'Coordinate X (m)': '512400',
             'Coordinate Y (m)': '9782000',
             'Coordinate Z (m)': '132',
             'Step record': '1',
             'Retries': '3',
             'Cycle time (ms)': '5000',
             'Sapuan horizontal (°)': '6',
             'Sapuan vertikal (°)': '6',
             'Track every (menit)': '15',
             'Auto search': 'true',
           },
       schedule =
           schedule ??
           List.generate(
             7,
             (i) => {'day': i, 'enabled': i < 5, 'on': '07:00', 'off': '18:00'},
           );
  String status(double mm) => mm >= danger
      ? 'Awas'
      : mm >= alert
      ? 'Siaga'
      : mm >= warning
      ? 'Waspada'
      : 'Normal';
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'location': location,
    'logger': logger,
    'warning': warning,
    'alert': alert,
    'danger': danger,
    'prisms': prisms.map((p) => p.toJson()).toList(),
    'sessions': sessions.map((s) => s.toJson()).toList(),
    'config': config,
    'schedule': schedule,
    'powered': powered,
    'ha': ha,
    'va': va,
    'home': home,
  };
  factory SiteData.fromJson(Map<String, dynamic> j) => SiteData(
    id: j['id'],
    name: j['name'],
    location: j['location'],
    logger: j['logger'],
    warning: (j['warning'] as num).toDouble(),
    alert: (j['alert'] as num? ?? 8).toDouble(),
    danger: (j['danger'] as num).toDouble(),
    prisms: (j['prisms'] as List)
        .map((e) => Prism.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    sessions: (j['sessions'] as List)
        .map((e) => RunSession.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    config: Map<String, String>.from(j['config']),
    schedule: (j['schedule'] as List)
        .map((e) => Map<String, dynamic>.from(e))
        .toList(),
    powered: j['powered'],
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    home: j['home'],
  );
}

String dateLabel(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.month - 1]} ${d.year}';
String timeLabel(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
