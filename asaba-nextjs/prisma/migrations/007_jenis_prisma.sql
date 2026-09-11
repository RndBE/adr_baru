-- Backsight / foresight jadi SIFAT prisma, bukan tindakan sesaat.
--
-- Sebelumnya perbedaan itu hanya ada sebagai dua tombol di modal Arahkan
-- teleskop: `measure_bs` mengirim `*ST2`, `measure_fs` mengirim `*ST3`. Operator
-- memilihnya tiap kali mengukur, hasilnya TIDAK disimpan ke mana pun, dan tidak
-- ada satu pun bagian aplikasi yang tahu prisma mana yang sebenarnya backsight.
--
-- Satu-satunya jejak yang tersisa selama ini adalah KEBIASAAN PENAMAAN: target
-- acuan diberi nama berawalan "BS". Kebiasaan tidak bisa ditegakkan, tidak bisa
-- ditanyakan lewat query, dan hilang begitu ada yang menamai prismanya lain.
--
-- Nilainya sengaja VARCHAR(2), bukan ENUM. Skema ini tidak memakai ENUM di mana
-- pun, dan menambah satu di sini berarti tiap penambahan nilai baru butuh ALTER
-- TABLE pada tabel yang sudah dipakai produksi.
--
-- Bawaannya 'fs'. Di pemantauan deformasi hampir semua prisma adalah titik
-- pantau; backsight biasanya hanya satu atau dua per site. Bawaan yang salah
-- untuk mayoritas akan membuat tiap prisma baru perlu dikoreksi manual.

ALTER TABLE `t_prisma` ADD COLUMN `jenis` VARCHAR(2) NOT NULL DEFAULT 'fs';

-- Backfill dari kebiasaan penamaan yang sudah ada: "BS_1", "BS1", "bs-utara".
-- Hanya awalan, bukan LIKE '%bs%' — nama seperti "Lereng_Absen" tidak boleh
-- ikut tertangkap.
UPDATE `t_prisma`
SET `jenis` = 'bs'
WHERE LOWER(`nama_prisma`) LIKE 'bs%';

-- Indeks: pembacaan yang sering dipakai adalah "mana backsight site ini",
-- dan itu selalu disaring bersama site-nya.
CREATE INDEX `t_prisma_site_jenis_idx` ON `t_prisma` (`site`, `jenis`);
