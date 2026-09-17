-- Base map (ortofoto) per site untuk halaman Visualisasi 3D.
--
-- SUDAH DIJALANKAN di db_demoadr (Server 3) pada 17 September 2026 — cadangan
-- pra-penerapan ada di
-- /root/backup-demoadr-20260917-1113-pra-migrasi-014-t_site.sql.gz.
-- Kalau migrasi ini diterapkan ke basis data lain, tambahkan di sini.
--
-- Aman ditunda di basis data lain: semua kolomnya NULL, dan site tanpa base map
-- berperilaku persis seperti sekarang — halaman 3D cuma tidak menggambar lantai.
--
-- ── Kenapa di t_site, bukan konstanta di kode ───────────────────────────────
--
-- Ini persis bentuk yang dilarang src/lib/sites.ts: sebelum tabel ini ada,
-- perilaku per-site ditulis sebagai `if (site === 'ccp')` yang tersebar di enam
-- berkas, dan site ketiga selalu jatuh ke cabang `else`. Base map adalah fakta
-- per-site yang sama jenisnya dengan map_lat/map_lng/utm_zone yang sudah ada di
-- sini. Site kedua yang punya ortofoto harus bisa ditambahkan tanpa menyentuh
-- kode.
--
-- ── Kenapa kotak batas, bukan cuma berkasnya ────────────────────────────────
--
-- Berkas gambar tidak membawa georeferensinya. Ortofoto BPP 1-4 datang sebagai
-- ECW — formatnya menyimpan origin dan ukuran sel di headernya, tapi ECW tidak
-- bisa dibaca browser (dekodernya butuh SDK Hexagon), jadi yang dilayani adalah
-- JPEG hasil dekode dan georeferensinya harus ikut disimpan terpisah. Empat
-- sudut dalam meter UTM sudah cukup: gambarnya north-up, tidak ada rotasi, dan
-- tepi gambar dipetakan ke tepi kotak ini.
--
-- Zona UTM-nya TIDAK diulang di sini. Sudah ada di utm_zone/utm_north pada baris
-- yang sama, dan menyimpannya dua kali berarti suatu hari keduanya berbeda.
--
-- ── Kenapa topeng nodata jadi berkas dan kolom sendiri ──────────────────────
--
-- Ortofoto drone berbentuk poligon tak beraturan di dalam bingkai persegi;
-- 36% luas gambar BPP 1-4 adalah tepi kosong. Kalau tepi itu ikut digambar,
-- base map-nya jadi lempeng persegi yang menutupi apa pun di baliknya saat
-- kamera dimiringkan. PNG 1-bit yang menandai bagian bergambar cuma 8 KB,
-- sementara menyimpan alfa di dalam PNG berwarna membengkakkan berkasnya dari
-- 448 KB jadi 4,3 MB, dan JPEG tidak punya alfa sama sekali.
--
-- Jalurnya disimpan sebagai kolom, bukan diturunkan dari basemap_url dengan
-- menempelkan akhiran: aturan penamaan tersembunyi seperti itu baru ketahuan
-- salah sebagai gambar yang diam-diam tidak bertopeng.
--
-- ── Kenapa ada basemap_z ────────────────────────────────────────────────────
--
-- Ortofoto itu gambar datar; ia tidak punya tinggi. Tanpa nilai tersimpan,
-- halaman 3D menaruh bidangnya di prisma terendah — yang berpindah tiap kali
-- ada prisma baca baru dan bisa melompat jauh saat satu tembakan meleset.
-- Kolom ini tempat menuliskan elevasi tanah hasil survei sekali saja. NULL
-- berarti "turunkan dari data", perilaku yang sama dengan sebelum kolom ini ada.
ALTER TABLE `t_site`
  ADD COLUMN `basemap_url`        VARCHAR(255) NULL,
  ADD COLUMN `basemap_nodata_url` VARCHAR(255) NULL,
  ADD COLUMN `basemap_min_e`      DOUBLE       NULL,
  ADD COLUMN `basemap_max_e`      DOUBLE       NULL,
  ADD COLUMN `basemap_min_n`      DOUBLE       NULL,
  ADD COLUMN `basemap_max_n`      DOUBLE       NULL,
  ADD COLUMN `basemap_z`          DOUBLE       NULL;

-- Ortofoto drone BPP 1-4, 16 September 2026. Sumber: "BPP 1-4.ecw",
-- 29570 x 16613 piksel, 8,66 cm/piksel, WGS84 / UTM 49S — cocok dengan
-- utm_zone = 49, utm_north = 0 pada baris yang sama.
--
-- Kotak batasnya diturunkan dari header ECW: origin (sudut kiri-atas sel
-- kiri-atas) E 462357,8434 N 9749590,2390, lalu ditambah jumlah sel dikali
-- ukuran sel. Bukan hasil kira-kira dari peta.
--
-- Catatan lapangan: prisma DF_7 (E 465139) jatuh ~221 m di SEBELAH TIMUR tepi
-- ortofoto. Tujuh dari delapan prisma tertutup; DF_7 akan tampil di luar
-- gambar. Perlu terbang ulang kalau ortofotonya mau menutup seluruh jaring.
UPDATE `t_site` SET
  `basemap_url`        = '/basemap/kolam_bpp.jpg',
  `basemap_nodata_url` = '/basemap/kolam_bpp-nodata.png',
  `basemap_min_e`      = 462357.8434,
  `basemap_max_e`      = 464918.6054,
  `basemap_min_n`      = 9748151.5532,
  `basemap_max_n`      = 9749590.2390
WHERE `slug` = 'kolam_bpp';
