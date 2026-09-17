/**
 * Pemeriksaan pemisahan "gagal ditembak" dari "tidak bergerak".
 * Jalankan: npx tsx src/components/monitoring/derive.test.ts
 *
 * Kasus di bawah bukan karangan. Pada 17 September 2026 site kolam_bpp
 * menghasilkan 501 baris rts dengan N/E/Z = "000,00,00" — prisma dibidik tapi
 * tidak ketemu. Sebelum pemisahan ini, baris seperti itu menghasilkan
 * DN/DE/DZ nol, tampil "0,0 mm", lalu dinilai "Normal": layar menyatakan AMAN
 * untuk prisma yang sebenarnya tidak diketahui keadaannya.
 */
import { type AmbangSite } from "@/lib/ambang";
import { ringkasPrisma, type PengukuranRow } from "./derive";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`);
}

const AMBANG: AmbangSite = {
  geser: { normalMax: 35, waspadaMax: 80, siagaMax: 150 },
  laju: { waspadaMin: 40, siagaMin: 80, awasMin: 120 },
};

function baris(t: PengukuranRow["temp_tembak"]): PengukuranRow {
  return { id_prisma: "P4", nama_prisma: "DF_4", temp_tembak: t };
}

// ── Prisma yang benar-benar diam ────────────────────────────────────────────
{
  const [r] = ringkasPrisma(
    [baris({ E0: 9748533.77, N0: 464729.2, Z0: -125.2, E1: 9748533.77, N1: 464729.2, Z1: -125.2, DE: 0, DN: 0, DZ: 0, linear: 0 })],
    AMBANG
  );
  cek("prisma diam: tertembak", r.tertembak, true);
  cek("prisma diam: pergeseran nol, bukan null", r.geserMm, 0);
  cek("prisma diam: dinilai Normal", r.status, "Normal");
}

// ── Prisma yang gagal ditembak ──────────────────────────────────────────────
{
  // Persis bentuk yang dihasilkan "000,00,00": seluruh sumbu nol.
  const [r] = ringkasPrisma(
    [baris({ E0: 9748533.77, N0: 464729.2, Z0: -125.2, E1: 0, N1: 0, Z1: 0, DE: 0, DN: 0, DZ: 0, linear: 0 })],
    AMBANG
  );
  cek("gagal ditembak: ditandai", r.tertembak, false);
  // Inti kasusnya: BUKAN nol, melainkan tidak diketahui.
  cek("gagal ditembak: pergeseran null, bukan 0", r.geserMm, null);
  cek("gagal ditembak: linier null", r.linierMm, null);
  cek("gagal ditembak: dx/dy/dz null", [r.dxMm, r.dyMm, r.dzMm], [null, null, null]);
  // Yang paling berbahaya kalau salah: status "Normal" untuk prisma tak terbaca.
  cek("gagal ditembak: TIDAK dinilai Normal", r.status, null);
  cek("gagal ditembak: tidak muncul di denah", [r.e, r.n], [null, null]);
  cek("gagal ditembak: arah tidak dikarang", r.arahTeks, null);
}

// ── Acuan R0 yang tidak sah ─────────────────────────────────────────────────
{
  const [r] = ringkasPrisma(
    [baris({ E0: 0, N0: 0, Z0: 0, E1: 9748533.77, N1: 464729.2, Z1: -125.2, DE: 0, DN: 0, DZ: 0, linear: 0 })],
    AMBANG
  );
  // Bacaan sekarang sah, tapi tanpa acuan yang sah tidak ada yang bisa dibandingkan.
  cek("acuan tidak sah: ikut ditandai gagal", r.tertembak, false);
  cek("acuan tidak sah: tidak dinilai", r.status, null);
}

// ── Penanda dari server dipercaya lebih dulu ────────────────────────────────
{
  // Server bilang gagal walau koordinatnya bukan nol — penanda server menang.
  const [r] = ringkasPrisma(
    [baris({ tertembak: false, E0: 9748533.77, N0: 464729.2, Z0: -125.2, E1: 9748533.9, N1: 464729.3, Z1: -125.1, DE: 0.13, DN: 0.1, DZ: 0.1, linear: 0.19 })],
    AMBANG
  );
  cek("penanda server dipakai", r.tertembak, false);
  cek("penanda server: angka ikut null", r.geserMm, null);
}

// ── Pergeseran sungguhan tetap lolos ────────────────────────────────────────
{
  const [r] = ringkasPrisma(
    [baris({ E0: 9748533.7744, N0: 464729.2067, Z0: -125.2, E1: 9748533.5785, N1: 464729.0532, Z1: -125.24, DE: -0.1959, DN: -0.1535, DZ: -0.04, linear: 0.2489 })],
    AMBANG
  );
  cek("pergeseran nyata: tertembak", r.tertembak, true);
  cek("pergeseran nyata: ~249 mm", Math.round(r.geserMm ?? 0), 249);
  cek("pergeseran nyata: dinilai Awas", r.status, "Awas");
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
