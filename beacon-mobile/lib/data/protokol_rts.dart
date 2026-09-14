/// Pembacaan balasan alat, diporting dari `asaba-nextjs/src/lib/protokol-rts.ts`
/// dan `src/lib/balasan-logger.ts`.
///
/// Ditulis ulang di Dart, BUKAN disederhanakan. Aturan di sini lahir dari
/// perilaku firmware yang tidak terdokumentasi di mana pun selain berkas asalnya;
/// menyederhanakannya berarti ponsel dan web menyimpulkan hal berbeda dari paket
/// yang sama. Setiap keanehan di bawah ada komentarnya — itu sebabnya ia ada.
///
/// Murni dan tanpa dependensi supaya bisa dikunci tes tanpa alat, persis seperti
/// berkas asalnya.
library;

/// Perintah ukur beserta NAMA KUNCI BALASANNYA.
///
/// Balasan dipilah lewat nama kunci ini, bukan lewat perintah yang dikirim:
/// satu topik membawa balasan semua perintah, dan menebak dari perintah terakhir
/// akan salah begitu dua perintah tumpang tindih.
const jenisUkur = {
  'bs': (perintah: 'measure_bs', balasan: 'MeasureBS', label: 'Backsight'),
  'fs': (perintah: 'measure_fs', balasan: 'MeasureFS', label: 'Foresight'),
};

/// Langkah jog dalam DERAJAT DESIMAL.
///
/// Satuannya berubah di revisi 3 protokol; revisi 2 memakai detik busur.
/// Selisihnya 3600× dan salah pilih tidak memunculkan galat apa pun — instrumen
/// tetap bergerak, hanya ke tempat yang sama sekali lain.
const langkahJog = [
  (label: '1°', derajat: 1.0),
  (label: '5°', derajat: 5.0),
  (label: '10°', derajat: 10.0),
];

const penandaHavaGagal = '000,00,00';

const _nilaiTolakJog = ['RTS Off', 'read failed', 'bad base', 'failed'];

/// Penjelasan tiap penolakan jog, ditampilkan apa adanya.
const sebabTolakJog = <String, String>{
  'RTS Off': 'RTS tidak menjawab. Nyalakan instrumen lebih dulu.',
  'read failed': 'Instrumen menjawab, tapi sudutnya tidak terbaca.',
  'bad base':
      'Sudut awal instrumen di luar rentang wajar, jadi geseran ditolak '
          'daripada memperparah.',
  'failed': 'Rotasi gagal dijalankan.',
};

String? _s(Map<String, dynamic> o, String k) => o[k]?.toString();

/// Nilai dari balasan logger, apa pun bentuknya.
///
/// Null berarti kuncinya memang tidak berisi apa-apa — dibedakan dari balasan
/// yang bernilai 0, karena 0 adalah jawaban yang berarti.
String? nilaiBalasanLogger(dynamic v) {
  if (v == null) return null;
  // Array tidak punya bentuk balasan yang disepakati; dibaca sebagai tidak
  // terbaca, bukan dipaksa jadi "1,2".
  if (v is List) return null;
  if (v is Map) {
    // `value` dipakai firmware baru; `nilai` dan `status` sudah terlihat di
    // balasan lain pada topik yang sama.
    final dalam = v['value'] ?? v['nilai'] ?? v['status'];
    return dalam?.toString();
  }
  return v.toString();
}

/// Hanya "1"/"true" yang berarti tuntas.
///
/// Nilai lain — termasuk 0 dan false — TIDAK boleh terbaca sukses: sukses palsu
/// di sini berarti operator menyimpan prisma yang alatnya gagal membidik.
bool balasanSelesai(String? nilai) => nilai == '1' || nilai == 'true';

/// Hanya "0"/"false" yang berarti gagal.
///
/// Sengaja BUKAN `!balasanSelesai()`: bentuk balasan yang belum dikenal harus
/// tetap terbaca "belum ada jawaban". Sukses dan gagal dua-duanya perlu bukti.
bool balasanGagal(String? nilai) => nilai == '0' || nilai == 'false';

// ── measure_bs / measure_fs (Bagian C.2) ────────────────────────────────────

enum JenisBalasanUkur { bukan, tahap, selesai, gagal, hasil }

class BalasanUkur {
  const BalasanUkur(
    this.jenis, {
    this.nilai = '',
    this.ha = '',
    this.va = '',
    this.sd = '',
    this.hd = '',
    this.kosong = false,
  });
  final JenisBalasanUkur jenis;
  final String nilai, ha, va, sd, hd;

  /// Keempat medan dikosongkan — satu-satunya penanda gagal yang bisa
  /// dipercaya, dan ia datang MENDAHULUI "failed".
  final bool kosong;
}

BalasanUkur bacaBalasanUkur(dynamic paket) {
  if (paket is! Map) return const BalasanUkur(JenisBalasanUkur.bukan);
  final o = Map<String, dynamic>.from(paket);

  final v = o['value'] ?? o['stage'];
  if (v != null) {
    final nilai = v.toString();
    if (nilai == 'failed') {
      return BalasanUkur(JenisBalasanUkur.gagal, nilai: nilai);
    }
    if (nilai == 'done') {
      return BalasanUkur(JenisBalasanUkur.selesai, nilai: nilai);
    }
    return BalasanUkur(JenisBalasanUkur.tahap, nilai: nilai);
  }

  const medan = ['HADMS', 'VADMS', 'SDis', 'HD'];
  if (!medan.any(o.containsKey)) {
    return const BalasanUkur(JenisBalasanUkur.bukan);
  }

  final ha = _s(o, 'HADMS') ?? '';
  final va = _s(o, 'VADMS') ?? '';
  final sd = _s(o, 'SDis') ?? '';
  final hd = _s(o, 'HD') ?? '';
  return BalasanUkur(
    JenisBalasanUkur.hasil,
    ha: ha,
    va: va,
    sd: sd,
    hd: hd,
    kosong: [ha, va, sd, hd].every((x) => x.trim().isEmpty),
  );
}

// ── manual_hava (Bagian C.1) ────────────────────────────────────────────────

class BacaanHaVa {
  const BacaanHaVa({
    required this.ada,
    required this.gagal,
    required this.ha,
    required this.va,
  });
  final bool ada, gagal;
  final String ha, va;
}

/// Sudutnya TIDAK ditafsirkan.
///
/// `manual_hava` termasuk yang kena bug sudut firmware: desimal derajat
/// dipotong seolah menit dan detik, jadi nilai seperti "151,38,71" (detik 71)
/// memang yang dikirim alat. Mengonversinya hanya menghasilkan angka yang salah
/// dengan cara berbeda.
BacaanHaVa bacaManualHaVa(dynamic paket) {
  const kosong = BacaanHaVa(ada: false, gagal: false, ha: '', va: '');
  if (paket is! Map) return kosong;
  final o = Map<String, dynamic>.from(paket);
  if (!o.containsKey('HA') && !o.containsKey('VA')) return kosong;

  final ha = _s(o, 'HA') ?? '';
  final va = _s(o, 'VA') ?? '';
  // Instrumen yang tidak menjawab membuat KEDUANYA "000,00,00" — itu penanda
  // gagal, bukan sudut sungguhan.
  return BacaanHaVa(
    ada: true,
    gagal: ha == penandaHavaGagal && va == penandaHavaGagal,
    ha: ha,
    va: va,
  );
}

// ── getTilt (Bagian C) ──────────────────────────────────────────────────────
//
//   {"set_30002":{"command":"set_rts","getTilt":true}}
//   → {"data_tilt":{"tilt1":"-0.00732","tilt2":"0.0198"}}
//
// Nama balasannya `data_tilt`, BUKAN `getTilt` maupun `Tilt`. `Tilt` adalah hal
// LAIN: pesan diagnostik kegagalan komunikasi, sebentuk dengan `Rotate` dan
// `Idle`. Salah membacanya berarti menampilkan kegagalan sebagai kemiringan.
//
// Nilainya dibiarkan STRING. Instrumen mengirimkannya begitu, dan mengubahnya
// jadi angka membuat "0" hasil pembacaan tidak bisa dibedakan dari 0 bawaan.

class BacaanTilt {
  const BacaanTilt({required this.ada, this.tilt1 = '', this.tilt2 = ''});
  final bool ada;
  final String tilt1, tilt2;
}

BacaanTilt bacaBalasanTilt(dynamic paket) {
  if (paket is! Map) return const BacaanTilt(ada: false);
  final o = Map<String, dynamic>.from(paket);
  if (!o.containsKey('tilt1') && !o.containsKey('tilt2')) {
    return const BacaanTilt(ada: false);
  }
  return BacaanTilt(
    ada: true,
    tilt1: _s(o, 'tilt1') ?? '',
    tilt2: _s(o, 'tilt2') ?? '',
  );
}

// ── turning_target / Go To Target ───────────────────────────────────────────

enum KelasBalasan { bukan, kemajuan, selesai, gagal }

/// `bad target` berarti nomor di luar 1–50 DITOLAK.
///
/// Tanpa mengenalinya, perintah yang tidak mengerjakan apa pun tetap membawa
/// status rotasi SEBELUMNYA dan terlihat berhasil.
KelasBalasan klasifikasiTurningTarget(dynamic paket) {
  if (paket is! Map) return KelasBalasan.bukan;
  final o = Map<String, dynamic>.from(paket);
  final v = o['value'] ?? o['stage'];
  if (v == null) return KelasBalasan.bukan;

  final nilai = v.toString();
  if (nilai == 'done' || nilai == '1' || nilai == 'true') {
    return KelasBalasan.selesai;
  }
  if (nilai == 'bad target' ||
      nilai == '0' ||
      nilai == 'false' ||
      nilai == 'failed') {
    return KelasBalasan.gagal;
  }
  return KelasBalasan.kemajuan;
}

// ── jog (Bagian C.5) ────────────────────────────────────────────────────────

enum JenisBalasanJog { bukan, tahap, target, selesai, ditolak }

class BalasanJog {
  const BalasanJog(
    this.jenis, {
    this.nilai = '',
    this.ha,
    this.va,
    this.dariHa,
    this.dariVa,
    this.keHa,
    this.keVa,
  });
  final JenisBalasanJog jenis;
  final String nilai;
  final String? ha, va;

  /// Dua satuan berbeda di dalam SATU balasan: `dari_*` derajat desimal (angka
  /// mentah instrumen), `ke_*` DMS mengikuti bentuk perintah rotasi. Dibiarkan
  /// string dan tidak ditafsirkan.
  final String? dariHa, dariVa, keHa, keVa;
}

BalasanJog bacaBalasanJog(dynamic paket) {
  if (paket is! Map) return const BalasanJog(JenisBalasanJog.bukan);
  final o = Map<String, dynamic>.from(paket);
  final v = o['value'] ?? o['stage'];
  if (v == null) return const BalasanJog(JenisBalasanJog.bukan);

  final nilai = v.toString();
  if (_nilaiTolakJog.contains(nilai)) {
    return BalasanJog(
      JenisBalasanJog.ditolak,
      nilai: nilai,
      ha: _s(o, 'HA'),
      va: _s(o, 'VA'),
    );
  }
  if (nilai == 'target') {
    return BalasanJog(
      JenisBalasanJog.target,
      nilai: nilai,
      dariHa: _s(o, 'dari_HA'),
      dariVa: _s(o, 'dari_VA'),
      keHa: _s(o, 'ke_HA'),
      keVa: _s(o, 'ke_VA'),
    );
  }
  if (nilai == 'done') return BalasanJog(JenisBalasanJog.selesai, nilai: nilai);
  return BalasanJog(JenisBalasanJog.tahap, nilai: nilai);
}
