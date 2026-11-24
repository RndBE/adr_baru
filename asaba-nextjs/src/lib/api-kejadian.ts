/**
 * Bagian bersama route /api/kejadian-alarm/[id]/*: membaca id, memeriksa
 * kode akses, dan nama operator dari sesi.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifikasiKodeAkses } from "@/lib/kode-akses";
import { LEVEL_GEOTECH } from "@/lib/akses-level";

export function gagal(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export function bacaId(teks: string): number | null {
  const n = Number(teks);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Null bila kode sah; balasan galat bila tidak. */
export async function tolakKodeAkses(kode: unknown): Promise<NextResponse | null> {
  const hasil = await verifikasiKodeAkses(String(kode ?? ""));
  if (hasil.valid) return null;
  return gagal(hasil.alasan === "Kode akses wajib diisi" ? 400 : 403, hasil.alasan ?? "Kode akses salah");
}

/**
 * Kode akses untuk Konfirmasi/Verifikasi/Perbarui arah bidik. Akun geotech
 * tidak memakainya: login pribadinya sudah kredensial (akses-level.ts).
 */
export async function tolakAksesKejadian(kode: unknown): Promise<NextResponse | null> {
  const sesi = await auth();
  if ((sesi?.user as { role?: string } | undefined)?.role === LEVEL_GEOTECH) return null;
  return tolakKodeAkses(kode);
}

/** Nama operator untuk dicatat: nama akun, atau username bila nama kosong. */
export async function namaOperator(): Promise<string> {
  const sesi = await auth();
  const nama = sesi?.user?.name?.trim() || sesi?.user?.email?.trim() || "Operator";
  return nama.slice(0, 100);
}
