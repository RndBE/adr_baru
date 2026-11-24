-- Posisi prisma saat alarm dikonfirmasi, untuk aturan "bergeser lagi sesudah
-- konfirmasi".
--
-- Konfirmasi hanya mencakup yang sudah terjadi saat tombolnya ditekan. Aturan
-- "naik sesudah konfirmasi" (migrasi 024) membandingkan TINGKAT, jadi prisma yang
-- sudah Awas lalu bergeser lagi sama sekali tidak membunyikan alarm: tingkatnya
-- tidak bisa naik lagi (24 Nov 2026, kejadian #7: P2 bergeser sekitar 105 mm
-- sesudah dikonfirmasi dan diverifikasi palsu, sirene tetap diam).
--
-- Kolom ini menyimpan JSON {"P1": <rts.id>, "P2": <rts.id>, ...}: tembakan sah
-- terakhir tiap prisma saat konfirmasi. Tiap siklus, posisi sekarang
-- dibandingkan dengan tembakan itu (bukan dengan R0 atau acuan prisma), dan
-- bergeser sebesar ambang Waspada atau lebih membatalkan konfirmasi.
-- NULL pada kejadian yang dikonfirmasi sebelum migrasi ini: aturannya tidak
-- berlaku untuk mereka sampai dikonfirmasi ulang.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).
-- Lihat src/lib/aturan-kejadian.ts (bergeserSesudahKonfirmasi).

ALTER TABLE kejadian_alarm ADD COLUMN posisi_dikonfirmasi TEXT NULL AFTER tingkat_dikonfirmasi;
