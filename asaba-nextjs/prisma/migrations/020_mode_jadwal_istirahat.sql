-- Mode jadwal AutoTracking "istirahat" (hanya firmware BL1100).
--
-- BELUM DIJALANKAN DI MANA PUN saat berkas ini ditulis. Kedua kolom NULL, dan
-- aplikasi berperilaku persis seperti sekarang selama keduanya tidak terisi:
-- pilihan mode baru tampil setelah get_config sebuah logger melaporkan
-- `trackMode`, atau setelah kolom ini pernah diisi.
--
-- ── Kenapa perlu ────────────────────────────────────────────────────────────
--
-- Jadwal lama (`trackEvery`) mengacu jam dinding: siklus mulai saat menit sejak
-- 00:00 habis dibagi interval. Siklus yang lebih lama dari intervalnya membuat
-- siklus berikutnya langsung jalan, nyaris tanpa jeda. BL1100 menambah mode
-- kedua, `istirahat`, yang menghitung dari SELESAINYA siklus — lama siklus
-- berubah-ubah (jumlah prisma, percobaan ulang, pencarian target), jam mulainya
-- ikut bergeser, tetapi istirahatnya tetap.
--
-- ── Kedudukan kolom ini ─────────────────────────────────────────────────────
--
-- Sama dengan track_every (migrasi 009): catatan "terakhir dikirim", BUKAN bukti
-- keadaan instrumen. Bedanya, BL1100 melaporkan nilainya lewat get_config, jadi
-- catatan ini hanya cadangan untuk saat logger tidak menjawab. Tidak boleh
-- dipakai melewatkan pengiriman.
--
-- track_mode  : 'jam' atau 'istirahat'. NULL = belum pernah dikirim ke logger
--               BL1100; selama NULL pilihan mode tidak ditampilkan, karena
--               firmware lain mengabaikan kuncinya TANPA balasan.
-- track_rest  : menit, 0–1440 (0 = mati). Istirahat ANTAR siklus — bukan
--               `sapu_rehat` (milidetik), yang jeda antar TITIK ukur di sapuan
--               custom.

ALTER TABLE `config_adr`
  ADD COLUMN `track_mode` VARCHAR(10) NULL,
  ADD COLUMN `track_rest` INT NULL;
