"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtJam, fmtTanggal } from "./format";
import type { LogKontrolRow } from "./derive";

/** Badge site — bentuknya sama dengan yang dikembalikan `useSites().badge`. */
export interface BadgeSite {
  label: string;
  color: string;
  nama: string;
  peringatan: string | null;
}

/**
 * Riwayat running, terbaru di atas.
 *
 * Baris kedua tiap item menampilkan hal yang BERBEDA antar baris, dan itu
 * tergantung halaman: bila daftarnya lintas site (Hasil Pengukuran) yang
 * membedakan adalah site-nya, sedangkan bila sudah tersaring satu site
 * (Dashboard) yang membedakan adalah berapa prisma yang berhasil diukur.
 * Karena itu `badge` dan angka prisma tidak pernah tampil bersamaan.
 */
export function SessionList({
  logs,
  activeLog,
  loading,
  onSelect,
  onOpen,
  badge,
}: {
  logs: LogKontrolRow[];
  activeLog: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  /** Bila diisi, tiap baris menampilkan site-nya, bukan jumlah prisma. */
  badge?: (slug: string | null | undefined) => BadgeSite;
}) {
  if (loading && logs.length === 0) {
    return (
      <div className="space-y-px px-5 py-2" aria-busy="true" aria-label="Memuat riwayat">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-3.5 w-24 rounded bg-(--paper)" />
            <div className="h-3.5 w-12 rounded bg-(--paper)" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-[13px] font-medium text-(--ink-2)">Belum ada running.</p>
        <p className="mt-1 text-[12px] text-(--ink-3)">
          Mulai pengukuran dari Kontrol ADR; sesi yang selesai akan tercatat di sini.
        </p>
      </div>
    );
  }

  return (
    <ul role="listbox" aria-label="Riwayat running" className="flex flex-col">
      {logs.map((log) => {
        const aktif = log.id_log === activeLog;
        const r0 = Number(log.r0) === 1;
        const b = badge?.(log.site);
        const total = log.prisma_count;
        const ok = log.success_count ?? 0;
        return (
          <li key={log.id_log}>
            <button
              type="button"
              role="option"
              aria-selected={aktif}
              onClick={() => onSelect(log.id_log)}
              onDoubleClick={onOpen ? () => onOpen(log.id_log) : undefined}
              title={
                onOpen
                  ? "Klik untuk pratinjau, klik dua kali untuk buka rinciannya"
                  : b?.peringatan ?? b?.nama
              }
              className={cn(
                "grid w-full cursor-pointer grid-cols-[3px_1fr_auto] items-stretch gap-x-3 border-b border-(--line) pr-4 text-left outline-none transition-colors hover:bg-(--paper) focus-visible:bg-(--paper)",
                aktif && "bg-(--paper)"
              )}
            >
              <span className={cn("rounded-r-full", aktif ? "bg-(--navy)" : "bg-transparent")} />
              <span className="min-w-0 self-center py-3">
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[13.5px] font-semibold",
                      aktif ? "text-(--ink)" : "text-(--ink-2)"
                    )}
                  >
                    {fmtTanggal(log.datetime)}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-(--ink-3)">
                    {fmtJam(log.datetime)}
                  </span>
                </span>
                {b ? (
                  <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-(--ink-3)">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: b.color }}
                    />
                    <span className="truncate">{b.nama}</span>
                    {b.peringatan && (
                      <AlertTriangle
                        className="size-3 shrink-0 text-amber-600"
                        aria-label="Data site ini belum bisa dipercaya"
                      />
                    )}
                  </span>
                ) : (
                  total !== undefined && (
                    <span className="mt-0.5 block text-[11.5px] text-(--ink-3)">
                      <span className="font-mono tabular-nums">
                        {ok}/{total}
                      </span>{" "}
                      prisma terukur
                    </span>
                  )
                )}
              </span>
              {r0 && (
                <span
                  className="self-center rounded-md bg-(--ink) px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white"
                  title="Sesi acuan (baseline R0)"
                >
                  R0
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
