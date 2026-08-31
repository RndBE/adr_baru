/**
 * Uji regresi pembacaan balasan logger RTS.
 *
 * Mengunci bug yang ditemukan 29 Agustus 2026: logger membalas
 * {"AutoSearch":{"value":1}} sedangkan kode lama hanya mengenali bentuk pipih
 * lewat `String(data.AutoSearch) === "1"`. Untuk objek String() menghasilkan
 * "[object Object]", jadi Auto Search di Prism Config menggantung di "waiting"
 * selamanya dan tombol Simpan ikut terkunci.
 *
 * Jalankan: npx tsx scripts/regresi-balasan-logger.ts
 */
import { nilaiBalasanLogger, balasanSelesai, balasanGagal } from "../src/lib/balasan-logger";

let lulus = 0;
let gagal = 0;

function periksa(judul: string, dapat: unknown, harap: unknown) {
  const cocok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (cocok) {
    lulus++;
  } else {
    gagal++;
    console.error(`  ✗ ${judul}\n      harap : ${JSON.stringify(harap)}\n      dapat : ${JSON.stringify(dapat)}`);
  }
}

/** Sesuai pemakaian di PrismaModal: kunci ada → baca → selesai? */
function selesai(paket: Record<string, unknown>, kunci: string): boolean {
  if (paket[kunci] === undefined) return false;
  return balasanSelesai(nilaiBalasanLogger(paket[kunci]));
}

console.log("🔧 Regresi pembacaan balasan logger\n");

// ── Bentuk yang benar-benar terlihat di lapangan ────────────────────────────
console.log("Payload nyata dari broker:");
periksa('{"AutoSearch":{"value":1}} → selesai', selesai({ AutoSearch: { value: 1 } }, "AutoSearch"), true);
periksa('{"TurningTarget":{"value":1}} → selesai', selesai({ TurningTarget: { value: 1 } }, "TurningTarget"), true);

// ── Bentuk firmware lama harus tetap jalan ─────────────────────────────────
console.log("Kompatibilitas firmware lama:");
periksa('{"AutoSearch":1} → selesai', selesai({ AutoSearch: 1 }, "AutoSearch"), true);
periksa('{"AutoSearch":"1"} → selesai', selesai({ AutoSearch: "1" }, "AutoSearch"), true);

// ── Varian kunci yang sudah dipakai di topic yang sama ─────────────────────
console.log("Varian kunci dalam:");
periksa('{"AutoSearch":{"nilai":1}} → selesai', selesai({ AutoSearch: { nilai: 1 } }, "AutoSearch"), true);
periksa('{"AutoSearch":{"status":"true"}} → selesai', selesai({ AutoSearch: { status: "true" } }, "AutoSearch"), true);
periksa('{"AutoSearch":true} → selesai', selesai({ AutoSearch: true }, "AutoSearch"), true);

// ── Yang TIDAK boleh terbaca sebagai sukses ────────────────────────────────
// Ini bagian terpenting: sukses palsu berarti operator menyimpan prisma yang
// alatnya sebenarnya gagal membidik.
console.log("Kegagalan tidak boleh terbaca sukses:");
periksa('{"AutoSearch":{"value":0}} → BELUM selesai', selesai({ AutoSearch: { value: 0 } }, "AutoSearch"), false);
periksa('{"AutoSearch":0} → BELUM selesai', selesai({ AutoSearch: 0 }, "AutoSearch"), false);
periksa('{"AutoSearch":false} → BELUM selesai', selesai({ AutoSearch: false }, "AutoSearch"), false);
periksa('{"AutoSearch":{"value":false}} → BELUM selesai', selesai({ AutoSearch: { value: false } }, "AutoSearch"), false);
periksa('{"AutoSearch":{}} → BELUM selesai', selesai({ AutoSearch: {} }, "AutoSearch"), false);
periksa('{"AutoSearch":null} → BELUM selesai', selesai({ AutoSearch: null }, "AutoSearch"), false);
periksa("kunci tidak ada → BELUM selesai", selesai({ TurningTarget: { value: 1 } }, "AutoSearch"), false);

// ── Bedakan "tidak ada balasan" dari "balasan bernilai 0" ──────────────────
console.log("Nilai mentah:");
periksa("objek kosong → null", nilaiBalasanLogger({}), null);
periksa("undefined → null", nilaiBalasanLogger(undefined), null);
periksa("array → null", nilaiBalasanLogger([1, 2]), null);
periksa('{"value":0} → "0" (bukan null)', nilaiBalasanLogger({ value: 0 }), "0");
periksa('0 → "0" (bukan null)', nilaiBalasanLogger(0), "0");

// ── Bug aslinya: pastikan cara lama memang gagal ───────────────────────────
// Kalau asersi ini suatu saat gagal, berarti asumsi dasarnya berubah dan
// perbaikan di atas perlu ditinjau ulang.
console.log("Reproduksi bug lama:");
periksa(
  'String({"value":1}) !== "1" (sebab bug)',
  String({ value: 1 } as unknown) === "1",
  false
);

// ── Keadaan gagal harus terbaca sebagai gagal, bukan menggantung ───────────
// Auto Search membalas 0 = prisma tidak ketemu. Itu jawaban akhir; UI harus
// berhenti menunggu. Sebelum ada balasanGagal(), statusnya diam di "waiting"
// selamanya karena hanya sukses yang punya cabang.
console.log("Balasan gagal:");
periksa('{"AutoSearch":{"value":0}} → gagal', balasanGagal(nilaiBalasanLogger({ value: 0 })), true);
periksa('{"AutoSearch":0} → gagal', balasanGagal(nilaiBalasanLogger(0)), true);
periksa('{"AutoSearch":false} → gagal', balasanGagal(nilaiBalasanLogger(false)), true);
periksa('{"AutoSearch":{"value":false}} → gagal', balasanGagal(nilaiBalasanLogger({ value: false })), true);

// Sukses tidak boleh ikut terbaca gagal, dan sebaliknya — keduanya eksklusif.
console.log("Sukses dan gagal saling eksklusif:");
for (const [nama, v] of [
  ['{"value":1}', { value: 1 }],
  ['{"value":0}', { value: 0 }],
  ["1", 1],
  ["0", 0],
] as Array<[string, unknown]>) {
  const n = nilaiBalasanLogger(v);
  periksa(`${nama} tidak sukses DAN gagal sekaligus`, balasanSelesai(n) && balasanGagal(n), false);
}

// Nilai tak dikenal harus tetap "belum ada jawaban": tidak sukses, tidak gagal.
// Kalau ini longgar, bentuk balasan baru akan divonis gagal diam-diam.
console.log("Nilai tak dikenal tetap menunggu:");
for (const [nama, v] of [
  ["objek kosong", {}],
  ["null", null],
  ['"pending"', "pending"],
  ["2", 2],
] as Array<[string, unknown]>) {
  const n = nilaiBalasanLogger(v);
  periksa(`${nama} → bukan sukses`, balasanSelesai(n), false);
  periksa(`${nama} → bukan gagal`, balasanGagal(n), false);
}

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
