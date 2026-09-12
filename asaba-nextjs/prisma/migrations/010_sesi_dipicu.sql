-- Asal sesi running: diminta operator, atau dimulai sendiri oleh logger.
--
-- Sebelum ini `log_kontrol` hanya terisi dari satu tempat: POST
-- /api/kontrol/start, yaitu tombol Mulai. Siklus yang dijalankan jadwal
-- AutoTracking (`trackEvery`) berjalan langsung di firmware dan tidak pernah
-- melewati route itu, jadi tidak ada sesi yang dibuat untuknya.
--
-- Akibatnya bukan sekadar "tidak tercatat". /api/datamasuk/adr menempelkan tiap
-- payload ke sesi TERAKHIR logger yang bersangkutan, jadi hasil ukur siklus
-- terjadwal ditimpakan ke sesi lama yang sudah selesai:
--
--   sesi 101109  dibuka 21-11-2025 10:11
--                berisi 1193 baris `rts`, yang terbaru 26-08-2026 11:30
--
-- Sembilan bulan pengukuran dianggap satu sesi yang sama. Di riwayat running
-- tidak ada satu pun baris baru sejak 2025, dan di Hasil Pengukuran seluruh
-- pengukuran itu bertumpuk di bawah satu tanggal.
--
-- Kolom ini menandai sesi yang dibuka /api/datamasuk/adr saat melihat siklus
-- mulai tanpa ada yang memintanya, supaya operator tidak melihat sesi yang
-- tidak pernah ia jalankan dan menyangkanya salah catat.
--
-- Nilainya 'operator' | 'logger'. 'logger', BUKAN 'jadwal': dari sisi server
-- siklus jadwal dan siklus yang dimulai lewat panel instrumen tiba dalam bentuk
-- yang persis sama — sensor16 berubah jadi 1 tanpa permintaan dari aplikasi.
-- Menulis 'jadwal' berarti mengaku tahu hal yang tidak bisa diketahui di sini.
--
-- VARCHAR(10), bukan ENUM: skema ini tidak memakai ENUM di mana pun, dan
-- menambah satu berarti tiap nilai baru butuh ALTER TABLE di tabel produksi.
--
-- Bawaannya 'operator' sekaligus mengisi baris lama dengan benar: semua sesi
-- yang sudah ada memang lahir dari tombol Mulai, karena sampai sekarang itu
-- satu-satunya jalan sesi bisa terbentuk.

ALTER TABLE `log_kontrol`
  ADD COLUMN `dipicu` VARCHAR(10) NOT NULL DEFAULT 'operator';

-- `prisma` dan `r0` diberi bawaan karena keduanya NOT NULL TANPA default,
-- sementara satu-satunya INSERT ke tabel ini tidak menyertakan mereka. Di
-- server ber-sql_mode STRICT_TRANS_TABLES — termasuk mesin ini — insert itu
-- ditolak dengan "Field 'prisma' doesn't have a default value", sehingga tombol
-- Mulai gagal SESUDAH sempat menyetel set_tempkontrol.status = 1 dan sebelum
-- sempat mengirim MQTT: perintahnya tidak pernah berangkat, sesinya tidak
-- pernah tercatat, dan pembukuan kontrol tertinggal di keadaan "minta jalan".
-- Baris set_tempkontrol di basis data ini terjebak begitu sejak 28 April 2026.
--
-- Route-nya sekarang menyebut semua kolom secara eksplisit, jadi bawaan ini
-- bukan satu-satunya penjaga — ia jaring pengaman untuk jalur insert lain yang
-- mungkin ditambahkan nanti.
ALTER TABLE `log_kontrol`
  ALTER COLUMN `prisma` SET DEFAULT '',
  ALTER COLUMN `r0` SET DEFAULT 0;

-- Riwayat selalu dibaca per site dan diurut terbaru dulu; tanpa indeks ini
-- MySQL memindai seluruh tabel lalu menyortirnya untuk mengambil 4 baris.
CREATE INDEX `log_kontrol_site_datetime_idx` ON `log_kontrol` (`site`, `datetime`);
