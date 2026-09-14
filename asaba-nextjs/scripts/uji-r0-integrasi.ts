/**
 * Jalankan: npx tsx scripts/uji-r0-integrasi.ts
 *
 * JANGAN JALANKAN TERHADAP BASIS DATA PRODUKSI. Skrip ini MENULIS: ia memindah
 * acuan R0 site "viewpoint" beberapa kali, membuat kode akses sementara, dan
 * menyisipkan satu sesi kosong. Semuanya dipulihkan di blok finally, tapi
 * pemulihan yang bergantung pada proses yang tidak dibunuh di tengah bukan
 * jaminan yang pantas diberikan ke data lapangan. Pakai salinan lokal.
 *
 * Uji integrasi PATCH /api/log-kontrol/[id_log] terhadap DB SUNGGUHAN. Bukan
 * unit test: handler-nya diimpor apa adanya dan dipanggil dengan Request
 * sintetis, jadi yang diuji persis kode yang dijalankan server — termasuk
 * verifikasi kode akses, tiap gerbang penolakan, dan transaksinya.
 *
 * Membuat perkakas sementara (kode akses uji + satu sesi kosong) dan MENGHAPUS
 * semuanya di blok finally, termasuk saat gagal di tengah. Acuan R0 yang
 * berlaku dicatat di awal dan dikembalikan di akhir.
 */
import { PATCH } from "@/app/api/log-kontrol/[id_log]/route";
import { prisma } from "@/lib/prisma";
import { hashKode } from "@/lib/kode-akses";
import type { NextRequest } from "next/server";

const SITE = "viewpoint";
const KODE = "uji-r0-sementara";
const SESI_KOSONG = "ZZUJI001";

let gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(`${ok ? "ok  " : "GAGAL"} ${nama}${ok ? "" : `\n      harap ${JSON.stringify(harap)}, dapat ${JSON.stringify(dapat)}`}`);
}

async function panggil(idLog: string, body: unknown) {
  const req = new Request("http://localhost/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
  const res = await PATCH(req, { params: Promise.resolve({ id_log: idLog }) });
  return { status: res.status, body: await res.json() };
}

async function main() {
const r0Awal = await prisma.logKontrol.findFirst({ where: { site: SITE, r0: 1 } });
console.log(`R0 ${SITE} sebelum uji: ${r0Awal?.id_log ?? "(tidak ada)"}\n`);

try {
  // ── Perkakas ──────────────────────────────────────────────────────────────
  const kodeBaris = await prisma.kodeAkses.create({
    data: {
      id_user: 2,
      kode_akses: hashKode(KODE),
      tanggal_mulai: new Date("2020-01-01"),
      tanggal_selesai: new Date("2099-12-31"),
    },
  });
  await prisma.$executeRaw`
    INSERT INTO log_kontrol (id_log, id_logger, prisma, datetime, r0, site, dipicu)
    VALUES (${SESI_KOSONG}, '30002', '', '2026-09-14 10:00:00', 0, ${SITE}, 'operator')
  `;

  // ── Gerbang penolakan ─────────────────────────────────────────────────────
  let r = await panggil("152558", {});
  cek("tanpa kode akses -> 400", r.status, 400);
  cek("  alasannya disebut", r.body.error, "Kode akses wajib diisi");

  r = await panggil("152558", { kode_akses: "salah-sekali" });
  cek("kode salah -> 403", r.status, 403);

  r = await panggil("152558", { kode_akses: "" });
  cek("kode kosong -> 400", r.status, 400);

  // Kode kedaluwarsa: baris asli DB ini memang sudah lewat (2023-11-30).
  r = await panggil("152558", { kode_akses: KODE });
  cek("kode sah -> lolos gerbang akses", r.status, 200);
  cek("  acuan berpindah", r.body.data?.id_log, "152558");
  cek("  berubah = true", r.body.data?.berubah, true);

  // ── Idempoten ─────────────────────────────────────────────────────────────
  r = await panggil("152558", { kode_akses: KODE });
  cek("menunjuk yang sama lagi -> 200 tanpa perubahan", r.body.data?.berubah, false);

  // ── Persis satu r0 per site ───────────────────────────────────────────────
  const bertanda = await prisma.logKontrol.findMany({
    where: { site: SITE, r0: 1 },
    select: { id_log: true },
  });
  cek("tepat satu baris r0=1 di site itu", bertanda.map((b) => b.id_log), ["152558"]);

  // Site lain tidak ikut tersapu.
  const lain = await prisma.logKontrol.findMany({ where: { r0: 1 }, select: { site: true } });
  cek("site lain tetap punya acuannya",
    [...new Set(lain.map((l) => l.site))].sort(), ["ccp", "politeknik-pu", "viewpoint"]);

  // ── Gerbang sesi tanpa bacaan ─────────────────────────────────────────────
  r = await panggil(SESI_KOSONG, { kode_akses: KODE });
  cek("sesi tanpa baris rts -> 409", r.status, 409);
  cek("  acuan TIDAK berpindah",
    (await prisma.logKontrol.findFirst({ where: { site: SITE, r0: 1 } }))?.id_log, "152558");

  // ── Sesi tidak ada ────────────────────────────────────────────────────────
  r = await panggil("TIDAKADA", { kode_akses: KODE });
  cek("sesi tidak ada -> 404", r.status, 404);

  // ── Reset keadaan peringatan ──────────────────────────────────────────────
  await prisma.statusPrisma.create({
    data: { site: SITE, id_prisma: "P1", tingkat: "Siaga", hitung_calon: 2, gagal_beruntun: 0 },
  });
  await prisma.statusPrisma.create({
    data: { site: "ccp", id_prisma: "P1", tingkat: "Awas", hitung_calon: 0, gagal_beruntun: 0 },
  });
  await panggil("163053", { kode_akses: KODE });
  cek("ganti acuan -> keadaan peringatan site itu dibuang",
    await prisma.statusPrisma.count({ where: { site: SITE } }), 0);
  cek("  keadaan site LAIN tidak ikut dibuang",
    await prisma.statusPrisma.count({ where: { site: "ccp" } }), 1);

  await prisma.kodeAkses.delete({ where: { id: kodeBaris.id } });
} finally {
  // ── Bersih-bersih ─────────────────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM log_kontrol WHERE id_log = ${SESI_KOSONG}`;
  await prisma.$executeRaw`DELETE FROM kode_akses WHERE kode_akses = ${hashKode(KODE)}`;
  await prisma.statusPrisma.deleteMany({ where: { site: { in: [SITE, "ccp"] } } });
  if (r0Awal) {
    await prisma.$executeRaw`UPDATE log_kontrol SET r0 = 0 WHERE site = ${SITE}`;
    await prisma.$executeRaw`UPDATE log_kontrol SET r0 = 1 WHERE id_log = ${r0Awal.id_log}`;
  }
  const balik = await prisma.logKontrol.findFirst({ where: { site: SITE, r0: 1 } });
  cek(`\nR0 ${SITE} dikembalikan`, balik?.id_log, r0Awal?.id_log);
  const sisaKode = await prisma.kodeAkses.count();
  cek("kode akses uji terhapus (sisa = 1 baris asli)", sisaKode, 1);
  const sisaSesi = await prisma.logKontrol.count({ where: { id_log: SESI_KOSONG } });
  cek("sesi uji terhapus", sisaSesi, 0);
  await prisma.$disconnect();
}

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
}

main();
