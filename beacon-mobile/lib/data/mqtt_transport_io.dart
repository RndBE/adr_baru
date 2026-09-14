/// Transport MQTT untuk platform native (iOS, Android, desktop).
///
/// Dipilih lewat conditional import di `mqtt_balasan.dart`. Pemisahan ini WAJIB,
/// bukan kerapian: `mqtt_browser_client` menarik `dart:js_interop` yang tidak
/// ada di VM, jadi mengimpor keduanya sekaligus membuat seluruh paket gagal
/// dikompilasi di luar web — termasuk saat menjalankan tes.
library;

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

MqttClient buatKlien(String host, int port, String id) => MqttServerClient(
  host,
  id,
)
  ..port = port
  // Broker yang sama dengan web, lewat WebSocket — bukan TCP polos.
  ..useWebSocket = true
  ..websocketProtocols = MqttClientConstants.protocolsSingleDefault;
