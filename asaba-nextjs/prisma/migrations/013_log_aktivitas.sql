-- Jejak perintah yang dikirim ke alat.
--
-- BELUM DIJALANKAN DI MANA PUN. Ditulis bersama kodenya; penerapannya keputusan
-- operator basis data. Aman ditunda: tanpa tabel ini pencatatan gagal diam-diam
-- (lihat catatAktivitas) dan perintahnya tetap terkirim seperti biasa.
--
-- ── Kenapa tabel baru, bukan menumpang log_kontrol ──────────────────────────
--
-- log_kontrol mencatat SESI PENGUKURAN: satu baris per running, dengan id_log
-- yang dipakai /api/deformasi sebagai kunci perhitungan pergeseran. Perintah
-- seperti "nyalakan daya", "baca tilt", atau "jog" tidak menghasilkan sesi dan
-- tidak punya pembacaan; memasukkannya ke sana akan membuat setiap daftar sesi,
-- setiap dropdown "Pilih sesi", dan setiap perhitungan R0 ikut melihat baris
-- yang bukan sesi.
--
-- log_siaga juga bukan tempatnya: isinya pelanggaran ambang, bukan tindakan
-- operator.
--
-- ── Kenapa id_logger, bukan site ────────────────────────────────────────────
--
-- Yang benar-benar diketahui pada saat perintah dikirim hanyalah topik MQTT,
-- dan topik itu memuat id alat (`sub_<idAlat>`) — bukan site. Satu logger boleh
-- melayani beberapa site (30002 melayani ccp dan viewpoint), jadi site tidak
-- bisa disimpulkan dari alat. Menyaring per site karena itu berarti menyaring
-- per logger milik site tersebut, dan perintah untuk site saudaranya akan ikut
-- terlihat. Itu jujur: alatnya memang satu.
--
-- ── Kenapa waktu bertipe DATETIME dan diisi string ──────────────────────────
--
-- Sama seperti seluruh kolom waktu di basis data ini: isinya JAM DINDING, bukan
-- UTC. Penulisnya memakai waktuDbLokal() dengan offset logger. Menyerahkan
-- objek Date ke Prisma akan menyimpannya tujuh jam meleset.

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id         INT NOT NULL AUTO_INCREMENT,
  id_logger  VARCHAR(15) NOT NULL,
  perintah   VARCHAR(64) NOT NULL,
  payload    TEXT NULL,
  terkirim   TINYINT(1) NOT NULL DEFAULT 0,
  waktu      DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY log_aktivitas_logger_waktu_idx (id_logger, waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
