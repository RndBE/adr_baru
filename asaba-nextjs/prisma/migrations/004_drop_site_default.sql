-- Lepas DEFAULT 'ccp' dari seluruh kolom `site`.
--
-- Default itu awalnya berguna dua kali: mengisi baris lama saat backfill, dan
-- menjaga app legacy CI3 tetap berjalan. Keduanya sudah tidak berlaku — backfill
-- selesai, dan CI3 tidak dipakai lagi.
--
-- Yang tersisa hanyalah risikonya: default ini MENDIAMKAN insert yang lupa
-- menyertakan site. Itu persis mekanisme bug awalnya — `kontrol/start` dulu
-- menyisipkan log_kontrol tanpa kolom site, sehingga setiap sesi pengukuran di
-- site mana pun tercatat sebagai 'ccp' lalu dinilai dengan ambang bahaya dan
-- koreksi rotasi milik CCP.
--
-- Setelah ini, dengan sql_mode STRICT_TRANS_TABLES (default di MySQL 8.4),
-- INSERT yang tidak menyebut kolom `site` DITOLAK di keempat tabel:
--
--   ERROR 1364 (HY000): Field 'site' doesn't have a default value
--
-- Termasuk log_kontrol, meski kolomnya nullable — menghilangkan kolom tanpa
-- default tetap error di strict mode. Mengirim NULL secara eksplisit tetap
-- diperbolehkan; nilai NULL itu ditangkap fallbackSite() di src/lib/sites.ts
-- dan memunculkan peringatan "site belum terdaftar" di UI.
--
-- Kalau strict mode suatu saat dimatikan, log_kontrol akan menerima NULL diam-
-- diam lagi (tapi tetap NULL, bukan salah dilabeli 'ccp'). Untuk menjadikannya
-- error tanpa bergantung sql_mode, kolomnya perlu dijadikan NOT NULL.

ALTER TABLE `t_prisma`         ALTER COLUMN `site` DROP DEFAULT;
ALTER TABLE `temp_prisma`      ALTER COLUMN `site` DROP DEFAULT;
ALTER TABLE `parameter_prisma` ALTER COLUMN `site` DROP DEFAULT;
ALTER TABLE `log_kontrol`      ALTER COLUMN `site` DROP DEFAULT;
