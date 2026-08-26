import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashKode, statusKode } from "@/lib/kode-akses";

/**
 * Bentuk baris untuk klien.
 *
 * Hash-nya SENGAJA tidak ikut dikirim. MD5 dari kode pendek bisa dipecahkan
 * offline dalam hitungan detik, jadi mengirimnya ke browser sama saja
 * membagikan kodenya. Kode akses hanya bisa ditimpa, tidak bisa dibaca kembali.
 */
function keBarisKlien(row: {
  id: number;
  id_user: number;
  tanggal_mulai: Date;
  tanggal_selesai: Date;
}, namaUser?: string, username?: string) {
  return {
    id: row.id,
    id_user: row.id_user,
    nama_user: namaUser ?? null,
    username: username ?? null,
    tanggal_mulai: row.tanggal_mulai.toISOString().slice(0, 10),
    tanggal_selesai: row.tanggal_selesai.toISOString().slice(0, 10),
    status: statusKode(row.tanggal_mulai, row.tanggal_selesai),
  };
}

/** Validasi payload; null = lolos. */
function validasi(body: Record<string, unknown>, kodeWajib: boolean): string | null {
  const kode = String(body.kode ?? "");
  if (kodeWajib && !kode.trim()) return "Kode akses wajib diisi";
  if (kode.trim() && kode.trim().length < 4)
    return "Kode akses minimal 4 karakter";

  if (!body.id_user) return "User wajib dipilih";

  const mulai = String(body.tanggal_mulai ?? "");
  const selesai = String(body.tanggal_selesai ?? "");
  if (!mulai || !selesai) return "Tanggal mulai dan selesai wajib diisi";
  if (Number.isNaN(Date.parse(mulai)) || Number.isNaN(Date.parse(selesai)))
    return "Format tanggal tidak valid";
  if (Date.parse(selesai) < Date.parse(mulai))
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai";

  return null;
}

// GET /api/kode-akses — daftar kode akses (tanpa hash)
export async function GET() {
  try {
    const rows = await prisma.kodeAkses.findMany({ orderBy: { id: "asc" } });
    const users = await prisma.user.findMany({
      select: { id_user: true, nama: true, username: true },
    });
    const peta = new Map(users.map((u) => [u.id_user, u]));

    const data = rows.map((r) => {
      const u = peta.get(r.id_user);
      return keBarisKlien(r, u?.nama, u?.username);
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/kode-akses]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data kode akses" },
      { status: 500 }
    );
  }
}

// POST /api/kode-akses — tambah kode akses baru
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validasi(body, true);
    if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });

    const hash = hashKode(String(body.kode).trim());

    // Kode yang sama persis tidak boleh terdaftar dua kali — kalau tidak,
    // tidak jelas baris mana yang menentukan masa berlakunya.
    const bentrok = await prisma.kodeAkses.findFirst({ where: { kode_akses: hash } });
    if (bentrok) {
      return NextResponse.json(
        { success: false, error: "Kode akses ini sudah terdaftar" },
        { status: 409 }
      );
    }

    const created = await prisma.kodeAkses.create({
      data: {
        id_user: Number(body.id_user),
        kode_akses: hash,
        tanggal_mulai: new Date(String(body.tanggal_mulai)),
        tanggal_selesai: new Date(String(body.tanggal_selesai)),
      },
    });

    return NextResponse.json(
      { success: true, data: keBarisKlien(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/kode-akses]", error);
    return NextResponse.json(
      { success: false, error: "Gagal menambah kode akses" },
      { status: 500 }
    );
  }
}
