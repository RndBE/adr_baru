-- Konfigurasi RTS (config_adr) di-scope per site.
--
-- Sebelumnya tabel ini hanya punya `id_logger`, dan `GET /api/config-adr`
-- mengambil `ORDER BY id ASC LIMIT 1` — selalu baris yang sama apa pun site
-- yang dipilih di halaman Kontrol ADR. Karena satu unit RTS bisa dipakai di
-- beberapa site (logger 30002 melayani ccp dan viewpoint), job name, prism
-- constant, dan titik origin tidak bisa dibedakan per site.
--
-- ⚠ DUPLIKASI YANG PERLU DIPUTUSKAN
-- coor_x/coor_y/coor_z di sini adalah origin RTS yang DIKIRIM KE PERANGKAT
-- lewat MQTT (perhatikan: coor_x = Northing, coor_y = Easting — penamaannya
-- terbalik dari dugaan). Besaran fisik yang sama juga disimpan di
-- t_site.rts_n / rts_e / rts_z, dan ITU yang dipakai menghitung deformasi.
--
-- Keduanya sempat terlihat berbeda (12 mm pada Northing CCP), tapi itu BUKAN
-- drift operator — penyebabnya presisi tipe data, lihat bagian berikutnya.
-- Setelah tipe kolomnya diperbaiki, keduanya identik.
--
-- Duplikasinya sendiri masih ada dan tetap perlu diputuskan: dua tempat menyimpan
-- besaran fisik yang sama, dan bisa didorong berbeda lewat form RTS Config.

ALTER TABLE `config_adr` ADD COLUMN `site` VARCHAR(50) NOT NULL DEFAULT 'ccp';
ALTER TABLE `config_adr` ADD UNIQUE KEY `config_adr_site_key` (`site`);
ALTER TABLE `config_adr` ALTER COLUMN `site` DROP DEFAULT;

-- Baris untuk site yang belum punya konfigurasi, koordinatnya diambil dari
-- t_site supaya konsisten sejak awal.
INSERT INTO config_adr (id_logger, job_name, prisma_cons, ts_high, coor_x, coor_y, coor_z, step_record, retries, cycle_time, site)
SELECT 30002, 'Viewpoint', 30, 0, s.rts_n, s.rts_e, s.rts_z, 2, 1, 10, 'viewpoint'
FROM t_site s WHERE s.slug='viewpoint'
  AND NOT EXISTS (SELECT 1 FROM config_adr c WHERE c.site='viewpoint');

INSERT INTO config_adr (id_logger, job_name, prisma_cons, ts_high, coor_x, coor_y, coor_z, step_record, retries, cycle_time, site)
SELECT 30003, 'Politeknik PU (contoh)', 30, 0, s.rts_n, s.rts_e, s.rts_z, 2, 1, 10, 'politeknik-pu'
FROM t_site s WHERE s.slug='politeknik-pu'
  AND NOT EXISTS (SELECT 1 FROM config_adr c WHERE c.site='politeknik-pu');

-- ── Presisi koordinat ────────────────────────────────────────────────────────
-- coor_x/y/z semula FLOAT (single precision, ~7 digit signifikan). Koordinat
-- UTM butuh 9-10 digit, jadi setiap penyimpanan kehilangan presisi:
--   ccp           N 401320.988   → tersimpan 401321      (meleset  12 mm)
--   viewpoint     N 402826.049   → tersimpan 402826      (meleset  14 mm)
--   politeknik-pu N 9220553.791  → tersimpan 9220550     (meleset 209 mm)
-- Northing hemisfer selatan berdigit 7 sehingga paling parah terkena.
--
-- Selisih terhadap t_site yang tadinya terlihat seperti "drift operator"
-- ternyata murni pembulatan tipe data. DOUBLE (seperti t_site) menghilangkannya.
ALTER TABLE `config_adr` MODIFY `coor_x` DOUBLE NOT NULL;
ALTER TABLE `config_adr` MODIFY `coor_y` DOUBLE NOT NULL;
ALTER TABLE `config_adr` MODIFY `coor_z` DOUBLE NOT NULL;

-- Tulis ulang dari t_site (sumber kebenaran koordinat) supaya nilai yang sudah
-- terlanjur dibulatkan kembali tepat.
UPDATE config_adr c JOIN t_site s ON s.slug = c.site
SET c.coor_x = s.rts_n, c.coor_y = s.rts_e, c.coor_z = s.rts_z
WHERE s.rts_n IS NOT NULL;
