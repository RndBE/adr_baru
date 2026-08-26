import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashKode, statusKode } from "@/lib/kode-akses";

/**
 * PUT /api/kode-akses/[id]
 * Ubah user / masa berlaku, dan opsional ganti kodenya.
 *
 * `kode` boleh dikosongkan = kode lama dipertahankan. Kode aslinya tidak
 * tersimpan (hanya hash-nya), jadi form tidak bisa menampilkan yang lama —
 * mengisi field berarti menimpa.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const body = await req.json();

    const lama = await prisma.kodeAkses.findUnique({ where: { id: idNum } });
    if (!lama)
      return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });

    if (!body.id_user)
      return NextResponse.json({ success: false, error: "User wajib dipilih" }, { status: 400 });

    const mulai = String(body.tanggal_mulai ?? "");
    const selesai = String(body.tanggal_selesai ?? "");
    if (!mulai || !selesai)
      return NextResponse.json(
        { success: false, error: "Tanggal mulai dan selesai wajib diisi" },
        { status: 400 }
      );
    if (Number.isNaN(Date.parse(mulai)) || Number.isNaN(Date.parse(selesai)))
      return NextResponse.json({ success: false, error: "Format tanggal tidak valid" }, { status: 400 });
    if (Date.parse(selesai) < Date.parse(mulai))
      return NextResponse.json(
        { success: false, error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" },
        { status: 400 }
      );

    const kodeBaru = String(body.kode ?? "").trim();
    if (kodeBaru && kodeBaru.length < 4)
      return NextResponse.json(
        { success: false, error: "Kode akses minimal 4 karakter" },
        { status: 400 }
      );

    let hash = lama.kode_akses;
    if (kodeBaru) {
      hash = hashKode(kodeBaru);
      const bentrok = await prisma.kodeAkses.findFirst({
        where: { kode_akses: hash, NOT: { id: idNum } },
      });
      if (bentrok)
        return NextResponse.json(
          { success: false, error: "Kode akses ini sudah dipakai baris lain" },
          { status: 409 }
        );
    }

    const updated = await prisma.kodeAkses.update({
      where: { id: idNum },
      data: {
        id_user: Number(body.id_user),
        kode_akses: hash,
        tanggal_mulai: new Date(mulai),
        tanggal_selesai: new Date(selesai),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        id_user: updated.id_user,
        tanggal_mulai: updated.tanggal_mulai.toISOString().slice(0, 10),
        tanggal_selesai: updated.tanggal_selesai.toISOString().slice(0, 10),
        status: statusKode(updated.tanggal_mulai, updated.tanggal_selesai),
      },
      kode_diganti: !!kodeBaru,
    });
  } catch (error) {
    console.error("[PUT /api/kode-akses/[id]]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengubah kode akses" },
      { status: 500 }
    );
  }
}

// DELETE /api/kode-akses/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);

    const ada = await prisma.kodeAkses.findUnique({ where: { id: idNum } });
    if (!ada)
      return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 });

    // Menghapus kode terakhir membuat kontrol RTS tidak bisa dibuka siapa pun.
    const jumlah = await prisma.kodeAkses.count();
    if (jumlah <= 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ini satu-satunya kode akses yang tersisa. Menghapusnya membuat " +
            "kontrol RTS tidak bisa dijalankan siapa pun — tambahkan kode " +
            "pengganti lebih dulu.",
        },
        { status: 409 }
      );
    }

    await prisma.kodeAkses.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true, message: "Kode akses dihapus" });
  } catch (error) {
    console.error("[DELETE /api/kode-akses/[id]]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus kode akses" },
      { status: 500 }
    );
  }
}
