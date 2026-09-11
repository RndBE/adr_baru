-- Relasi site -> logger dipindah ke t_site.
--
-- Sebelumnya relasi ini TIDAK dimodelkan di mana pun, dan aplikasi menebaknya
-- lewat tiga jalan berbeda yang bisa menjawab berbeda:
--
--   1. Kontrol ADR  : logger RTS pertama urut id_logger, site tidak ikut
--                     dihitung sama sekali, lalu jatuh ke "30002" yang ditulis
--                     langsung di kode.
--   2. Route perintah: config_adr.site -> id_logger, cadangan t_prisma.site.
--   3. Daftar site   : log_kontrol yang terakhir melapor untuk site itu.
--
-- Akibatnya nyata, bukan sekadar tidak rapi: site politeknik-pu dilayani logger
-- 30003, tapi halaman Kontrol ADR tetap berlangganan topik pub_30002 dan
-- menulis "Logger 30002". Perintahnya berangkat ke 30003 sementara balasannya
-- ditunggu di saluran 30002, sehingga ack-nya tidak pernah terlihat.
--
-- Satu kolom di t_site menjadikan aturannya benar dengan sendirinya:
--   - satu site TIDAK BISA punya lebih dari satu logger, karena kolomnya satu;
--   - satu logger tetap boleh melayani banyak site, karena tidak ada kunci unik
--     di kolom ini.
--
-- Tipenya VARCHAR(10) menyamai t_logger.id_logger persis. config_adr dan
-- t_prisma menyimpan kode yang sama sebagai INT — perbedaan tipe itu sudah jadi
-- sumber kekeliruan, jadi kolom baru ini mengikuti tabel masternya.

ALTER TABLE `t_site` ADD COLUMN `id_logger` VARCHAR(10) NULL;

-- CATATAN COLLATION untuk seluruh backfill di bawah.
--
-- Kolom `site` tidak seragam di skema ini: config_adr memakai utf8mb3, t_site
-- utf8mb4_unicode_ci, sedangkan log_kontrol dan t_prisma utf8mb4_0900_ai_ci.
-- Membandingkan dua kolom utf8mb4 bercollation berbeda ditolak MySQL dengan
-- "Illegal mix of collations", jadi tiap perbandingan dipaksa ke satu collation
-- yang ada di MySQL 8 maupun MariaDB. Tanpa ini migrasinya berhenti di tengah
-- dan sebagian site tidak terisi.

-- Backfill 1: config_adr. Ini yang selama ini DIPAKAI merutekan perintah, jadi
-- ia yang paling mendekati kebenaran untuk site yang sudah berjalan.
UPDATE `t_site` s
JOIN `config_adr` c
  ON CONVERT(c.site USING utf8mb4) COLLATE utf8mb4_general_ci
   = CONVERT(s.slug USING utf8mb4) COLLATE utf8mb4_general_ci
SET s.id_logger = CAST(c.id_logger AS CHAR)
WHERE s.id_logger IS NULL;

-- Backfill 2: logger yang terakhir benar-benar melapor untuk site itu, untuk
-- site yang belum punya baris config_adr.
UPDATE `t_site` s
JOIN (
  SELECT lk.site, MIN(lk.id_logger) AS id_logger
  FROM `log_kontrol` lk
  JOIN (
    SELECT site, MAX(datetime) AS terbaru
    FROM `log_kontrol`
    WHERE site IS NOT NULL
    GROUP BY site
  ) t ON t.site = lk.site AND t.terbaru = lk.datetime
  GROUP BY lk.site
) x
  ON CONVERT(x.site USING utf8mb4) COLLATE utf8mb4_general_ci
   = CONVERT(s.slug USING utf8mb4) COLLATE utf8mb4_general_ci
SET s.id_logger = x.id_logger
WHERE s.id_logger IS NULL;

-- Backfill 3: logger yang dipakai prisma milik site itu.
UPDATE `t_site` s
JOIN (
  SELECT site, MIN(CAST(id_logger AS CHAR)) AS id_logger
  FROM `t_prisma`
  GROUP BY site
) p
  ON CONVERT(p.site USING utf8mb4) COLLATE utf8mb4_general_ci
   = CONVERT(s.slug USING utf8mb4) COLLATE utf8mb4_general_ci
SET s.id_logger = p.id_logger
WHERE s.id_logger IS NULL;

-- SENGAJA dibiarkan NULL-able dan tanpa foreign key.
--
-- Site yang baru dibuat memang belum punya logger sampai operator memilihnya di
-- Master Data, dan memaksanya NOT NULL berarti site tidak bisa dibuat lebih
-- dulu. Yang menjaga isinya sahih adalah validasi di POST/PUT /api/sites, yang
-- menolak id_logger yang tidak ada di t_logger.
--
-- Foreign key tidak dipasang karena seluruh skema ini memang tidak memakainya
-- (t_logger.lokasi_logger ke t_lokasi pun tidak), dan menambahkannya hanya di
-- satu tempat membuat perilaku hapus jadi tidak seragam.

-- Indeks: arah pembacaan yang sering dipakai adalah "site mana saja yang
-- memakai logger ini", mis. saat menolak penghapusan logger.
CREATE INDEX `t_site_id_logger_idx` ON `t_site` (`id_logger`);
