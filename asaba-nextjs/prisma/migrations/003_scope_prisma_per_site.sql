-- Scope prisma per site.
--
-- `id_prisma` (P1, P2, …) ternyata nomor SLOT RTS yang dipakai ulang di tiap
-- site, bukan identitas prisma global. Dibuktikan dari data: P1 di site "ccp"
-- adalah BS_1 (N 401356, E 525952) sedangkan P1 di "viewpoint" adalah TS_1
-- (N 402838, E 526904) — dua target berbeda berjarak ~1,5 km.
--
-- Tanpa kolom site, ketiga tabel di bawah menyatukan prisma dari semua site:
-- daftar prisma bocor antar site, dan ingest telemetri meng-update baris milik
-- site yang salah.
--
-- Default 'ccp' hanya dipakai saat migrasi supaya baris lama (yang semuanya
-- milik CCP) terisi tanpa perlu ditulis satu per satu.
--
-- Setelah backfill, TIDAK ADA lagi penulis yang mengandalkan default ini —
-- seluruh INSERT di aplikasi menyebut kolom `site` secara eksplisit. Default-nya
-- sendiri layak dilepas: dia mendiamkan insert yang lupa menyertakan site, dan
-- itu persis mekanisme yang dulu membuat setiap sesi tertandai 'ccp' diam-diam.
--   ALTER TABLE `t_prisma`         ALTER COLUMN `site` DROP DEFAULT;
--   ALTER TABLE `temp_prisma`      ALTER COLUMN `site` DROP DEFAULT;
--   ALTER TABLE `parameter_prisma` ALTER COLUMN `site` DROP DEFAULT;

-- AlterTable
ALTER TABLE `t_prisma` ADD COLUMN `site` VARCHAR(50) NOT NULL DEFAULT 'ccp';
ALTER TABLE `temp_prisma` ADD COLUMN `site` VARCHAR(50) NOT NULL DEFAULT 'ccp';
ALTER TABLE `parameter_prisma` ADD COLUMN `site` VARCHAR(50) NOT NULL DEFAULT 'ccp';
