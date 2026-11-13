import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateSiteCache } from "@/lib/sites";
import {
  bacaAmbang,
  type DetailAmbangSite,
  type KanalPeringatan,
  type PrismaAmbang,
} from "@/lib/ambang-kolom";
import { asStatusLabel } from "@/lib/ambang";
import { chatUntukSite, penerimaEmail, tujuanWhatsapp } from "@/lib/kirim-peringatan";

export const dynamic = "force-dynamic";

/**
 * GET /api/sites/[id]/ambang
 * Bahan tab Ambang Batas (Master Data) untuk satu site: tiap prisma dengan pergeseran
 * dan tingkat terakhirnya (status_prisma — angka yang sama dengan pesan WA dan
 * alarm dasbor), kapan siklus terakhir dinilai, sesi acuan R0, dan ke mana
 * peringatannya dikirim. Nomor dan ID tujuan TIDAK ikut dikirim ke peramban.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const site = Number.isFinite(idNum)
      ? await prisma.site.findUnique({ where: { id: idNum }, select: { slug: true } })
      : null;
    if (!site)
      return NextResponse.json({ success: false, error: "Site tidak ditemukan" }, { status: 404 });
    const slug = site.slug;

    const [baris, siklus, r0, kanal] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id_prisma: string;
          jenis: string;
          tingkat: string | null;
          nilai_mm: number | null;
          gagal_beruntun: number | null;
        }>
      >`
        SELECT p.id_prisma, p.jenis, s.tingkat, s.nilai_mm, s.gagal_beruntun
        FROM t_prisma p
        LEFT JOIN status_prisma s ON s.site = p.site AND s.id_prisma = p.id_prisma
        WHERE p.site = ${slug}
        ORDER BY p.id_prisma
      `,
      prisma.$queryRaw<Array<{ waktu: string | null }>>`
        SELECT DATE_FORMAT(MAX(l.datetime), '%Y-%m-%d %H:%i:%s') AS waktu
        FROM log_kontrol l
        WHERE l.site = ${slug}
          AND l.id_log IN (SELECT s.siklus_terakhir FROM status_prisma s WHERE s.site = ${slug})
      `,
      // Sama dengan acuanR0Bertanda() di evaluasi-siklus.ts: sesi bertanda r0=1.
      prisma.$queryRaw<Array<{ waktu: string | null }>>`
        SELECT DATE_FORMAT(datetime, '%Y-%m-%d %H:%i:%s') AS waktu
        FROM log_kontrol WHERE site = ${slug} AND r0 = 1 LIMIT 1
      `,
      kanalSite(slug),
    ]);

    const daftar: PrismaAmbang[] = baris.map((b) => ({
      idPrisma: b.id_prisma,
      jenis: b.jenis,
      tingkat: asStatusLabel(b.tingkat),
      nilaiMm: b.nilai_mm == null ? null : Number(b.nilai_mm),
      gagalBeruntun: Number(b.gagal_beruntun ?? 0),
    }));

    const data: DetailAmbangSite = {
      prisma: daftar,
      siklusTerakhir: siklus[0]?.waktu ?? null,
      acuanR0: r0[0]?.waktu ?? null,
      kanal,
    };
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/sites/[id]/ambang]", error);
    return NextResponse.json({ success: false, error: "Gagal membaca data ambang" }, { status: 500 });
  }
}

// ─── Kanal peringatan ───────────────────────────────────────────────────────

/** Nama grup WA per chatId. Gagal pun disimpan, supaya gateway yang mati tidak
 *  menambah 3 detik ke setiap pembukaan halaman. */
const namaGrup = new Map<string, { nama: string | null; at: number }>();
const UMUR_NAMA_MS = 10 * 60 * 1000;

async function namaGrupWa(chatId: string): Promise<string | null> {
  const ada = namaGrup.get(chatId);
  if (ada && Date.now() - ada.at < UMUR_NAMA_MS) return ada.nama;

  let nama: string | null = null;
  try {
    const base = (process.env.WHATSAPP_API_URL || "").replace(/\/+$/, "");
    const sesi = process.env.WHATSAPP_SESSION || "beacon";
    const res = await fetch(`${base}/client/getChatById/${encodeURIComponent(sesi)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.WHATSAPP_API_KEY || "" },
      body: JSON.stringify({ chatId }),
      signal: AbortSignal.timeout(3000),
    });
    const j = (await res.json()) as { chat?: { name?: unknown } };
    if (typeof j?.chat?.name === "string" && j.chat.name.trim()) nama = j.chat.name.trim();
  } catch {
    nama = null;
  }
  namaGrup.set(chatId, { nama, at: Date.now() });
  return nama;
}

async function kanalSite(slug: string): Promise<KanalPeringatan[]> {
  const hasil: KanalPeringatan[] = [];

  const tujuan = tujuanWhatsapp(slug);
  const gatewaySiap = !!process.env.WHATSAPP_API_URL && !!process.env.WHATSAPP_API_KEY;
  if (!gatewaySiap) {
    hasil.push({ nama: "WhatsApp", aktif: false, rincian: "Gateway belum disetel" });
  } else if (tujuan.length === 0) {
    hasil.push({ nama: "WhatsApp", aktif: false, rincian: "Belum ada tujuan" });
  } else {
    const grup = tujuan.filter((t) => t.endsWith("@g.us"));
    const nomor = tujuan.length - grup.length;
    const bagian: string[] = [];
    if (grup.length === 1) {
      const nama = await namaGrupWa(grup[0]);
      bagian.push(nama ? `Grup "${nama}"` : "1 grup");
    } else if (grup.length > 1) {
      bagian.push(`${grup.length} grup`);
    }
    if (nomor > 0) bagian.push(`${nomor} nomor`);
    hasil.push({ nama: "WhatsApp", aktif: true, rincian: bagian.join(" + ") });
  }

  const telegramSiap = !!process.env.TELEGRAM_BOT_TOKEN && !!chatUntukSite(slug);
  hasil.push({ nama: "Telegram", aktif: telegramSiap, rincian: telegramSiap ? "1 chat" : "Belum disetel" });

  const email = penerimaEmail(slug);
  const emailSiap = !!process.env.SMTP_HOST && email.length > 0;
  hasil.push({
    nama: "Email",
    aktif: emailSiap,
    rincian: emailSiap ? `${email.length} alamat` : "Belum disetel",
  });

  return hasil;
}

/**
 * PUT /api/sites/[id]/ambang
 * Simpan HANYA keenam kolom ambang satu site — dipakai tab Ambang Batas
 * di Master Data. Kolom site lain tidak disentuh, jadi dua orang yang menyunting
 * ambang dan koordinat bersamaan tidak saling menimpa.
 *
 * Berlaku mulai siklus ukur berikutnya: evaluasi-siklus.ts membaca ambang lewat
 * getSite(), yang cache-nya dikosongkan di sini.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    if (!Number.isFinite(idNum))
      return NextResponse.json({ success: false, error: "ID site tidak sah" }, { status: 400 });

    const hasil = bacaAmbang((await req.json()) as Record<string, unknown>);
    if (hasil.error !== undefined)
      return NextResponse.json({ success: false, error: hasil.error }, { status: 400 });

    const ada = await prisma.site.findUnique({ where: { id: idNum }, select: { id: true } });
    if (!ada)
      return NextResponse.json({ success: false, error: "Site tidak ditemukan" }, { status: 404 });

    const updated = await prisma.site.update({ where: { id: idNum }, data: hasil.data });
    invalidateSiteCache();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/sites/[id]/ambang]", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan ambang" }, { status: 500 });
  }
}
