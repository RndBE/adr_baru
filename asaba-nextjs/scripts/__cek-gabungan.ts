import { PrismaClient } from "@prisma/client";
import { GET } from "@/app/api/analisa-gabungan/route";
import { NextRequest } from "next/server";
const p = new PrismaClient();

async function main() {
  try {
    const sites = await p.$queryRawUnsafe<Array<{ site: string; n: bigint; awal: Date; akhir: Date }>>(`
      SELECT site, COUNT(*) n, MIN(datetime) awal, MAX(datetime) akhir
      FROM log_kontrol GROUP BY site ORDER BY n DESC LIMIT 5`);
    console.log("site tersedia:", sites.map((s) => `${s.site}(${s.n})`).join(", "));
    const site = sites[0].site;
    const akhir = sites[0].akhir;
    const tgl = akhir.toISOString().slice(0, 10);

    for (const [judul, dari, sampai] of [
      ["rentang 6 jam", `${tgl} 06:00:00`, `${tgl} 12:59:59`],
      ["sehari penuh", `${tgl} 00:00:00`, `${tgl} 23:59:59`],
      ["4 hari (mode per jam)", `${tgl} 00:00:00`, `${tgl} 23:59:59`.replace(tgl, tgl)],
    ] as const) {
      const url = `http://x/api/analisa-gabungan?site=${site}&dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`;
      const res = await GET(new NextRequest(url));
      const j = await res.json();
      if (!j.success) { console.log(`\n${judul}: GAGAL ${j.error}`); continue; }
      const d = j.data;
      const isi = d.prisma.filter((x: { titik: unknown[] }) => x.titik.length > 0);
      console.log(`\n── ${judul} (${dari} → ${sampai}) site=${site}`);
      console.log(`   per_jam=${d.per_jam} terpotong=${d.terpotong} r0=${d.r0?.waktu ?? "—"}`);
      console.log(`   ${d.prisma.length} prisma, ${isi.length} punya bacaan`);
      if (d.dibuang.tanpa_acuan.length) console.log(`   tanpa acuan R0: ${d.dibuang.tanpa_acuan.join(", ")}`);
      if (d.dibuang.tanpa_bacaan.length) console.log(`   tanpa bacaan di rentang: ${d.dibuang.tanpa_bacaan.join(", ")}`);
      for (const x of isi.slice(0, 4)) {
        const t = x.titik;
        const g = (q: { deMm: number; dnMm: number }) => Math.hypot(q.deMm, q.dnMm).toFixed(2);
        console.log(`   ${String(x.nama_prisma).padEnd(8)} ${String(t.length).padStart(3)} titik  awal ${g(t[0])} mm  akhir ${g(t[t.length - 1])} mm`);
      }
    }

    // Penolakan masukan yang tidak sah
    for (const [judul, qs] of [
      ["stempel ngawur", `site=${site}&dari=kemarin&sampai=besok`],
      ["dari > sampai", `site=${site}&dari=${tgl} 12:00:00&sampai=${tgl} 06:00:00`],
      ["tanpa site", `dari=${tgl} 00:00:00&sampai=${tgl} 01:00:00`],
    ] as const) {
      const res = await GET(new NextRequest(`http://x/api/analisa-gabungan?${qs}`));
      const j = await res.json();
      console.log(`\n${judul}: status ${res.status} — ${j.error ?? "DITERIMA (seharusnya ditolak)"}`);
    }
  } catch (e) {
    console.log("galat:", e instanceof Error ? e.message.split("\n").slice(0, 3).join(" | ") : String(e));
  } finally {
    await p.$disconnect();
  }
}
main();
