import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { offsetLogger } from "@/lib/sites";
import { sendRtsStartCommand } from "@/lib/mqtt";
import { buatSesiKontrol } from "@/lib/log-kontrol";
import { kunciApiCocok } from "@/lib/kunci-api";
import { rtsSibuk } from "@/lib/rts-sibuk";
import { NAMA_HARI, jadwalJatuhTempo, type BarisJadwal } from "@/lib/jadwal-running";
import { waktuDbLokal } from "@/components/monitoring/format";

export const dynamic = "force-dynamic";

/**
 * POST /api/jadwal-running/jalankan
 *
 * Pelaksana Jadwal running (scheduling_task), dipanggil cron server tiap
 * menit. Pengganti `Kontrol/tes_cronjob` di aplikasi CI3 lama, yang tidak ikut
 * dipindah — sejak itu jadwal yang disimpan di Kontrol ADR tidak pernah jalan.
 * Lihat src/lib/jadwal-running.ts.
 *
 * Header wajib `X-API-Key` = env `JADWAL_RUNNING_KEY`. Jalur ini terbuka di
 * proxy karena cron tidak punya cookie sesi; kuncinya yang menjaga.
 *
 * `?coba=1` hanya melaporkan keputusan tanpa memulai apa pun.
 *
 * Setiap jadwal memulai sesi sekali: dilewati bila site itu sudah punya sesi
 * (dari jadwal, tombol Mulai, atau logger sendiri) sejak jam jadwalnya, atau
 * bila RTS sedang menjalankan sesi. Sesi yang dibuat dicatat `dipicu = jadwal`.
 */
export async function POST(req: NextRequest) {
  const kunci = process.env.JADWAL_RUNNING_KEY?.trim();
  if (!kunci) {
    console.error("[jadwal-running] JADWAL_RUNNING_KEY belum disetel; permintaan ditolak.");
    return NextResponse.json({ success: false, error: "Pelaksana jadwal belum dikonfigurasi" }, { status: 503 });
  }
  if (!kunciApiCocok(req.headers.get("x-api-key"), kunci)) {
    return NextResponse.json({ success: false, error: "Kunci API salah" }, { status: 401 });
  }
  const coba = req.nextUrl.searchParams.get("coba") === "1";

  try {
    // scheduling_task tidak punya kolom site; aplikasi lama memakai satu
    // logger ter-hardcode. Di sini: satu-satunya site aktif yang punya logger.
    // Lebih dari satu = tidak bisa memilih dengan aman, jadi tidak ada yang
    // dijalankan sampai jadwalnya punya site sendiri.
    const site = await prisma.$queryRaw<Array<{ slug: string; nama: string; id_logger: string }>>`
      SELECT slug, nama, id_logger FROM t_site
      WHERE aktif = 1 AND id_logger IS NOT NULL AND id_logger <> ''
      ORDER BY slug
    `;
    if (site.length !== 1) {
      const alasan =
        site.length === 0
          ? "Tidak ada site aktif yang punya logger RTS"
          : `Ada ${site.length} site aktif ber-logger (${site.map((s) => s.slug).join(", ")}); jadwal running belum punya kolom site`;
      return NextResponse.json({ success: true, jalan: false, alasan });
    }
    const { slug, id_logger: idLogger } = site[0];

    const sekarang = waktuDbLokal(new Date(), await offsetLogger(idLogger));
    const daftar = await prisma.$queryRaw<BarisJadwal[]>`
      SELECT id, nama, days, time, status FROM scheduling_task WHERE status = 1
    `;
    const tempo = jadwalJatuhTempo(daftar, sekarang);
    if (!tempo) {
      return NextResponse.json({ success: true, jalan: false, alasan: "Tidak ada jadwal jatuh tempo", sekarang });
    }
    const label = `${tempo.baris.nama} (${NAMA_HARI[Number(tempo.baris.days)] ?? tempo.baris.days} ${tempo.baris.time})`;

    const sudah = await prisma.$queryRaw<Array<{ id_log: string; dipicu: string }>>`
      SELECT id_log, dipicu FROM log_kontrol
      WHERE site = ${slug} AND datetime >= ${tempo.sejakDb}
      ORDER BY datetime LIMIT 1
    `;
    if (sudah.length > 0) {
      return NextResponse.json({
        success: true,
        jalan: false,
        alasan: `${label}: sudah ada sesi ${sudah[0].id_log} (${sudah[0].dipicu}) sejak ${tempo.sejakDb}`,
      });
    }

    const sibuk = await rtsSibuk(idLogger);
    if (sibuk) {
      console.log(`[jadwal-running] ${slug} ${label}: dilewati — ${sibuk}`);
      return NextResponse.json({ success: true, jalan: false, alasan: `${label}: ${sibuk}` });
    }

    if (coba) {
      return NextResponse.json({ success: true, jalan: false, coba: true, alasan: `${label}: akan dimulai`, sekarang });
    }

    // Sama dengan tombol Mulai (/api/kontrol/start), minus kode akses.
    await prisma.$executeRaw`
      UPDATE set_tempkontrol
      SET status = '1', status_manual = '1', datetime = ${sekarang}
      WHERE id_logger = ${idLogger}
    `;
    const { idLog } = await buatSesiKontrol({ idLogger, site: slug, waktuDb: sekarang, asal: "jadwal" });
    const terkirim = await sendRtsStartCommand(idLogger, "jadwal");
    console.log(
      `[jadwal-running] ${slug} ${label}: sesi ${idLog} dimulai, MQTT ${terkirim ? "terkirim" : "GAGAL terkirim"}`
    );
    return NextResponse.json({ success: true, jalan: true, id_log: idLog, mqtt_sent: terkirim, jadwal: label });
  } catch (error) {
    console.error("[POST /api/jadwal-running/jalankan]", error);
    return NextResponse.json({ success: false, error: "Gagal menjalankan jadwal" }, { status: 500 });
  }
}
