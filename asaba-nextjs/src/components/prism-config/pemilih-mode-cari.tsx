"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INFO_MODE_CARI,
  KODE_MODE_CARI,
  labelModeCari,
  type KodeModeCari,
} from "@/lib/protokol-rts";

const IKON =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-(--ink-3) outline-none transition-colors hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * Pemilih RANTAI cara cari prisma di AutoTracking.
 *
 * Rantai dicoba dari atas ke bawah: AutoSearch → Custom berarti AutoSearch
 * dulu, dan hanya kalau gagal, firmware kembali ke sudut acuan lalu menyapu
 * custom. Urutan karena itu bagian dari artinya, bukan hiasan — makanya ada
 * tombol naik/turun, bukan sekadar kotak centang.
 *
 * Minimal satu cara selalu tersisa: rantai kosong bukan keadaan yang bisa
 * dikirim (firmware menganggapnya "as"), dan membiarkannya terjadi di layar
 * hanya membuat operator mengira slotnya tidak punya cara cari.
 */
export function PemilihModeCari({
  nilai,
  onChange,
  disabled,
}: {
  nilai: KodeModeCari[];
  onChange: (rantai: KodeModeCari[]) => void;
  disabled?: boolean;
}) {
  // Jumlah kode (tiga) sama dengan batas rantai, jadi "penuh" dan "tak ada sisa"
  // adalah keadaan yang sama — tidak perlu penjaga terpisah.
  const sisa = KODE_MODE_CARI.filter((k) => !nilai.includes(k));

  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= nilai.length) return;
    const baru = [...nilai];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    onChange(baru);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-1.5" aria-label="Urutan cara cari">
        {nilai.map((kode, i) => (
          <li
            key={kode}
            className="flex items-center gap-2.5 rounded-[9px] bg-white px-2.5 py-1.5 ring-1 ring-(--line)"
          >
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--navy) font-mono text-[11px] font-semibold text-white"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-(--ink)">{INFO_MODE_CARI[kode].nama}</span>
              <span className="block text-[11px] text-(--ink-3)">{INFO_MODE_CARI[kode].keterangan}</span>
            </span>
            <button
              type="button"
              onClick={() => geser(i, -1)}
              disabled={disabled || i === 0}
              aria-label={`Naikkan ${INFO_MODE_CARI[kode].nama}`}
              className={IKON}
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => geser(i, 1)}
              disabled={disabled || i === nilai.length - 1}
              aria-label={`Turunkan ${INFO_MODE_CARI[kode].nama}`}
              className={IKON}
            >
              <ArrowDown className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(nilai.filter((k) => k !== kode))}
              disabled={disabled || nilai.length <= 1}
              aria-label={`Buang ${INFO_MODE_CARI[kode].nama}`}
              title={nilai.length <= 1 ? "Minimal satu cara" : undefined}
              className={IKON}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ol>

      {sisa.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-(--ink-3)">Tambah cadangan:</span>
          {sisa.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange([...nilai, k])}
                disabled={disabled}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-[8px] bg-white px-2.5 text-[12px] font-semibold text-(--ink-2) ring-1 ring-(--line) outline-none transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Plus className="size-3.5" />
                {INFO_MODE_CARI[k].nama}
              </button>
            ))}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-(--ink-3)">
        Dicoba berurutan: <span className="font-semibold text-(--ink-2)">{labelModeCari(nilai)}</span>
        {nilai.length > 1 ? ". Cara berikutnya hanya dipakai bila yang sebelumnya gagal." : "."}
        {nilai.includes("ac") && (
          <>
            {" "}
            Custom memakai setelan sapuan yang berlaku di instrumen — belum ada setelan per target.
          </>
        )}
      </p>
    </div>
  );
}
