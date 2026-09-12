-- Rentang sapuan dan jadwal AutoTracking ikut disimpan.
--
-- Sebelumnya keduanya sengaja TIDAK disimpan — alasannya ada di migrasi 008 dan
-- di kepala kedua route-nya: menyimpan angka yang bisa diam-diam tidak lagi
-- benar sama saja membuat sumber kebenaran kedua yang buta.
--
-- Akibatnya di lapangan: RTS Config selalu terbuka dengan 15° × 15° dan jadwal
-- "Mati", apa pun yang barusan disimpan operator. Nilai yang baru saja dikirim
-- ke instrumen hilang dari tampilan begitu modalnya ditutup, dan tidak ada
-- tempat lain untuk melihatnya kembali.
--
-- Kenapa premisnya tidak lagi berlaku sama seperti dulu:
--
-- `SearchArea` bertahan di EEPROM instrumen DAN ikut di snapshot ack
-- konfigurasi (PROTOKOL_MQTT_ADR revisi 12 September 2026, Bagian D) — dua
-- syarat yang persis dipakai migrasi 008 untuk membenarkan penyimpanan
-- `auto_search`. Yang direset PowerOn ke 7° ter-hardcode adalah jendela AKTIF
-- di instrumen, bukan nilai tersimpan; AutoTracking memasang ulang nilai itu
-- sebelum tiap target.
--
-- `trackEvery` memang tidak pernah dilaporkan balik — ia tidak ikut di snapshot
-- ack. Justru karena itu database satu-satunya tempat nilainya bisa diingat:
-- tanpa kolom ini tidak ada cara apa pun mengetahui jadwal yang sedang berlaku
-- selain bertanya ke operator yang menyetelnya.
--
-- Keduanya TETAP dikirim ulang tiap kali Simpan ditekan, walau kolomnya tidak
-- disentuh. Kolom ini catatan "terakhir dikirim", bukan bukti keadaan
-- instrumen, dan tidak boleh dipakai untuk melewatkan pengiriman.
--
-- FLOAT untuk sudut: nilai sahnya kelipatan 1,5 derajat (1.5, 3, 4.5, …), jadi
-- INT akan membuang separuh pilihan yang sah. Bawaannya 15 — sama dengan bawaan
-- firmware.
--
-- INT untuk jadwal: nilainya 0/5/10/15/20/30/60 menit. Bawaannya 0 = mati.

ALTER TABLE `config_adr`
  ADD COLUMN `search_area_hor` FLOAT NOT NULL DEFAULT 15,
  ADD COLUMN `search_area_ver` FLOAT NOT NULL DEFAULT 15,
  ADD COLUMN `track_every`     INT   NOT NULL DEFAULT 0;
