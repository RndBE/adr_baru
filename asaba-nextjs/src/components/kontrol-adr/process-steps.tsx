"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LangkahProses {
  label: string;
  aktif: boolean;
  selesai: boolean;
  /** Teks kanan menggantikan tanda selesai — mis. "8 OK / 2 gagal". */
  hasil?: string;
  /** Kemajuan sebagai "3/10", ditampilkan saat langkah ini berjalan. */
  kemajuan?: string;
}

/**
 * Empat tahap satu sesi AutoTracking, disimpulkan dari status kartu prisma.
 *
 * Sebelumnya dirender sebagai baris teks yang diisi titik-titik sampai lebar
 * tertentu (`".".repeat(35 - label.length)`) — jajaran titik itu ikut menjadi
 * konten, jadi ia terbaca oleh pembaca layar dan patah begitu labelnya berubah
 * panjang. Di sini urutannya dibawa oleh nomor langkah, dan jaraknya oleh tata
 * letak, bukan oleh karakter.
 *
 * Ini TURUNAN, bukan laporan alat. Angka yang dilaporkan firmware sendiri
 * (termasuk target yang belum menjawab) ada di panel AutoTracking terpisah.
 */
export function ProcessSteps({ langkah }: { langkah: LangkahProses[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {langkah.map((l, i) => (
        <li
          key={l.label}
          className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-[18px] items-center justify-center rounded-full font-mono text-[10px] font-semibold tabular-nums",
              l.selesai
                ? "bg-(--st-normal) text-white"
                : l.aktif
                  ? "bg-(--navy) text-white"
                  : "bg-(--paper) text-(--ink-3) ring-1 ring-(--line)"
            )}
          >
            {l.selesai ? <Check className="size-2.5" strokeWidth={3.5} /> : i + 1}
          </span>

          <span
            className={cn(
              "min-w-0 truncate text-[12.5px]",
              l.aktif ? "font-semibold text-(--ink)" : l.selesai ? "text-(--ink-2)" : "text-(--ink-3)"
            )}
          >
            {l.label}
          </span>

          <span className="shrink-0 text-right">
            {l.aktif ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-(--navy)">
                {l.kemajuan && (
                  <span className="font-mono tabular-nums">{l.kemajuan}</span>
                )}
                <Loader2 className="size-3.5 animate-spin" />
              </span>
            ) : l.hasil ? (
              <span className="text-[11.5px] font-semibold text-(--ink-2)">{l.hasil}</span>
            ) : l.selesai ? (
              <span className="text-[11.5px] font-medium text-(--ink-3)">selesai</span>
            ) : (
              <span className="text-[11.5px] text-(--ink-3)">—</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
