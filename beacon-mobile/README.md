# Beacon Mobile

Aplikasi Flutter untuk pemantauan deformasi Beacon. Terpisah dari `asaba-nextjs/`, tapi **tidak berdiri sendiri**: seluruh datanya berasal dari backend itu, dan perintahnya menggerakkan RTS sungguhan di lapangan.

> **Tombol di menu Kontrol dan Prism Config menggerakkan instrumen nyata.**
> Daya, jog, Auto Search, Go To Target, uji tembak, dan Mulai pengukuran
> menerbitkan perintah MQTT ke alat. Tidak ada mode latihan.

## Menjalankan

```sh
cd beacon-mobile
flutter pub get
flutter run                      # menunjuk server produksi
```

Login memakai akun yang sama dengan website (tabel `t_user`); tidak ada akun contoh. Kode akses konfigurasi dan Mulai pengukuran diverifikasi backend, bukan dicocokkan di aplikasi.

### Menunjuk backend lain

Bawaannya `https://demo-adr.monitoring4system.com`. Untuk dev server di mesin sendiri:

```sh
flutter run --dart-define=BEACON_API=http://localhost:3000
```

Broker balasan alat juga bisa diganti — nilai bawaannya sama dengan `NEXT_PUBLIC_MQTT_*` milik website:

```sh
--dart-define=BEACON_MQTT_HOST=... --dart-define=BEACON_MQTT_WS_PORT=8083
--dart-define=BEACON_MQTT_USER=... --dart-define=BEACON_MQTT_PASS=...
```

### Yang dibutuhkan backend

- Migrasi `prisma/migrations/013_log_aktivitas.sql` sudah dijalankan, kalau Log aktivitas mau terisi. Tanpa itu pencatatan gagal diam-diam dan perintahnya tetap terkirim.
- `AUTH_SECRET` terpasang — token mobile ditandatangani dengannya.

## Fitur

| Menu | Isi | Sumber |
|---|---|---|
| Login | Validasi isian, pesan galat dari server, tampil/sembunyikan password, logout | `POST /api/mobile/login` |
| Dashboard | Pilih site dan sesi, telemetri alat, status pergeseran, denah 2D dengan detail prisma, arah pergeseran, hasil sesi, profil elevasi, informasi R0 | `sites`, `log-kontrol`, `deformasi`, `kontrol/dashboard` |
| Kontrol ADR | Daya on/off, baca tilt, simpan home, mulai dengan kode akses, progres sesi, stop, replay SD, konfigurasi instrumen, SearchArea, TrackEvery, jadwal running, hapus sesi, log aktivitas | `kontrol/*`, `config-adr`, `scheduling`, `log-aktivitas` |
| Prism Config | 50 slot/site, akses terkunci, pencarian/filter, tambah/ubah/hapus, BS/FS, tinggi target, Manual HA/VA, jog, Go To Target, Auto Search, uji tembak wajib lulus sebelum simpan | `prism-config`, `kontrol/{measure,jog,auto-search,go-to-target,manual-hava}` |
| Hasil | Pilih sesi/rentang, Harian/Event/Peta, cari/filter status, atur kelompok kolom, detail prisma, riwayat grafik horizontal/linear/ΔN/ΔE/ΔZ, tabel riwayat, Excel | `log-kontrol`, `deformasi` |
| Kondisi data | Memuat, coba lagi setelah galat, site kosong, pencarian kosong, sesi berakhir | — |

Master Data dan Visualisasi 3D tidak disertakan. `Linear 3D` pada detail hanya angka/grafik resultan, bukan visualisasi ruang 3D. R0 hanya-baca mengikuti website. Rekap Data/Peta Tambang tidak diikutkan karena menu tersebut dinonaktifkan di sidebar website.

## Perilaku data

- **Server yang menyimpan.** Site, slot prisma, sesi, pembacaan, konfigurasi RTS, jadwal, dan riwayat perintah semuanya milik backend. Yang tersimpan di perangkat hanya token sesi (`beacon.token.v1`), berlaku 30 hari.
- **Pembacaan tidak dihitung ulang di aplikasi.** Pergeseran memerlukan rotasi koordinat terhadap acuan R0; rumus itu tinggal di `/api/deformasi`. Menyalinnya ke Dart berarti dua salinan yang akan menyimpang.
- **Sudut `"331,85,05"` bukan DMS.** Backend mengganti koma jadi titik lalu `parseFloat`, yang berhenti di titik kedua — nilainya 331.85. Ditiru persis di `lib/data/beacon_api.dart`.
- **Kolom waktu berisi jam dinding WIB** walau diserialkan berakhiran `Z`. Tidak pernah dikonversi zona.
- **Perintah alat fire-and-forget.** Backend menerbitkan ke `sub_<idAlat>` lalu langsung menjawab; hasilnya datang di `pub_<idAlat>`, yang di-subscribe aplikasi lewat WSS. Tombol yang menunggu hasil memakai timeout dari tabel durasi protokol (Bagian A).
- **Uji tembak wajib mendapat pantulan** sebelum slot bisa disimpan. Pantulan dengan keempat medan kosong berarti tidak ada prisma di sudut itu — bukan hasil bernilai nol.
- **Jog bersifat relatif**, satuan derajat desimal. Isian Manual HA/VA menghitung selisihnya terhadap posisi terakhir yang dilaporkan alat.
- Ekspor membuat `.xlsx` sungguhan dari data yang sudah ditarik. Android/iOS membuka lembar bagikan sistem; web memakai Web Share atau download fallback.

## Struktur

- `lib/data/api_client.dart`: HTTP + token bearer, amplop `{success, data, error}` dibuka di satu tempat.
- `lib/data/beacon_api.dart`: penerjemah bentuk balasan backend ke model.
- `lib/data/repository.dart`: sumber data aplikasi; seluruh perintah alat lewat sini.
- `lib/data/protokol_rts.dart`: pembaca balasan alat, porting dari `src/lib/protokol-rts.ts` dan `balasan-logger.ts`.
- `lib/data/mqtt_balasan.dart`: langganan WSS ke `pub_<idAlat>`; transportnya dipisah per platform.
- `lib/core/`: tema Beacon, komponen, grafik Canvas dan denah 2D.
- `lib/screens/`: dashboard, kontrol, konfigurasi prisma, hasil/detail.
- `docs/ANALYSIS.md`: catatan tahap frontend. **Sudah usang** — bagian "belum dipanggil" tidak berlaku lagi.

Aturan yang sudah punya rumah di backend tidak ditulis ulang di sini. Yang diporting ke Dart hanya pembacaan balasan alat, karena balasannya tiba langsung di aplikasi lewat MQTT dan tidak melewati backend sama sekali.

## Verifikasi

```sh
flutter analyze
flutter test
flutter build web
flutter build apk --debug
```

Widget tests mencakup alur login, empat menu pada lebar 320/390/600 px, pemilihan site, kunci akses, uji tembak wajib, validasi konfigurasi dan retry. Tests repository mencakup isolasi site, start/stop, persistensi, batas protokol, file Excel, dan konversi koordinat.

Android debug APK untuk review lokal, belum paket Play Store. Source iOS telah dibuat tetapi build iOS belum diverifikasi karena Xcode/CocoaPods di lingkungan ini belum lengkap.

Referensi arsitektur: [Flutter app architecture](https://docs.flutter.dev/app-architecture/guide), [adaptive and responsive UI](https://docs.flutter.dev/ui/adaptive-responsive).
