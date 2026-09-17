import { GET } from "@/app/api/analisa-gabungan/route";
import { NextRequest } from "next/server";
async function main() {
  for (const [judul, dari, sampai] of [
    ["2 hari (mentah)", "2026-09-16 00:00:00", "2026-09-17 23:59:59"],
    ["5 hari (per jam)", "2026-09-13 00:00:00", "2026-09-17 23:59:59"],
    ["rentang kosong", "2020-01-01 00:00:00", "2020-01-02 00:00:00"],
    ["lewat batas hari", "2020-01-01 00:00:00", "2026-01-01 00:00:00"],
  ] as const) {
    const url = `http://x/api/analisa-gabungan?site=kolam_bpp&dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`;
    const res = await GET(new NextRequest(url));
    const j = await res.json();
    if (!j.success) { console.log(`${judul}: status ${res.status} — ${j.error}`); continue; }
    const isi = j.data.prisma.filter((x: { titik: unknown[] }) => x.titik.length > 0);
    const contoh = isi[0];
    console.log(
      `${judul.padEnd(18)} per_jam=${String(j.data.per_jam).padEnd(5)} prisma berisi=${isi.length}` +
      (contoh ? `  ${contoh.nama_prisma}: ${contoh.titik.length} titik, t pertama "${contoh.titik[0].t}"` : "  (kosong)")
    );
  }
  process.exit(0);
}
main();
