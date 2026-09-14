// flutter test test/repository_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:excel/excel.dart';
import 'package:beacon_mobile/data/api_client.dart';
import 'package:beacon_mobile/data/beacon_api.dart';
import 'package:beacon_mobile/data/repository.dart';
import 'package:beacon_mobile/data/models.dart';
import 'package:beacon_mobile/data/export_service.dart';
import 'fake_backend.dart';

BeaconRepository buat({
  JejakPanggilan? jejak,
  bool loginGagal = false,
  bool kodeSalah = false,
  bool siteGagal = false,
  bool persist = false,
}) => BeaconRepository(
  persist: persist,
  api: ApiClient(
    baseUrl: 'http://uji',
    client: backendPalsu(
      jejak: jejak,
      loginGagal: loginGagal,
      kodeSalah: kodeSalah,
      siteGagal: siteGagal,
    ),
  ),
);

Future<BeaconRepository> masuk({JejakPanggilan? jejak}) async {
  final r = buat(jejak: jejak);
  await r.login('demo', 'rahasia');
  return r;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('pemetaan balasan backend', () {
    test('sudut dibaca seperti nfloat di backend, bukan sebagai DMS', () {
      // "331,85,05" → 331.85. Kalau ini ditafsirkan derajat-menit-detik
      // hasilnya 333.42, dan angka di ponsel akan berbeda dari yang di web.
      expect(nfloat('331,85,05'), closeTo(331.85, 1e-9));
      expect(nfloat('000,00,00'), 0);
      expect(nfloat(null), 0);
      expect(nfloat(12.5), 12.5);
    });

    test('waktu DB dibaca sebagai jam dinding WIB, tanpa digeser', () {
      // Kolom DATETIME diserialkan dengan akhiran Z padahal isinya WIB.
      // `.toLocal()` akan menggeser +7 jam dan memunculkan sesi pukul 17:11.
      final t = waktuWib('2025-11-21T10:11:09.000Z');
      expect(t.hour, 10);
      expect(t.minute, 11);
      expect(t.day, 21);
    });

    test('50 slot selalu ada meski backend hanya mengirim sebagian', () {
      final slot = slotDariApi([
        {
          'id_prisma': 'P2',
          'nama_prisma': 'B',
          'jenis': 'fs',
          'slot': 2,
          'registered': true,
        },
      ]);
      expect(slot.length, 50);
      expect(slot[1].name, 'B');
      expect(slot[0].registered, false);
    });

    test('prisma gagal tembak ditandai, bukan dilaporkan nol', () {
      final r = pembacaanDariDeformasi({
        'data_pengukuran': [
          {
            'id_prisma': 'P9',
            'temp_tembak': {
              'nama_prisma': 'X',
              'N0': 100.0,
              'E0': 200.0,
              'Z0': 5.0,
              'N1': 0,
              'E1': 0,
              'Z1': 0,
              'DN': '0.000000',
              'DE': '0.000000',
              'DZ': '0.000000',
            },
          },
        ],
      });
      expect(r.single.success, false);
      expect(r.single.displacement, 0);
    });

    test('acuan R0 kosong TIDAK jadi pergeseran ribuan kilometer', () {
      // Bentuk asli dari produksi: prisma yang belum punya acuan R0. Backend
      // menolak menyatakan angka — DN/DE/DZ nol, arah "-". Menghitung sendiri
      // `N1 - N0` di sini menghasilkan koordinat UTM utuh dalam milimeter:
      // satu prisma terbaca bergeser 9.150 km.
      final r = pembacaanDariDeformasi({
        'data_pengukuran': [
          {
            'id_prisma': 'P1',
            'temp_tembak': {
              'nama_prisma': 'BS1',
              'N0': 0,
              'E0': 0,
              'Z0': 0,
              'N1': 444376.5419,
              'E1': 9139557.1118,
              'Z1': 204.4625,
              'DN': '0.000000',
              'DE': '0.000000',
              'DZ': '0.000000',
            },
          },
        ],
      });
      expect(r.single.displacement, 0);
      expect(r.single.linear3d, 0);
      // Koordinat terukur tetap ditampilkan apa adanya.
      expect(r.single.n, closeTo(444376.5419, 1e-6));
    });

    test('selisih diambil dari DN/DE/DZ, bukan dihitung dari N1-N0', () {
      final r = pembacaanDariDeformasi({
        'data_pengukuran': [
          {
            'id_prisma': 'P1',
            'temp_tembak': {
              'nama_prisma': 'BS_1',
              'N0': 401306.514,
              'E0': 525919.314,
              'Z0': 63.835,
              'N1': 401306.5261514441,
              'E1': 525919.3105601738,
              'Z1': 63.8373,
              'DN': '0.012151',
              'DE': '-0.003440',
              'DZ': '0.002300',
            },
          },
        ],
      });
      expect(r.single.dn, closeTo(12.151, 1e-6));
      expect(r.single.de, closeTo(-3.44, 1e-6));
      expect(r.single.dz, closeTo(2.3, 1e-6));
    });

    test('konfigurasi bolak-balik memakai nama kolom backend', () {
      final config = konfigurasiDariApi({
        'job_name': 'JOB',
        'retries': 3,
        'cycle_time': 5000,
        'auto_search': 1,
      });
      expect(config['Job name'], 'JOB');
      expect(config[labelAutoSearch], 'true');
      final body = konfigurasiKeApi('ccp', config);
      expect(body['site'], 'ccp');
      expect(body['job_name'], 'JOB');
      expect(body['retries'], 3);
      expect(body['auto_search'], true);
      // Sapuan & track every bukan kolom config_adr; tidak boleh ikut terkirim.
      expect(body.containsKey('search_area_hor'), false);
      expect(body.containsKey('track_every'), false);
    });
  });

  group('repository terhadap backend', () {
    test('login menyimpan token dan memuat site', () async {
      final jejak = JejakPanggilan();
      final r = await masuk(jejak: jejak);
      addTearDown(r.dispose);
      expect(r.loggedIn, true);
      expect(r.api.token, tokenPalsu);
      expect(r.sites.length, 2);
      expect(r.site.id, 'ccp');
      expect(r.site.name, 'CPP 3');
      // Identitas alat memakai id_logger, bukan deskripsi modelnya.
      expect(r.site.logger, '30002');
      // Ambang diambil dari kolom site, bukan nilai bawaan model.
      expect(r.site.warning, 100);
      // Ambang laju juga milik site, bukan angka contoh 1/2/3 mm/hari.
      expect(r.site.speedWarning, 50);
      expect(r.site.speedStatus(40), 'Normal');
      expect(r.site.speedStatus(120), 'Siaga');
      expect(r.site.speedStatus(200), 'Awas');
      expect(jejak.jalur, contains('GET /api/sites'));
    });

    test('login salah melempar pesan server dan tidak menandai masuk', () async {
      final r = buat(loginGagal: true);
      addTearDown(r.dispose);
      await expectLater(
        r.login('demo', 'salah'),
        throwsA(isA<ApiException>()),
      );
      expect(r.loggedIn, false);
      expect(r.api.token, isNull);
    });

    test('slot, sesi, pembacaan, dan keadaan alat ikut termuat', () async {
      final r = await masuk();
      addTearDown(r.dispose);
      expect(r.site.prisms.length, 50);
      expect(r.registered.length, 2);
      expect(r.site.prisms[0].kind, 'bs');
      expect(r.site.prisms[0].ha, closeTo(331.85, 1e-9));
      expect(r.site.sessions.length, 2);
      // Diurutkan terbaru dulu.
      expect(r.site.sessions.first.id, '101109');
      expect(r.site.sessions.last.reference, true);
      expect(r.latest!.readings.length, 2);
      expect(r.site.powered, true);
      expect(r.running, false);
      expect(r.site.config['Job name'], 'Demo Tambang MIP');
      expect(r.site.schedule.length, 2);
    });

    test('pindah site mengunci ulang akses dan memuat isi site baru', () async {
      final r = await masuk();
      addTearDown(r.dispose);
      await r.unlock('123456');
      expect(r.unlocked, true);
      r.selectSite(1);
      await Future<void>.delayed(Duration.zero);
      expect(r.unlocked, false);
      expect(r.site.id, 'viewpoint');
    });

    test('kode akses salah tidak membuka konfigurasi', () async {
      final r = buat(kodeSalah: true);
      addTearDown(r.dispose);
      await r.login('demo', 'rahasia');
      await expectLater(r.unlock('999999'), throwsA(isA<ApiException>()));
      expect(r.unlocked, false);
    });

    test('galat server tampil sebagai pesan, bukan lemparan mentah', () async {
      final r = buat(siteGagal: true);
      addTearDown(r.dispose);
      await r.login('demo', 'rahasia');
      expect(r.error, 'Database tidak dapat dihubungi');
      expect(r.loading, false);
    });

    test('perintah instrumen benar-benar dikirim ke endpointnya', () async {
      final jejak = JejakPanggilan();
      final r = await masuk(jejak: jejak);
      addTearDown(r.dispose);
      await r.power(true);
      await r.jog(0.5, 0);
      await r.setHome('HOME');
      expect(jejak.jalur, contains('POST /api/kontrol/power'));
      expect(jejak.jalur, contains('POST /api/kontrol/jog'));
      expect(jejak.jalur, contains('POST /api/kontrol/set-home'));
      final badanJog =
          jejak.badan[jejak.jalur.indexOf('POST /api/kontrol/jog')]! as Map;
      expect(badanJog['site'], 'ccp');
      // Jog itu RELATIF: yang dikirim selisihnya, bukan sudut tujuan.
      expect(badanJog['ha'], 0.5);
      expect(badanJog['va'], 0);
    });

    test('sudut absolut dikirim sebagai selisih dari posisi sekarang', () async {
      final jejak = JejakPanggilan();
      final r = await masuk(jejak: jejak);
      addTearDown(r.dispose);
      // Dashboard palsu melaporkan HA 124,50 dan VA 89,20.
      expect(r.site.ha, closeTo(124.5, 1e-9));
      expect(r.site.va, closeTo(89.2, 1e-9));
      await r.aimAbsolut(125, 89);
      final badan =
          jejak.badan[jejak.jalur.indexOf('POST /api/kontrol/jog')]! as Map;
      expect(badan['ha'], closeTo(0.5, 1e-9));
      expect(badan['va'], closeTo(-0.2, 1e-9));
      // Posisi perkiraan ikut maju, supaya langkah berikutnya punya acuan.
      expect(r.site.ha, closeTo(125, 1e-9));
      expect(r.site.va, closeTo(89, 1e-9));
    });

    test('perintah alat memakai endpointnya masing-masing', () async {
      final jejak = JejakPanggilan();
      final r = await masuk(jejak: jejak);
      addTearDown(r.dispose);
      await r.ukur('fs');
      await r.autoSearch(slot: 3);
      await r.goToTarget(3);
      expect(jejak.jalur, contains('POST /api/kontrol/measure'));
      expect(jejak.jalur, contains('POST /api/kontrol/auto-search'));
      expect(jejak.jalur, contains('POST /api/kontrol/go-to-target'));
      final ukur =
          jejak.badan[jejak.jalur.indexOf('POST /api/kontrol/measure')]! as Map;
      expect(ukur['jenis'], 'fs');
      final target = jejak
              .badan[jejak.jalur.indexOf('POST /api/kontrol/go-to-target')]!
          as Map;
      expect(target['slot_id'], 3);
    });

    test('penjaga lokal menolak perintah sebelum menyentuh jaringan', () async {
      final jejak = JejakPanggilan();
      final r = await masuk(jejak: jejak);
      addTearDown(r.dispose);
      r.site.powered = false;
      await expectLater(r.jog(1, 1), throwsStateError);
      expect(jejak.jalur, isNot(contains('POST /api/kontrol/jog')));
      // Sesi acuan R0 tidak boleh dihapus.
      final r0 = r.site.sessions.firstWhere((s) => s.reference);
      await expectLater(r.deleteSession(r0), throwsStateError);
    });

    test('simpan prisma butuh akses terbuka dan nama yang belum dipakai', () async {
      final r = await masuk();
      addTearDown(r.dispose);
      await expectLater(
        r.savePrism(Prism(13, name: 'BARU', registered: true)),
        throwsStateError,
      );
      await r.unlock('123456');
      await expectLater(
        r.savePrism(Prism(13, name: 'BS_1', registered: true)),
        throwsStateError,
      );
      await r.savePrism(Prism(13, name: 'BARU', registered: true));
      expect(r.site.prisms[12].name, 'BARU');
    });

    test('keluar menghapus token dan data di memori', () async {
      SharedPreferences.setMockInitialValues({});
      final r = buat(persist: true);
      addTearDown(r.dispose);
      await r.login('demo', 'rahasia');
      expect(
        (await SharedPreferences.getInstance()).getString('beacon.token.v1'),
        tokenPalsu,
      );
      await r.logout();
      expect(r.loggedIn, false);
      expect(r.sites, isEmpty);
      expect(
        (await SharedPreferences.getInstance()).getString('beacon.token.v1'),
        isNull,
      );
    });

    test('token tersimpan memulihkan sesi tanpa login ulang', () async {
      SharedPreferences.setMockInitialValues({'beacon.token.v1': tokenPalsu});
      final r = buat(persist: true);
      addTearDown(r.dispose);
      await r.load();
      expect(r.loggedIn, true);
      expect(r.sites.length, 2);
    });
  });

  group('aturan yang tetap milik aplikasi', () {
    test('konfigurasi divalidasi menurut satuan protokol', () {
      expect(validateConfig('Retries', '0'), isNotNull);
      expect(validateConfig('Retries', '15'), isNull);
      expect(validateConfig('Cycle time (ms)', '999'), isNotNull);
      expect(validateConfig('Sapuan horizontal (°)', '2'), isNotNull);
      expect(validateConfig('Sapuan horizontal (°)', '180'), isNull);
      expect(validateConfig(labelTrackEvery, '7'), isNotNull);
      expect(validateConfig('Coordinate X (m)', 'NaN'), isNotNull);
    });

    test('meter jadi milimeter dan arah searah jarum jam dari utara', () {
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
        dn: 3,
        de: 4,
        dz: 0,
      );
      expect(reading.displacement, closeTo(5, 1e-6));
      expect(reading.bearing, closeTo(53.1301, .001));
    });

    test('Excel berisi satuan, dan pembacaan gagal dikosongkan', () async {
      final r = await masuk();
      addTearDown(r.dispose);
      final bytes = measurementWorkbook(r.site, [r.latest!]);
      final workbook = Excel.decodeBytes(bytes);
      final rows = workbook['Pengukuran'].rows;
      expect(rows.length, 4); // judul + kepala + 2 prisma
      expect(rows[1][10]!.value.toString(), 'ΔN (mm)');
      expect(rows.first.first!.value.toString(), contains(r.site.name));
      // P2 gagal ditembak: kolom hasilnya dibiarkan kosong, bukan diisi nol.
      expect(rows[3][7]?.value, isNull);
      expect(rows[2][7]!.value, isNotNull);
    });
  });
}
