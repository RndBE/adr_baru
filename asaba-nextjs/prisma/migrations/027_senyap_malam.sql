-- Bunyi alarm dimatikan otomatis pada jam malam.
--
-- Diminta 26 Nov 2026: alarm yang berbunyi di malam hari dan tidak dikonfirmasi
-- dalam beberapa menit tidak boleh terus membunyikan sirene lapangan dan
-- peramban sampai pagi. Pengaturannya per site (t_site), keadaannya per
-- kejadian (kejadian_alarm). Lihat src/lib/aturan-senyap-malam.ts.
--
-- Yang dimatikan hanya BUNYI: sirene + lampu EWS (level 0) dan suara di
-- peramban. Alarm tetap "belum dikonfirmasi": banner, modal, dan lencana tetap
-- tampil. Bunyi menyala lagi bila tingkatnya naik, prisma lain menyusul naik,
-- atau prisma bergeser lagi sejak saat dimatikan (aturan yang sama dengan
-- sesudah konfirmasi).
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

ALTER TABLE t_site
  ADD COLUMN senyap_malam TINYINT(1) NOT NULL DEFAULT 0 AFTER id_logger_ews,
  ADD COLUMN senyap_malam_mulai CHAR(5) NOT NULL DEFAULT '17:00' AFTER senyap_malam,
  ADD COLUMN senyap_malam_selesai CHAR(5) NOT NULL DEFAULT '08:00' AFTER senyap_malam_mulai,
  ADD COLUMN senyap_malam_menit INT NOT NULL DEFAULT 10 AFTER senyap_malam_selesai;

-- berbunyi_sejak: kapan bunyi terakhir (mulai) menyala — dibuka, atau menyala
-- lagi sesudah konfirmasi/bungkam dibatalkan. NULL = sejak `mulai`.
-- dibungkam / tingkat_dibungkam / posisi_dibungkam: kapan, pada tingkat apa,
-- dan posisi prisma (JSON {"P1": rts.id}) saat bunyi dimatikan otomatis.
ALTER TABLE kejadian_alarm
  ADD COLUMN berbunyi_sejak DATETIME NULL AFTER posisi_dikonfirmasi,
  ADD COLUMN dibungkam DATETIME NULL AFTER berbunyi_sejak,
  ADD COLUMN tingkat_dibungkam VARCHAR(10) NULL AFTER dibungkam,
  ADD COLUMN posisi_dibungkam TEXT NULL AFTER tingkat_dibungkam;
