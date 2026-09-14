-- Peringatan pergeseran: keadaan yang bertahan antar siklus, dan riwayatnya.
--
-- BELUM DIJALANKAN DI MANA PUN. Ditulis bersama kodenya supaya keduanya tidak
-- lepas, tapi penerapannya keputusan operator basis data.
--
-- ── Kenapa tabel BARU, bukan `log_siaga` yang sudah ada ─────────────────────
--
-- Godaannya jelas: `log_siaga` sudah ada dan bentuknya nyaris pas
-- (id_logger, nilai, status, waktu). Tiga alasan untuk tidak memakainya.
--
--   1. `waktu` bertipe VARCHAR(100), bukan DATETIME. Jeda antar pesan dihitung
--      dari selisih waktu, dan selisih waktu di atas kolom teks adalah
--      perbandingan leksikografis yang kebetulan benar sampai formatnya
--      berubah sekali saja.
--
--   2. Tidak ada kolom site maupun slot prisma. Keduanya wajib: `id_prisma`
--      cuma nomor slot RTS yang DIPAKAI ULANG tiap site — lihat
--      @@unique([site, id_prisma]) di model TempPrisma. Tanpa site, keadaan
--      prisma P1 di dua lokasi berbeda akan saling menimpa.
--
--   3. 224 baris lamanya memakai kosakata yang berbeda: 'Aman', 'Siaga 1',
--      'Siaga 2', 'Siaga 3' dari sistem tinggi muka air — bukan
--      'Normal'/'Waspada'/'Siaga'/'Awas' yang dipakai t_site. Mencampurnya
--      membuat riwayat baru tidak bisa dibaca tanpa selalu mengingat baris
--      mana milik sistem yang mana.
--
-- `log_siaga` dibiarkan apa adanya sebagai arsip. Ia juga bukti kenapa peredam
-- di src/lib/peredam.ts ada: 63% perubahan status di tabel itu terjadi kurang
-- dari lima menit sejak perubahan sebelumnya, dan pada 27 Juni 2024 tercatat
-- 75 perubahan dalam satu hari.

-- ── Keadaan sekarang ────────────────────────────────────────────────────────
--
-- Satu baris per prisma, ditimpa tiap siklus. Terpisah dari riwayat karena
-- aturan "tingkat baru harus terlihat tiga siklus beruntun" butuh hitungan yang
-- bertahan antar siklus. Menurunkannya dari riwayat tiap kali berarti memindai
-- log_peringatan untuk tiap prisma di tiap siklus — dan dengan track_every 5
-- menit itu 288 kali sehari dikali jumlah prisma.
CREATE TABLE `status_prisma` (
  `site`      VARCHAR(50) NOT NULL,
  `id_prisma` VARCHAR(20) NOT NULL,

  -- Tingkat yang sudah DIAKUI, bukan yang barusan terukur. Perubahan baru
  -- pindah ke sini setelah lolos konfirmasi.
  `tingkat`       VARCHAR(10) NOT NULL DEFAULT 'Normal',
  -- Tingkat yang sedang menunggu konfirmasi, dan sudah berapa siklus beruntun
  -- ia terlihat. NULL/0 berarti tidak ada yang menunggu.
  `tingkat_calon` VARCHAR(10) NULL,
  `hitung_calon`  TINYINT UNSIGNED NOT NULL DEFAULT 0,

  -- Pergeseran linier 2D terhadap acuan R0, dalam mm. NULL bila siklus terakhir
  -- tidak menghasilkan bacaan sah untuk prisma ini.
  `nilai_mm` DOUBLE NULL,

  -- log_kontrol.id_log siklus terakhir yang mengevaluasi baris ini.
  `siklus_terakhir` VARCHAR(20) NULL,

  -- Dasar jeda antar pesan. Sengaja DATETIME: jeda dihitung dalam waktu dinding,
  -- bukan jumlah siklus, karena track_every boleh 5 sampai 60 menit dan jeda
  -- berbasis siklus akan melipatgandakan volume pesan 12x di ujung yang cepat.
  `kirim_terakhir` DATETIME NULL,

  -- Berapa siklus beruntun prisma ini gagal ditembak. status_get = 1 dengan
  -- N1/E1/Z1 semuanya nol berarti "Failed / Not Found" — dibidik tapi tidak
  -- ketemu. Sekali dua kali itu kabut atau hujan; beruntun, prisma itu mungkin
  -- roboh, tertimbun, atau terhalang, dan itu kabar tersendiri.
  `gagal_beruntun` SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (`site`, `id_prisma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ── Riwayat ─────────────────────────────────────────────────────────────────
--
-- Hanya perubahan yang SUDAH terkonfirmasi. Calon yang gugur di tengah tidak
-- masuk sini — kalau ikut dicatat, tabel ini akan mengulang persis kekacauan
-- log_siaga dan tidak bisa dibaca sebagai riwayat kejadian.
CREATE TABLE `log_peringatan` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `site`      VARCHAR(50) NOT NULL,
  `id_prisma` VARCHAR(20) NOT NULL,
  -- Siklus pemicunya, supaya tiap baris bisa ditelusuri balik ke pengukurannya.
  `id_log`    VARCHAR(20) NOT NULL,

  `dari`      VARCHAR(10) NOT NULL,
  `ke`        VARCHAR(10) NOT NULL,
  `nilai_mm`  DOUBLE NOT NULL,
  `waktu`     DATETIME NOT NULL,

  -- Membedakan "tidak ada peringatan" dari "peringatan gagal berangkat". Dari
  -- sisi penerima kedua keadaan itu terlihat identik — ponsel yang sunyi — dan
  -- hanya satu di antaranya berarti keadaannya aman.
  `terkirim`  TINYINT(1) NOT NULL DEFAULT 0,
  `galat`     VARCHAR(255) NULL,

  PRIMARY KEY (`id`),
  -- Riwayat selalu dibaca per site dan diurut terbaru dulu.
  INDEX `log_peringatan_site_waktu_idx` (`site`, `waktu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
