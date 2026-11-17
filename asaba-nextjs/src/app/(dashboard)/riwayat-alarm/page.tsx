"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { BellOff, ClipboardCheck, Loader2, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSites } from "@/hooks/use-sites";
import { INPUT } from "@/components/monitoring/modal-shell";
import { useDialogKejadian } from "@/components/alarm-ambang";
import { LencanaTingkat } from "@/components/kejadian-alarm/dialog-kejadian";
import { DialogUjiEws } from "@/components/kejadian-alarm/dialog-uji-ews";
import {
  fmtWaktuPendek,
  statusKejadian,
  waktuWib,
  type KejadianRingkas,
  type StatusKejadian,
} from "@/lib/aturan-kejadian";

/**
 * Riwayat Alarm: setiap kejadian alarm per site, dari naik di atas Normal
 * sampai pulih, beserta siapa yang mengonfirmasi, hasil verifikasi lapangan,
 * dan catatannya. Bahan evaluasi ambang — banyak "palsu" berarti ambang atau
 * akurasi RTS site itu perlu ditinjau.
 */

const FILTER_STATUS: Array<{ nilai: string; label: string }> = [
  { nilai: "semua", label: "Semua status" },
  { nilai: "perlu-konfirmasi", label: "Perlu konfirmasi" },
  { nilai: "disenyapkan", label: "Disenyapkan, belum diverifikasi" },
  { nilai: "perlu-verifikasi", label: "Pulih, belum diverifikasi" },
  { nilai: "benar", label: "Terverifikasi benar" },
  { nilai: "palsu", label: "Terverifikasi palsu" },
];

const LABEL_STATUS: Record<StatusKejadian, { teks: string; warna: string }> = {
  "perlu-konfirmasi": { teks: "Perlu konfirmasi", warna: "#d03b3b" },
  disenyapkan: { teks: "Disenyapkan", warna: "#ec835a" },
  "perlu-verifikasi": { teks: "Perlu verifikasi", warna: "#303481" },
  selesai: { teks: "Selesai", warna: "#0ca30c" },
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RiwayatAlarmPage() {
  return (
    <Suspense fallback={null}>
      <IsiRiwayat />
    </Suspense>
  );
}

function fmtMm(v: number | null): string {
  return v == null ? "" : `${Math.round(v).toLocaleString("id-ID")} mm`;
}

/** "12 mnt" / "2 j 5 mnt" antara dua waktu dinding. */
function lama(dari: string, sampai: string | null): string | null {
  const a = waktuWib(dari);
  const b = waktuWib(sampai);
  if (a === null || b === null || b < a) return null;
  const menit = Math.round((b - a) / 60_000);
  if (menit < 60) return `${menit} mnt`;
  return `${Math.floor(menit / 60)} j ${menit % 60} mnt`;
}

function IsiRiwayat() {
  const router = useRouter();
  const params = useSearchParams();
  const site = params.get("site") ?? "";
  const status = params.get("status") ?? "semua";
  const { sites } = useSites(true);
  const [ujiBuka, setUjiBuka] = useState(false);

  const kunci = `/api/kejadian-alarm?site=${encodeURIComponent(site)}&status=${encodeURIComponent(status)}`;
  const { data, isLoading } = useSWR<{ success: boolean; data?: KejadianRingkas[]; error?: string }>(
    kunci,
    fetcher,
    { refreshInterval: 30_000 }
  );
  const daftar = data?.success ? data.data ?? [] : [];

  // Modal dan dialognya dipasang sekali oleh provider alarm, yang juga menyegarkan
  // daftar ini (dan banner) sesudah konfirmasi atau verifikasi tersimpan.
  const { bukaKonfirmasi, bukaVerifikasi } = useDialogKejadian();

  const ganti = (kunciParam: string, nilai: string) => {
    const baru = new URLSearchParams(params.toString());
    if (!nilai || nilai === "semua") baru.delete(kunciParam);
    else baru.set(kunciParam, nilai);
    router.replace(`/riwayat-alarm${baru.size ? `?${baru}` : ""}`);
  };

  const jumlah = {
    benar: daftar.filter((k) => k.hasil === "benar").length,
    palsu: daftar.filter((k) => k.hasil === "palsu").length,
  };

  return (
    <div className="tema-monitoring">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <label htmlFor="filter-site" className="mb-1 block text-xs font-semibold text-(--ink-2)">
            Site
          </label>
          <select
            id="filter-site"
            value={site}
            onChange={(e) => ganti("site", e.target.value)}
            className={cn(INPUT, "cursor-pointer")}
          >
            <option value="">Semua site</option>
            {sites.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem]">
          <label htmlFor="filter-status" className="mb-1 block text-xs font-semibold text-(--ink-2)">
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => ganti("status", e.target.value)}
            className={cn(INPUT, "cursor-pointer")}
          >
            {FILTER_STATUS.map((f) => (
              <option key={f.nilai} value={f.nilai}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-(--ink-3)">
          {daftar.length} kejadian · {jumlah.benar} benar · {jumlah.palsu} palsu
        </p>
        <button
          type="button"
          onClick={() => setUjiBuka(true)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] bg-white px-3.5 text-[13px] font-semibold text-(--ink-2) ring-1 ring-(--line) outline-none transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
        >
          <Siren className="size-4" />
          Uji EWS
        </button>
      </div>
      {ujiBuka && <DialogUjiEws onClose={() => setUjiBuka(false)} />}

      <div className="overflow-x-auto rounded-[12px] border border-(--line)">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead className="bg-(--paper) text-xs text-(--ink-2)">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Mulai</th>
              <th className="px-3 py-2.5 font-semibold">Site</th>
              <th className="px-3 py-2.5 font-semibold">Puncak</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Konfirmasi</th>
              <th className="px-3 py-2.5 font-semibold">Verifikasi</th>
              <th className="px-3 py-2.5 font-semibold">Catatan</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-(--ink-3)">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Memuat…
                </td>
              </tr>
            )}
            {!isLoading && data && !data.success && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-red-700">
                  {data.error ?? "Gagal membaca riwayat"}
                </td>
              </tr>
            )}
            {!isLoading && data?.success && daftar.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-(--ink-3)">
                  Belum ada kejadian alarm{status !== "semua" ? " dengan status ini" : ""}.
                </td>
              </tr>
            )}
            {daftar.map((k) => {
              const st = statusKejadian(k);
              const tanggap = k.dikonfirmasi ? lama(k.mulai, k.dikonfirmasi) : null;
              return (
                <tr key={k.id} className="border-t border-(--line) align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 text-(--ink)">
                    {fmtWaktuPendek(k.mulai)}
                    <span className="block text-xs text-(--ink-3)">
                      {k.pulih ? `pulih ${fmtWaktuPendek(k.pulih)}` : "masih aktif"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-(--ink)">{k.namaSite}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <LencanaTingkat tingkat={k.tingkatPuncak} />
                    {k.prismaPuncak && (
                      <span className="mt-1 block text-xs text-(--ink-3)">
                        {k.prismaPuncak} {fmtMm(k.nilaiPuncakMm)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: LABEL_STATUS[st].warna }}
                    >
                      <span className="size-2 rounded-full" style={{ background: LABEL_STATUS[st].warna }} />
                      {LABEL_STATUS[st].teks}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-(--ink)">
                    {k.dikonfirmasi ? (
                      <>
                        {k.dikonfirmasiOleh}
                        <span className="block text-xs text-(--ink-3)">
                          {fmtWaktuPendek(k.dikonfirmasi)}
                          {tanggap && ` · tanggap ${tanggap}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-(--ink-3)">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-(--ink)">
                    {k.hasil ? (
                      <>
                        <b className={k.hasil === "benar" ? "text-[#d03b3b]" : "text-[#0a7d0a]"}>
                          {k.hasil === "benar" ? "Benar" : "Palsu"}
                        </b>
                        {k.penyebab && <span className="block text-xs text-(--ink-2)">{k.penyebab}</span>}
                        <span className="block text-xs text-(--ink-3)">
                          {k.diverifikasiOleh} · {fmtWaktuPendek(k.diverifikasi)}
                        </span>
                      </>
                    ) : (
                      <span className="text-(--ink-3)">—</span>
                    )}
                  </td>
                  <td className="max-w-[18rem] px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line text-(--ink-2)">
                    {k.catatan ?? ""}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {st === "perlu-konfirmasi" ? (
                      <button
                        type="button"
                        onClick={() => bukaKonfirmasi(k)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#d03b3b] px-2.5 py-1 text-xs font-semibold text-white hover:brightness-90"
                      >
                        <BellOff className="h-3.5 w-3.5" />
                        Konfirmasi
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bukaVerifikasi(k)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#303481]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[#303481] hover:bg-[#303481]/5"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {k.hasil ? "Ubah" : "Verifikasi"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
