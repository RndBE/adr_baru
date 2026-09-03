"use client";

import { useEffect, useRef } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tampil, type PrismaSlot } from "./types";

const TH =
  "sticky top-0 z-10 border-b border-(--line) bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)";
const TD_ANGKA =
  "border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums";

const AKSI =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-45";

/**
 * Daftar 50 slot target, digulir dalam satu daftar tanpa paginasi.
 *
 * Paginasi 10-per-halaman dihapus: 50 baris adalah jumlah tetap yang muat
 * digulir, sedangkan paginasinya justru menyembunyikan slot kosong di halaman
 * belakang dan menambah satu keadaan (halaman aktif) yang harus dijaga setiap
 * kali site, pencarian, atau saringan berubah.
 */
export function SlotTable({
  rows,
  loading,
  terbuka,
  selected,
  onSelect,
  onSet,
  onEdit,
  onHapus,
  adaPencarian,
}: {
  rows: PrismaSlot[];
  loading: boolean;
  /** Kunci konfigurasi terbuka — tombol aksi baru aktif bila true. */
  terbuka: boolean;
  selected: number | null;
  onSelect: (slot: number) => void;
  onSet: (row: PrismaSlot) => void;
  onEdit: (row: PrismaSlot) => void;
  onHapus: (row: PrismaSlot) => void;
  adaPencarian: boolean;
}) {
  const wadahRef = useRef<HTMLDivElement>(null);

  /**
   * Slot yang dipilih dari magasin digulirkan ke tengah daftar — tanpa ini,
   * mengklik sel nomor 43 tidak terlihat efeknya karena barisnya jauh di bawah.
   *
   * scrollTop dihitung sendiri, bukan lewat scrollIntoView({behavior:"smooth"}):
   * animasi smooth-nya TIDAK pernah berjalan di container ini (diuji 3
   * September 2026 — scrollTop tetap 0 setelah 1,2 detik, sementara gulir
   * instan langsung bekerja), jadi bergantung padanya berarti gulirnya diam-diam
   * tidak terjadi.
   *
   * Baris yang sudah terlihat sengaja dibiarkan: mengklik baris di tabel juga
   * memilihnya, dan memaksa re-center di situ membuat daftar melompat di bawah
   * kursor.
   */
  useEffect(() => {
    const wadah = wadahRef.current;
    if (selected === null || !wadah) return;
    const baris = wadah.querySelector<HTMLElement>(`[data-slot="${selected}"]`);
    if (!baris) return;

    const atas = baris.offsetTop;
    const bawah = atas + baris.offsetHeight;
    const pandanganAtas = wadah.scrollTop;
    const pandanganBawah = pandanganAtas + wadah.clientHeight;
    if (atas >= pandanganAtas && bawah <= pandanganBawah) return;

    wadah.scrollTop = Math.max(
      0,
      atas - wadah.clientHeight / 2 + baris.offsetHeight / 2
    );
  }, [selected]);

  return (
    <div ref={wadahRef} className="relative flex-1 overflow-auto">
      <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>
              Slot
            </th>
            <th scope="col" className={TH}>
              Nama prisma
            </th>
            <th
              scope="col"
              className={cn(TH, "text-right")}
              title="Sudut horizontal hasil pembelajaran — derajat, menit, detik"
            >
              HA
            </th>
            <th
              scope="col"
              className={cn(TH, "text-right")}
              title="Sudut vertikal hasil pembelajaran — derajat, menit, detik"
            >
              VA
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Tinggi target <span className="font-normal normal-case tracking-normal">m</span>
            </th>
            <th scope="col" className={cn(TH, "pr-5 text-right")}>
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="h-64 text-center">
                <Loader2
                  className="mx-auto size-5 animate-spin text-(--navy)"
                  aria-label="Memuat daftar slot"
                />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="h-64 px-6 text-center text-[13px] text-(--ink-3)">
                {adaPencarian
                  ? "Tidak ada slot yang cocok dengan pencarian."
                  : "Belum ada slot untuk site ini."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const terpilih = row.slot === selected;
              return (
                <tr
                  key={row.id_prisma}
                  data-slot={row.slot}
                  onClick={() => onSelect(row.slot)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-(--paper)",
                    terpilih && "bg-(--paper)"
                  )}
                >
                  <td className="border-b border-(--line) py-2.5 pr-3 pl-5 whitespace-nowrap">
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block h-6 w-[3px] rounded-full",
                          terpilih ? "bg-(--navy)" : "bg-transparent"
                        )}
                      />
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-7 items-center justify-center rounded-[6px] px-1.5 font-mono text-[11.5px] font-semibold tabular-nums",
                          row.registered
                            ? "bg-(--navy)/10 text-(--navy)"
                            : "bg-(--paper) text-(--ink-3) ring-1 ring-(--line)"
                        )}
                      >
                        {row.slot}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-(--line) px-3 py-2.5 whitespace-nowrap">
                    {row.registered ? (
                      <span className="text-[13px] font-semibold text-(--ink)">
                        {row.nama_prisma.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-(--ink-3)">Slot kosong</span>
                    )}
                  </td>
                  <td className={cn(TD_ANGKA, row.registered ? "text-(--ink)" : "text-(--ink-3)")}>
                    {tampil(row.HA)}
                  </td>
                  <td className={cn(TD_ANGKA, row.registered ? "text-(--ink)" : "text-(--ink-3)")}>
                    {tampil(row.VA)}
                  </td>
                  <td className={cn(TD_ANGKA, row.registered ? "text-(--ink)" : "text-(--ink-3)")}>
                    {tampil(row.target_height)}
                  </td>
                  <td className="border-b border-(--line) px-3 py-2.5 pr-5">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.registered ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(row);
                            }}
                            disabled={!terbuka}
                            title={terbuka ? `Ubah slot ${row.slot}` : "Buka kunci konfigurasi dulu"}
                            className={cn(
                              AKSI,
                              "bg-white text-(--navy) ring-1 ring-(--navy)/30 hover:bg-(--paper)"
                            )}
                          >
                            <Pencil className="size-3.5" />
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onHapus(row);
                            }}
                            disabled={!terbuka}
                            title={
                              terbuka ? `Hapus slot ${row.slot}` : "Buka kunci konfigurasi dulu"
                            }
                            aria-label={`Hapus slot ${row.slot}`}
                            className={cn(
                              AKSI,
                              "bg-white px-2 text-(--st-awas) ring-1 ring-(--st-awas)/30 hover:bg-red-50"
                            )}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSet(row);
                          }}
                          disabled={!terbuka}
                          title={
                            terbuka ? `Isi slot ${row.slot}` : "Buka kunci konfigurasi dulu"
                          }
                          className={cn(
                            AKSI,
                            "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                          )}
                        >
                          <Plus className="size-3.5" />
                          Isi slot
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
