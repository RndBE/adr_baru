"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseArah } from "./format";
import type { PengukuranRow } from "./derive";
import { jumlahAktif, type ColumnVisibility, type SubKolom } from "./column-filter";

/**
 * Catatan mentah satu sesi, apa adanya seperti yang dikirim RTS.
 *
 * Satuannya METER dengan 4 desimal — sama dengan berkas Excel yang diunduh dari
 * halaman ini, karena keduanya adalah dokumen ukur yang sama. Nilai dalam
 * milimeter (yang dibandingkan dengan ambang bahaya) ada di tab Harian dan di
 * Dashboard. Karena itu setiap satuan DITULIS di kepala kolomnya: dua tampilan
 * dengan satuan berbeda tanpa label adalah cara termudah salah baca.
 */

/**
 * Tinggi baris kepala kelompok DAN offset sticky baris sub-kolom di bawahnya
 * harus selalu sama, kalau tidak baris kedua akan menempel terlalu tinggi
 * (menimpa baris pertama) atau menyisakan celah saat tabel digulir. Keduanya
 * karena itu memakai satu langkah skala yang sama: h-9 = top-9 = 36px.
 */
const TH_GRUP =
  "sticky top-0 z-20 h-9 border-b border-(--line) bg-white px-2.5 text-center align-middle font-display text-[11.5px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)";
const TH_SUB =
  "sticky top-9 z-20 border-b border-(--line) bg-white px-2.5 pt-1 pb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--ink-3)";
const TH_TUNGGAL =
  "sticky top-0 z-20 border-b border-(--line) bg-white px-2.5 py-3 align-middle font-display text-[11.5px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)";
const TD = "border-b border-(--line) px-2.5 py-3 text-right font-mono text-[12px] tabular-nums";
/** Garis pemisah antar blok kolom — menandai batas kelompok, bukan hiasan. */
const BATAS = "border-l border-(--line)";

const SUB_LABEL: Record<keyof SubKolom, { teks: string; satuan?: string }> = {
  X: { teks: "X", satuan: "m" },
  Y: { teks: "Y", satuan: "m" },
  Z: { teks: "Z", satuan: "m" },
  HA: { teks: "HA" },
  VA: { teks: "VA" },
  SD: { teks: "Slope dist.", satuan: "m" },
};

const URUT_SUB: (keyof SubKolom)[] = ["X", "Y", "Z", "HA", "VA", "SD"];

/** 4 desimal; "—" bila kosong atau bukan angka. */
function fval(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(4);
}

/** Nilai sudut/teks dari perangkat — dibiarkan apa adanya. */
function fteks(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function Satuan({ children }: { children: string }) {
  return <span className="ml-1 font-normal normal-case tracking-normal">{children}</span>;
}

export function EventTable({
  rows,
  colVis,
  loading,
  belumAdaSesi,
  redup,
  onBukaPrisma,
}: {
  rows: PengukuranRow[];
  colVis: ColumnVisibility;
  loading: boolean;
  belumAdaSesi: boolean;
  /** Menahan data sesi sebelumnya sementara yang baru dimuat. */
  redup: boolean;
  onBukaPrisma: (nama: string) => void;
}) {
  const nAwal = jumlahAktif(colVis.awal);
  const nHasil = jumlahAktif(colVis.hasil);
  const nGeser = jumlahAktif(colVis.pergeseran);
  const totalKolom = 2 + nAwal + nHasil + nGeser + (colVis.arah ? 1 : 0);

  const subAwal = URUT_SUB.filter((c) => colVis.awal[c]);
  const subHasil = URUT_SUB.filter((c) => colVis.hasil[c]);

  return (
    <div
      className={cn(
        "relative flex-1 overflow-auto transition-opacity duration-300",
        redup && "opacity-50"
      )}
    >
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(TH_TUNGGAL, "pl-5 text-left")}>
              Prisma
            </th>
            {nAwal > 0 && (
              <th scope="colgroup" colSpan={nAwal} className={cn(TH_GRUP, BATAS)}>
                Awal pengukuran
              </th>
            )}
            {nHasil > 0 && (
              <th scope="colgroup" colSpan={nHasil} className={cn(TH_GRUP, BATAS)}>
                Hasil pengukuran
              </th>
            )}
            {nGeser > 0 && (
              <th scope="colgroup" colSpan={nGeser} className={cn(TH_GRUP, BATAS)}>
                Pergeseran
              </th>
            )}
            {colVis.arah && (
              <th
                scope="col"
                rowSpan={2}
                className={cn(TH_TUNGGAL, BATAS, "pr-5 text-left")}
              >
                Arah
              </th>
            )}
          </tr>
          <tr>
            {subAwal.map((c, i) => (
              <th
                key={`ha-${c}`}
                scope="col"
                className={cn(TH_SUB, "text-right", i === 0 && BATAS)}
              >
                {SUB_LABEL[c].teks}
                {SUB_LABEL[c].satuan && <Satuan>{SUB_LABEL[c].satuan!}</Satuan>}
              </th>
            ))}
            {subHasil.map((c, i) => (
              <th
                key={`hh-${c}`}
                scope="col"
                className={cn(TH_SUB, "text-right", i === 0 && BATAS)}
              >
                {SUB_LABEL[c].teks}
                {SUB_LABEL[c].satuan && <Satuan>{SUB_LABEL[c].satuan!}</Satuan>}
              </th>
            ))}
            {colVis.pergeseran.DX && (
              <th scope="col" className={cn(TH_SUB, "text-right", BATAS)}>
                ΔX<Satuan>m</Satuan>
              </th>
            )}
            {colVis.pergeseran.DY && (
              <th scope="col" className={cn(TH_SUB, "text-right")}>
                ΔY<Satuan>m</Satuan>
              </th>
            )}
            {colVis.pergeseran.DZ && (
              <th scope="col" className={cn(TH_SUB, "text-right")}>
                ΔZ<Satuan>m</Satuan>
              </th>
            )}
            {colVis.pergeseran.Linier && (
              <th scope="col" className={cn(TH_SUB, "text-right")} title="Resultan 3D">
                Linier<Satuan>m</Satuan>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={totalKolom} className="h-64 text-center">
                <Loader2
                  className="mx-auto size-5 animate-spin text-(--navy)"
                  aria-label="Memuat catatan pengukuran"
                />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalKolom}
                className="h-64 px-6 text-center text-[13px] text-(--ink-3)"
              >
                {belumAdaSesi
                  ? "Pilih tanggal running di sebelah kiri."
                  : "Running ini tidak punya pembacaan yang bisa dibandingkan dengan acuan R0."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const t = row.temp_tembak ?? {};
              const nama = row.nama_prisma || "";
              const arah = parseArah(t.arah_pergeseran);
              return (
                <tr key={String(row.id_prisma)} className="transition-colors hover:bg-(--paper)">
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

                  {subAwal.map((c, i) => (
                    <td
                      key={`da-${c}`}
                      className={cn(TD, "text-(--ink-2)", i === 0 && BATAS)}
                    >
                      {c === "X"
                        ? fval(t.E0)
                        : c === "Y"
                          ? fval(t.N0)
                          : c === "Z"
                            ? fval(t.Z0)
                            : c === "HA"
                              ? fteks(t.HA0)
                              : c === "VA"
                                ? fteks(t.VA0)
                                : fteks(t.SD0)}
                    </td>
                  ))}

                  {subHasil.map((c, i) => (
                    <td key={`dh-${c}`} className={cn(TD, "text-(--ink)", i === 0 && BATAS)}>
                      {c === "X"
                        ? fval(t.E1)
                        : c === "Y"
                          ? fval(t.N1)
                          : c === "Z"
                            ? fval(t.Z1)
                            : c === "HA"
                              ? fteks(t.HA1)
                              : c === "VA"
                                ? fteks(t.VA1)
                                : fteks(t.SD1)}
                    </td>
                  ))}

                  {/* Selisih tidak diwarnai merah/hijau: tanda + dan − di sini
                      berarti arah mata angin, bukan baik atau buruk. */}
                  {colVis.pergeseran.DX && (
                    <td className={cn(TD, "text-(--ink)", BATAS)}>{fval(t.DE)}</td>
                  )}
                  {colVis.pergeseran.DY && <td className={cn(TD, "text-(--ink)")}>{fval(t.DN)}</td>}
                  {colVis.pergeseran.DZ && <td className={cn(TD, "text-(--ink)")}>{fval(t.DZ)}</td>}
                  {colVis.pergeseran.Linier && (
                    <td className={cn(TD, "font-semibold text-(--ink)")}>{fval(t.linear)}</td>
                  )}

                  {colVis.arah && (
                    <td
                      className={cn(
                        "border-b border-(--line) px-2.5 py-3 pr-5 text-[12.5px] whitespace-nowrap text-(--ink-2)",
                        BATAS
                      )}
                    >
                      {arah ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="7"
                              fill="none"
                              stroke="currentColor"
                              strokeOpacity="0.25"
                            />
                            <path
                              d="M8 2.6 L10.6 9.4 L8 8.1 L5.4 9.4 Z"
                              fill="currentColor"
                              transform={`rotate(${arah.bearing} 8 8)`}
                            />
                          </svg>
                          <span className="font-mono tabular-nums">
                            {arah.bearing.toFixed(1)}°
                          </span>
                          {arah.teks && <span>{arah.teks}</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
