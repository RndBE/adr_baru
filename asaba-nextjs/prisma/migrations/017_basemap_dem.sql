-- DEM (relief) untuk lantai scene Visualisasi 3D.
--
-- BELUM DIJALANKAN DI MANA PUN saat berkas ini ditulis. Ketiga kolomnya NULL,
-- dan site tanpa isi berperilaku persis seperti sekarang: lantainya bidang
-- datar seperti sesudah migrasi 014.
--
-- ── Kenapa perlu ────────────────────────────────────────────────────────────
--
-- Base map dari migrasi 014 menggambar ortofoto pada SATU bidang datar. Untuk
-- kolam pengendapan yang berundak-undak di lereng, itu membuang justru
-- informasi yang paling dicari: prisma mana duduk di tanggul atas dan mana di
-- dasar. Bedanya di BPP 1-4 mencapai 32 m.
--
-- Sumbernya kontur survei "Situasi_BPP_260731.dxf" — 588 polyline berinterval
-- 1 m, 94.634 vertex, 11-43 m. Diubah jadi raster oleh
-- tools/dxf/kontur-ke-dem.py dan dilayani sebagai PNG.
--
-- ── Kenapa PNG abu-abu + alfa, bukan JSON grid ──────────────────────────────
--
-- Grid 800 x 449 berisi 359.200 angka. Sebagai JSON itu beberapa megabita yang
-- harus di-parse peramban tiap kali halaman dibuka; sebagai PNG 8-bit ia 83 KB
-- dan didekode mesin gambar peramban. Ketelitiannya 0,125 m per tingkat abu —
-- jauh lebih halus daripada kontur 1 m yang jadi sumbernya, jadi tidak ada
-- yang hilang.
--
-- Alfa dipakai sebagai penanda "tidak ada data tinggi", bukan sebagai
-- transparansi. Ortofoto BPP 1-4 lebih luas daripada surveinya: tepi barat
-- ~160 m dan tepi timur ~40 m tidak punya kontur sama sekali. Di sana lantainya
-- tidak digambar — permukaan yang dikarang mulus jauh lebih menyesatkan
-- daripada lubang yang jujur.
--
-- ── Kenapa min/max Z disimpan terpisah ──────────────────────────────────────
--
-- Nilai abu 0-255 tidak berarti apa-apa tanpa keduanya. Menanamkannya di nama
-- berkas atau mengira-ngira dari data akan membuat relief yang tingginya
-- berubah diam-diam setiap DEM-nya diganti.
ALTER TABLE `t_site`
  ADD COLUMN `basemap_dem_url`   VARCHAR(255) NULL,
  ADD COLUMN `basemap_dem_min_z` DOUBLE       NULL,
  ADD COLUMN `basemap_dem_max_z` DOUBLE       NULL;

-- kolam_bpp: dari Situasi_BPP_260731.dxf, grid 800 x 449 (3,20 m per sel).
--
-- Diperiksa terhadap tembakan RTS yang sudah dikoreksi (migrasi 015+016):
-- keenam prisma duduk −0,7 … +1,8 m dari permukaan DEM ini. RTS sendiri +9,5 m
-- di atasnya — cocok dengan `config_adr.ts_high` = 10, menara sheltemya, yang
-- memang sudah termasuk dalam `rts_z`.
UPDATE `t_site` SET
  `basemap_dem_url`   = '/basemap/kolam_bpp-dem.png',
  `basemap_dem_min_z` = 11.000,
  `basemap_dem_max_z` = 43.000
WHERE `slug` = 'kolam_bpp';
