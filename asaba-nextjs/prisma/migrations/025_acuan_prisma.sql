-- Acuan baru per prisma sesudah arah bidiknya diperbarui.
--
-- Pergeseran dihitung terhadap sesi acuan R0 site. Prisma yang pergeserannya
-- diverifikasi BENAR lalu arah bidiknya ditulis ulang ke slot RTS (Perbarui
-- arah bidik) menerima posisi barunya: tembakan yang sudutnya ditulis ke slot
-- jadi acuan prisma itu sendiri, dan prisma itu kembali Normal. Prisma lain
-- tetap dihitung terhadap R0.
--
-- Berlaku untuk sesi yang dimulai SESUDAH sesi tembakan (`id_log`); sesi itu
-- sendiri dan sebelumnya tetap terhadap acuan lama, supaya pergeseran yang
-- memicu alarm tetap terbaca. Satu prisma bisa punya beberapa baris; yang
-- berlaku yang `id`-nya terbesar. Mengganti R0 menghapus baris site itu.
--
-- Semua kolom waktu jam dinding WIB. Dijalankan dengan tangan seperti migrasi
-- lain (bukan Prisma Migrate). Lihat src/lib/aturan-acuan.ts dan
-- src/lib/acuan-prisma.ts.

CREATE TABLE IF NOT EXISTS acuan_prisma (
  id INT NOT NULL AUTO_INCREMENT,
  site VARCHAR(50) NOT NULL,
  id_prisma VARCHAR(20) NOT NULL,
  -- rts.id tembakan yang jadi acuan, dan sesinya (log_kontrol.id_log).
  id_rts INT NOT NULL,
  id_log VARCHAR(20) NOT NULL,
  -- Pergeseran tembakan itu terhadap acuan sebelumnya: yang diterima.
  geser_diterima_mm DOUBLE NULL,
  id_kejadian INT NULL,
  ditetapkan DATETIME NOT NULL,
  oleh VARCHAR(100) NULL,
  PRIMARY KEY (id),
  KEY acuan_prisma_site_idx (site, id_prisma),
  KEY acuan_prisma_log_idx (id_log)
);
