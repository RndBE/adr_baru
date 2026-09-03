"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { nilaiPrisma, RUPA_STATUS, type PrismaCard } from "./prisma";

/**
 * Hasil tembakan per prisma pada sesi yang sedang/baru berjalan.
 *
 * Satu kartu per prisma, bukan baris tabel: nilainya cuma tiga (Y, X, Z) dan
 * yang paling sering dicari operator adalah statusnya, bukan perbandingan
 * angka antar prisma. Kartu membuat status jadi yang pertama terbaca.
 *
 * Koordinat memakai label Y/X/Z sesuai penamaan di seluruh halaman ini
 * (Y = northing, X = easting) — sengaja tidak diseragamkan ke urutan X/Y/Z
 * karena laporan dan menu instrumennya sendiri memakai urutan ini.
 */
export function PrismaGrid({
  cards,
  loading,
  adaSite,
}: {
  cards: PrismaCard[];
  loading: boolean;
  adaSite: boolean;
}) {
  if (loading) {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3.5"
        aria-busy="true"
        aria-label="Memuat data prisma"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-[12px] bg-(--paper) p-3.5">
            <div className="h-4 w-20 rounded bg-white" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded bg-white" />
              <div className="h-3 w-full rounded bg-white" />
              <div className="h-3 w-2/3 rounded bg-white" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!adaSite) {
    return (
      <p className="py-14 text-center text-[13px] text-(--ink-3)">
        Pilih site pengukuran untuk melihat daftar prisma.
      </p>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-[13px] font-medium text-(--ink-2)">
          Belum ada prisma terdaftar untuk site ini.
        </p>
        <p className="mt-1 text-[12px] text-(--ink-3)">
          Daftarkan slot targetnya lebih dulu di Prism Config.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3.5">
      {cards.map((p) => {
        const rupa = RUPA_STATUS[p.status];
        const mengukur = p.status === "Running...";
        return (
          <li
            key={p.name}
            className="min-w-0 rounded-[12px] bg-white ring-1 ring-(--line)"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2.5">
              <span className="truncate text-[13.5px] font-semibold text-(--ink)">
                {p.name}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold",
                  mengukur ? "text-(--navy)" : "text-(--ink-2)"
                )}
              >
                {mengukur ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: rupa.warna }}
                  />
                )}
                {rupa.label}
              </span>
            </div>

            <dl className="border-t border-(--line)">
              {(
                [
                  ["Y", p.y],
                  ["X", p.x],
                  ["Z", p.z],
                ] as const
              ).map(([label, nilai], i) => (
                <div
                  key={label}
                  className={cn(
                    "grid grid-cols-[22px_minmax(0,1fr)] items-baseline gap-2 px-3.5 py-2",
                    i > 0 && "border-t border-(--line)"
                  )}
                >
                  <dt className="font-mono text-[11px] font-semibold text-(--ink-3)">
                    {label}
                  </dt>
                  <dd className="truncate text-right font-mono text-[12px] tabular-nums text-(--ink)">
                    {mengukur ? (
                      <span className="text-(--ink-3)">mengukur…</span>
                    ) : (
                      nilaiPrisma(p.status, nilai)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
