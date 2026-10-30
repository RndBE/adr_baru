/**
 * Keadaan panel Uji sapuan custom, diputar dari urutan balasan di
 * ADR_RTS_PORTING §3.2.
 * Jalankan: npx tsx src/lib/uji-sapuan.test.ts
 *
 * Yang dijaga:
 *
 *   1. Sapuan tidak dianggap selesai di penutup (`tahap:"sweep"`); hanya hasil
 *      akhir yang menyelesaikannya, dan hasil itu yang membawa SDis.
 *   2. Sisa pesan sesudah sapuan selesai tidak menghidupkannya lagi.
 *   3. Penolakan di gerbang firmware tidak masuk riwayat uji — bukan data.
 */
import { bacaBalasanSapuan } from "./protokol-rts";
import {
  arahGagalTerkirim,
  formatDurasi,
  formatMeter,
  keadaanAwal,
  lebarDiJarak,
  MAKS_RIWAYAT_UJI,
  MAKS_TITIK_TERAKHIR,
  mulaiArah,
  mulaiKirim,
  terapkanArah,
  terapkanBalasan,
  tutupTanpaJawaban,
  type KeadaanSapuan,
  type ParameterUji,
} from "./uji-sapuan";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

const PARAM: ParameterUji = {
  slot: 3, step: "0,30,00", Hlebar: "1,00,00", Vlebar: "1,00,00", rehat: "500", jarakM: 1200, titik: 25,
};

/** Putar paket mentah di bawah kunci `autosearch` satu per satu. */
function putar(awal: KeadaanSapuan, paket: unknown[], t0 = 1_000_000, selang = 1000): KeadaanSapuan {
  let k = awal;
  paket.forEach((p, i) => {
    k = terapkanBalasan(k, bacaBalasanSapuan(p), t0 + i * selang);
  });
  return k;
}

const awalKirim = mulaiKirim(keadaanAwal(), PARAM, 1_000_000);
cek("mulaiKirim: fase mengirim, titik dari parameter", [awalKirim.fase, awalKirim.titik], ["mengirim", 25]);

// ── Urutan penuh: ketemu di titik ke-7 ──────────────────────────────────────
const ketemu = putar(awalKirim, [
  { value: "check" },
  { value: "read" },
  { ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1800, langkah_va: 1800 },
  { tembakan: 1, dari: 25, ha: "151,08,07", va: "102,20,53", SDis: "" },
  { tembakan: 2, dari: 25, ha: "151,08,08", va: "102,20,54", SDis: "" },
  { tembakan: 7, dari: 25, ha: "151,09,00", va: "102,21,00", SDis: "1210.4" },
  { ke: 0, tahap: "sweep", value: "ketemu", titik_ke: 7, ha: "151,09,00", va: "102,21,00" },
]);
cek("setelah penutup sapuan fase MASIH berjalan", ketemu.fase, "berjalan");
cek("penutup mencatat titik ke-7", ketemu.penutup, { nilai: "ketemu", titikKe: 7 });
cek("progres 7/25", [ketemu.tembakan, ketemu.dari], [7, 25]);
cek("titik terakhir tersimpan, yang kena ditandai", ketemu.titikTerakhir.map((t) => t.kena), [false, false, true]);

const selesai = putar(ketemu, [
  { jenis: "custom", rehat: 500, value: "ketemu", SDis: "1210.4", HA: "151,09,00", VA: "102,21,00" },
], 1_000_000 + 8000);
cek("hasil akhir → selesai", selesai.fase, "selesai");
cek("hasil akhir membawa SDis", selesai.hasil?.SDis, "1210.4");
cek("riwayat bertambah satu entri ketemu", [selesai.riwayat.length, selesai.riwayat[0].hasil], [1, "ketemu"]);
cek("entri riwayat membawa parameter dan titik ke", [selesai.riwayat[0].parameter.slot, selesai.riwayat[0].titikKe], [3, 7]);
cek("durasi dihitung dari kirim ke hasil", selesai.riwayat[0].durasiDetik, 8); // kirim di t0, hasil di t0 + 8000 ms

// Sisa pesan sesudah selesai tidak menghidupkan lagi.
const sisa = putar(selesai, [
  { tembakan: 8, dari: 25, ha: "x", va: "y", SDis: "" },
  { value: "read" },
  { ke: 0, tahap: "sweep", value: "habis", titik: 25 },
]);
cek("pesan basi sesudah selesai diabaikan", sisa, selesai);

// ── Habis: tidak ketemu ─────────────────────────────────────────────────────
const habis = putar(mulaiKirim(keadaanAwal(), PARAM, 0), [
  { value: "check" },
  { ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1800, langkah_va: 1800 },
  { ke: 0, tahap: "sweep", value: "habis", titik: 25 },
  { jenis: "custom", rehat: 500, value: "gagal", SDis: "", HA: "a", VA: "b" },
], 0, 30_000);
cek("habis → selesai dengan hasil gagal", [habis.fase, habis.hasil?.hasil], ["selesai", "gagal"]);
cek("riwayat mencatat gagal", habis.riwayat[0].hasil, "gagal");
cek("durasi 90 detik", habis.riwayat[0].durasiDetik, 90);

// ── Dibatalkan ──────────────────────────────────────────────────────────────
const dibatalkan = putar(mulaiKirim(keadaanAwal(), PARAM, 0), [
  { value: "check" },
  { ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1800, langkah_va: 1800 },
  { tembakan: 3, dari: 25, ha: "a", va: "b", SDis: "" },
  { value: "stop diminta", berjalan: true },
]);
cek("stop diminta menandai, fase tetap berjalan", [dibatalkan.stopDiminta, dibatalkan.fase], [true, "berjalan"]);
const batalSelesai = putar(dibatalkan, [
  { ke: 0, tahap: "sweep", value: "dibatalkan", tembakan: 3, dari: 25 },
  { jenis: "custom", rehat: 500, value: "gagal", SDis: "", HA: "a", VA: "b" },
]);
cek("dibatalkan dicatat sebagai dibatalkan, bukan gagal", batalSelesai.riwayat[0].hasil, "dibatalkan");
cek("stopDiminta dibersihkan sesudah selesai", batalSelesai.stopDiminta, false);
cek("progres terakhir dibawa ke riwayat", [batalSelesai.riwayat[0].tembakan, batalSelesai.riwayat[0].dari], [3, 25]);

// ── Penolakan ───────────────────────────────────────────────────────────────
const sibuk = putar(awalKirim, [{ error: "sedang sibuk", alasan: "AutoTracking" }]);
cek("ditolak di gerbang → fase ditolak", sibuk.fase, "ditolak");
cek("pesan dan keterangan dibawa", [sibuk.pesan, sibuk.keterangan], ["sedang sibuk", "AutoTracking"]);
cek("penolakan di gerbang TIDAK masuk riwayat", sibuk.riwayat.length, 0);

const rtsOff = putar(awalKirim, [{ value: "check" }, { value: "RTS Off" }]);
cek("RTS Off di tahap check → ditolak, tidak masuk riwayat", [rtsOff.fase, rtsOff.riwayat.length], ["ditolak", 0]);

const tanpaJawaban = tutupTanpaJawaban(awalKirim, "Logger tidak menjawab");
cek("tanpa jawaban → ditolak dengan pesan", [tanpaJawaban.fase, tanpaJawaban.pesan], ["ditolak", "Logger tidak menjawab"]);
cek("tutupTanpaJawaban tidak menyentuh sapuan yang sudah berjalan",
  tutupTanpaJawaban(ketemu, "x"), ketemu);

// Rotate gagal di satu titik: sapuan lanjut.
const rotGagal = putar(awalKirim, [
  { value: "check" },
  { ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1800, langkah_va: 1800 },
  { tembakan: 4, dari: 25, ha: "a", va: "b", value: "rotate gagal" },
]);
cek("rotate gagal tetap berjalan", rotGagal.fase, "berjalan");
cek("rotate gagal ditandai, tidak dianggap kena", [rotGagal.titikTerakhir[0].rotateGagal, rotGagal.titikTerakhir[0].kena], [true, false]);

// ── Sapuan dari luar halaman ────────────────────────────────────────────────
const luar = putar(keadaanAwal(), [{ value: "check" }, { ke: 0, dari: 0, tahap: "sweep", titik: 9, langkah_ha: 600, langkah_va: 600 }]);
cek("sapuan dari luar tampil sebagai berjalan", [luar.fase, luar.titik], ["berjalan", 9]);
const luarSelesai = putar(luar, [
  { ke: 0, tahap: "sweep", value: "habis", titik: 9 },
  { jenis: "custom", rehat: 0, value: "gagal", SDis: "", HA: "", VA: "" },
]);
cek("sapuan dari luar tidak dicatat (parameter tidak diketahui)", luarSelesai.riwayat.length, 0);
cek("pesan acak tanpa sapuan aktif diabaikan",
  putar(keadaanAwal(), [{ tembakan: 1, dari: 9, ha: "a", va: "b", SDis: "" }]).fase, "diam");

// ── Batas ───────────────────────────────────────────────────────────────────
let banyak = mulaiKirim(keadaanAwal(), { ...PARAM, titik: 100 }, 0);
banyak = putar(banyak, [{ value: "check" }, { ke: 0, dari: 0, tahap: "sweep", titik: 100, langkah_ha: 1, langkah_va: 1 }]);
for (let i = 1; i <= 50; i++) {
  banyak = terapkanBalasan(banyak, bacaBalasanSapuan({ tembakan: i, dari: 100, ha: "a", va: "b", SDis: "" }), i);
}
cek(`titik terakhir dibatasi ${MAKS_TITIK_TERAKHIR}`, banyak.titikTerakhir.length, MAKS_TITIK_TERAKHIR);
cek("yang tersimpan adalah yang TERBARU", banyak.titikTerakhir[MAKS_TITIK_TERAKHIR - 1].tembakan, 50);

let riwayatPenuh = keadaanAwal();
for (let i = 0; i < MAKS_RIWAYAT_UJI + 5; i++) {
  riwayatPenuh = mulaiKirim(riwayatPenuh, PARAM, i * 100_000);
  riwayatPenuh = putar(riwayatPenuh, [
    { value: "check" },
    { ke: 0, dari: 0, tahap: "sweep", titik: 25, langkah_ha: 1, langkah_va: 1 },
    { ke: 0, tahap: "sweep", value: "habis", titik: 25 },
    { jenis: "custom", rehat: 0, value: "gagal", SDis: "", HA: "", VA: "" },
  ], i * 100_000);
}
cek(`riwayat dibatasi ${MAKS_RIWAYAT_UJI}`, riwayatPenuh.riwayat.length, MAKS_RIWAYAT_UJI);
cek("riwayat terbaru di depan", riwayatPenuh.riwayat[0].waktuMs > riwayatPenuh.riwayat[1].waktuMs, true);

// Sapuan baru mempertahankan riwayat.
cek("mulaiKirim mempertahankan riwayat", mulaiKirim(selesai, PARAM, 0).riwayat.length, 1);

// ── Arah ────────────────────────────────────────────────────────────────────
const a = mulaiArah(keadaanAwal(), 3);
cek("arah menunggu", [a.arah, a.arahSlot], ["menunggu", 3]);
cek("kemajuan tidak mengubah arah", terapkanArah(a, "kemajuan").arah, "menunggu");
cek("selesai", terapkanArah(a, "selesai").arah, "selesai");
cek("gagal", terapkanArah(a, "gagal").arah, "gagal");
cek("bukan → tidak berubah", terapkanArah(a, "bukan").arah, "menunggu");
cek("balasan arah tanpa menunggu diabaikan", terapkanArah(keadaanAwal(), "selesai").arah, "diam");
cek("gagal terkirim → gagal", arahGagalTerkirim(a).arah, "gagal");
cek("gagal terkirim tanpa menunggu → tetap", arahGagalTerkirim(keadaanAwal()).arah, "diam");
cek("arah dipertahankan saat sapuan dimulai", mulaiKirim(terapkanArah(a, "selesai"), PARAM, 0).arah, "selesai");

// ── Format ──────────────────────────────────────────────────────────────────
// 1° pada 1000 m ≈ 17,46 m.
cek("lebar 1° di 1000 m", Number(lebarDiJarak(1, 1000).toFixed(2)), 17.46);
cek("lebar 0,5° di 1200 m", Number(lebarDiJarak(0.5, 1200).toFixed(2)), 10.47);
cek("durasi detik", formatDurasi(34), "34 dtk");
cek("durasi menit", formatDurasi(125), "2 mnt 5 dtk");
cek("durasi menit bulat", formatDurasi(120), "2 mnt");
cek("durasi jam", formatDurasi(3 * 3600 + 7 * 60), "3 jam 7 mnt");
cek("meter besar", formatMeter(1234.5), "1235 m");
cek("meter sedang", formatMeter(17.46), "17.5 m");
cek("meter kecil", formatMeter(4.1234), "4.12 m");

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
