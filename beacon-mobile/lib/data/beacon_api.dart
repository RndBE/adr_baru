/// Pemetaan balasan backend asaba-nextjs ke model aplikasi.
///
/// Aturan yang sudah punya rumah di backend TIDAK ditulis ulang di sini:
/// rotasi koordinat, ambang status, dan kecepatan harian dihitung oleh
/// `/api/deformasi`. Yang dikerjakan berkas ini cuma penerjemahan bentuk.
library;

import 'models.dart';

/// Port dari `nfloat()` di `asaba-nextjs/src/lib/coordinates.ts`.
///
/// Sudut di basis data ditulis `"331,85,05"`. Itu BUKAN derajat-menit-detik:
/// backend mengganti semua koma jadi titik lalu memanggil `parseFloat`, yang
/// berhenti di titik kedua — jadi nilainya 331.85 dan grup ketiga terbuang.
/// Ditiru apa adanya supaya angka di ponsel sama dengan angka di web; menebak
/// DMS di sini akan membuat keduanya berbeda tanpa ada yang salah menurut
/// dirinya sendiri.
double nfloat(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  var s = v.toString().trim();
  if (s.isEmpty || s == '000,00,00' || s == '000.00.00') return 0;
  s = s.replaceAll(',', '.').replaceAll(RegExp(r'[^0-9.\-]'), '');
  if (s.isEmpty || s == '-' || s == '.' || s == '-.') return 0;
  // parseFloat berhenti di karakter tak sah; `double.parse` melempar.
  final m = RegExp(r'^-?\d*\.?\d*').firstMatch(s)?.group(0) ?? '';
  return double.tryParse(m) ?? 0;
}

/// Waktu basis data adalah JAM DINDING WIB, bukan UTC.
///
/// Prisma menserialkan kolom DATETIME dengan akhiran `Z`, jadi
/// `"2025-11-21T10:11:09.000Z"` sebenarnya berarti 10:11 WIB. Memanggil
/// `.toLocal()` akan menggesernya +7 jam dan menampilkan sesi pukul 17:11 yang
/// tidak pernah ada. Komponennya karena itu dibaca sebagai jam dinding.
DateTime waktuWib(dynamic v) {
  if (v == null) return DateTime.now();
  final s = v.toString();
  final t = DateTime.tryParse(s);
  if (t == null) return DateTime.now();
  final u = t.toUtc();
  return DateTime(u.year, u.month, u.day, u.hour, u.minute, u.second);
}

int _slotDariId(dynamic idPrisma, dynamic slot) {
  if (slot is num) return slot.toInt();
  final s = idPrisma?.toString() ?? '';
  return int.tryParse(s.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
}

/// Satu baris `/api/prism-config` → satu slot.
Prism prismDariApi(Map<String, dynamic> j) {
  final slot = _slotDariId(j['id_prisma'], j['slot']);
  return Prism(
    slot,
    name: (j['nama_prisma'] ?? '').toString(),
    kind: (j['jenis'] ?? 'fs').toString().toLowerCase() == 'bs' ? 'bs' : 'fs',
    height: nfloat(j['target_height']),
    ha: nfloat(j['HA']),
    va: nfloat(j['VA']),
    registered: j['registered'] == true,
  );
}

/// 50 slot tetap; yang tidak ada di backend tampil kosong.
///
/// Jumlahnya dikunci karena firmware mengalamatkan slot P1..P50, bukan karena
/// tampilan butuh grid rapi.
List<Prism> slotDariApi(List<dynamic> rows, {int total = 50}) {
  final hasil = List<Prism>.generate(total, (i) => Prism(i + 1));
  for (final r in rows) {
    final p = prismDariApi(Map<String, dynamic>.from(r as Map));
    if (p.slot >= 1 && p.slot <= total) hasil[p.slot - 1] = p;
  }
  return hasil;
}

/// Satu baris `/api/sites?with_logger=1` → satu site, tanpa slot dan sesi.
///
/// Ambang diambil apa adanya dari kolom site; nilai bawaan model (5/8/10 mm)
/// hanya berlaku untuk site yang belum punya angka sendiri.
SiteData siteDariApi(
  Map<String, dynamic> j, {
  List<Prism>? prisms,
  List<RunSession>? sessions,
}) {
  final lokasi = (j['nama_lokasi'] ?? j['badge_label'] ?? '').toString();
  return SiteData(
    id: (j['slug'] ?? '').toString(),
    name: (j['nama'] ?? j['slug'] ?? '').toString(),
    location: lokasi.isEmpty ? (j['nama'] ?? '').toString() : lokasi,
    // id_logger, BUKAN nama_logger.
    //
    // `nama_logger` di basis data berisi deskripsi model ("Automatic
    // Deformation Recorder") — kalimat, bukan identitas. Dipakai sebagai judul
    // kartu ia membungkus tiga baris, mengulang label "ROBOTIC TOTAL STATION"
    // tepat di atasnya, dan tidak membedakan satu alat dari alat lain.
    // `id_logger` justru yang dipakai operator dan firmware (topik
    // `sub_<idAlat>`/`pub_<idAlat>`).
    logger: (j['id_logger'] ?? j['nama_logger'] ?? '').toString(),
    warning: nfloat(j['geser_normal_max']),
    alert: nfloat(j['geser_waspada_max']),
    danger: nfloat(j['geser_siaga_max']),
    prisms: prisms ?? List.generate(50, (i) => Prism(i + 1)),
    sessions: sessions ?? [],
  );
}

/// Satu baris `/api/log-kontrol` → sesi tanpa pembacaan.
///
/// Pembacaan sengaja tidak diisi dari `data_kirim`: kolom itu berisi E/N mentah,
/// sementara pergeseran yang benar memakai koordinat yang sudah dirotasi
/// terhadap acuan R0 — perhitungan yang tinggal di `/api/deformasi`. Mengisinya
/// di sini berarti menyalin rumus geodesi ke Dart dan membiarkannya menyimpang.
RunSession sesiDariApi(Map<String, dynamic> j) {
  final kirim = j['data_kirim'];
  final jumlah = kirim is List ? kirim.length : 0;
  final r0 = j['r0'] == 1 || j['r0'] == true;
  return RunSession(
    id: (j['id_log'] ?? '').toString(),
    time: waktuWib(j['datetime']),
    readings: [],
    reference: r0,
    // log_kontrol tidak menyimpan status sesi; sesi yang sudah tercatat berarti
    // sudah selesai mengirim.
    state: jumlah == 0 ? 'Kosong' : 'Selesai',
  );
}

/// `/api/deformasi?id_log=` → pembacaan satu sesi.
///
/// `N0/E0/Z0` dan `N1/E1/Z1` di `temp_tembak` adalah pasangan yang SUDAH
/// dirotasi — selisihnya persis `DN`/`DE` yang ditampilkan web. Pasangan
/// `raw_*` adalah koordinat sebelum rotasi dan tidak dipakai di sini.
List<Reading> pembacaanDariDeformasi(Map<String, dynamic> data) {
  final baris = data['data_pengukuran'];
  if (baris is! List) return [];
  final hasil = <Reading>[];
  for (final b in baris) {
    final j = Map<String, dynamic>.from(b as Map);
    final t = j['temp_tembak'];
    if (t is! Map) continue;
    final tt = Map<String, dynamic>.from(t);
    final slot = _slotDariId(j['id_prisma'], null);
    final n1 = nfloat(tt['N1']), e1 = nfloat(tt['E1']), z1 = nfloat(tt['Z1']);
    final n0 = nfloat(tt['N0']), e0 = nfloat(tt['E0']), z0 = nfloat(tt['Z0']);
    // Prisma yang gagal ditembak tidak punya koordinat hasil sama sekali.
    final berhasil = n1 != 0 || e1 != 0;

    // `daily` boleh kosong: `count` 0 berarti tidak ada pembacaan hari itu yang
    // bisa dibandingkan dengan acuan R0. Statusnya diambil dari `label`, bukan
    // dihitung ulang dari ambang site.
    final d = j['daily'];
    final harian = d is Map ? Map<String, dynamic>.from(d) : null;
    final adaHarian = ((harian?['count'] as num?)?.toInt() ?? 0) > 0;
    String? label(String kunci) {
      final v = harian?[kunci];
      return v is Map ? v['label']?.toString() : v?.toString();
    }

    hasil.add(
      Reading(
        slot: slot,
        name: (tt['nama_prisma'] ?? j['nama_prisma'] ?? 'P$slot').toString(),
        n: berhasil ? n1 : n0,
        e: berhasil ? e1 : e0,
        z: berhasil ? z1 : z0,
        n0: n0,
        e0: e0,
        z0: z0,
        ha: nfloat(tt['HA1']),
        va: nfloat(tt['VA1']),
        sd: nfloat(tt['SD1']),
        // Selisih DIAMBIL dari backend, bukan dihitung ulang dari N1-N0.
        // Backend mengembalikan nol untuk prisma yang acuan R0-nya belum ada,
        // dan pengurangan sendiri akan menghasilkan koordinat UTM utuh sebagai
        // "pergeseran". DN/DE/DZ bersatuan meter.
        dn: nfloat(tt['DN']) * 1000,
        de: nfloat(tt['DE']) * 1000,
        dz: nfloat(tt['DZ']) * 1000,
        success: berhasil,
        // Pasangan N0/E0 yang dua-duanya nol berarti prisma ini belum diikat ke
        // sesi acuan, bukan berarti tidak bergeser.
        punyaAcuan: n0 != 0 || e0 != 0,
        geserHarianMm: adaHarian ? nfloat(harian?['pergeseran_mm']) : null,
        lajuHarianMmd: adaHarian ? nfloat(harian?['kecepatan_mmd']) : null,
        statusGeserHarian: adaHarian ? label('status_pergeseran') : null,
        statusLajuHarian: adaHarian ? label('status_kecepatan') : null,
      ),
    );
  }
  hasil.sort((a, b) => a.slot.compareTo(b.slot));
  return hasil;
}

/// `/api/log-aktivitas` → satu baris riwayat perintah.
Aktivitas aktivitasDariApi(Map<String, dynamic> j) => Aktivitas(
  perintah: (j['perintah'] ?? '').toString(),
  waktu: waktuWib(j['waktu']),
  terkirim: j['terkirim'] == true || j['terkirim'] == 1,
);

/// `/api/config-adr` ⇄ label yang dibaca operator.
///
/// Kunci kiri adalah label di formulir, kanan nama kolom `config_adr`.
/// Dipasangkan eksplisit supaya penggantian nama kolom ketahuan di satu tempat,
/// bukan menyebar sebagai field kosong di formulir.
///
/// `Sapuan horizontal/vertikal` dan `Track every` TIDAK ada di sini: backend
/// tidak menyimpannya di `config_adr`, keduanya perintah MQTT tersendiri lewat
/// `/api/kontrol/search-area` dan `/api/kontrol/track-every`. Formulirnya tetap
/// menampilkan ketiganya berdampingan karena begitu operator memikirkannya;
/// yang berbeda hanya ke mana nilainya dikirim saat disimpan.
const petaKonfigurasi = <String, String>{
  'Job name': 'job_name',
  'Prisma const (mm)': 'prisma_cons',
  'TS high (m)': 'ts_high',
  'Coordinate X (m)': 'coor_x',
  'Coordinate Y (m)': 'coor_y',
  'Coordinate Z (m)': 'coor_z',
  'Step record': 'step_record',
  'Retries': 'retries',
  'Cycle time (ms)': 'cycle_time',
};

/// Label untuk nilai yang dikirim sebagai perintah, bukan disimpan di config.
const labelSapuanHor = 'Sapuan horizontal (°)';
const labelSapuanVer = 'Sapuan vertikal (°)';
const labelTrackEvery = 'Track every (menit)';
const labelAutoSearch = 'Auto search';

Map<String, String> konfigurasiDariApi(Map<String, dynamic> j) {
  final hasil = <String, String>{};
  petaKonfigurasi.forEach((label, kolom) {
    final v = j[kolom];
    hasil[label] = v == null ? '' : v.toString();
  });
  hasil[labelAutoSearch] = (j['auto_search'] == 1 || j['auto_search'] == true)
      .toString();
  return hasil;
}

/// Kebalikannya, untuk badan `PUT /api/config-adr`.
///
/// Hanya kolom yang benar-benar milik `config_adr` yang ikut; sisanya diam di
/// sini supaya tidak dikirim ke endpoint yang akan mengabaikannya tanpa kabar.
Map<String, dynamic> konfigurasiKeApi(String site, Map<String, String> config) {
  final body = <String, dynamic>{'site': site};
  petaKonfigurasi.forEach((label, kolom) {
    final v = config[label];
    if (v == null) return;
    // Kolom numerik dikirim sebagai angka: backend memvalidasi rentang
    // `retries` dan `cycle_time`, dan string akan lolos pemeriksaan itu.
    body[kolom] = kolom == 'job_name' ? v : (double.tryParse(v) ?? v);
  });
  body['auto_search'] = config[labelAutoSearch] == 'true';
  return body;
}
