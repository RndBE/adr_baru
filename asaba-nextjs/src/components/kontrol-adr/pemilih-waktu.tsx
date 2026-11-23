"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tombol waktu + dropdown jam/menit untuk Jadwal running.
 *
 * Bentuk dropdown-nya sama dengan sebelumnya; yang dibetulkan dua hal:
 *
 * 1. Saat dibuka, kolom jam dan menit langsung digulir ke nilai tersimpan.
 *    Versi lama mencari kelas `time-active-hour`/`time-active-minute` yang
 *    terhapus saat redesign 3 Sep 2026, jadi dropdown selalu terbuka di 00.
 *    Kolomnya digulir lewat `scrollTop`, bukan `scrollIntoView` — yang
 *    terakhir ikut menggulir modal dan halaman di belakangnya.
 * 2. Dropdown tidak lagi terpotong area gulir modal. Ia dirender di
 *    `document.body` dengan posisi `fixed` menempel di tombolnya, tetapi
 *    tetap di dalam kotak modal: dibuka ke bawah bila muat, ke atas bila
 *    ruang di atas yang muat, dan bila keduanya tidak muat tingginya
 *    dipendekkan ke sisi yang lebih lega.
 */

const JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MENIT = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const TINGGI = 168;
/** Tiga baris; lebih pendek dari ini kolomnya tidak bisa dipakai. */
const TINGGI_MIN = 96;
const LEBAR = 124;
const JARAK = 4;
/** Jarak dropdown dari tepi modal. */
const TEPI = 8;

export function pisahWaktu(nilai: string | null | undefined): [string, string] {
  const [j, m] = (nilai ?? "").split(":");
  const jam = (j ?? "").padStart(2, "0");
  const menit = (m ?? "").padStart(2, "0");
  return [JAM.includes(jam) ? jam : "00", MENIT.includes(menit) ? menit : "00"];
}

type Posisi = { top: number; left: number; height: number };
type Kotak = { top: number; bottom: number; left: number; right: number };

/**
 * Letak dropdown untuk tombol `r` di dalam `batas` (kotak modal). Murni,
 * supaya aturan buka-ke-bawah / ke-atas / dipendekkan bisa diuji.
 */
export function letakDropdown(r: Kotak, batas: Kotak): Posisi {
  const ruangBawah = batas.bottom - TEPI - (r.bottom + JARAK);
  const ruangAtas = r.top - JARAK - (batas.top + TEPI);
  let top: number;
  let height: number;
  if (ruangBawah >= TINGGI) {
    top = r.bottom + JARAK;
    height = TINGGI;
  } else if (ruangAtas >= TINGGI) {
    top = r.top - JARAK - TINGGI;
    height = TINGGI;
  } else if (ruangBawah >= ruangAtas) {
    top = r.bottom + JARAK;
    height = Math.max(TINGGI_MIN, ruangBawah);
  } else {
    height = Math.max(TINGGI_MIN, ruangAtas);
    top = r.top - JARAK - height;
  }
  const left = Math.min(batas.right - TEPI - LEBAR, Math.max(batas.left + TEPI, r.right - LEBAR));
  return { top, left, height };
}

function hitungPosisi(tombol: HTMLElement | null): Posisi | null {
  if (!tombol) return null;
  // Kotak modal tempat tombol berada; di luar modal, layar.
  const modal = tombol.closest<HTMLElement>('[role="dialog"]');
  const batas: Kotak = modal
    ? modal.getBoundingClientRect()
    : { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
  return letakDropdown(tombol.getBoundingClientRect(), batas);
}

function tengahkan(kolom: HTMLDivElement | null, nilai: string) {
  const el = kolom?.querySelector<HTMLElement>(`[data-nilai="${nilai}"]`);
  if (!kolom || !el) return;
  kolom.scrollTop = el.offsetTop - (kolom.clientHeight - el.offsetHeight) / 2;
}

function Kolom({
  daftar,
  dipilih,
  pilih,
  kolomRef,
  label,
  garis,
}: {
  daftar: string[];
  dipilih: string;
  pilih: (v: string) => void;
  kolomRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  garis?: boolean;
}) {
  return (
    <div
      ref={kolomRef}
      role="listbox"
      aria-label={label}
      className={cn(
        "relative h-full w-1/2 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        garis && "border-r border-(--line)"
      )}
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
              "w-full cursor-pointer py-1.5 font-mono text-[13px] tabular-nums transition-colors",
              aktif ? "bg-(--navy) text-white" : "text-(--ink-2) hover:bg-(--paper)"
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({
  tombolRef,
  nilai,
  onUbah,
  onTutup,
}: {
  tombolRef: React.RefObject<HTMLButtonElement | null>;
  nilai: string;
  onUbah: (nilai: string) => void;
  onTutup: () => void;
}) {
  const [jam, menit] = pisahWaktu(nilai);
  const [posisi, setPosisi] = useState<Posisi | null>(() => hitungPosisi(tombolRef.current));
  const jamRef = useRef<HTMLDivElement>(null);
  const menitRef = useRef<HTMLDivElement>(null);

  // Sekali saat dibuka. Menggulir ulang tiap kali nilai berubah membuat kolom
  // melompat di bawah kursor saat operator sedang memilih.
  useLayoutEffect(() => {
    tengahkan(jamRef.current, jam);
    tengahkan(menitRef.current, menit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ikuti tombolnya kalau modal digulir atau jendela berubah ukuran.
  useEffect(() => {
    const ikut = (e: Event) => {
      if (e.target instanceof Node && (jamRef.current?.contains(e.target) || menitRef.current?.contains(e.target))) return;
      const p = hitungPosisi(tombolRef.current);
      setPosisi((lama) =>
        p && lama && p.top === lama.top && p.left === lama.left && p.height === lama.height ? lama : p
      );
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onTutup();
      }
    };
    window.addEventListener("resize", ikut);
    window.addEventListener("scroll", ikut, true);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("resize", ikut);
      window.removeEventListener("scroll", ikut, true);
      window.removeEventListener("keydown", esc, true);
    };
  }, [tombolRef, onTutup]);

  if (!posisi) return null;

  // `tema-monitoring` membawa token warna (--navy, --line, …); di luar modal
  // token itu tidak berlaku.
  return createPortal(
    <div className="tema-monitoring">
      <div className="fixed inset-0 z-[60]" onClick={onTutup} />
      <div
        className="fixed z-[61] flex overflow-hidden rounded-[10px] bg-white shadow-xl ring-1 ring-(--line)"
        style={{ top: posisi.top, left: posisi.left, height: posisi.height, width: LEBAR }}
      >
        <Kolom daftar={JAM} dipilih={jam} pilih={(j) => onUbah(`${j}:${menit}`)} kolomRef={jamRef} label="Jam" garis />
        <Kolom daftar={MENIT} dipilih={menit} pilih={(m) => onUbah(`${jam}:${m}`)} kolomRef={menitRef} label="Menit" />
      </div>
    </div>,
    document.body
  );
}

export function PemilihWaktu({
  nilai,
  buka,
  disabled,
  label,
  onBuka,
  onTutup,
  onUbah,
}: {
  /** "HH:MM". Kosong atau rusak dibaca 00:00. */
  nilai: string;
  buka: boolean;
  disabled?: boolean;
  label: string;
  onBuka: () => void;
  onTutup: () => void;
  onUbah: (nilai: string) => void;
}) {
  const tombolRef = useRef<HTMLButtonElement>(null);
  const tutup = useCallback(() => onTutup(), [onTutup]);
  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        onClick={() => (buka ? onTutup() : onBuka())}
        disabled={disabled}
        aria-expanded={buka}
        aria-haspopup="listbox"
        aria-label={label}
        className="inline-flex h-8 w-[92px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-white font-mono text-[13px] tabular-nums text-(--ink) ring-1 ring-(--line) outline-none transition-colors hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:bg-(--paper) disabled:text-(--ink-3)"
      >
        <Clock className="size-3.5 text-(--ink-3)" />
        {nilai || "00:00"}
      </button>
      {buka && !disabled && <Dropdown tombolRef={tombolRef} nilai={nilai} onUbah={onUbah} onTutup={tutup} />}
    </>
  );
}
