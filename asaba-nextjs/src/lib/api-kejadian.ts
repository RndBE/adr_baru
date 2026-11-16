/**
 * Bagian bersama route /api/kejadian-alarm/[id]/*: membaca id, memeriksa
 * kode akses, dan nama operator dari sesi.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifikasiKodeAkses } from "@/lib/kode-akses";

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

/** Nama operator untuk dicatat: nama akun, atau username bila nama kosong. */
export async function namaOperator(): Promise<string> {
  const sesi = await auth();
  const nama = sesi?.user?.name?.trim() || sesi?.user?.email?.trim() || "Operator";
  return nama.slice(0, 100);
}
