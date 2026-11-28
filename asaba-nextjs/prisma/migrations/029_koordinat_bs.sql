-- Koordinat survei backsight + tinggi alat.
--
-- Masukan lapangan 28 Nov 2026 (pemasangan ulang RTS Kolam BPP 27 Nov):
-- nol set horizontal sekarang dihitung dari koordinat survei BS, bukan dibaca
-- dari peta. Azimut RTS->BS dari koordinat dikurangi HA BS hasil tembakan sesi
-- acuan = nol set; dua BS dirata-rata sirkular. Lihat src/lib/orientasi-bs.ts.
--
-- koor_e/koor_n/koor_h: koordinat survei titik prisma (UTM, meter). Diisi untuk
-- prisma berjenis bs; null = belum disurvei.
--
-- tinggi_alat: tinggi alat di atas rts_z (patok), meter. Z tembakan =
-- rts_z + tinggi_alat + SD cos(VA). Bawaan 0 = perilaku sebelumnya.
--
-- pemasangan_sejak: waktu alat dipasang (disetel) terakhir. Hitung ulang
-- riwayat sesudah nol set berubah hanya menyentuh sesi sejak waktu ini —
-- sesi pemasangan sebelumnya punya nol set sendiri dan tidak boleh ikut
-- diputar. NULL = semua sesi site.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

ALTER TABLE t_prisma
  ADD COLUMN koor_e DOUBLE NULL AFTER mode_cari,
  ADD COLUMN koor_n DOUBLE NULL AFTER koor_e,
  ADD COLUMN koor_h DOUBLE NULL AFTER koor_n;

ALTER TABLE t_site
  ADD COLUMN tinggi_alat DOUBLE NOT NULL DEFAULT 0 AFTER rts_z,
  ADD COLUMN pemasangan_sejak DATETIME NULL AFTER tinggi_alat;
