/**
 * Jalankan: npx tsx src/components/monitoring/format.test.ts
 *
 * Menguji penulis waktu ke database — `waktuDbLokal` (string, untuk $executeRaw)
 * dan `waktuDateLokal` (Date, untuk kolom DateTime lewat client berjenis) —
 * bulat-baliknya dengan pembaca `waktuMsLokal`, dan perilakunya pada zona selain
 * WIB. Salah sejam di sini tidak memunculkan galat apa pun; datanya tetap
 * tersimpan, cuma dengan waktu yang keliru, dan itu baru ketahuan setelah
 * dipakai.
 */
import assert from "node:assert";
import {
  ZONA_BAWAAN_MENIT,
  kodeZona,
  parseOffsetMenit,
  waktuDateLokal,
  waktuDbLokal,
  waktuMsLokal,
} from "./format";

// Epoch tetap: hasilnya WAJIB sama di zona proses mana pun. Menjalankan berkas
// ini dengan TZ=UTC dan TZ=Asia/Jakarta harus memberi keluaran identik.
assert.strictEqual(waktuDbLokal(new Date("2026-09-12T10:13:00Z")), "2026-09-12 17:13:00");

// Lewat tengah malam UTC: 2026-09-11 20:30 UTC = 2026-09-12 03:30 WIB.
// Tanggalnya ikut maju — inilah yang dulu membuat grafik "hari ini" membuka
// hari kemarin sepanjang pukul 00:00-06:59 WIB.
assert.strictEqual(waktuDbLokal(new Date("2026-09-11T20:30:00Z")), "2026-09-12 03:30:00");
assert.strictEqual(waktuDbLokal(new Date("2026-09-11T20:30:00Z")).slice(0, 10), "2026-09-12");

// Tahun baru WIB terjadi tujuh jam sebelum tahun baru UTC.
assert.strictEqual(waktuDbLokal(new Date("2026-12-31T17:00:00Z")), "2027-01-01 00:00:00");

// Bentuknya harus persis yang diterima kolom DATETIME MySQL: spasi, tanpa "T",
// tanpa milidetik, tanpa akhiran zona.
assert.match(waktuDbLokal(new Date()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

// ── waktuDateLokal ────────────────────────────────────────────────────────────
//
// Prisma menulis medan UTC sebuah Date ke kolom DATETIME apa adanya, jadi yang
// diperiksa di sini justru medan UTC-nya: itulah digit yang mendarat di kolom.
assert.strictEqual(
  waktuDateLokal(Date.parse("2026-09-12T10:13:00Z")).toISOString(),
  "2026-09-12T17:13:00.000Z"
);

// Bentuk Date dan bentuk string harus menyebut jam yang sama. Kalau keduanya
// bergeser sendiri, satu tabel akan berisi dua jenis jam — persis kekeliruan
// yang membuat log_kontrol menyebut dua jam berbeda di satu baris.
for (const iso of ["2026-09-12T10:13:00Z", "2026-09-11T20:30:00Z", "2026-12-31T17:00:00Z"]) {
  const d = new Date(iso);
  assert.strictEqual(
    waktuDateLokal(d.getTime()).toISOString().slice(0, 19).replace("T", " "),
    waktuDbLokal(d)
  );
}

// Bulat-balik dengan pembacanya. Ini yang menjaga jeda 30 menit peredam: sisi
// tulis dan sisi baca harus memulangkan epoch yang sama persis, kalau tidak
// jedanya meleset tujuh jam dan pesan pertama tiap prisma selalu tertahan.
for (const ms of [Date.parse("2026-09-12T10:13:00Z"), Date.parse("2026-12-31T17:00:00Z"), 0]) {
  assert.strictEqual(waktuMsLokal(waktuDateLokal(ms)), ms);
  assert.strictEqual(waktuMsLokal(waktuDbLokal(new Date(ms))), ms);
}

// ── Zona selain WIB ─────────────────────────────────────────────────────────
//
// WITA (+480). Epoch yang sama harus menghasilkan jam dinding satu jam lebih
// maju daripada WIB — itulah seluruh isi persoalannya.
const E = Date.parse("2026-09-12T10:13:00Z");
assert.strictEqual(waktuDbLokal(new Date(E), 420), "2026-09-12 17:13:00");
assert.strictEqual(waktuDbLokal(new Date(E), 480), "2026-09-12 18:13:00");
assert.strictEqual(waktuDbLokal(new Date(E), 540), "2026-09-12 19:13:00");

// Bawaan = WIB. Tanpa ini, memasang kolom baru diam-diam menggeser setiap
// pemanggil lama yang tidak menyebut zona.
assert.strictEqual(ZONA_BAWAAN_MENIT, 420);
assert.strictEqual(waktuDbLokal(new Date(E)), waktuDbLokal(new Date(E), 420));
assert.strictEqual(waktuMsLokal("2026-09-12 17:13:00"), waktuMsLokal("2026-09-12 17:13:00", 420));

// Bulat-balik pada tiap zona, dan HANYA pada zona yang sama. Membaca jam WITA
// sebagai WIB meleset satu jam persis — inilah yang membuat logger WITA tampak
// "terhubung" sejam lebih lama daripada seharusnya di hitungStatusRts.
for (const off of [420, 480, 540]) {
  assert.strictEqual(waktuMsLokal(waktuDateLokal(E, off), off), E);
  assert.strictEqual(waktuMsLokal(waktuDbLokal(new Date(E), off), off), E);
}
/** waktuMsLokal untuk nilai yang di uji ini dijamin sah. */
function ms(w: string | Date, offsetMenit?: number): number {
  const v = waktuMsLokal(w, offsetMenit);
  assert.notStrictEqual(v, null, `waktu tidak terbaca: ${String(w)}`);
  return v as number;
}

assert.strictEqual(ms(waktuDbLokal(new Date(E), 480), 420) - E, 60 * 60 * 1000);

// Offset yang saling meniadakan: dua cap waktu dari alat yang sama boleh dibaca
// dengan zona apa pun asalkan sama, karena yang dipakai cuma SELISIHnya. Ini
// yang membuat peredam dan bolehAdopsiSesi() tidak perlu tahu zona.
for (const off of [420, 480, 540]) {
  assert.strictEqual(
    ms("2026-09-12 10:30:00", off) - ms("2026-09-12 10:00:00", off),
    30 * 60 * 1000
  );
}

// ── parseOffsetMenit ────────────────────────────────────────────────────────
assert.strictEqual(parseOffsetMenit(undefined), 420);
assert.strictEqual(parseOffsetMenit(""), 420);
assert.strictEqual(parseOffsetMenit("480"), 480);
assert.strictEqual(parseOffsetMenit(540), 540);
assert.strictEqual(parseOffsetMenit(-720), -720);
assert.strictEqual(parseOffsetMenit(840), 840);
assert.strictEqual(parseOffsetMenit(841), null);
assert.strictEqual(parseOffsetMenit(-721), null);
assert.strictEqual(parseOffsetMenit(4.5), null);
assert.strictEqual(parseOffsetMenit("WITA"), null);

assert.strictEqual(kodeZona(420), "WIB");
assert.strictEqual(kodeZona(480), "WITA");
assert.strictEqual(kodeZona(540), "WIT");
assert.strictEqual(kodeZona(345), "UTC+5:45");
assert.strictEqual(kodeZona(-300), "UTC-5");

console.log("✅ waktu + zona lulus");
