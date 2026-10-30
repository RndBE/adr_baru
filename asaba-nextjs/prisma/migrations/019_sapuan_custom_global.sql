-- Setelan sapuan custom GLOBAL: langkah, rentang, dan rehat.
--
-- BELUM DIJALANKAN DI MANA PUN saat berkas ini ditulis. Kelimanya NULL, dan
-- baris tanpa isi berperilaku persis seperti sekarang: aplikasi tidak mengirim
-- apa pun, dan instrumen memakai nilai yang sudah tersimpan di dalamnya.
--
-- ── Kenapa perlu ────────────────────────────────────────────────────────────
--
-- Target bermode `ac` (sapuan custom) di AutoTracking menyapu memakai SATU set
-- parameter yang dipegang firmware — ADR_RTS_PORTING §3.1, kunci `set_rts`
-- langkahHA/VA, rentangHA/VA, rehat. Sebelum ini aplikasi tidak punya tempat
-- untuk mengisinya, jadi mode Custom bisa dipilih di Prism Config tanpa cara
-- mengatur ukuran sapuannya.
--
-- Parameter PER TARGET (RANCANGAN_SAPU_PER_TARGET) bukan bagian dari ini: itu
-- usulan yang menunggu firmware.
--
-- ── Kedudukan kolom ini ─────────────────────────────────────────────────────
--
-- Sama dengan search_area_* dan track_every (migrasi 009): catatan "terakhir
-- dikirim", BUKAN bukti keadaan instrumen. Ditulis hanya sesudah perintahnya
-- benar-benar terkirim, dan dipakai mengisi kolom di RTS Config supaya operator
-- tidak membuka form kosong setiap kali. Tidak boleh dipakai melewatkan
-- pengiriman tanpa bukti lain.
--
-- Bentuk isi mengikuti protokol: sudut "d,m,s" atau derajat desimal sebagai
-- teks (apa adanya yang diketik, dipangkas), rehat dalam milidetik. VARCHAR,
-- bukan FLOAT, karena "0,00,01" harus kembali persis seperti ditulis — firmware
-- yang mengurainya, dan membulatkan lewat float hanya menambah satu tempat
-- selisih. Divalidasi di aplikasi (validasiSapuanGlobal).

ALTER TABLE `config_adr`
  ADD COLUMN `sapu_langkah_ha` VARCHAR(16) NULL,
  ADD COLUMN `sapu_langkah_va` VARCHAR(16) NULL,
  ADD COLUMN `sapu_rentang_ha` VARCHAR(16) NULL,
  ADD COLUMN `sapu_rentang_va` VARCHAR(16) NULL,
  ADD COLUMN `sapu_rehat`      INT         NULL;
