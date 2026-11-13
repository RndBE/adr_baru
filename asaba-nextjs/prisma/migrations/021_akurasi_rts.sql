-- Akurasi RTS per site, untuk toleransi pemicu ambang.
--
-- RTS tidak mengirim ukuran mutu per tembakan, jadi yang dipakai adalah
-- spesifikasi alatnya: akurasi sudut (detik busur) dan akurasi jarak
-- (mm + ppm). Toleransi tiap prisma dihitung dari jarak prisma ke alat dan
-- ditambahkan ke ambang pergeseran site — lihat src/lib/akurasi-rts.ts.
--
-- Bawaan 2" · 2 mm + 2 ppm (kelas robotic total station 2 detik yang umum)
-- sampai spesifikasi alat Kolam BPP dicek; ubah lewat Master Data → Site.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

ALTER TABLE t_site
  ADD COLUMN rts_akurasi_sudut_detik DOUBLE NOT NULL DEFAULT 2 AFTER laju_awas_min,
  ADD COLUMN rts_akurasi_jarak_mm DOUBLE NOT NULL DEFAULT 2 AFTER rts_akurasi_sudut_detik,
  ADD COLUMN rts_akurasi_jarak_ppm DOUBLE NOT NULL DEFAULT 2 AFTER rts_akurasi_jarak_mm;
