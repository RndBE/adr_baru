# Beacon Mobile

Frontend Flutter untuk aplikasi pemantauan deformasi Beacon. Project terpisah dari `asaba/` dan `asaba-nextjs/`. Backend tidak diubah.

## Mencoba aplikasi

- **Android:** APK debug tersedia setelah build di `build/app/outputs/flutter-apk/app-debug.apk`.
- **Browser:** jalankan `flutter run -d chrome`; tampilan ditujukan untuk ponsel, konten dibatasi lebarnya pada desktop.
- **Perangkat Android:** jalankan `flutter run` dengan perangkat/emulator terhubung.

```sh
cd beacon-mobile
flutter pub get
flutter run -d chrome
```

Akun demo: **operator / beacon123**. Kode akses kontrol/prisma: **123456**. Tombol **Jelajahi demo** langsung mengisi akun contoh. Data yang ditampilkan, status perangkat, dan balasan instrumen merupakan simulasi. Tidak ada panggilan API/MQTT ke backend atau alat.

## Fitur

| Menu | Alur frontend |
|---|---|
| Login | Validasi isian, pesan akun salah, tampil/sembunyikan password, demo, logout |
| Ringkasan | Pilih site dan sesi, telemetri demo, status pergeseran, denah 2D dengan detail prisma, arah pergeseran, hasil sesi, profil elevasi, informasi R0 |
| Kontrol ADR | Daya on/off, baca tilt, simpan home, mulai dengan kode akses, progres hasil, stop, replay SD, konfigurasi instrumen, SearchArea, TrackEvery, jadwal daya mingguan, hapus sesi, log aktivitas |
| Prism Config | 50 slot/site, akses terkunci, pencarian/filter, tambah/ubah/hapus, BS/FS, tinggi target, Manual HA/VA, jog, Go To Target, Auto Search, uji tembak sebelum simpan |
| Hasil | Pilih sesi/rentang, Harian/Event/Peta, cari/filter status, atur kelompok kolom, detail prisma, riwayat grafik horizontal/linear/ΔN/ΔE/ΔZ, tabel riwayat, Excel |
| Kondisi data | Loading, retry setelah error (tersedia dari menu akun), site kosong, pencarian kosong, penyimpanan lokal dan pesan gagal menyimpan |

Master Data dan Visualisasi 3D tidak disertakan. `Linear 3D` pada detail hanya angka/grafik resultan, bukan visualisasi ruang 3D. R0 hanya-baca mengikuti website. Rekap Data/Peta Tambang tidak diikutkan karena menu tersebut dinonaktifkan di sidebar website.

## Perilaku data

- Site, slot, konfigurasi, jadwal dan sesi disimpan melalui SharedPreferences di namespace `beacon.demo.v1`.
- Login dan kunci akses tidak dipersistenkan. Berpindah site mengunci kembali konfigurasi.
- Sesi yang berjalan tetap milik site asal walaupun operator berpindah site. Stop mempertahankan hasil parsial. Sesi R0 tidak dapat dihapus.
- Instrumen disimulasikan berurutan dengan timer. Jadwal disimpan untuk mencoba formulir; tidak ada scheduler/perintah perangkat sungguhan. Replay menampilkan kembali informasi sesi demo yang sudah ada, bukan membaca kartu SD nyata.
- Harian memakai pergeseran horizontal E/N dalam **mm**; kecepatan mengikuti rumus website: nilai absolut selisih pertama–terakhir pada hari itu, dengan label **mm/hari**. Event memakai **meter**, dan delta pada detail memakai **mm**.
- Ambang contoh: Normal <5 mm; Waspada <8 mm; Siaga <10 mm; Awas ≥10 mm. Ambang laju demo 1/2/3 mm/hari menggunakan perbandingan `>` seperti website. Nilai contoh ini bukan ambang operasional lapangan.
- Ekspor membuat file `.xlsx` sungguhan. Android/iOS membuka lembar bagikan/simpan sistem; web menggunakan Web Share atau download fallback. Tidak ada pengiriman otomatis ke orang lain. Ekspor hasil mencakup sesi terpilih (seluruh sesi hari itu pada mode Harian); ekspor detail dibatasi prisma dan rentang.

## Struktur

- `lib/data/`: model bertipe, repository lokal, validasi, pembentukan workbook.
- `lib/core/`: tema Beacon, komponen, grafik Canvas dan denah 2D.
- `lib/screens/`: dashboard, kontrol, konfigurasi prisma, hasil/detail.
- `lib/main.dart`: bootstrap, login, shell dan pemilih site.
- `docs/ANALYSIS.md`: pemetaan kode website dan kontrak API untuk tahap integrasi berikutnya.

Repository demo adalah sumber data frontend. Integrasi backend nyata belum dilakukan: autentikasi, transport HTTP/MQTT, pembacaan telemetri, dan acknowledgment alat harus diimplementasikan pada tahap integrasi tanpa menganggap balasan simulasi sebagai balasan nyata.

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
