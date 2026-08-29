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
import { nilaiBalasanLogger, balasanSelesai } from "../src/lib/balasan-logger";

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

console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
