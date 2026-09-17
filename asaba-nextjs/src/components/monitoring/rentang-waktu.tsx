"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ymd } from "./prism-history";

/**
 * Pemilih rentang waktu: dua tanggal pada satu kalender, ditambah jam mulai dan
 * jam selesai.
 *
 * Disalin dari pemilih di halaman detail prisma ketika halaman Analisa
 * Gabungan membutuhkan yang sama, lalu dijadikan komponen supaya pemakai
 * berikutnya tidak menyalin untuk ketiga kalinya.
 *
 * BELUM SELESAI: halaman detail prisma masih memakai salinannya sendiri —
 * blok Popover di dalam (dashboard)/hasil-pengukuran/[prisma]/page.tsx. Selama
 * itu masih ada, setiap perbaikan di sini harus ikut diterapkan di sana, dan
 * dua pemilih yang kelihatan sama bisa mulai berperilaku berbeda. Memindahkan
 * halaman itu ke komponen ini adalah pekerjaan yang tertinggal, bukan pilihan
 * desain.
 *
 * Perubahan ditahan sebagai draf sampai "Tampilkan" ditekan: memuat ulang data
 * pada tiap klik tanggal akan menembakkan permintaan untuk rentang setengah
 * jadi — mis. begitu tanggal awal dipilih dan tanggal akhir belum.
 */

export const JAM_DARI = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
export const JAM_SAMPAI = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:59`);

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

export function fmtTanggalPanjang(d: Date): string {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTanggalPendek(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * "YYYY-MM-DD HH:MM:SS" untuk parameter API — jam dinding WIB apa adanya,
 * tanpa konversi zona, karena itulah yang tersimpan di `rts.waktu`.
 *
 * Detiknya menutup menit yang dipilih: batas bawah mulai di detik 0, batas atas
 * berakhir di detik 59, supaya pembacaan pada menit terakhir tidak terbuang.
 */
export function stempelDb(d: Date, jam: string, batas: "awal" | "akhir"): string {
  return `${ymd(d)} ${jam}:${batas === "awal" ? "00" : "59"}`;
}

/** Lama rentang dalam hari kalender, minimal 1. */
export function lamaHari(dari: Date, sampai: Date): number {
  return Math.max(1, Math.round((sampai.getTime() - dari.getTime()) / 86400000) + 1);
}

const tombol =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

export function RentangWaktu({
  dari,
  sampai,
  jamDari,
  jamSampai,
  onTerapkan,
  catatan,
  disabled,
}: {
  dari: Date;
  sampai: Date;
  jamDari: string;
  jamSampai: string;
  onTerapkan: (dari: Date, sampai: Date, jamDari: string, jamSampai: string) => void;
  /** Keterangan di kaki popover — mis. aturan agregasi per jam. */
  catatan?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tDari, setTDari] = useState<Date>(dari);
  const [tSampai, setTSampai] = useState<Date>(sampai);
  const [tJamDari, setTJamDari] = useState(jamDari);
  const [tJamSampai, setTJamSampai] = useState(jamSampai);

  const buka = (o: boolean) => {
    // Draf disetel ulang dari nilai berlaku tiap kali dibuka: perubahan yang
    // ditinggalkan tanpa "Tampilkan" tidak boleh muncul lagi di pembukaan
    // berikutnya seolah-olah sedang berlaku.
    if (o) {
      setTDari(dari);
      setTSampai(sampai);
      setTJamDari(jamDari);
      setTJamSampai(jamSampai);
    }
    setOpen(o);
  };

  const terapkan = () => {
    setOpen(false);
    onTerapkan(tDari, tSampai, tJamDari, tJamSampai);
  };

  return (
    <Popover open={open} onOpenChange={buka}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          tombol,
          "bg-white font-mono text-[12.5px] font-medium tabular-nums text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
        )}
        aria-label="Ubah rentang waktu"
      >
        <CalendarIcon className="size-4 text-(--ink-3)" />
        {fmtTanggalPendek(dari)} {jamDari} – {fmtTanggalPendek(sampai)} {jamSampai}
        <ChevronDown className="size-3.5 text-(--ink-3)" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="tema-monitoring w-auto max-w-[calc(100vw-2rem)] rounded-[14px] border-(--line) bg-white p-4 shadow-xl"
      >
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-(--paper) px-3 font-medium text-(--ink) ring-1 ring-(--line)">
            <CalendarIcon className="size-4 text-(--ink-3)" />
            {fmtTanggalPanjang(tDari)}
          </span>
          <Select value={tJamDari} onValueChange={(v) => v && setTJamDari(v)}>
            <SelectTrigger className="h-9 w-[92px] cursor-pointer rounded-[9px] border-0 bg-(--paper) px-3 font-mono text-[12.5px] tabular-nums text-(--ink) shadow-none ring-1 ring-(--line)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[240px] rounded-[10px] p-1">
              {JAM_DARI.map((h) => (
                <SelectItem key={h} value={h} className="cursor-pointer justify-center rounded-md py-1.5 font-mono text-[12px]">
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="px-1 text-(--ink-3)">sampai</span>
          <span className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-(--paper) px-3 font-medium text-(--ink) ring-1 ring-(--line)">
            <CalendarIcon className="size-4 text-(--ink-3)" />
            {fmtTanggalPanjang(tSampai)}
          </span>
          <Select value={tJamSampai} onValueChange={(v) => v && setTJamSampai(v)}>
            <SelectTrigger className="h-9 w-[92px] cursor-pointer rounded-[9px] border-0 bg-(--paper) px-3 font-mono text-[12.5px] tabular-nums text-(--ink) shadow-none ring-1 ring-(--line)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[240px] rounded-[10px] p-1">
              {JAM_SAMPAI.map((h) => (
                <SelectItem key={h} value={h} className="cursor-pointer justify-center rounded-md py-1.5 font-mono text-[12px]">
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="mt-3 rounded-[12px] ring-1 ring-(--line)"
          style={{ "--primary": "var(--navy)", "--muted": "#e8e8f0" } as CSSProperties}
        >
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={tDari}
            selected={{ from: tDari, to: tSampai }}
            onSelect={(r) => {
              if (!r?.from) return;
              setTDari(r.from);
              setTSampai(r.to ?? r.from);
            }}
            className="p-3"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] text-(--ink-3)">
            <span className="font-mono tabular-nums">{lamaHari(tDari, tSampai)}</span> hari.
            {catatan ? <> {catatan}</> : null}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={terapkan}
              className={cn(tombol, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
            >
              Tampilkan
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
