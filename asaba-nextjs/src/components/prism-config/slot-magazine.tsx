"use client";

import { cn } from "@/lib/utils";
import type { PrismaSlot } from "./types";

/**
 * Magasin 50 slot target milik RTS.
 *
 * Perangkatnya memang menyimpan target pada nomor 1–50, jadi bentuk ini bukan
 * hiasan: ia adalah isi memori instrumen apa adanya. Sebelumnya keadaan yang
 * sama hanya bisa dibaca dengan membolak-balik 5 halaman tabel yang sebagian
 * besar barisnya bertuliskan "Not Set", sehingga pertanyaan paling dasar —
 * slot mana yang masih kosong — justru paling sulit dijawab.
 *
 * Sepuluh kolom, bukan lebar penuh: satu baris = satu puluhan, jadi slot 37
 * dicari di baris keempat kolom ketujuh tanpa menghitung. Lebarnya dibatasi
 * supaya selnya tetap sebesar sasaran klik yang wajar, tidak melebar jadi
 * kotak-kotak raksasa di layar lebar.
 *
 * Mengklik sebuah sel memilih slot itu dan menggulirkan tabel di bawah ke
 * barisnya. Tindakannya sendiri (Isi slot/Ubah/Hapus) tetap tinggal di baris
 * tabel, supaya perilaku sel tidak berubah-ubah mengikuti keadaan kunci.
 */
export function SlotMagazine({
  slots,
  selected,
  onSelect,
}: {
  slots: PrismaSlot[];
  selected: number | null;
  onSelect: (slot: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Magasin slot target RTS"
      // Lebarnya ditentukan wadah di config-panel, bukan di sini: sel
      // aspect-square tidak punya lebar intrinsik, jadi di dalam flex ia
      // mengempis kalau wadahnya tidak memberi basis yang definit.
      className="grid w-full grid-cols-10 gap-1.5"
    >
      {slots.map((s) => {
        const aktif = s.slot === selected;
        const nama = s.registered ? s.nama_prisma.replace(/_/g, " ") : "kosong";
        return (
          <button
            key={s.slot}
            type="button"
            aria-pressed={aktif}
            onClick={() => onSelect(s.slot)}
            title={`Slot ${s.slot} · ${nama}`}
            className={cn(
              "flex aspect-square min-w-0 cursor-pointer items-center justify-center rounded-[6px] font-mono text-[11px] tabular-nums outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-(--navy)/50",
              s.registered
                ? "bg-(--navy) font-semibold text-white hover:bg-(--navy-deep)"
                : "bg-(--paper) text-(--ink-3) ring-1 ring-(--line) ring-inset hover:bg-white hover:text-(--ink-2)",
              aktif && "ring-2 ring-(--ink) ring-offset-2 ring-offset-white"
            )}
          >
            {s.slot}
          </button>
        );
      })}
    </div>
  );
}

/** Keterangan warna magasin — angka terisi/kosong sekaligus jadi legenda. */
export function MagazineLegend({ slots }: { slots: PrismaSlot[] }) {
  const terisi = slots.filter((s) => s.registered).length;
  const kosong = slots.length - terisi;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Keterangan magasin">
      <li className="inline-flex items-center gap-1.5 text-[11.5px] text-(--ink-2)">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-(--navy)" />
        Terisi
        <span className="font-mono tabular-nums text-(--ink-3)">{terisi}</span>
      </li>
      <li className="inline-flex items-center gap-1.5 text-[11.5px] text-(--ink-2)">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-[3px] bg-(--paper) ring-1 ring-(--line) ring-inset"
        />
        Kosong
        <span className="font-mono tabular-nums text-(--ink-3)">{kosong}</span>
      </li>
    </ul>
  );
}
