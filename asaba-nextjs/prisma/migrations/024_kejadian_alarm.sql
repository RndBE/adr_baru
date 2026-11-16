-- Kejadian alarm per site: konfirmasi operator dan verifikasi lapangan.
--
-- Satu baris = satu kejadian, dari siklus pertama tingkat site naik di atas
-- Normal sampai siklus yang mengembalikannya ke Normal (`pulih`). Selama
-- `pulih` NULL kejadiannya AKTIF; paling banyak satu yang aktif per site.
--
-- Konfirmasi: operator menekan Konfirmasi di website (dengan kode akses).
-- Sirene + lampu EWS dikirimi level 0 dan suara di semua peramban berhenti,
-- selama tingkat site tidak melebihi `tingkat_dikonfirmasi`. Naik melewatinya
-- membunyikan semuanya lagi dan meminta konfirmasi ulang.
--
-- Verifikasi: hasil cek lapangan, `benar` (pergeseran nyata) atau `palsu`
-- (dengan `penyebab`), plus catatan. Kejadian yang belum diverifikasi tetap
-- tampil di website walau sudah pulih.
--
-- Semua kolom waktu jam dinding WIB, seperti kolom waktu lain di basis data
-- ini. Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).
-- Lihat src/lib/aturan-kejadian.ts dan src/lib/kejadian-alarm.ts.

CREATE TABLE IF NOT EXISTS kejadian_alarm (
  id INT NOT NULL AUTO_INCREMENT,
  site VARCHAR(50) NOT NULL,
  id_log_mulai VARCHAR(20) NOT NULL,
  mulai DATETIME NOT NULL,
  tingkat_puncak VARCHAR(10) NOT NULL,
  tingkat_terakhir VARCHAR(10) NOT NULL,
  prisma_puncak VARCHAR(20) NULL,
  nilai_puncak_mm DOUBLE NULL,
  pulih DATETIME NULL,
  dikonfirmasi DATETIME NULL,
  dikonfirmasi_oleh VARCHAR(100) NULL,
  tingkat_dikonfirmasi VARCHAR(10) NULL,
  diverifikasi DATETIME NULL,
  diverifikasi_oleh VARCHAR(100) NULL,
  hasil VARCHAR(10) NULL,
  penyebab VARCHAR(50) NULL,
  catatan TEXT NULL,
  PRIMARY KEY (id),
  KEY kejadian_alarm_site_mulai_idx (site, mulai)
);
