"use client";

import { Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDate } from "./format";
import type { LogKontrolRow } from "./derive";

/**
 * Keterangan acuan R0.
 *
 * Sengaja HANYA membaca. Dialog sebelumnya punya pemilih tanggal/waktu dan
 * tombol "Simpan", tapi tombol itu tidak pernah punya handler dan tidak ada
 * endpoint yang mengubah `log_kontrol.r0` — jadi kontrolnya menjanjikan sesuatu
 * yang tidak terjadi. Sampai endpoint itu ada, yang ditampilkan adalah acuan
 * yang sedang berlaku beserta keterangan bahwa penggantiannya belum tersedia.
 */
export function R0Dialog({
  open,
  onOpenChange,
  siteNama,
  r0Log,
  jumlahSesi,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  siteNama: string;
  /** Sesi yang bertanda r0 = 1 untuk site ini. Null bila belum ada. */
  r0Log: LogKontrolRow | null;
  jumlahSesi: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#303481] text-white">
              <Ruler className="size-4" />
            </span>
            Acuan R0
          </DialogTitle>
          <DialogDescription>
            Semua pergeseran di halaman ini dihitung sebagai selisih terhadap satu sesi acuan.
            Sesi itulah yang disebut R0.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[12px] bg-[#F3F4F8] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b6f8e]">
            Berlaku untuk {siteNama}
          </p>
          {r0Log ? (
            <>
              <p className="mt-1.5 font-mono text-[19px] font-semibold tabular-nums text-[#14173a]">
                {fmtDate(r0Log.datetime)}
              </p>
              <p className="mt-1 text-[12px] text-[#4f5374]">
                Sesi <span className="font-mono">{r0Log.id_log}</span> · dibandingkan dengan{" "}
                {jumlahSesi} sesi lain di site ini.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[15px] font-semibold text-[#14173a]">Belum ditetapkan</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#4f5374]">
                Tidak ada sesi bertanda R0 untuk site ini, jadi perhitungan memakai sesi paling
                awal sebagai acuan.
              </p>
            </>
          )}
        </div>

        <p className="text-[12px] leading-relaxed text-[#6b6f8e]">
          Mengganti acuan R0 belum tersedia — perubahannya harus dilakukan langsung di data
          <span className="font-mono"> log_kontrol</span>.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 cursor-pointer rounded-[9px] bg-[#303481] px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#252865] focus-visible:ring-2 focus-visible:ring-[#303481]/40"
          >
            Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
