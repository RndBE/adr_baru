-- Logger EWS (sirene/lampu peringatan) per site.
--
-- Saat tingkat terburuk sebuah site berubah, evaluasi-siklus.ts menerbitkan
-- {"EWS":{"cmd":"CTRL","level":N}} ke topik sub_<id_logger_ews> — lihat
-- src/lib/ews.ts untuk tabel level (angkanya terbalik dari keparahan).
--
-- Kolom TERPISAH dari id_logger: perangkat EWS biasanya unit lain dari RTS,
-- dan memakai id_logger berarti perintah sirene terkirim ke topik RTS.
--
-- Isinya KODE logger (t_logger.id_logger), bukan primary key, sama dengan
-- id_logger. NULL = site ini tidak punya EWS; perintahnya dilewati, bukan
-- dikirim ke logger tebakan.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

ALTER TABLE t_site
  ADD COLUMN id_logger_ews VARCHAR(10) NULL AFTER id_logger,
  ADD INDEX t_site_id_logger_ews_idx (id_logger_ews);
