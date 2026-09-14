/// Transport MQTT untuk web. Lihat `mqtt_transport_io.dart` soal pemisahannya.
library;

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_browser_client.dart';

MqttClient buatKlien(String host, int port, String id) =>
    MqttBrowserClient('wss://$host', id)..port = port;
