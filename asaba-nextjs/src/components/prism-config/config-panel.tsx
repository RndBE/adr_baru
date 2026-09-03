"use client";

import { Lock, LockOpen, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "@/components/monitoring/panel";
import { MagazineLegend, SlotMagazine } from "./slot-magazine";
import type { PrismaSlot } from "./types";

/**
 * Kepala halaman konfigurasi: identitas perangkat, magasin slot, dan kunci.
 *
 * SENGAJA di atas kertas, bukan panel gelap seperti Dashboard dan Hasil
 * Pengukuran. Bidang gelap di sana menandai "subjek utama halaman yang sedang
 * dipantau"; kalau dipakai di ketiga halaman ia berhenti menandai apa pun dan
 * cuma jadi cap yang berulang. Halaman ini juga bukan halaman pemantauan —
 * ia meja kerja — jadi identitasnya dibangun dari magasin slotnya sendiri.
 *
 * Tata letaknya mendatar supaya tingginya ditentukan magasin saja. Versi
 * sebelumnya menaruh identitas, kunci, dan magasin sebagai tiga kolom sejajar,
 * sehingga dua kolom pertama menyisakan ruang kosong setinggi magasin.
 */
export function ConfigPanel({
  namaPos,
  namaSite,
  siteWarna,
  idLogger,
  slots,
  selected,
  onSelect,
  terbuka,
  onBuka,
  onTutup,
  loading,
  className,
  style,
}: {
  namaPos: string;
  namaSite: string;
  siteWarna: string;
  idLogger: string | null;
  slots: PrismaSlot[];
  selected: number | null;
  onSelect: (slot: number) => void;
  terbuka: boolean;
  onBuka: () => void;
  onTutup: () => void;
  loading: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const terisi = slots.filter((s) => s.registered).length;

  return (
    <Panel className={className} style={style} aria-label="Konfigurasi slot prisma">
      {/* ── Identitas perangkat + kunci ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-4 pb-4">
        <div className="min-w-0">
          <Eyebrow>Pos RTS</Eyebrow>
          <h2 className="mt-1 truncate font-display text-[22px] font-bold tracking-[-0.01em] text-(--ink)">
            {namaPos}
          </h2>
          {/* Satu baris meta, bukan daftar bertingkat: ketiganya sama pentingnya
              dan pendek-pendek, jadi menumpuknya cuma menambah tinggi. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-(--ink-2)">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: siteWarna }}
              />
              <span className="font-medium text-(--ink)">{namaSite}</span>
            </span>
            <span aria-hidden="true" className="text-(--ink-3)">
              ·
            </span>
            <span>
              Logger <span className="font-mono tabular-nums text-(--ink)">{idLogger ?? "—"}</span>
            </span>
            <span aria-hidden="true" className="text-(--ink-3)">
              ·
            </span>
            <span>
              <span className="font-mono tabular-nums text-(--ink)">
                {loading ? "…" : terisi}
              </span>{" "}
              dari 50 slot terpakai
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold",
              terbuka
                ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                : "bg-(--paper) text-(--ink-2) ring-1 ring-(--line)"
            )}
          >
            {terbuka ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
            {terbuka ? "Terbuka" : "Terkunci"}
          </span>
          <button
            type="button"
            onClick={terbuka ? onTutup : onBuka}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50",
              terbuka
                ? "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                : "bg-(--navy) text-white hover:bg-(--navy-deep)"
            )}
          >
            {terbuka ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            {terbuka ? "Selesai konfigurasi" : "Mulai konfigurasi"}
          </button>
        </div>
      </div>

      {/* Peringatan hanya muncul saat kuncinya terbuka — di situlah tombol di
          bawah benar-benar bisa memutar teleskop di lapangan. Saat terkunci,
          keadaannya sudah cukup dijelaskan chip "Terkunci" di atas. */}
      {terbuka && (
        <div
          role="status"
          className="mx-5 mb-4 flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900"
        >
          <ShieldAlert className="mt-px size-4 shrink-0 text-amber-600" />
          <p>
            Isi slot, Ubah, dan Hapus aktif. Go To Target dan Auto Search akan{" "}
            <span className="font-semibold">memutar teleskop RTS di lapangan</span>.
          </p>
        </div>
      )}

      {/* ── Magasin ── */}
      <div className="border-t border-(--line) px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Eyebrow>Magasin slot</Eyebrow>
          {!loading && <MagazineLegend slots={slots} />}
        </div>

        {/* Magasin di kiri, keterangan di kanan. Magasinnya sengaja tidak
            dilebarkan penuh — selnya sudah 37px, sasaran klik yang cukup, dan
            membesarkannya lagi cuma menghasilkan kotak raksasa. Ruang sisa di
            kanan dipakai keterangan, bukan dibiarkan menganga. */}
        <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-4">
          {loading && slots.length === 0 ? (
            <div
              className="grid w-full max-w-full shrink-0 grow-0 basis-[420px] grid-cols-10 gap-1.5"
              aria-busy="true"
              aria-label="Memuat magasin slot"
            >
              {Array.from({ length: 50 }, (_, i) => (
                <div key={i} className="aspect-square rounded-[6px] bg-(--paper)" />
              ))}
            </div>
          ) : (
            <div className="max-w-full shrink-0 grow-0 basis-[420px]">
              <SlotMagazine slots={slots} selected={selected} onSelect={onSelect} />
            </div>
          )}

          <div className="min-w-[220px] max-w-[380px] flex-1 text-[12.5px] leading-relaxed text-(--ink-2)">
            <p>Klik slot untuk melompat ke barisnya di daftar bawah.</p>
            {terbuka ? (
              <p className="mt-2.5">
                Mengisi satu slot adalah prosedur bertahap: arahkan teleskop, cari prismanya,
                baru simpan. Tombol Simpan menunggu perangkat menjawab lebih dulu.
              </p>
            ) : (
              <p className="mt-2.5">
                Seluruh daftar bisa dibaca tanpa membuka kunci. Menekan{" "}
                <span className="font-medium text-(--ink)">Mulai konfigurasi</span> akan meminta
                kode akses, dan setelah itu tombol Isi slot, Ubah, dan Hapus jadi aktif.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
