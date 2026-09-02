"use client";

import { useState } from "react";
import { Check, Columns3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SubKolom {
  X: boolean;
  Y: boolean;
  Z: boolean;
  HA: boolean;
  VA: boolean;
  SD: boolean;
}

export interface KolomPergeseran {
  DX: boolean;
  DY: boolean;
  DZ: boolean;
  Linier: boolean;
}

export interface ColumnVisibility {
  awal: SubKolom;
  hasil: SubKolom;
  pergeseran: KolomPergeseran;
  arah: boolean;
}

export const KOLOM_LENGKAP: ColumnVisibility = {
  awal: { X: true, Y: true, Z: true, HA: true, VA: true, SD: true },
  hasil: { X: true, Y: true, Z: true, HA: true, VA: true, SD: true },
  pergeseran: { DX: true, DY: true, DZ: true, Linier: true },
  arah: true,
};

const NAMA_SUB: Record<keyof SubKolom, string> = {
  X: "X (easting)",
  Y: "Y (northing)",
  Z: "Z (elevasi)",
  HA: "HA — sudut horizontal",
  VA: "VA — sudut vertikal",
  SD: "Slope distance",
};

const NAMA_GESER: Record<keyof KolomPergeseran, string> = {
  DX: "ΔX",
  DY: "ΔY",
  DZ: "ΔZ",
  Linier: "Linier (resultan 3D)",
};

const salin = (v: ColumnVisibility): ColumnVisibility => ({
  awal: { ...v.awal },
  hasil: { ...v.hasil },
  pergeseran: { ...v.pergeseran },
  arah: v.arah,
});

export function jumlahAktif(g: SubKolom | KolomPergeseran): number {
  return Object.values(g).filter(Boolean).length;
}

/** Jumlah seluruh kolom opsional yang sedang tampil. */
export function totalAktif(v: ColumnVisibility): number {
  return jumlahAktif(v.awal) + jumlahAktif(v.hasil) + jumlahAktif(v.pergeseran) + (v.arah ? 1 : 0);
}

const TOTAL_KOLOM = 17;

function Kotak({ state }: { state: boolean | "sebagian" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        state === false
          ? "border-(--ink-3)/50 bg-white"
          : "border-(--navy) bg-(--navy)"
      )}
    >
      {state === true && <Check className="size-3 text-white" strokeWidth={3.5} />}
      {state === "sebagian" && <span className="h-[2px] w-2.5 rounded-full bg-white" />}
    </span>
  );
}

function Baris({
  label,
  state,
  onToggle,
  kelompok,
}: {
  label: string;
  state: boolean | "sebagian";
  onToggle: () => void;
  kelompok?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "sebagian" ? "mixed" : state}
      onClick={onToggle}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-(--paper) focus-visible:bg-(--paper)",
        kelompok
          ? "font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)"
          : "text-[12.5px] text-(--ink)"
      )}
    >
      <Kotak state={state} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/**
 * Pemilih kolom tabel Event.
 *
 * Semua kelompok tampil sekaligus, bukan di balik tab seperti sebelumnya —
 * seluruh daftar hanya 17 baris, jadi memecahnya jadi dua panel dengan tab
 * membuat operator harus mengklik untuk melihat apa yang sedang aktif.
 *
 * Perubahan ditahan sebagai draf sampai Terapkan ditekan: tabel ini punya
 * belasan kolom, dan menyusunnya ulang pada setiap klik centang bikin
 * tampilannya melompat-lompat.
 */
export function ColumnFilter({
  value,
  onChange,
}: {
  value: ColumnVisibility;
  onChange: (v: ColumnVisibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnVisibility>(value);

  const bukaTutup = (o: boolean) => {
    if (o) setDraft(salin(value));
    setOpen(o);
  };

  const stateKelompok = (g: SubKolom | KolomPergeseran): boolean | "sebagian" => {
    const n = jumlahAktif(g);
    if (n === 0) return false;
    return n === Object.keys(g).length ? true : "sebagian";
  };

  const setKelompok = (k: "awal" | "hasil", on: boolean) =>
    setDraft((p) => ({ ...p, [k]: { X: on, Y: on, Z: on, HA: on, VA: on, SD: on } }));

  const setSub = (k: "awal" | "hasil", col: keyof SubKolom, on: boolean) =>
    setDraft((p) => ({ ...p, [k]: { ...p[k], [col]: on } }));

  const aktif = totalAktif(value);

  return (
    <Popover open={open} onOpenChange={bukaTutup}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] bg-white px-3 text-[13px] font-semibold text-(--ink-2) ring-1 ring-(--line) outline-none transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
        )}
        title="Pilih kolom yang ditampilkan"
      >
        <Columns3 className="size-4" />
        Kolom
        {aktif < TOTAL_KOLOM && (
          <span className="rounded-full bg-(--navy) px-1.5 font-mono text-[10.5px] font-semibold text-white">
            {aktif}
          </span>
        )}
      </PopoverTrigger>
      {/* `tema-monitoring` WAJIB ada di sini: PopoverContent dirender lewat
          portal di <body>, di luar root halaman — tanpa kelas ini token
          --navy/--ink/--paper/--line tidak ter-resolve dan kotak centangnya
          tampil kosong meski kolomnya aktif. */}
      <PopoverContent
        align="start"
        className="tema-monitoring w-[268px] max-h-(--available-height) gap-0 overflow-hidden rounded-[14px] bg-white p-0 ring-1 ring-(--line)"
      >
        {/* Tinggi dibatasi --available-height dari Positioner base-ui, bukan
            angka tetap: di layar 768px daftar 17 kolom ini tidak muat ke atas
            maupun ke bawah dari tombolnya, jadi kalau tingginya dipatok ia akan
            terpotong tepi layar. Dengan ini daftarnya menggulir di dalam
            popover dan footernya selalu terlihat. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Baris
            label="Awal pengukuran"
            kelompok
            state={stateKelompok(draft.awal)}
            onToggle={() => setKelompok("awal", stateKelompok(draft.awal) !== true)}
          />
          <div className="mb-1.5 pl-4">
            {(Object.keys(NAMA_SUB) as (keyof SubKolom)[]).map((c) => (
              <Baris
                key={`awal-${c}`}
                label={NAMA_SUB[c]}
                state={draft.awal[c]}
                onToggle={() => setSub("awal", c, !draft.awal[c])}
              />
            ))}
          </div>

          <Baris
            label="Hasil pengukuran"
            kelompok
            state={stateKelompok(draft.hasil)}
            onToggle={() => setKelompok("hasil", stateKelompok(draft.hasil) !== true)}
          />
          <div className="mb-1.5 pl-4">
            {(Object.keys(NAMA_SUB) as (keyof SubKolom)[]).map((c) => (
              <Baris
                key={`hasil-${c}`}
                label={NAMA_SUB[c]}
                state={draft.hasil[c]}
                onToggle={() => setSub("hasil", c, !draft.hasil[c])}
              />
            ))}
          </div>

          <Baris
            label="Pergeseran"
            kelompok
            state={stateKelompok(draft.pergeseran)}
            onToggle={() => {
              const on = stateKelompok(draft.pergeseran) !== true;
              setDraft((p) => ({
                ...p,
                pergeseran: { DX: on, DY: on, DZ: on, Linier: on },
              }));
            }}
          />
          <div className="mb-1.5 pl-4">
            {(Object.keys(NAMA_GESER) as (keyof KolomPergeseran)[]).map((c) => (
              <Baris
                key={`geser-${c}`}
                label={NAMA_GESER[c]}
                state={draft.pergeseran[c]}
                onToggle={() =>
                  setDraft((p) => ({
                    ...p,
                    pergeseran: { ...p.pergeseran, [c]: !p.pergeseran[c] },
                  }))
                }
              />
            ))}
          </div>

          <Baris
            label="Arah pergeseran"
            kelompok
            state={draft.arah}
            onToggle={() => setDraft((p) => ({ ...p, arah: !p.arah }))}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-(--line) px-3 py-2.5">
          <button
            type="button"
            onClick={() => setDraft(salin(KOLOM_LENGKAP))}
            className="cursor-pointer rounded-md text-[12.5px] font-medium text-(--ink-3) outline-none hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
          >
            Tampilkan semua
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 cursor-pointer rounded-[8px] px-3 text-[12.5px] font-semibold text-(--ink-2) outline-none transition-colors hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(salin(draft));
                setOpen(false);
              }}
              className="h-8 cursor-pointer rounded-[8px] bg-(--navy) px-3 text-[12.5px] font-semibold text-white outline-none transition-colors hover:bg-(--navy-deep) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
            >
              Terapkan
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
