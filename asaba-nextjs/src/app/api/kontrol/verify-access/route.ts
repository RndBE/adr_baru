import { NextRequest, NextResponse } from "next/server";
import { verifikasiKodeAkses } from "@/lib/kode-akses";

/**
 * POST /api/kontrol/verify-access
 * Hanya validasi kode akses — TIDAK kirim MQTT apapun.
 * Dipakai oleh halaman Prism Config untuk unlock tombol Set/Edit.
 *
 * Body: { kode_akses: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kode_akses } = body;

    // verifikasiKodeAkses() sekaligus memeriksa masa berlaku — sebelumnya
    // hanya hash yang dicocokkan, sehingga kode kedaluwarsa tetap diterima.
    const hasil = await verifikasiKodeAkses(String(kode_akses ?? ""));
    if (!hasil.valid) {
      return NextResponse.json(
        { success: false, error: hasil.alasan },
        { status: hasil.alasan === "Kode akses wajib diisi" ? 400 : 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/kontrol/verify-access]", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify access code" },
      { status: 500 }
    );
  }
}
