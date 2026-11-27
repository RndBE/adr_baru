-- Konfirmasi beberapa sesi sebelum tingkat naik.
--
-- Masukan dari lapangan 27 Nov 2026: pada uji Kolam BPP, P4 bergantian
-- Waspada–Normal tiap sesi dan setiap Waspada menyalakan sirene dan WhatsApp.
-- Sekarang tingkat baru diakui hanya bila N sesi berturut-turut semuanya
-- mencapainya (nilai pemicu = pergeseran terkecil dari N sesi). Turun tidak
-- ditahan. Aturan "bergeser lagi" sesudah konfirmasi ikut memakai N yang sama.
-- Lihat src/lib/aturan-konfirmasi-sesi.ts.
--
-- 1 = perilaku sebelumnya (satu sesi langsung menentukan). Bawaan 2.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

ALTER TABLE t_site
  ADD COLUMN konfirmasi_sesi INT NOT NULL DEFAULT 2 AFTER id_logger_ews;
