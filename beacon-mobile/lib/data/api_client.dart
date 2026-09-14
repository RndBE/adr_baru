/// Klien HTTP ke backend asaba-nextjs.
///
/// Autentikasinya token bearer dari `POST /api/mobile/login`, bukan cookie
/// Auth.js: alur credentials Auth.js berjalan di peramban (CSRF + Set-Cookie)
/// dan tidak bisa ditempuh klien native. `src/proxy.ts` di backend menerima
/// `Authorization: Bearer <token>` untuk seluruh `/api/**` justru karena itu.
///
/// Seluruh route backend menjawab `{ success: bool, data?, error? }`. Bentuk itu
/// dipaksakan di satu tempat — `_json()` — supaya layar tidak perlu tahu.
library;

import 'dart:convert';
import 'package:http/http.dart' as http;

/// Dilempar untuk galat yang layak dibaca operator, bukan stack trace.
class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client})
    : _http = client ?? http.Client();

  /// Tanpa garis miring di akhir, mis. `http://localhost:3000`.
  final String baseUrl;
  final http.Client _http;

  String? _token;
  String? get token => _token;
  bool get authenticated => _token != null;

  /// Dipakai saat memulihkan sesi dari penyimpanan perangkat.
  void pakaiToken(String? token) => _token = token;

  Map<String, String> get _headers => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(
        queryParameters: query == null || query.isEmpty ? null : query,
      );

  /// Membuka amplop `{success, data, error}` dan melempar pesan servernya.
  ///
  /// Pesan server SELALU menang atas pesan buatan sendiri. Backend menjawab 401
  /// untuk dua hal berbeda — token kedaluwarsa DAN kredensial salah — jadi
  /// mengganti isinya dengan "Sesi berakhir" akan memberi tahu orang yang salah
  /// ketik password bahwa sesinya habis. `status` tetap dibawa supaya pemanggil
  /// bisa membedakan keduanya.
  dynamic _json(http.Response r) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(r.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        r.statusCode == 401
            ? 'Sesi berakhir. Masuk lagi.'
            : 'Balasan server tidak dikenali (HTTP ${r.statusCode}).',
        status: r.statusCode,
      );
    }
    if (body['success'] != true || r.statusCode >= 400) {
      throw ApiException(
        (body['error'] ??
                body['message'] ??
                (r.statusCode == 401
                    ? 'Sesi berakhir. Masuk lagi.'
                    : 'Permintaan gagal.'))
            .toString(),
        status: r.statusCode,
      );
    }
    return body['data'];
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) async =>
      _json(await _kirim(() => _http.get(_uri(path, query), headers: _headers)));

  Future<dynamic> post(String path, [Object? body]) async => _json(
    await _kirim(
      () => _http.post(
        _uri(path),
        headers: _headers,
        body: body == null ? null : jsonEncode(body),
      ),
    ),
  );

  Future<dynamic> put(String path, [Object? body]) async => _json(
    await _kirim(
      () => _http.put(
        _uri(path),
        headers: _headers,
        body: body == null ? null : jsonEncode(body),
      ),
    ),
  );

  Future<dynamic> delete(String path) async =>
      _json(await _kirim(() => _http.delete(_uri(path), headers: _headers)));

  /// Kegagalan jaringan tampil sebagai pesan, bukan SocketException mentah.
  Future<http.Response> _kirim(Future<http.Response> Function() f) async {
    try {
      return await f().timeout(const Duration(seconds: 20));
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('Server tidak dapat dihubungi. Periksa jaringan.');
    }
  }

  /// Menukar kredensial dengan token bearer dan menyimpannya di klien ini.
  Future<Map<String, dynamic>> login(String username, String password) async {
    _token = null;
    final data = await post('/api/mobile/login', {
      'username': username,
      'password': password,
    });
    final map = Map<String, dynamic>.from(data as Map);
    final token = map['token'];
    if (token is! String || token.isEmpty) {
      throw ApiException('Server tidak mengirim token.');
    }
    _token = token;
    return map;
  }

  void logout() => _token = null;
  void dispose() => _http.close();
}
