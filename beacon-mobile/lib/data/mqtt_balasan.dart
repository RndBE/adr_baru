/// Balasan alat dari topik `pub_<idAlat>`.
///
/// Perintah RTS fire-and-forget: backend menerbitkan ke `sub_<idAlat>` lalu
/// langsung menjawab, dan hasilnya datang belakangan di topik ini. Tanpa
/// berlangganan ke sini aplikasi hanya tahu perintahnya terkirim — tidak tahu
/// prismanya kena, teleskopnya sampai, atau instrumennya menolak.
///
/// Halaman web melakukan persis hal yang sama lewat WSS
/// (`prisma-modal.tsx`, `arahkan-modal.tsx`). Klien ini menyalin perilakunya
/// supaya kedua sisi menyimpulkan hal yang sama dari paket yang sama.
library;

import 'dart:async';
import 'dart:convert';
import 'package:mqtt_client/mqtt_client.dart';
// Transportnya dipilih saat kompilasi: `mqtt_browser_client` menarik
// `dart:js_interop` yang tidak ada di VM, jadi mengimpor keduanya sekaligus
// membuat paket ini gagal dikompilasi di luar web — termasuk saat tes.
import 'mqtt_transport_io.dart'
    if (dart.library.js_interop) 'mqtt_transport_web.dart';

/// Pola topiknya ter-hardcode di firmware — tidak ada env yang mengubahnya.
String topikBalasan(String idAlat) => 'pub_$idAlat';

class MqttBalasan {
  MqttBalasan({
    required this.host,
    required this.port,
    required this.username,
    required this.password,
  });

  final String host, username, password;
  final int port;

  MqttClient? _klien;
  String? _topik;
  final _pesan = StreamController<Map<String, dynamic>>.broadcast();

  /// Setiap paket JSON yang tiba di topik balasan alat yang sedang dipantau.
  Stream<Map<String, dynamic>> get pesan => _pesan.stream;

  bool get tersambung =>
      _klien?.connectionStatus?.state == MqttConnectionState.connected;

  /// Menyambung lalu berlangganan balasan satu alat.
  ///
  /// Dipanggil ulang dengan id lain akan berpindah langganan; memanggilnya ulang
  /// dengan id yang sama tidak melakukan apa-apa.
  Future<void> pantau(String idAlat) async {
    final topikBaru = topikBalasan(idAlat);
    if (tersambung && _topik == topikBaru) return;

    await putus();
    _topik = topikBaru;

    final id = 'beacon-mobile-${DateTime.now().microsecondsSinceEpoch}';
    final klien = buatKlien(host, port, id);

    klien
      ..keepAlivePeriod = 30
      ..autoReconnect = true
      ..resubscribeOnAutoReconnect = true
      ..logging(on: false)
      ..connectionMessage = MqttConnectMessage()
          .withClientIdentifier(id)
          .startClean();

    _klien = klien;
    try {
      await klien.connect(username, password);
    } catch (_) {
      // Balasan alat adalah tambahan, bukan syarat: kegagalan menyambung tidak
      // boleh menjatuhkan layar yang sedang dibuka. Statusnya terbaca lewat
      // `tersambung`, dan UI memakai timeout protokol sebagai jaring pengaman.
      klien.disconnect();
      _klien = null;
      return;
    }

    if (!tersambung) {
      _klien = null;
      return;
    }

    klien.subscribe(topikBaru, MqttQos.atMostOnce);
    klien.updates?.listen((peristiwa) {
      for (final p in peristiwa) {
        final isi = p.payload;
        if (isi is! MqttPublishMessage) continue;
        final teks = MqttPublishPayload.bytesToStringAsString(
          isi.payload.message,
        );
        try {
          final data = jsonDecode(teks);
          if (data is Map) _pesan.add(Map<String, dynamic>.from(data));
        } catch (_) {
          // Topik yang sama membawa pesan non-JSON; diabaikan, bukan digagalkan.
        }
      }
    });
  }

  Future<void> putus() async {
    _klien?.disconnect();
    _klien = null;
    _topik = null;
  }

  void dispose() {
    unawaited(putus());
    unawaited(_pesan.close());
  }
}
