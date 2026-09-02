"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, fmtSelisih } from "./format";
import { StatusDot } from "./panel";
import type { PrismaRingkas } from "./derive";

/** Panah kecil yang menunjuk ke arah bearing (0° = utara, searah jarum jam). */
function ArahGlyph({ bearing }: { bearing: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-(--ink-2)">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M8 2.6 L10.6 9.4 L8 8.1 L5.4 9.4 Z" fill="currentColor" transform={`rotate(${bearing} 8 8)`} />
    </svg>
  );
}

const TH =
  "sticky top-0 z-10 border-b border-(--line) bg-white px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)";
const TD_ANGKA =
  "border-b border-(--line) px-2.5 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-(--ink)";
// Resultan 3D disembunyikan hanya di layar sempit, tempat tabel sudah harus
// digulir mendatar. Dari `xl` ke atas kolomnya muat, jadi ikut tampil.
const LEBAR_SAJA = "hidden xl:table-cell";

/**
 * Hasil satu running per prisma. Semua jarak dalam mm — satuan yang sama dengan
 * ambang bahaya, jadi angkanya bisa langsung dibandingkan dengan status.
 */
export function SessionTable({
  prisma,
  loading,
  kosong,
  redup,
}: {
  prisma: PrismaRingkas[];
  loading: boolean;
  kosong: boolean;
  /** Menampilkan data sesi sebelumnya sementara yang baru dimuat. */
  redup: boolean;
}) {
  const kolom = 8;
  return (
    <div
      className={cn(
        "relative flex-1 overflow-auto transition-opacity duration-300",
        redup && "opacity-50"
      )}
    >
      <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>
              Prisma
            </th>
            <th scope="col" className={cn(TH, "text-right")} title="Selisih ke arah timur terhadap acuan R0">
              ΔX <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={cn(TH, "text-right")} title="Selisih ke arah utara terhadap acuan R0">
              ΔY <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={cn(TH, "text-right")} title="Selisih elevasi terhadap acuan R0">
              ΔZ <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={cn(TH, LEBAR_SAJA, "text-right")} title="Resultan 3D dari ΔX, ΔY, ΔZ">
              Linier <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={TH}>
              Arah
            </th>
            <th
              scope="col"
              className={cn(TH, "text-right")}
              title="Pergeseran horizontal 2D — dasar penentuan status"
            >
              Pergeseran <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={cn(TH, "pr-5")}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && prisma.length === 0 ? (
            <tr>
              <td colSpan={kolom} className="h-56 text-center">
                <Loader2 className="mx-auto size-5 animate-spin text-(--navy)" aria-label="Memuat hasil" />
              </td>
            </tr>
          ) : prisma.length === 0 ? (
            <tr>
              <td colSpan={kolom} className="h-56 px-6 text-center text-[13px] text-(--ink-3)">
                {kosong
                  ? "Belum ada running untuk site ini."
                  : "Tidak ada prisma yang terukur pada running ini — periksa rinciannya di Hasil Pengukuran."}
              </td>
            </tr>
          ) : (
            prisma.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-(--paper)">
                <td className="border-b border-(--line) py-2.5 pl-5 pr-3 whitespace-nowrap">
                  <div className="text-[13px] font-semibold text-(--ink)">{p.nama.replace(/_/g, " ")}</div>
                  <div className="font-mono text-[10.5px] text-(--ink-3)">{p.id}</div>
                </td>
                <td className={TD_ANGKA}>{fmtSelisih(p.dxMm)}</td>
                <td className={TD_ANGKA}>{fmtSelisih(p.dyMm)}</td>
                <td className={TD_ANGKA}>{fmtSelisih(p.dzMm)}</td>
                <td className={cn(TD_ANGKA, LEBAR_SAJA)}>{fmt(p.linierMm)}</td>
                <td className="border-b border-(--line) px-2.5 py-2.5 whitespace-nowrap">
                  {p.bearing !== null ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-(--ink-2)">
                      <ArahGlyph bearing={p.bearing} />
                      <span className="font-mono tabular-nums">{fmt(p.bearing, 1)}°</span>
                      {p.arahTeks && <span>{p.arahTeks}</span>}
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-(--ink-3)">—</span>
                  )}
                </td>
                <td className={cn(TD_ANGKA, "font-semibold")}>{fmt(p.geserMm)}</td>
                <td className="border-b border-(--line) py-2.5 pl-3 pr-5">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-(--ink)">
                    <StatusDot status={p.status} />
                    {p.status ?? "—"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
