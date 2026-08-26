import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/prism-config
 * Setara dengan Adr::prism_set() di CI3.
 * Dipanggil oleh frontend saat menerima MQTT response recordTarget dari logger.
 * Simpan HA dan VA ke t_prisma.
 *
 * Body: { nama_prisma: string, HA: string, VA: string, site: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama_prisma, HA, VA, site } = body;

    if (!nama_prisma) {
      return NextResponse.json(
        { success: false, error: "nama_prisma wajib dikirim" },
        { status: 400 }
      );
    }
    // Nama prisma tidak dijamin unik antar site, jadi tanpa site update ini
    // bisa mengenai target milik site lain.
    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib dikirim" },
        { status: 400 }
      );
    }
    if (HA === undefined || VA === undefined) {
      return NextResponse.json(
        { success: false, error: "Parameter HA dan VA wajib dikirim" },
        { status: 400 }
      );
    }

    // Update HA/VA di t_prisma berdasarkan nama_prisma, dibatasi per site
    await prisma.$executeRaw`
      UPDATE t_prisma
      SET HA = ${String(HA)}, VA = ${String(VA)}
      WHERE nama_prisma = ${nama_prisma} AND site = ${site}
    `;

    return NextResponse.json({
      success: true,
      message: "Data HA dan VA berhasil diperbarui",
    });
  } catch (error) {
    console.error("[PATCH /api/prism-config]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update HA/VA" },
      { status: 500 }
    );
  }
}
