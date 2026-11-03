/**
 * Keadaan geser titik tengah sapuan, diputar dari balasan ManualHAVA dan Jog.
 * Jalankan: npx tsx src/lib/geser-sapuan.test.ts
 *
 * Yang dijaga:
 *
 *   1. Balasan yang datang tanpa diminta (halaman lain memicu manual_hava/jog
 *      di topik yang sama) tidak mengubah apa pun.
 *   2. Jog baru dianggap selesai di `done`, bukan di `target` — sapuan baru
 *      boleh dikirim sesudah instrumen berhenti bergerak.
 *   3. Bacaan sudut dikosongkan begitu instrumen bergerak.
 *   4. "000,00,00" adalah gagal baca, bukan sudut.
 *   5. Isian yang salah ketik menjadi galat, bukan "tidak geser".
 */
import { bacaBalasanJog, bacaManualHaVa } from "./protokol-rts";
import {
  cekGeseran,
  keadaanGeserAwal,
  kosongkanBacaan,
  mulaiBaca,
  mulaiGeser,
  terapkanBacaan,
  terapkanJog,
  tutupBacaTanpaJawaban,
  tutupGeserTanpaJawaban,
  uraiGeseran,
} from "./geser-sapuan";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

// ── Baca sudut ──────────────────────────────────────────────────────────────
const awal = keadaanGeserAwal();
cek("bacaan tanpa diminta diabaikan", terapkanBacaan(awal, bacaManualHaVa({ HA: "151,38,71", VA: "206,04,62" }), 1).baca.fase, "diam");

const menungguBaca = mulaiBaca(awal);
cek("mulaiBaca menunggu", menungguBaca.baca.fase, "menunggu");
const ada = terapkanBacaan(menungguBaca, bacaManualHaVa({ HA: "151,38,71", VA: "206,04,62" }), 5000);
cek("bacaan diterima apa adanya", [ada.baca.fase, ada.baca.HA, ada.baca.VA, ada.baca.waktuMs], ["ada", "151,38,71", "206,04,62", 5000]);

const gagalBaca = terapkanBacaan(menungguBaca, bacaManualHaVa({ HA: "000,00,00", VA: "000,00,00" }), 5000);
cek("000,00,00 = gagal, angkanya tidak ditampilkan", [gagalBaca.baca.fase, gagalBaca.baca.HA], ["gagal", ""]);
cek("balasan bukan ManualHAVA diabaikan", terapkanBacaan(menungguBaca, bacaManualHaVa(undefined), 1).baca.fase, "menunggu");
cek("tanpa jawaban → gagal dengan pesan", tutupBacaTanpaJawaban(menungguBaca, "x").baca, { fase: "gagal", HA: "", VA: "", waktuMs: null, pesan: "x" });
cek("tutupBacaTanpaJawaban tidak menyentuh bacaan yang sudah ada", tutupBacaTanpaJawaban(ada, "x").baca.fase, "ada");
cek("kosongkanBacaan", kosongkanBacaan(ada).baca.fase, "diam");

// ── Geser ───────────────────────────────────────────────────────────────────
cek("jog tanpa diminta diabaikan", terapkanJog(awal, bacaBalasanJog({ value: "done" })).geser.fase, "diam");

const geser = mulaiGeser(ada, 0.5, -0.01, 9000);
cek("mulaiGeser menunggu dan mengosongkan bacaan", [geser.geser.fase, geser.geser.ha, geser.geser.va, geser.baca.fase], ["menunggu", 0.5, -0.01, "diam"]);

let k = geser;
for (const p of [{ value: "start" }, { value: "check" }, { value: "read" }]) k = terapkanJog(k, bacaBalasanJog(p));
cek("tahap perantara tidak menyelesaikan", k.geser.fase, "menunggu");

k = terapkanJog(k, bacaBalasanJog({ value: "target", dari_HA: "151.3871", dari_VA: "206.0462", ke_HA: "151,53,14", ke_VA: "206,02,10" }));
cek("target menyimpan dari/ke, belum selesai", [k.geser.fase, k.geser.dariHA, k.geser.keHA, k.geser.keVA], ["menunggu", "151.3871", "151,53,14", "206,02,10"]);

k = terapkanJog(k, bacaBalasanJog({ value: "rotate" }));
cek("rotate belum selesai", k.geser.fase, "menunggu");

k = terapkanJog(k, bacaBalasanJog({ value: "done" }));
cek("done menyelesaikan; dari/ke dipertahankan", [k.geser.fase, k.geser.keHA], ["selesai", "151,53,14"]);
cek("done lagi sesudah selesai tidak mengubah", terapkanJog(k, bacaBalasanJog({ value: "failed" })).geser.fase, "selesai");

const ditolak = terapkanJog(geser, bacaBalasanJog({ value: "RTS Off" }));
cek("RTS Off → gagal dengan penjelasan", [ditolak.geser.fase, ditolak.geser.pesan], ["gagal", "RTS tidak menjawab. Nyalakan instrumen lebih dulu."]);

const badBase = terapkanJog(geser, bacaBalasanJog({ value: "bad base", HA: "0.0", VA: "0.0" }));
cek("bad base → gagal, sudut awal dicatat", [badBase.geser.fase, badBase.geser.dariHA], ["gagal", "0.0"]);

cek("tanpa jawaban → gagal", tutupGeserTanpaJawaban(geser, "x").geser.fase, "gagal");
cek("tutupGeserTanpaJawaban tidak menyentuh yang sudah selesai", tutupGeserTanpaJawaban(k, "x").geser.fase, "selesai");

// ── Isian ───────────────────────────────────────────────────────────────────
cek("kosong = 0", uraiGeseran(""), 0);
cek("desimal titik", uraiGeseran("0.5"), 0.5);
cek("desimal koma", uraiGeseran("0,5"), 0.5);
cek("minus desimal", uraiGeseran("-0,25"), -0.25);
cek("plus eksplisit", uraiGeseran("+1"), 1);
cek("d,m,s", uraiGeseran("0,30,00"), 0.5);
cek("minus d,m,s berlaku untuk seluruhnya", uraiGeseran("-0,30,00"), -0.5);
cek("d,m,s dengan derajat", Number((uraiGeseran("1,15,36") ?? 0).toFixed(4)), 1.26);
cek("menit 60 ditolak", uraiGeseran("0,60,00"), null);
cek("huruf ditolak", uraiGeseran("abc"), null);
cek("dua titik desimal ditolak", uraiGeseran("1.2.3"), null);

cek("keduanya kosong = tidak ada geseran, bukan galat", cekGeseran("", ""), { ok: true, ha: 0, va: 0, ada: false });
cek("geseran sah", cekGeseran("0,5", "-0,01"), { ok: true, ha: 0.5, va: -0.01, ada: true });
cek("salah ketik = galat, bukan tidak geser", cekGeseran("0,5x", "").ok, false);
cek("di atas 10° ditolak", cekGeseran("11", "").ok, false);
cek("di bawah satu detik busur ditolak", cekGeseran("0,0001", "").ok, false);
cek("salah satu sumbu saja boleh", cekGeseran("", "0,2"), { ok: true, ha: 0, va: 0.2, ada: true });

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
