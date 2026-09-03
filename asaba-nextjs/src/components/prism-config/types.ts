/** Satu slot target di RTS. Selalu ada 50, terisi maupun tidak. */
export interface PrismaSlot {
  /** Nomor slot pada perangkat, 1–50. */
  slot: number;
  id?: number;
  /** "P1".."P50" — penamaan slot di database, bukan identitas prisma global. */
  id_prisma: string;
  id_logger?: string;
  nama_prisma: string;
  status_controller?: string;
  target_height: string | number;
  /** Sudut horizontal hasil pembelajaran, format derajat,menit,detik. */
  HA: string;
  /** Sudut vertikal, format sama dengan HA. */
  VA: string;
  SlopDis?: string;
  registered: boolean;
}

export interface PrismConfigResponse {
  success: boolean;
  data: PrismaSlot[];
  id_logger?: string;
  error?: string;
}

/** Slot kosong mengisi kolomnya dengan "Not Set" dari server, bukan null. */
export const KOSONG = "Not Set";

/** Nilai yang benar-benar ada isinya; "Not Set" dan kosong dianggap tidak ada. */
export function nilaiAda(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s !== KOSONG && s !== "-";
}

/** Tampilkan nilai slot, atau em-dash bila belum ada. */
export function tampil(v: unknown): string {
  return nilaiAda(v) ? String(v) : "—";
}
