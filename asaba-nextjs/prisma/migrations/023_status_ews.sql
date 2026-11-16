-- Level EWS (sirene/lampu) yang terakhir BERHASIL dikirim ke perangkat, per site.
--
-- Sebelumnya evaluasi-siklus.ts menebak "level sebelum" dari status_prisma.
-- Tebakan itu bisa berbeda dari yang sebenarnya diterima perangkat, dan
-- perintah "Aman" tidak pernah berangkat:
--
--   - R0 diganti      → status_prisma site dihapus, "sebelum" terbaca Normal
--   - prisma dihapus  → barisnya disaring, "sebelum" ikut turun
--   - terbit gagal    → "sebelum" sudah berubah, perintahnya tidak diulang
--
-- Dengan tabel ini perintah dikirim selama perangkat belum menerima tingkat
-- yang benar: saat tingkat berubah, saat logger EWS site diganti, dan sekali
-- lagi di siklus berikutnya bila terbitnya gagal. Ditulis HANYA setelah
-- terbit berhasil. Lihat perluKirimEws() di src/lib/ews.ts.
--
-- Dijalankan dengan tangan seperti migrasi lain (bukan Prisma Migrate).

CREATE TABLE IF NOT EXISTS status_ews (
  site VARCHAR(50) NOT NULL,
  id_logger_ews VARCHAR(10) NOT NULL,
  tingkat VARCHAR(10) NOT NULL,
  dikirim DATETIME NOT NULL,
  PRIMARY KEY (site)
);
