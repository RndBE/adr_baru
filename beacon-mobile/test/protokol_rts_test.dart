// flutter test test/protokol_rts_test.dart
//
// Mengunci pembacaan balasan alat terhadap contoh paket dari PROTOKOL_MQTT_ADR,
// persis seperti scripts/regresi-protokol-rts.ts mengunci sisi webnya. Alur MQTT
// sendiri tidak bisa diuji tanpa perangkat; aturannya bisa.
import 'package:flutter_test/flutter_test.dart';
import 'package:beacon_mobile/data/protokol_rts.dart';

void main() {
  group('measure_bs / measure_fs', () {
    test('pantulan terbaca sebagai hasil, bukan tahap', () {
      final b = bacaBalasanUkur({
        'HADMS': '151,38,71',
        'VADMS': '206,04,62',
        'SDis': '35.7679',
        'HD': '35.7',
      });
      expect(b.jenis, JenisBalasanUkur.hasil);
      expect(b.kosong, false);
      expect(b.ha, '151,38,71');
    });

    test('keempat medan kosong berarti GAGAL, bukan hasil bernilai nol', () {
      final b = bacaBalasanUkur({
        'HADMS': '',
        'VADMS': '',
        'SDis': '',
        'HD': '  ',
      });
      expect(b.jenis, JenisBalasanUkur.hasil);
      expect(b.kosong, true);
    });

    test('"done" itu penyelesaian, "start" cuma tahap', () {
      expect(
        bacaBalasanUkur({'value': 'done'}).jenis,
        JenisBalasanUkur.selesai,
      );
      expect(
        bacaBalasanUkur({'stage': 'start'}).jenis,
        JenisBalasanUkur.tahap,
      );
      expect(
        bacaBalasanUkur({'value': 'failed'}).jenis,
        JenisBalasanUkur.gagal,
      );
    });

    test('paket asing tidak dianggap balasan ukur', () {
      expect(bacaBalasanUkur(null).jenis, JenisBalasanUkur.bukan);
      expect(bacaBalasanUkur({'lain': 1}).jenis, JenisBalasanUkur.bukan);
    });
  });

  group('manual_hava', () {
    test('"000,00,00" pada KEDUA sudut adalah penanda gagal', () {
      final b = bacaManualHaVa({'HA': '000,00,00', 'VA': '000,00,00'});
      expect(b.ada, true);
      expect(b.gagal, true);
    });

    test('sudut dikembalikan apa adanya, termasuk detik ≥ 60', () {
      // Bug pemotongan desimal di firmware: detik 71 memang yang dikirim alat.
      final b = bacaManualHaVa({'HA': '151,38,71', 'VA': '206,04,62'});
      expect(b.gagal, false);
      expect(b.ha, '151,38,71');
    });
  });

  group('turning_target', () {
    test('"bad target" itu penolakan, bukan kemajuan', () {
      expect(
        klasifikasiTurningTarget({'value': 'bad target', 'target': 99}),
        KelasBalasan.gagal,
      );
    });

    test('bentuk angka lama tetap dikenali', () {
      expect(klasifikasiTurningTarget({'value': 1}), KelasBalasan.selesai);
      expect(klasifikasiTurningTarget({'value': 0}), KelasBalasan.gagal);
      expect(
        klasifikasiTurningTarget({'value': 'rotate'}),
        KelasBalasan.kemajuan,
      );
    });
  });

  group('jog', () {
    test('penolakan dikenali beserta sebabnya', () {
      for (final n in ['RTS Off', 'read failed', 'bad base', 'failed']) {
        final b = bacaBalasanJog({'value': n});
        expect(b.jenis, JenisBalasanJog.ditolak, reason: n);
        expect(sebabTolakJog[n], isNotNull, reason: n);
      }
    });

    test('tahap "target" membawa dua satuan sekaligus', () {
      final b = bacaBalasanJog({
        'value': 'target',
        'dari_HA': '151.3871',
        'ke_HA': '151,53,14',
      });
      expect(b.jenis, JenisBalasanJog.target);
      // `dari_*` derajat desimal, `ke_*` DMS. Keduanya dibiarkan string.
      expect(b.dariHa, '151.3871');
      expect(b.keHa, '151,53,14');
    });

    test('"done" menutup, tahap lain tidak', () {
      expect(bacaBalasanJog({'value': 'done'}).jenis, JenisBalasanJog.selesai);
      expect(bacaBalasanJog({'value': 'rotate'}).jenis, JenisBalasanJog.tahap);
    });
  });

  group('balasan logger', () {
    test('dibaca pipih maupun bersarang', () {
      expect(nilaiBalasanLogger(1), '1');
      expect(nilaiBalasanLogger({'value': 1}), '1');
      expect(nilaiBalasanLogger({'nilai': 'Success'}), 'Success');
      expect(nilaiBalasanLogger({'status': 0}), '0');
      expect(nilaiBalasanLogger(null), isNull);
      // Array tidak punya bentuk yang disepakati.
      expect(nilaiBalasanLogger([1, 2]), isNull);
    });

    test('sukses dan gagal dua-duanya perlu bukti', () {
      expect(balasanSelesai('1'), true);
      expect(balasanGagal('0'), true);
      // Bentuk yang belum dikenal tetap "belum ada jawaban".
      expect(balasanSelesai('Success'), false);
      expect(balasanGagal('Success'), false);
      expect(balasanGagal(null), false);
    });
  });
}
