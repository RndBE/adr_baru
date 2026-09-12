/**
 * Pemeriksaan keputusan sesi. Jalankan: npx tsx src/lib/sesi-kontrol.test.ts
 *
 * Ada karena jalur ini hanya dilewati saat perangkat sungguhan menjalankan
 * siklus — tidak bisa dicoba dari layar, dan kalau salah, salahnya muncul
 * sebagai riwayat yang diam-diam berhenti bertambah. Kasus pertama di bawah
 * adalah keadaan nyata yang memicu keluhan: sesi 101109 dibuka 21 November 2025
 * dan masih menampung baris pengukuran bertanggal 26 Agustus 2026.
 */
import { awalSiklus, bolehAdopsiSesi, pilihSiteSesi, BATAS_ADOPSI_SESI_MS } from "./sesi-kontrol";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

// ── awalSiklus ───────────────────────────────────────────────────────────────
cek("0 -> 1 = siklus mulai", awalSiklus("1", "0"), true);
cek("1 -> 1 = sedang berjalan, bukan awal", awalSiklus("1", "1"), false);
cek("1 -> 0 = selesai", awalSiklus("0", "1"), false);
cek("0 -> 0 = diam", awalSiklus("0", "0"), false);
// temp_rts.sensor16 kolom FLOAT: driver bisa mengembalikan angka, bukan string.
cek("angka dari kolom float", awalSiklus(1, 0), true);
cek("float 1.0 dibaca sebagai 1", awalSiklus("1.0", "0"), true);
// Payload pertama logger ini: belum ada baris temp_rts sama sekali.
cek("belum ada payload sebelumnya", awalSiklus("1", undefined), true);
cek("belum ada payload, sensor16 mati", awalSiklus("0", undefined), false);

// ── bolehAdopsiSesi ──────────────────────────────────────────────────────────
cek("sesi kosong & baru dibuat -> diadopsi", bolehAdopsiSesi({ kosong: true, umurMs: 30_000 }), true);
// Inti bug-nya: sesi lama yang SUDAH berisi hasil tidak boleh menampung siklus
// baru. Ini yang membuat sembilan bulan pengukuran menumpuk di sesi 101109.
cek("sesi sudah berisi hasil -> sesi baru", bolehAdopsiSesi({ kosong: false, umurMs: 30_000 }), false);
cek("sesi kosong tapi basi -> sesi baru", bolehAdopsiSesi({ kosong: true, umurMs: BATAS_ADOPSI_SESI_MS + 1 }), false);
cek("tepat di batas -> masih diadopsi", bolehAdopsiSesi({ kosong: true, umurMs: BATAS_ADOPSI_SESI_MS }), true);
// Jam logger beberapa menit lebih maju dari server: selisihnya negatif, dan itu
// bukan alasan memecah satu pengukuran jadi dua sesi.
cek("jam logger sedikit maju -> tetap diadopsi", bolehAdopsiSesi({ kosong: true, umurMs: -120_000 }), true);
cek("tidak ada sesi sama sekali", bolehAdopsiSesi(null), false);
cek("waktu sesi tidak terbaca", bolehAdopsiSesi({ kosong: true, umurMs: null }), false);

// ── pilihSiteSesi ────────────────────────────────────────────────────────────
// 30002 melayani dua site; yang menentukan adalah site tempat operator terakhir
// bekerja, karena target yang direkam instrumen berasal dari Prism Config site itu.
cek("dua site, ikut sesi terakhir", pilihSiteSesi(["ccp", "viewpoint"], "viewpoint"), "viewpoint");
cek("satu site, tanpa sesi terakhir", pilihSiteSesi(["politeknik-pu"], null), "politeknik-pu");
cek("satu site, sesi terakhir cocok", pilihSiteSesi(["politeknik-pu"], "politeknik-pu"), "politeknik-pu");
// Logger dipindah di Master Data: site sesi lama bukan lagi urusan logger ini.
cek("sesi terakhir sudah pindah logger", pilihSiteSesi(["politeknik-pu"], "ccp"), "politeknik-pu");
// Dua site dan tidak satu pun cocok: memilih salah satunya = melempar koin,
// jadi yang dipakai tetap jejak terakhir apa adanya.
cek("dua site, tidak ada yang cocok", pilihSiteSesi(["ccp", "viewpoint"], "politeknik-pu"), "politeknik-pu");
// t_site belum dikalibrasi (id_logger kosong) — jejak terakhir masih lebih baik
// daripada tidak mencatat site sama sekali.
cek("logger tak punya site terdaftar", pilihSiteSesi([], "ccp"), "ccp");
cek("tidak ada petunjuk apa pun", pilihSiteSesi([], null), null);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
