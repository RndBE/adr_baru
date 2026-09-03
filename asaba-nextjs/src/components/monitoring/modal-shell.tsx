"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kerangka dialog halaman ini.
 *
 * Kelas `tema-monitoring` dipasang ulang di sini. Dialognya memang dirender di
 * dalam pohon halaman sehingga custom property-nya ikut terwaris, tapi
 * memasangnya eksplisit membuat komponen ini tetap benar kalau kelak dipindah
 * ke portal — kasus yang sudah pernah menggigit pada popover pemilih kolom.
 *
 * Tombol Esc ikut menutup dialog; sebelumnya hanya klik di luar yang bisa.
 */
export function ModalShell({
  judul,
  keterangan,
  ikon,
  lebar = "max-w-[420px]",
  onClose,
  bisaDitutup = true,
  children,
  footer,
}: {
  judul: string;
  keterangan?: ReactNode;
  ikon?: ReactNode;
  lebar?: string;
  onClose: () => void;
  /** False selama proses yang tidak boleh diputus di tengah jalan. */
  bisaDitutup?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!bisaDitutup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bisaDitutup, onClose]);

  return (
    <div
      className="tema-monitoring fixed inset-0 z-50 flex items-center justify-center bg-(--ink)/40 p-4 backdrop-blur-[3px]"
      onClick={() => bisaDitutup && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl ring-1 ring-(--line)",
          lebar
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            {ikon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-(--navy) text-white">
                {ikon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-[18px] font-bold tracking-[-0.01em] text-(--ink)">
                {judul}
              </h3>
              {keterangan && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-(--ink-2)">{keterangan}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!bisaDitutup}
            aria-label="Tutup"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-(--ink-3) outline-none transition-colors hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-(--line) px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pesan galat di dalam dialog. */
export function ModalError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-red-800"
    >
      {children}
    </div>
  );
}

export const TOMBOL_UTAMA =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-(--navy) px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-(--navy-deep) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:bg-(--ink-3)/40 disabled:text-white/70";

export const TOMBOL_SEKUNDER =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-white px-4 text-[13px] font-semibold text-(--ink-2) ring-1 ring-(--line) outline-none transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-50";

export const TOMBOL_BAHAYA =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-(--st-awas) px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:brightness-90 focus-visible:ring-2 focus-visible:ring-(--st-awas)/40 disabled:cursor-not-allowed disabled:opacity-50";

export const INPUT =
  "h-9 w-full rounded-[9px] border border-(--line) bg-white px-3 text-[13px] text-(--ink) outline-none transition-colors placeholder:text-(--ink-3) focus:border-(--navy) focus:ring-2 focus:ring-(--navy)/25";

export const LABEL = "mb-1.5 block text-[12px] font-semibold text-(--ink-2)";
