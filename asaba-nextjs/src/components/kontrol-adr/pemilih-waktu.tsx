"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Pemilih jam dan menit untuk Jadwal running: dua kolom yang digulir.
 *
 * Dipasang DI BAWAH baris jadwalnya, bukan melayang. Versi melayang
 * (`absolute`) terpotong area gulir modal — di layar laptop hanya empat baris
 * pertama yang terlihat, sisanya tertutup footer.
 *
 * Saat dibuka, tiap kolom digulir sampai nilai tersimpan berada di tengah.
 * Versi sebelumnya mencari kelas `time-active-hour`/`time-active-minute`
 * yang terhapus saat redesign 3 Sep 2026, jadi pemilihnya selalu terbuka di
 * 00 dan operator harus menggulir sendiri ke, misalnya, 20:25. Kolomnya
 * digulir lewat `scrollTop`, bukan `scrollIntoView`: yang terakhir ikut
 * menggulir modal dan halaman di belakangnya.
 */

const JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MENIT = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function pisahWaktu(nilai: string | null | undefined): [string, string] {
  const [j, m] = (nilai ?? "").split(":");
  const jam = JAM.includes((j ?? "").padStart(2, "0")) ? (j ?? "").padStart(2, "0") : "00";
  const menit = MENIT.includes((m ?? "").padStart(2, "0")) ? (m ?? "").padStart(2, "0") : "00";
  return [jam, menit];
}

function tengahkan(kolom: HTMLDivElement | null, nilai: string) {
  const el = kolom?.querySelector<HTMLElement>(`[data-nilai="${nilai}"]`);
  if (!kolom || !el) return;
  kolom.scrollTop = el.offsetTop - (kolom.clientHeight - el.offsetHeight) / 2;
}

function Kolom({
  judul,
  daftar,
  dipilih,
  pilih,
  kolomRef,
}: {
  judul: string;
  daftar: string[];
  dipilih: string;
  pilih: (v: string) => void;
  kolomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="w-[64px]">
      <p className="pb-1 text-center text-[10.5px] font-semibold tracking-wide text-(--ink-3) uppercase">{judul}</p>
      <div
        ref={kolomRef}
        role="listbox"
        aria-label={judul}
        className="relative h-[168px] overflow-y-auto overscroll-contain rounded-[8px] bg-white ring-1 ring-(--line) [scrollbar-width:thin]"
      >
        {daftar.map((v) => {
          const aktif = v === dipilih;
          return (
            <button
              type="button"
              key={v}
              data-nilai={v}
              role="option"
              aria-selected={aktif}
              onClick={() => pilih(v)}
              className={cn(
                "w-full cursor-pointer py-1.5 font-mono text-[13px] tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-(--navy)/40 focus-visible:ring-inset",
                aktif ? "bg-(--navy) text-white" : "text-(--ink-2) hover:bg-(--paper)"
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PemilihWaktu({
  nilai,
  onUbah,
  onSelesai,
}: {
  /** "HH:MM". Kosong atau rusak dibaca 00:00. */
  nilai: string;
  onUbah: (nilai: string) => void;
  onSelesai: () => void;
}) {
  const [jam, menit] = pisahWaktu(nilai);
  const akarRef = useRef<HTMLDivElement>(null);
  const jamRef = useRef<HTMLDivElement>(null);
  const menitRef = useRef<HTMLDivElement>(null);

  // Sekali saat dibuka saja. Menggulir ulang tiap kali nilai berubah membuat
  // kolom melompat di bawah kursor saat operator sedang memilih.
  useLayoutEffect(() => {
    tengahkan(jamRef.current, jam);
    tengahkan(menitRef.current, menit);
    akarRef.current?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={akarRef}
      className="relative z-50 mt-2 flex items-end justify-end gap-3 rounded-[10px] bg-(--paper) p-2.5 ring-1 ring-(--line)"
    >
      <Kolom judul="Jam" daftar={JAM} dipilih={jam} pilih={(j) => onUbah(`${j}:${menit}`)} kolomRef={jamRef} />
      <span className="pb-[76px] font-mono text-[15px] font-semibold text-(--ink-3)">:</span>
      <Kolom judul="Menit" daftar={MENIT} dipilih={menit} pilih={(m) => onUbah(`${jam}:${m}`)} kolomRef={menitRef} />
      <button
        type="button"
        onClick={onSelesai}
        className="ml-1 inline-flex h-8 cursor-pointer items-center rounded-[8px] bg-(--navy) px-3 text-[12.5px] font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-(--navy)/40"
      >
        Selesai
      </button>
    </div>
  );
}
