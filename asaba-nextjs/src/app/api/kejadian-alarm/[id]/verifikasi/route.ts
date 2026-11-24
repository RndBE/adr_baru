import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { asStatusLabel } from "@/lib/ambang";
import { getSite } from "@/lib/sites";
import { bolehVerifikasi, teksVerifikasi, validasiVerifikasi } from "@/lib/aturan-kejadian";
import { sekarangDb, teksWaktuDb } from "@/lib/kejadian-alarm";
import { kirimKabar } from "@/lib/kirim-peringatan";
import { bacaId, gagal, namaOperator, tolakKodeAkses } from "@/lib/api-kejadian";

/**
 * POST /api/kejadian-alarm/[id]/verifikasi
 * Body: { kode_akses, hasil: "benar" | "palsu", penyebab?: string, catatan: string }
 *
 * Hasil cek lapangan. Boleh setelah dikonfirmasi, atau setelah kejadiannya
 * pulih sendiri. Boleh diulang untuk membetulkan catatan — yang terakhir
 * berlaku, dan tiap verifikasi dikabarkan ke WhatsApp.
 *
 * Verifikasi tidak mengubah perhitungan apa pun. Pergeseran yang BENAR tetap
 * berstatus sampai arah bidik prismanya diperbarui (acuan baru prisma, lihat
 * aturan-acuan.ts), R0 diganti, atau ambangnya diubah.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = bacaId((await params).id);
    if (!id) return gagal(400, "Id kejadian tidak sah");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ditolak = await tolakKodeAkses(body.kode_akses);
    if (ditolak) return ditolak;

    const isi = validasiVerifikasi(body);
    if (!isi.ok) return gagal(400, isi.galat);

    const k = await prisma.kejadianAlarm.findUnique({ where: { id } });
    if (!k) return gagal(404, "Kejadian tidak ditemukan");
    if (!bolehVerifikasi({ aktif: k.pulih === null, dikonfirmasi: k.dikonfirmasi !== null })) {
      return gagal(409, "Konfirmasi alarm dulu — sirenenya masih berbunyi");
    }

    const oleh = await namaOperator();
    const waktu = sekarangDb();
    await prisma.kejadianAlarm.update({
      where: { id },
      data: {
        diverifikasi: waktu,
        diverifikasi_oleh: oleh,
        hasil: isi.hasil,
        penyebab: isi.penyebab,
        catatan: isi.catatan,
      },
    });
    console.log(`[kejadian] #${id} ${k.site}: diverifikasi ${isi.hasil} oleh ${oleh}`);

    const cfg = await getSite(k.site);
    const teks = teksVerifikasi({
      namaSite: cfg.nama,
      tingkatPuncak: asStatusLabel(k.tingkat_puncak) ?? "Normal",
      mulai: teksWaktuDb(k.mulai) ?? "",
      hasil: isi.hasil,
      penyebab: isi.penyebab,
      catatan: isi.catatan,
      oleh,
      waktu: teksWaktuDb(waktu) ?? "",
    });
    after(async () => {
      console.log(`[kejadian] #${id} kabar verifikasi: ${await kirimKabar(k.site, teks)}`);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/kejadian-alarm/[id]/verifikasi]", error);
    return gagal(500, "Gagal menyimpan verifikasi");
  }
}
