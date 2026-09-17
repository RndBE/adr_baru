-- Perbaikan azimut koordinat tembakan RTS, per site.
--
-- BELUM DIJALANKAN DI MANA PUN saat berkas ini ditulis. Kedua kolomnya NULL,
-- dan site tanpa isi berperilaku persis seperti sekarang — tidak ada koreksi
-- yang diterapkan.
--
-- ── Masalahnya ──────────────────────────────────────────────────────────────
--
-- Koordinat yang dikirim logger untuk kolam_bpp dihitung dengan DUA kesalahan
-- yang bertumpuk pada sudut horizontalnya:
--
--   1. SATUAN. `rts.sensor5` berisi HA dalam GON (lingkaran 400) tapi dipakai
--      seolah derajat. Faktor 0,9 hilang.
--   2. TANDA. Sudutnya dikurangkan, bukan ditambahkan.
--
-- Diukur dari enam prisma pada sesi acuan R0 `144500`, dengan koordinat
-- sebenarnya dibaca dari "Peta Prisma Robotik BPP 1-4.pdf":
--
--     yang direkam :  bearing = 89,70° − HA_gon          (rentang 0,61°)
--     yang benar   :  bearing = 0,9 × HA_gon + 302,49°   (rentang 1,00°)
--
-- Akibatnya setiap prisma tergambar di sisi yang salah dari alat. DF_7 meleset
-- 1.824 m; yang paling dekat pun, DF_3, meleset 109 m.
--
-- ── Kenapa dikoreksi di sini, bukan di alat ─────────────────────────────────
--
-- Perbaikan di alat tidak memungkinkan (keputusan operator, 17 September 2026).
-- Karena HA mentahnya tersimpan utuh di `rts.sensor5` pada SETIAP tembakan,
-- arah yang benar bisa dihitung ulang kapan saja — baik untuk data yang masuk
-- nanti maupun untuk seluruh riwayat yang sudah ada.
--
-- ── Kenapa dua kolom, bukan satu sudut koreksi ──────────────────────────────
--
-- Godaannya menyimpan satu angka "putar sekian derajat". Itu tidak cukup:
-- kesalahannya bukan rotasi. Kesalahan satuan membuat besar simpangannya
-- BERGANTUNG pada HA masing-masing prisma — DF_2 meleset 611 m sementara DF_3
-- yang jaraknya seperempatnya meleset 109 m. Satu-satunya cara membetulkannya
-- adalah menghitung ulang azimut dari HA mentah, dan itu perlu dua angka:
-- pengalinya dan pergeserannya.
--
--   azimut_benar = HA_mentah × ha_faktor_derajat + ha_orientasi_deg
--
-- Bentuk ini juga menampung site yang HA-nya memang sudah derajat
-- (ha_faktor_derajat = 1) atau yang cuma perlu orientasi ulang.
--
-- ── Yang TIDAK diubah ───────────────────────────────────────────────────────
--
-- Hanya arahnya. Jarak mendatar dan elevasi dibiarkan apa adanya, karena
-- keduanya diturunkan dari SD dan VA yang tidak menyentuh HA sama sekali —
-- terbukti cocok dengan SD·sin(VA) sampai 0,4–2,0 m. Konsekuensinya besar
-- pergeseran radial tiap prisma tidak bergerak satu milimeter pun, dan
-- seluruh ambang serta riwayat peringatan tetap berlaku.
ALTER TABLE `t_site`
  ADD COLUMN `ha_faktor_derajat` DOUBLE NULL,
  ADD COLUMN `ha_orientasi_deg`  DOUBLE NULL;

-- kolam_bpp: HA dalam gon (×0,9), orientasi 302,352°.
--
-- Orientasinya adalah rata-rata berbobot jarak² dari enam prisma terhadap peta
-- survei. Bobot jarak² dipakai karena galat sudut dari membaca titik di PDF
-- berbanding terbalik dengan jaraknya: prisma dekat menyumbang derau paling
-- besar dan harus paling sedikit menentukan.
--
-- TELITINYA ±0,5°, setara ±10 m pada prisma terjauh. Itu batas yang bisa
-- diberikan sebuah PDF. Yang TIDAK terpengaruh sama sekali adalah pengukuran
-- deformasinya — konstanta yang sama diputar ke setiap epoch, jadi selisih
-- antar epoch tetap persis. Begitu ada koordinat backsight hasil survei,
-- perbarui SATU angka ini; tidak ada kode yang perlu disentuh.
UPDATE `t_site` SET
  `ha_faktor_derajat` = 0.9,
  `ha_orientasi_deg`  = 302.352
WHERE `slug` = 'kolam_bpp';
