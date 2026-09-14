# Beacon mobile — scope dan desain

## Sumber yang dianalisis
- `asaba/`: aplikasi CodeIgniter lama.
- `asaba-nextjs/src/components/app-sidebar.tsx`: navigasi website aktif.
- `asaba-nextjs/src/app/(dashboard)/beranda/page.tsx`: site, sesi, telemetri RTS, status, denah prisma, elevasi, riwayat, R0.
- `kontrol-adr/page.tsx`: daya, tilt, set home, start/stop, replay SD, konfigurasi instrumen, SearchArea, TrackEvery, penjadwalan mingguan, hapus log.
- `prism-config/page.tsx` dan `components/prism-config/`: 50 slot per site, akses terkunci, BS/FS, tinggi target, bidik/jog, sudut HA/VA, auto search, uji tembak, simpan/hapus.
- `hasil-pengukuran/page.tsx` dan `[prisma]/page.tsx`: sesi, Harian/Event/Peta, filter kolom, detail prisma, rentang tanggal, grafik, pembacaan, ekspor Excel.
- `components/monitoring/r0-dialog.tsx`: R0 hanya baca; website belum menyediakan pergantian R0.
- `lib/protokol-rts.ts`: retries 1–15, cycle 1000–600000 ms, sapuan H 0–180 / V 0–90 kelipatan 1.5°, TrackEvery 0/5/10/15/20/30/60 menit.

Master Data dan Visualisasi 3D dikecualikan. Rekap Data dan Peta Tambang merupakan rute tersembunyi/dinonaktifkan di sidebar; bukan alur navigasi aktif. Denah 2D prisma tetap termasuk fitur pengukuran.

## Batas tahap frontend
Aplikasi terpisah di `beacon-mobile/`, tidak mengubah PHP, Next.js, database, API, atau MQTT. Data dan perintah memakai repository simulasi lokal, diberi label Demo. Sesi login demo bukan autentikasi produksi. Konfigurasi, slot, dan riwayat disimpan lokal. Simulasi instrumen tidak mengirim paket jaringan. Integrasi produksi memerlukan pekerjaan berikutnya, bukan status online palsu.

## Desain
Audience: operator pemantauan deformasi yang bekerja lewat telepon.
Job: membaca kondisi site, memeriksa prisma yang perlu perhatian, lalu menjalankan alur instrumen dengan jelas.

Palette: Ink #192443, Beacon #303481, Paper #F3F5FA, Teal #087F75, Amber #A66308, Line #E2E7F0. Putih untuk kartu baca; navy untuk panel instrumen. Status selalu disertai teks dan ikon.
Type: font platform sans untuk teks kerja; display tebal dengan jarak rapat; monospace untuk koordinat dan pembacaan.
Layout: pemilih site global → judul kerja → kondisi ringkas → rincian vertikal. Empat tujuan navigasi bawah: Ringkasan / Kontrol / Prisma / Hasil. Detail sebagai halaman; form sebagai lembar bawah yang bisa digulir mengikuti keyboard.
Signature: denah pengamatan 2D dengan garis bidik RTS ke prisma, memakai status warna yang sama dengan daftar. Ini memberi konteks lapangan yang lebih spesifik daripada kartu angka generik.

## Kontrak untuk integrasi selanjutnya (belum dipanggil)
| Fitur | Endpoint website |
|---|---|
| Site/logger | GET /api/sites?with_logger=1, /api/loggers/:id |
| Sesi, deformasi | GET /api/log-kontrol?site=, /api/deformasi?id_log= |
| Riwayat prisma | GET /api/analisa?type=range&id_prisma=&kolom=&dari=&sampai= |
| Konfigurasi | GET/PUT /api/config-adr?site= |
| Instrumen | POST /api/kontrol/{power,get-tilt,set-home,start,stop,replay,search-area,track-every} |
| Prisma | /api/prism-config, /api/prism-config/prism-set |
| Bidik | POST /api/kontrol/{jog,manual-hava,go-to-target,auto-search,measure} |
| Jadwal | GET/PUT /api/scheduling |
| Hapus sesi | DELETE /api/log-kontrol/:id_log |
| Ekspor | /api/export-excel |

`/api/mobile/login` membuat token random tetapi integrasi autentikasi endpoint kontrol/cookie perlu ditinjau tersendiri. Jangan menganggap token itu langsung berlaku pada semua endpoint.

## Audit rumus
Pemeriksaan lanjutan `components/monitoring/status.ts`, `derive.ts`, dan `api/deformasi/route.ts` menemukan empat tingkat status (Normal/Waspada/Siaga/Awas). Pergeseran Harian memakai resultan **horizontal** E/N; linear 3D merupakan angka terpisah. `kecepatan_mmd` di website adalah `abs(last_lin - first_lin) * 1000`, tanpa normalisasi durasi. Frontend demo mengikuti rumus tersebut agar interpretasinya konsisten. Acuan R0 demo menghasilkan delta nol.

## Revisi header
Atas permintaan pengguna, header shell diubah menjadi putih bersih tanpa gambar logo. Identitas memakai teks Monitoring / Beacon Mobile, badge Demo netral, tombol akun bundar, dan garis bawah halus. Pemilih site diberi jarak 14 px dari header. Fungsi akun dan navigasi tetap bekerja. Verifikasi: analisis bersih, 16 tests lulus, build web/APK berhasil, dan inspeksi visual preview header.
