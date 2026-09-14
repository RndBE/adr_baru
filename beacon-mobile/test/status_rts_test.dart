// flutter test test/status_rts_test.dart
//
// Cermin dari asaba-nextjs/src/lib/status-rts.test.ts. Rumus ini pernah ditulis
// ulang di dua tempat dan membuat Beranda, Kontrol ADR, dan Prism Config saling
// membantah untuk perangkat yang sama; aplikasi ini sempat jadi yang ketiga.
import 'package:flutter_test/flutter_test.dart';
import 'package:beacon_mobile/data/status_rts.dart';

Map<String, dynamic> dashboard({
  required bool segar,
  required Object? cekRts,
  required Object? rtsRunning,
  Object? powerRts = -0.03,
}) => {
  'status_logger': segar,
  'data_rts': {
    'Cek_RTS': {'nilai': cekRts, 'satuan': ''},
    'RTS_Running': {'nilai': rtsRunning, 'satuan': ''},
    // sensor23 — kolom tilt. Ada di sini justru supaya ketahuan kalau ada yang
    // memakainya lagi sebagai keadaan daya.
    'Power_RTS': {'nilai': powerRts, 'satuan': ''},
  },
};

void main() {
  test('logger kirim + instrumen mati → terhubung tapi tidak aktif', () {
    final s = statusRtsDariDashboard(
      dashboard(segar: true, cekRts: 0, rtsRunning: 0),
    );
    expect(s.loggerTerhubung, true);
    expect(s.rtsAktif, false);
    expect(s.label, 'Tidak aktif');
  });

  test('instrumen menyala → aktif', () {
    final s = statusRtsDariDashboard(
      dashboard(segar: true, cekRts: 1, rtsRunning: 0),
    );
    expect(s.rtsMenyala, true);
    expect(s.rtsAktif, true);
    expect(s.label, 'Menyala, siap');
  });

  test('sedang mengukur → label mengukur', () {
    final s = statusRtsDariDashboard(
      dashboard(segar: true, cekRts: 1, rtsRunning: 1),
    );
    expect(s.rtsMengukur, true);
    expect(s.label, 'Sedang mengukur');
  });

  test('data basi → tidak aktif walau Cek_RTS = 1', () {
    final s = statusRtsDariDashboard(
      dashboard(segar: false, cekRts: 1, rtsRunning: 1),
    );
    expect(s.loggerTerhubung, false);
    expect(s.rtsAktif, false);
    expect(s.label, 'Tidak aktif');
  });

  test('dibaca sebagai string, bukan diangkakan', () {
    // Kolom sensor datang sebagai angka dari satu jalur dan string dari jalur
    // lain. Keduanya harus terbaca sama.
    expect(
      statusRtsDariDashboard(
        dashboard(segar: true, cekRts: '1', rtsRunning: '0'),
      ).rtsMenyala,
      true,
    );
    // Kolom kosong bukan "mati yang meyakinkan", tapi juga bukan menyala.
    final kosong = statusRtsDariDashboard(
      dashboard(segar: true, cekRts: '', rtsRunning: null),
    );
    expect(kosong.rtsMenyala, false);
    expect(kosong.rtsMengukur, false);
  });

  test('Power_RTS TIDAK menentukan keadaan daya', () {
    // Keadaan nyata di produksi: Cek_RTS = 1 (menyala), Power_RTS = -0.03
    // karena parameter itu memetakan sensor23, salah satu kolom tilt. Membaca
    // Power_RTS sebagai daya membuat ponsel bilang mati sementara web bilang
    // siap untuk instrumen yang sama.
    final s = statusRtsDariDashboard(
      dashboard(segar: true, cekRts: 1, rtsRunning: 0, powerRts: -0.03),
    );
    expect(s.rtsAktif, true);
    expect(s.label, 'Menyala, siap');
  });
}
