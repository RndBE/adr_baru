/// Backend palsu untuk pengujian.
///
/// Bentuk balasannya disalin dari respons asli `asaba-nextjs` — termasuk
/// kebiasaannya yang menjebak: sudut sebagai string `"331,85,05"`, dan waktu
/// yang berakhiran `Z` padahal isinya jam dinding WIB. Memalsukan bentuk yang
/// lebih rapi dari aslinya akan membuat tes lulus untuk data yang tidak pernah
/// dikirim server.
library;

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const tokenPalsu = 'token.uji.palsu';

/// Endpoint mana saja yang sudah dipanggil — dipakai tes untuk memastikan
/// perintah benar-benar dikirim, bukan hanya tampil berhasil.
class JejakPanggilan {
  final List<String> jalur = [];
  final List<Object?> badan = [];
}

MockClient backendPalsu({
  JejakPanggilan? jejak,
  bool loginGagal = false,
  bool kodeSalah = false,
  bool siteGagal = false,
}) {
  return MockClient((req) async {
    jejak?.jalur.add('${req.method} ${req.url.path}');
    jejak?.badan.add(req.body.isEmpty ? null : jsonDecode(req.body));

    http.Response ok(Object? data) => http.Response(
      jsonEncode({'success': true, 'data': data}),
      200,
      headers: {'content-type': 'application/json'},
    );
    http.Response gagal(String pesan, int kode) => http.Response(
      jsonEncode({'success': false, 'error': pesan}),
      kode,
      headers: {'content-type': 'application/json'},
    );

    final p = req.url.path;
    final site = req.url.queryParameters['site'];

    if (p == '/api/mobile/login') {
      if (loginGagal) return gagal('Username atau password salah', 401);
      return ok({
        'id_user': 3,
        'token': tokenPalsu,
        'username': 'demo',
        'nama': 'Demo User',
        'level': 'admin',
      });
    }
    if (p == '/api/sites') {
      if (siteGagal) return gagal('Database tidak dapat dihubungi', 500);
      return ok([
        {
          'slug': 'ccp',
          'nama': 'CPP 3',
          'nama_logger': 'ADR CCP',
          'nama_lokasi': 'Pos RTS Demo',
          'id_logger': '30002',
          'geser_normal_max': 100,
          'geser_waspada_max': 200,
          'geser_siaga_max': 400,
          'laju_waspada_min': 50,
          'laju_siaga_min': 100,
          'laju_awas_min': 150,
        },
        {
          'slug': 'viewpoint',
          'nama': 'Viewpoint',
          'nama_logger': 'ADR CCP',
          'nama_lokasi': 'Pos RTS Demo',
          'id_logger': '30002',
          'geser_normal_max': 50,
          'geser_waspada_max': 100,
          'geser_siaga_max': 200,
        },
      ]);
    }
    if (p == '/api/prism-config') {
      if (req.method != 'GET') return ok({'ok': true});
      if (site == 'viewpoint') return ok([]);
      return ok([
        {
          'id_prisma': 'P1',
          'nama_prisma': 'BS_1',
          'jenis': 'bs',
          'target_height': 1.5,
          'HA': '331,85,05',
          'VA': '077,89,99',
          'slot': 1,
          'registered': true,
        },
        {
          'id_prisma': 'P2',
          'nama_prisma': 'PC_4',
          'jenis': 'fs',
          'target_height': 1.5,
          'HA': '027,99,40',
          'VA': '093,57,65',
          'slot': 2,
          'registered': true,
        },
      ]);
    }
    if (p == '/api/log-kontrol') {
      if (site == 'viewpoint') return ok([]);
      return ok([
        {
          'id_log': '101109',
          'datetime': '2025-11-21T10:11:09.000Z',
          'site': 'ccp',
          'r0': 0,
          'data_kirim': [
            {'id_prisma': 'P1'},
            {'id_prisma': 'P2'},
          ],
        },
        {
          'id_log': '100000',
          'datetime': '2025-11-20T08:00:00.000Z',
          'site': 'ccp',
          'r0': 1,
          'data_kirim': [
            {'id_prisma': 'P1'},
          ],
        },
      ]);
    }
    if (p == '/api/deformasi') {
      return ok({
        'tanggal': '2025-11-21T10:11:09.000Z',
        'data_pengukuran': [
          {
            'id_prisma': 'P1',
            'nama_prisma': 'BS_1',
            'temp_tembak': {
              'nama_prisma': 'BS_1',
              'N0': 401306.514,
              'E0': 525919.314,
              'Z0': 63.835,
              'N1': 401306.5261514441,
              'E1': 525919.3105601738,
              'Z1': 63.8373,
              'HA1': '000,00,09',
              'VA1': '087,57,16',
              'SD1': '35.7679',
              'DN': '0.012151',
              'DE': '-0.003440',
              'DZ': '0.002300',
            },
          },
          {
            'id_prisma': 'P2',
            'nama_prisma': 'PC_4',
            'temp_tembak': {
              'nama_prisma': 'PC_4',
              'N0': 401400.0,
              'E0': 525900.0,
              'Z0': 70.0,
              'N1': 0,
              'E1': 0,
              'Z1': 0,
              'HA1': '000,00,00',
              'VA1': '000,00,00',
              'SD1': '0',
              'DN': '0.000000',
              'DE': '0.000000',
              'DZ': '0.000000',
            },
          },
        ],
      });
    }
    if (p == '/api/kontrol/dashboard') {
      Map<String, dynamic> s(Object? v) => {'nilai': v, 'satuan': ''};
      return ok({
        'id_logger': '30002',
        'status_logger': true,
        'jumlah_prisma': 2,
        'data_rts': {
          // Nama parameter asli dari `parameter_sensor`. Cek_RTS memetakan
          // sensor14 (menyala); Power_RTS memetakan sensor23 — kolom tilt, dan
          // sengaja diberi nilai pecahan di sini supaya ketahuan kalau ada yang
          // memakainya lagi sebagai keadaan daya.
          'Cek_RTS': s(1),
          'RTS_Running': s(0),
          'Power_RTS': s(-0.03),
          'HA': s('124,50,00'),
          'VA': s('089,20,00'),
        },
        'config_adr': {
          'job_name': 'Demo Tambang MIP',
          'prisma_cons': 30,
          'ts_high': 10,
          'coor_x': 401320.988,
          'coor_y': 525952,
          'coor_z': 62.559,
          'step_record': 2,
          'retries': 1,
          'cycle_time': 5000,
          'auto_search': 1,
        },
        'schedule_all': [
          {'id': 'r1', 'nama': 'Run 1', 'status': 0, 'time': '15:00', 'days': 1},
          {'id': 'r2', 'nama': 'Run 2', 'status': 1, 'time': '20:00', 'days': 1},
        ],
      });
    }
    if (p == '/api/kontrol/verify-access') {
      if (kodeSalah) return gagal('Kode akses salah', 400);
      return ok({'ok': true});
    }
    if (p.startsWith('/api/kontrol/') ||
        p == '/api/config-adr' ||
        p == '/api/scheduling' ||
        p.startsWith('/api/log-kontrol/')) {
      return ok({'ok': true});
    }
    return gagal('Tidak ditemukan: $p', 404);
  });
}
