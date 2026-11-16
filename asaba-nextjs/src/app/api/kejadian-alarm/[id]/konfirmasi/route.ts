import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { asStatusLabel } from "@/lib/ambang";
import { getSite } from "@/lib/sites";
import { perluKonfirmasi, teksKonfirmasi } from "@/lib/aturan-kejadian";
import { sekarangDb, sinkronEws, teksWaktuDb } from "@/lib/kejadian-alarm";
import { kirimKabar } from "@/lib/kirim-peringatan";
import { bacaId, gagal, namaOperator, tolakKodeAkses } from "@/lib/api-kejadian";

/**
 * POST /api/kejadian-alarm/[id]/konfirmasi
 * Body: { kode_akses: string }
 *
 * Operator menyatakan alarm sudah diketahui. Akibatnya:
 *   - sirene + lampu EWS site dikirimi level 0 (Aman) SEKARANG, tidak menunggu
 *     siklus berikutnya;
 *   - suara alarm di semua peramban berhenti (banner membaca senyap ini);
 *   - kabar singkat ke WhatsApp site.
 *
 * Status di website TIDAK berubah — tingkatnya tetap hasil ukur. Senyapnya
 * hanya sampai tingkat yang dikonfirmasi; naik melewatinya membunyikan semuanya
 * lagi. Lihat aturan-kejadian.ts.
 *
 * Dijaga kode akses, sama seperti perintah ke perangkat lain: mematikan sirene
 * di lapangan bukan hal yang boleh dilakukan siapa saja yang membuka dasbor.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = bacaId((await params).id);
    if (!id) return gagal(400, "Id kejadian tidak sah");

    const body = (await req.json().catch(() => ({}))) as { kode_akses?: unknown };
    const ditolak = await tolakKodeAkses(body.kode_akses);
    if (ditolak) return ditolak;

    const k = await prisma.kejadianAlarm.findUnique({ where: { id } });
    if (!k) return gagal(404, "Kejadian tidak ditemukan");
    if (k.pulih) {
      return gagal(409, "Kejadian sudah pulih — sirene sudah mati. Lanjutkan ke verifikasi.");
    }

    const tingkat = asStatusLabel(k.tingkat_terakhir) ?? "Normal";
    const sebelumnya = asStatusLabel(k.tingkat_dikonfirmasi);
    if (!perluKonfirmasi({ aktif: true, tingkatTerakhir: tingkat, tingkatDikonfirmasi: sebelumnya })) {
      return gagal(409, `Alarm ${tingkat} ini sudah dikonfirmasi oleh ${k.dikonfirmasi_oleh ?? "operator lain"}`);
    }

    const oleh = await namaOperator();
    const waktu = sekarangDb();
    // Bersyarat pada keadaan yang barusan dibaca: dua operator yang menekan
    // bersamaan, atau siklus yang menutup kejadian di antaranya, tidak boleh
    // saling menimpa diam-diam.
    const ubah = await prisma.kejadianAlarm.updateMany({
      where: { id, pulih: null, tingkat_terakhir: k.tingkat_terakhir, tingkat_dikonfirmasi: k.tingkat_dikonfirmasi },
      data: { dikonfirmasi: waktu, dikonfirmasi_oleh: oleh, tingkat_dikonfirmasi: tingkat },
    });
    if (ubah.count === 0) {
      return gagal(409, "Keadaan alarm berubah saat dikonfirmasi. Muat ulang lalu coba lagi.");
    }

    const cfg = await getSite(k.site);
    const ews = await sinkronEws(k.site, cfg.idLoggerEws, tingkat);
    console.log(`[kejadian] #${id} ${k.site}: ${tingkat} dikonfirmasi oleh ${oleh}, ews=${ews}`);

    const teks = teksKonfirmasi({
      namaSite: cfg.nama,
      tingkat,
      mulai: teksWaktuDb(k.mulai) ?? "",
      oleh,
      waktu: teksWaktuDb(waktu) ?? "",
      ews,
    });
    after(async () => {
      console.log(`[kejadian] #${id} kabar konfirmasi: ${await kirimKabar(k.site, teks)}`);
    });

    return NextResponse.json({ success: true, ews });
  } catch (error) {
    console.error("[POST /api/kejadian-alarm/[id]/konfirmasi]", error);
    return gagal(500, "Gagal mengonfirmasi alarm");
  }
}
