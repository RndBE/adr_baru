import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggerForSite, getSite } from "@/lib/sites";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { bacaId, gagal, namaOperator, tolakKodeAkses } from "@/lib/api-kejadian";
import { sudutKosong } from "@/lib/koreksi-azimut";
import { rtsSibuk } from "@/lib/rts-sibuk";
import {
  geserSampingM,
  langkahSah,
  perintahLangkah,
  type PrismaArah,
  type RencanaArah,
  type Tembakan,
} from "@/lib/rekam-arah";

/**
 * /api/kejadian-alarm/[id]/arah-bidik
 *
 * Rekam ulang arah bidik prisma setelah kejadiannya diverifikasi BENAR. Lihat
 * src/lib/rekam-arah.ts untuk alasan dan urutan langkahnya.
 *
 * Langkah-langkahnya dijalankan dialog di peramban, satu per satu, karena
 * balasan logger hanya terdengar lewat MQTT (`pub_<idLogger>`) — pola yang
 * sama dengan Arahkan RTS dan Prism Config. Route ini menjaga setiap langkah:
 * kode akses, kejadian benar-benar diverifikasi Benar, slot terdaftar di site,
 * dan RTS tidak sedang menjalankan sesi.
 */

type Konteks = { params: Promise<{ id: string }> };

const SLOT_MAKS = 50;

function nomorSlot(idPrisma: string): number | null {
  const m = /^P(\d+)$/.exec(idPrisma.trim());
  return m ? Number(m[1]) : null;
}

async function muatKejadian(teksId: string) {
  const id = bacaId(teksId);
  if (!id) return { galat: gagal(400, "Id kejadian tidak sah") } as const;
  const k = await prisma.kejadianAlarm.findUnique({ where: { id } });
  if (!k) return { galat: gagal(404, "Kejadian tidak ditemukan") } as const;
  return { k } as const;
}

/**
 * GET — rencana: prisma site ini, arah tersimpan, tembakan terakhir, dan
 * prisma mana yang ikut memicu kejadian.
 */
export async function GET(_req: NextRequest, { params }: Konteks) {
  try {
    const m = await muatKejadian((await params).id);
    if ("galat" in m) return m.galat;
    const { k } = m;

    const cfg = await getSite(k.site);
    const idLogger = await getLoggerForSite(k.site);
    const faktor = cfg.koreksiAzimut?.faktorDerajat ?? 1;

    const [daftar, tembakan, pemicu, sibuk] = await Promise.all([
      prisma.$queryRaw<
        Array<{ id_prisma: string; nama_prisma: string; target_height: number; HA: string | null; VA: string | null; jenis: string }>
      >`SELECT id_prisma, nama_prisma, target_height, HA, VA, jenis FROM t_prisma WHERE site = ${k.site}`,
      // Tembakan sesi milik site ini saja: slot dipakai ulang antar site, dan
      // satu unit RTS bisa melayani lebih dari satu site.
      prisma.$queryRaw<
        Array<{ id_kontrol: string; waktu: string; sensor1: string; sensor5: string; sensor6: string; sensor7: string }>
      >`
        SELECT r.id_kontrol, DATE_FORMAT(r.waktu, '%Y-%m-%d %H:%i:%s') AS waktu,
               r.sensor1, r.sensor5, r.sensor6, r.sensor7
        FROM rts r JOIN log_kontrol l ON l.id_log = r.id_kontrol
        WHERE l.site = ${k.site} AND r.sensor16 = 1 AND r.sensor1 LIKE 'P%'
        ORDER BY r.id DESC
        LIMIT 3000
      `,
      prisma.logPeringatan.findMany({
        where: {
          site: k.site,
          waktu: { gte: k.mulai, ...(k.pulih ? { lte: k.pulih } : {}) },
          NOT: { ke: "Normal" },
        },
        select: { id_prisma: true },
        distinct: ["id_prisma"],
      }),
      idLogger ? rtsSibuk(idLogger) : Promise.resolve(null),
    ]);

    // Tembakan sah terakhir per prisma. Tembakan gagal datang berjarak nol
    // atau bersudut "000,00,00".
    const terakhir = new Map<string, Tembakan & { waktu: string; idLog: string }>();
    for (const r of tembakan) {
      if (terakhir.has(r.sensor1)) continue;
      const sd = Number(String(r.sensor7 ?? "").replace(",", "."));
      if (!Number.isFinite(sd) || sd <= 0 || sudutKosong(r.sensor5) || sudutKosong(r.sensor6)) continue;
      terakhir.set(r.sensor1, { HA: r.sensor5, VA: r.sensor6, SD: sd, waktu: r.waktu, idLog: r.id_kontrol });
    }

    const memicu = new Set(pemicu.map((p) => p.id_prisma));
    if (k.prisma_puncak) memicu.add(k.prisma_puncak);

    const prismaArah: PrismaArah[] = daftar
      .map((p) => ({ p, slot: nomorSlot(p.id_prisma) }))
      .filter((x): x is { p: (typeof daftar)[number]; slot: number } => x.slot !== null)
      .sort((a, b) => a.slot - b.slot)
      .map(({ p, slot }) => {
        const t = terakhir.get(p.id_prisma) ?? null;
        const tersimpan = { HA: p.HA, VA: p.VA };
        return {
          slot,
          idPrisma: p.id_prisma,
          nama: p.nama_prisma,
          jenis: p.jenis === "bs" ? "bs" : "fs",
          tersimpan,
          terakhir: t,
          geserM: t ? geserSampingM(tersimpan, t, t.SD, faktor) : null,
          memicu: memicu.has(p.id_prisma),
        };
      });

    const data: RencanaArah = {
      site: k.site,
      namaSite: cfg.nama,
      idLogger,
      hasil: k.hasil,
      faktorDerajat: faktor,
      sibuk,
      prisma: prismaArah,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/kejadian-alarm/[id]/arah-bidik]", error);
    return gagal(500, "Gagal memuat arah bidik prisma");
  }
}

/**
 * POST — satu langkah.
 * Body: { kode_akses, slot, langkah: "putar" | "cari" | "ukur" | "rekam" }
 *    atau { kode_akses, slot, langkah: "simpan", HA, VA }
 */
export async function POST(req: NextRequest, { params }: Konteks) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ditolak = await tolakKodeAkses(body.kode_akses);
    if (ditolak) return ditolak;

    const m = await muatKejadian((await params).id);
    if ("galat" in m) return m.galat;
    const { k } = m;
    if (k.hasil !== "benar") {
      return gagal(409, "Rekam ulang arah bidik hanya untuk kejadian yang diverifikasi Benar.");
    }

    const slot = Number(body.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_MAKS) {
      return gagal(400, `slot harus bilangan bulat 1–${SLOT_MAKS}`);
    }
    const idPrisma = `P${slot}`;
    const baris = await prisma.$queryRaw<
      Array<{ nama_prisma: string; target_height: number; HA: string | null; VA: string | null; jenis: string }>
    >`SELECT nama_prisma, target_height, HA, VA, jenis FROM t_prisma WHERE site = ${k.site} AND id_prisma = ${idPrisma} LIMIT 1`;
    const p = baris[0];
    if (!p) return gagal(404, `Prisma ${idPrisma} tidak terdaftar di site ini`);

    if (body.langkah === "simpan") {
      const HA = String(body.HA ?? "").trim();
      const VA = String(body.VA ?? "").trim();
      if (!HA || !VA || HA.length > 50 || VA.length > 50 || sudutKosong(HA) || sudutKosong(VA)) {
        return gagal(400, "HA dan VA tidak sah");
      }
      await prisma.$executeRaw`
        UPDATE t_prisma SET HA = ${HA}, VA = ${VA} WHERE site = ${k.site} AND id_prisma = ${idPrisma}
      `;
      console.log(
        `[arah-bidik] kejadian #${k.id} ${k.site} ${idPrisma}: HA ${p.HA} -> ${HA}, VA ${p.VA} -> ${VA} oleh ${await namaOperator()}`
      );
      return NextResponse.json({ success: true });
    }

    if (!langkahSah(body.langkah)) return gagal(400, "Langkah tidak dikenal");
    const langkah = body.langkah;

    const idLogger = await getLoggerForSite(k.site);
    if (!idLogger) return gagal(404, `Logger untuk site "${k.site}" tidak ditemukan`);

    // Diperiksa di SETIAP langkah: sesi terjadwal bisa mulai di tengah jalan,
    // dan perintah putar di tengah sesi merusak sesinya.
    const sibuk = await rtsSibuk(idLogger);
    if (sibuk) return gagal(409, sibuk);

    const isi = perintahLangkah(langkah, {
      slot,
      nama: p.nama_prisma,
      targetHeight: p.target_height ?? 0,
      jenis: p.jenis === "bs" ? "bs" : "fs",
    });
    const terkirim = await publishMqtt(topikPerintah(idLogger), { [`set_${idLogger}`]: isi });
    if (!terkirim) return gagal(502, "Perintah gagal terkirim ke broker MQTT");
    if (langkah === "putar" || langkah === "rekam") {
      console.log(`[arah-bidik] kejadian #${k.id} ${k.site} ${idPrisma}: ${langkah} dikirim`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/kejadian-alarm/[id]/arah-bidik]", error);
    return gagal(500, "Gagal menjalankan langkah rekam ulang");
  }
}
