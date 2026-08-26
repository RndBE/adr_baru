import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateSiteCache } from "@/lib/sites";
import { normalizeBody, validate } from "@/lib/site-validation";

// GET /api/sites/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await prisma.site.findUnique({ where: { id: parseInt(id) } });
    if (!data)
      return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/sites/[id]]", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/sites/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const data = normalizeBody(await req.json());
    const err = validate(data);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    const lama = await prisma.site.findUnique({ where: { id: idNum } });
    if (!lama)
      return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });

    // Slug adalah kunci yang menghubungkan ke log_kontrol.site. Mengubahnya akan
    // memutus seluruh riwayat pengukuran site ini, jadi tolak kalau sudah ada data.
    if (data.slug !== lama.slug) {
      const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM log_kontrol WHERE site = ${lama.slug}
      `;
      if (Number(n) > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Slug tidak bisa diubah: sudah ada ${Number(n)} data pengukuran ` +
              `yang memakai "${lama.slug}". Mengubahnya akan memutus riwayat site ini.`,
          },
          { status: 409 }
        );
      }
      const bentrok = await prisma.site.findUnique({ where: { slug: data.slug } });
      if (bentrok)
        return NextResponse.json(
          { success: false, error: `Slug "${data.slug}" sudah dipakai` },
          { status: 409 }
        );
    }

    const updated = await prisma.site.update({ where: { id: idNum }, data });
    invalidateSiteCache();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/sites/[id]]", error);
    return NextResponse.json({ success: false, error: "Gagal mengupdate site" }, { status: 500 });
  }
}

// DELETE /api/sites/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);

    const site = await prisma.site.findUnique({ where: { id: idNum } });
    if (!site)
      return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });

    // Site yang masih punya data pengukuran tidak boleh dihapus — barisnya akan
    // jatuh ke fallback dan status bahayanya dihitung dengan ambang yang salah.
    // Arahkan ke nonaktifkan saja.
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM log_kontrol WHERE site = ${site.slug}
    `;
    if (Number(n) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Site "${site.nama}" masih punya ${Number(n)} data pengukuran dan tidak bisa dihapus. ` +
            `Nonaktifkan saja agar riwayatnya tetap bisa dibaca dengan ambang yang benar.`,
        },
        { status: 409 }
      );
    }

    await prisma.site.delete({ where: { id: idNum } });
    invalidateSiteCache();
    return NextResponse.json({ success: true, message: "Site berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/sites/[id]]", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus site" }, { status: 500 });
  }
}
