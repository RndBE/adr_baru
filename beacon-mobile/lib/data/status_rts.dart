/// Status instrumen, porting dari `asaba-nextjs/src/lib/status-rts.ts`.
///
/// Berkas asalnya ada justru karena aturan ini pernah disalin ke beberapa
/// tempat dengan cara yang sedikit berbeda, sehingga Beranda, Kontrol ADR, dan
/// Prism Config bisa menjawab berbeda untuk perangkat yang sama pada saat yang
/// sama. Aplikasi ini sempat mengulangi kesalahan itu untuk ketiga kalinya.
library;

/// "Logger terhubung" dan "RTS menyala" adalah DUA FAKTA BERBEDA.
///
/// Logger bisa melapor rajin sementara instrumennya mati, dan instrumen bisa
/// menyala sementara loggernya sudah sejam tidak mengirim apa-apa. Menyatukan
/// keduanya jadi satu boolean adalah persis yang dulu membuat halaman-halaman
/// web saling bertentangan.
class StatusRts {
  const StatusRts({
    required this.loggerTerhubung,
    required this.rtsMenyala,
    required this.rtsMengukur,
  });

  final bool loggerTerhubung, rtsMenyala, rtsMengukur;

  /// Instrumen bisa dipakai: menyala ATAU sedang mengukur, dan loggernya masih
  /// melapor. Tanpa syarat terakhir, status yang terbaca berasal dari data basi.
  bool get rtsAktif => loggerTerhubung && (rtsMenyala || rtsMengukur);

  /// Label seragam dengan website.
  String get label => rtsMengukur && loggerTerhubung
      ? 'Sedang mengukur'
      : rtsAktif
      ? 'Menyala, siap'
      : 'Tidak aktif';
}

/// Membaca `data_rts` dari `/api/kontrol/dashboard`.
///
/// Dibandingkan sebagai STRING, bukan diangkakan. Kolom sensor datang sebagai
/// angka dari satu jalur dan string dari jalur lain, dan `0` hasil pengangkaan
/// kolom kosong menyamarkan "tidak tahu" sebagai "mati" yang meyakinkan.
///
/// `loggerTerhubung` diambil dari `status_logger` kiriman server — jendela satu
/// jam itu dihitung di sana, dan menghitungnya lagi di sini berarti menambah
/// salinan keempat dari aturan yang sama.
StatusRts statusRtsDariDashboard(Map<String, dynamic> d) {
  final rts = d['data_rts'];
  String nilai(String kunci) {
    if (rts is! Map) return '';
    final v = (rts[kunci] as Map?)?['nilai'];
    return v?.toString() ?? '';
  }

  return StatusRts(
    loggerTerhubung: d['status_logger'] == true,
    // Cek_RTS → sensor14. BUKAN Power_RTS: parameter itu memetakan sensor23,
    // salah satu kolom pembacaan tilt, dan nilainya pecahan seperti -0.03.
    rtsMenyala: nilai('Cek_RTS') == '1',
    // RTS_Running → sensor16.
    rtsMengukur: nilai('RTS_Running') == '1',
  );
}
