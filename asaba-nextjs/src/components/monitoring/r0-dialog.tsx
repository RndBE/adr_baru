"use client";

import { useEffect, useMemo, useState } from "react";
import { Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate } from "./format";
import type { LogKontrolRow } from "./derive";

/**
 * Keterangan acuan R0, dan penggantiannya.
 *
 * Dialog ini pernah punya pemilih tanggal dan tombol "Simpan" yang tidak
 * berfungsi: tombolnya tak punya handler dan `log_kontrol.r0` tidak punya
 * penulis sama sekali — bukan di aplikasi ini, bukan juga di CI3. Sesudah itu
 * kontrolnya dicopot dan dialognya jadi baca-saja. Sekarang endpoint-nya ada
 * (PATCH /api/log-kontrol/[id_log]), jadi kontrolnya kembali — kali ini dengan
 * yang di baliknya.
 *
 * Dijaga kode akses seperti perintah kontrol. Mengganti acuan menggeser SELURUH
 * angka pergeseran site sekaligus, dan sejak jalur peringatan ada, ikut
 * menghitung ulang ambang yang memutuskan orang dibangunkan tengah malam.
 */
export function R0Dialog({
  open,
  onOpenChange,
  siteNama,
  r0Log,
  jumlahSesi,
  sesiSite,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  siteNama: string;
  /** Sesi yang bertanda r0 = 1 untuk site ini. Null bila belum ada. */
  r0Log: LogKontrolRow | null;
  jumlahSesi: number;
  /** Sesi site yang sedang dilihat, terbaru dulu — kandidat acuan. */
  sesiSite: LogKontrolRow[];
  /** Dipanggil sesudah acuan berpindah, supaya pemanggil memuat ulang datanya. */
  onSaved: () => void;
}) {
  const [pilihan, setPilihan] = useState("");
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  // Bersihkan tiap kali dibuka. Kode akses khususnya tidak boleh menggantung di
  // state sesudah dialog ditutup — dan pilihan yang basi bisa menunjuk sesi
  // milik site yang sudah berganti di belakang dialog.
  useEffect(() => {
    if (open) {
      setPilihan(r0Log?.id_log ?? "");
      setKode("");
      setGalat("");
    }
  }, [open, r0Log?.id_log]);

  const opsi = useMemo(
    () =>
      sesiSite.map((l) => ({
        value: l.id_log,
        label: `${fmtDate(l.datetime)} · ${l.id_log}${Number(l.r0) === 1 ? " · R0 sekarang" : ""}`,
      })),
    [sesiSite]
  );

  const berubah = pilihan !== "" && pilihan !== (r0Log?.id_log ?? "");
  const bisaSimpan = berubah && kode.trim() !== "" && !menyimpan;

  const simpan = async () => {
    if (!bisaSimpan) return;
    setMenyimpan(true);
    setGalat("");
    try {
      const res = await fetch(`/api/log-kontrol/${encodeURIComponent(pilihan)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: kode }),
      }).then((r) => r.json());

      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setGalat(res.error || "Gagal menetapkan acuan R0");
      }
    } catch {
      setGalat("Gagal menghubungi server");
    } finally {
      setMenyimpan(false);
    }
  };

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
                awal sebagai acuan — dan peringatan pergeseran tidak berjalan sama sekali.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[#4f5374]">Jadikan acuan</span>
            <Select
              value={pilihan}
              onValueChange={(v) => setPilihan(v as string)}
              items={opsi}
            >
              <SelectTrigger className="h-9 w-full cursor-pointer border-[#D1D5DB] text-sm">
                <SelectValue placeholder="Pilih sesi" />
              </SelectTrigger>
              <SelectContent>
                {sesiSite.map((l) => (
                  <SelectItem key={l.id_log} value={l.id_log}>
                    {fmtDate(l.datetime)} · {l.id_log}
                    {Number(l.r0) === 1 ? " · R0 sekarang" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[#4f5374]">Kode akses</span>
            <Input
              type="password"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              placeholder="Kode akses kontrol"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") void simpan();
              }}
            />
          </label>

          <p className="text-[12px] leading-relaxed text-[#6b6f8e]">
            Mengganti acuan menghitung ulang seluruh pergeseran site ini sekaligus, dan mereset
            keadaan peringatan tiap prisma — tingkat yang sedang berlaku dibangun ulang dari nol
            selama tiga siklus berikutnya.
          </p>

          {galat && (
            <p role="alert" className="text-[12px] font-medium text-(--st-awas)">
              {galat}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 cursor-pointer rounded-[9px] px-4 text-[13px] font-semibold text-[#4f5374] outline-none transition-colors hover:bg-[#F3F4F8] focus-visible:ring-2 focus-visible:ring-[#303481]/40"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => void simpan()}
            disabled={!bisaSimpan}
            className="h-9 cursor-pointer rounded-[9px] bg-[#303481] px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#252865] focus-visible:ring-2 focus-visible:ring-[#303481]/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {menyimpan ? "Menyimpan…" : "Jadikan acuan"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
