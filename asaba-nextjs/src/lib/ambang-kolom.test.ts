/**
 * Pemeriksaan validasi ambang dan toleransi akurasi RTS.
 * Jalankan: npx tsx src/lib/ambang-kolom.test.ts
 */
import { validasiAmbang } from "./ambang-kolom";
import { AKURASI_BAWAAN, ambangDenganToleransi, toleransiMm, validasiAkurasi } from "./akurasi-rts";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

const SAH = {
  geser_normal_max: 35, geser_waspada_max: 80, geser_siaga_max: 150,
  laju_waspada_min: 35, laju_siaga_min: 80, laju_awas_min: 150,
};

// ── Ambang ──────────────────────────────────────────────────────────────────
cek("ambang sah lolos", validasiAmbang(SAH), null);
cek("pergeseran tidak menaik ditolak", validasiAmbang({ ...SAH, geser_waspada_max: 200 }),
  "Ambang pergeseran harus menaik: Waspada < Siaga < Awas");
cek("pergeseran sama besar ditolak", typeof validasiAmbang({ ...SAH, geser_waspada_max: 35 }), "string");
cek("kecepatan tidak menaik ditolak", validasiAmbang({ ...SAH, laju_awas_min: 10 }),
  "Ambang kecepatan harus menaik: Waspada < Siaga < Awas");
cek("Waspada pergeseran 0 ditolak", typeof validasiAmbang({ ...SAH, geser_normal_max: 0 }), "string");
cek("kecepatan negatif ditolak", typeof validasiAmbang({ ...SAH, laju_waspada_min: -1 }), "string");
cek("kecepatan Waspada 0 boleh", validasiAmbang({ ...SAH, laju_waspada_min: 0 }), null);

// ── Toleransi akurasi RTS ───────────────────────────────────────────────────
const r1 = (n: number) => Math.round(n * 10) / 10;
// Jarak nyata prisma Kolam BPP dari RTS, alat bawaan 2" · 2 mm + 2 ppm.
cek("P1 197 m → ± 4,3 mm", r1(toleransiMm(197.5, AKURASI_BAWAAN)), 4.3);
cek("P2 496 m → ± 8,0 mm", r1(toleransiMm(496.4, AKURASI_BAWAAN)), 8);
cek("P7 1.147 m → ± 16,9 mm", r1(toleransiMm(1147.3, AKURASI_BAWAAN)), 16.9);
cek("alat 1\" · 1 mm + 1,5 ppm lebih ketat untuk P7",
  toleransiMm(1147.3, { sudutDetik: 1, jarakMm: 1, jarakPpm: 1.5 }) < toleransiMm(1147.3, AKURASI_BAWAAN), true);
cek("jarak tidak sah → 0", toleransiMm(0, AKURASI_BAWAAN), 0);
cek("jarak NaN → 0", toleransiMm(NaN, AKURASI_BAWAAN), 0);

const A = {
  geser: { normalMax: 35, waspadaMax: 80, siagaMax: 150 },
  laju: { waspadaMin: 35, siagaMin: 80, awasMin: 150 },
};
cek("ambang + toleransi menggeser ketiga batas pergeseran", ambangDenganToleransi(A, 17).geser,
  { normalMax: 52, waspadaMax: 97, siagaMax: 167 });
cek("ambang kecepatan tidak disentuh", ambangDenganToleransi(A, 17).laju, A.laju);
cek("toleransi negatif diperlakukan 0", ambangDenganToleransi(A, -5).geser, A.geser);

cek("akurasi bawaan sah", validasiAkurasi(AKURASI_BAWAAN), null);
cek("akurasi sudut 0 ditolak", typeof validasiAkurasi({ ...AKURASI_BAWAAN, sudutDetik: 0 }), "string");
cek("akurasi jarak negatif ditolak", typeof validasiAkurasi({ ...AKURASI_BAWAAN, jarakMm: -1 }), "string");
cek("ppm 0 boleh", validasiAkurasi({ ...AKURASI_BAWAAN, jarakPpm: 0 }), null);

if (gagal) {
  console.log(`\n${gagal} pemeriksaan gagal`);
  process.exit(1);
}
console.log("\nsemua lolos");
