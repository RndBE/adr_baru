import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { catatStepRecord, kirimStepRecord } from "@/lib/step-record-db";

/**
 * POST /api/prism-config/step-record
 * Hitung ulang stepRecord (jumlah prisma per siklus) dari t_prisma site ini,
 * catat ke config_adr, dan kirim ke logger.
 *
 * Dipanggil modal Isi slot SETELAH logger membalas `recordTarget`, bukan di
 * POST /api/prism-config yang mengirim `recordTarget` itu. Perintah kedua yang
 * tiba saat firmware masih membaca sudut dari instrumen bisa tertahan atau
 * hilang, dan yang kalah justru perekaman targetnya.
 *
 * Body: { site, kirim_logger? }
 * Balasan: { success, data: HasilStepRecord }. `data.dikirim` hanya berarti
 * sampai ke broker; bukti logger menerimanya adalah ack `updated` di pub_<id>.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const site = typeof body.site === "string" ? body.site.trim() : "";
    const kirimLogger = body.kirim_logger !== false;

    if (!site) {
      return NextResponse.json({ success: false, error: "site wajib diisi" }, { status: 400 });
    }

    const catatan = await prisma.$transaction((tx) => catatStepRecord(tx, site));
    const data = await kirimStepRecord(site, catatan, kirimLogger);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[POST /api/prism-config/step-record]", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui step record" },
      { status: 500 }
    );
  }
}
