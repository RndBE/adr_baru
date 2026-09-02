"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, parseNum } from "./format";
import { StatusDot } from "./panel";
import { Sparkline } from "./sparkline";
import { asStatusLabel } from "./status";
import type { PengukuranRow } from "./derive";

/**
 * Angka harian per prisma: pergeseran terhadap acuan R0 pada pembacaan terakhir
 * hari itu, dan laju perubahannya sepanjang hari.
 *
 * Berbeda dari tab Event, yang membaca satu sesi saja. Nilainya sudah dalam
 * MILIMETER dari server — satuan yang sama dengan ambang bahaya, jadi statusnya
 * bisa langsung dibandingkan.
 */

const TH =
  "sticky top-0 z-10 border-b border-(--line) bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)";
const TD_ANGKA =
  "border-b border-(--line) px-3 py-3 text-right font-mono text-[12.5px] tabular-nums text-(--ink)";

/** "10:11:32" dari timestamp; "—" bila kosong. */
function fmtJamDetik(w: string | null | undefined): string {
  if (!w) return "—";
  const d = new Date(w);
  if (isNaN(d.getTime())) return "—";
  return d.toTimeString().slice(0, 8);
}

export function DailyTable({
  rows,
  loading,
  belumAdaSesi,
  redup,
  onBukaPrisma,
}: {
  rows: PengukuranRow[];
  loading: boolean;
  belumAdaSesi: boolean;
  redup: boolean;
  onBukaPrisma: (nama: string) => void;
}) {
  const kolom = 7;
  return (
    <div
      className={cn(
        "relative flex-1 overflow-auto transition-opacity duration-300",
        redup && "opacity-50"
      )}
    >
      {/* min-w 760px: pas tanpa gulir mendatar di 1366px (kolom kontennya 812px),
          dan tetap memaksa gulir di layar lebih sempit alih-alih menghimpit kolom. */}
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>
              Prisma
            </th>
            <th
              scope="col"
              className={cn(TH, "text-right")}
              title="Jarak dari acuan R0 pada pembacaan terakhir hari ini"
            >
              Pergeseran <span className="font-normal normal-case tracking-normal">mm</span>
            </th>
            <th scope="col" className={TH}>
              Status
            </th>
            <th
              scope="col"
              className={cn(TH, "text-right")}
              title="Selisih pergeseran antara pembacaan pertama dan terakhir hari ini"
            >
              Kecepatan <span className="font-normal normal-case tracking-normal">mm/hari</span>
            </th>
            <th scope="col" className={TH}>
              Status laju
            </th>
            <th scope="col" className={cn(TH, "text-center")}>
              Sepanjang hari
            </th>
            <th scope="col" className={cn(TH, "pr-5 text-right")}>
              Pembacaan
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={kolom} className="h-64 text-center">
                <Loader2
                  className="mx-auto size-5 animate-spin text-(--navy)"
                  aria-label="Memuat angka harian"
                />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={kolom} className="h-64 px-6 text-center text-[13px] text-(--ink-3)">
                {belumAdaSesi
                  ? "Pilih tanggal running di sebelah kiri."
                  : "Running ini tidak punya pembacaan yang bisa dibandingkan dengan acuan R0."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const d = row.daily;
              const ada = (d?.count ?? 0) > 0;
              const geser = parseNum(d?.pergeseran_mm);
              const laju = parseNum(d?.kecepatan_mmd);
              const stGeser = asStatusLabel(d?.status_pergeseran?.label);
              const stLaju = asStatusLabel(d?.status_kecepatan?.label);
              const nama = row.nama_prisma || "";
              const seri = d?.series ?? [];

              return (
                <tr
                  key={`${row.id_prisma}-harian`}
                  className="transition-colors hover:bg-(--paper)"
                >
                  <td className="border-b border-(--line) py-3 pr-3 pl-5 whitespace-nowrap">
                    {nama ? (
                      <button
                        type="button"
                        onClick={() => onBukaPrisma(nama)}
                        className="cursor-pointer rounded text-[13px] font-semibold text-(--navy) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/40"
                        title={`Buka riwayat ${nama.replace(/_/g, " ")}`}
                      >
                        {nama.replace(/_/g, " ")}
                      </button>
                    ) : (
                      <span className="text-[13px] text-(--ink-3)">—</span>
                    )}
                    <div className="font-mono text-[10.5px] text-(--ink-3)">{row.id_prisma}</div>
                  </td>
                  <td className={cn(TD_ANGKA, "font-semibold")}>
                    {ada ? fmt(geser) : "—"}
                  </td>
                  <td className="border-b border-(--line) px-3 py-3">
                    {ada && stGeser ? (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-(--ink)">
                        <StatusDot status={stGeser} />
                        {stGeser}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-(--ink-3)">—</span>
                    )}
                  </td>
                  <td className={TD_ANGKA}>{ada ? fmt(laju) : "—"}</td>
                  <td className="border-b border-(--line) px-3 py-3">
                    {ada && stLaju ? (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-(--ink)">
                        <StatusDot status={stLaju} />
                        {stLaju}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-(--ink-3)">—</span>
                    )}
                  </td>
                  <td className="border-b border-(--line) px-3 py-2">
                    <div className="flex justify-center">
                      <Sparkline data={seri} status={stGeser} />
                    </div>
                  </td>
                  <td className="border-b border-(--line) px-3 py-3 pr-5 text-right whitespace-nowrap">
                    {ada ? (
                      <>
                        <div className="font-mono text-[12px] tabular-nums text-(--ink)">
                          {fmtJamDetik(d?.first_time)} – {fmtJamDetik(d?.last_time)}
                        </div>
                        <div className="text-[10.5px] text-(--ink-3)">
                          {d?.count} pembacaan
                        </div>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-(--ink-3)">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
