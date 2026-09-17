"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useAnalisaGabungan, useLogKontrol } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { Chip, Eyebrow, Panel, PanelHeader } from "@/components/monitoring/panel";
import { AnalisaGabungan } from "@/components/monitoring/analisa-gabungan";
import {
  RentangWaktu,
  fmtTanggalPendek,
  stempelDb,
} from "@/components/monitoring/rentang-waktu";
import { ambangDariSite } from "@/components/monitoring/status";
import { keMs } from "@/components/monitoring/prism-history";
import type { LogKontrolRow } from "@/components/monitoring/derive";
import type { PrismaRentang } from "@/components/monitoring/gabungan";
import {
  AUTO_HARI,
  AUTO_JAM,
  INTERVAL,
  JUDUL_INTERVAL,
  KETERANGAN_RAPAT,
  LABEL_INTERVAL,
  type IntervalGabungan,
} from "@/lib/interval-gabungan";

/**
 * Analisa Gabungan — beberapa prisma satu site dibaca sebagai satu kelompok,
 * pada rentang waktu yang dipilih sendiri.
 *
 * Halaman terpisah, bukan tab di Hasil Pengukuran, karena sumbu waktunya
 * berbeda: Hasil Pengukuran selalu terikat pada SATU sesi running, sedangkan di
 * sini pertanyaannya "apa yang terjadi antara jam sekian dan jam sekian" —
 * rentang yang boleh memotong banyak sesi atau hanya sebagian dari satu sesi.
 *
 * TIDAK ada pilihan "semua site". Menggabungkan prisma lintas site berarti
 * merata-ratakan vektor yang diukur dari acuan R0 berbeda, di area yang
 * berjauhan, dengan ambang bahaya yang berbeda pula — angkanya akan terbentuk,
 * dan tidak satu pun berarti apa-apa.
 */

/** Rentang bawaan: satu hari penuh. */
const JAM_AWAL = "00:00";
const JAM_AKHIR = "23:59";

function tanggalDari(w: unknown): Date | null {
  const ms = keMs(w);
  if (ms === null) return null;
  const d = new Date(ms);
  // Stempel DB dibaca sebagai UTC (lihat keMs), jadi bagian tanggalnya pun
  // dibaca dengan getter UTC — memakai getter lokal akan menggeser sehari
  // penuh pada jam-jam tertentu.
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function AnalisaGabunganContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sites, badge: siteBadge, bySlug, isLoading: sitesLoading } = useSites(false, true);

  const [sitePilihan, setSitePilihan] = useState(searchParams.get("site") ?? "");
  // Site aktif DITURUNKAN: sebelum daftar site tiba, `sitePilihan` bisa kosong
  // atau berisi slug dari URL yang ternyata tidak ada. Menjatuhkannya ke site
  // pertama di sini menghindari effect yang mengejar perubahan daftar.
  const site = useMemo(() => {
    if (sitePilihan && sites.some((s) => s.slug === sitePilihan)) return sitePilihan;
    return sites[0]?.slug ?? "";
  }, [sitePilihan, sites]);

  // Sesi terakhir site ini — hanya untuk menebak rentang bawaan. Hari ini belum
  // tentu ada running, dan halaman yang terbuka kosong tanpa sebab terbaca
  // sebagai "tidak ada pergeseran", bukan "salah hari".
  const { logs } = useLogKontrol(site || undefined, 1, { withPrisma: false });
  const tanggalSesi = useMemo(
    () => tanggalDari((logs as LogKontrolRow[])[0]?.datetime ?? null),
    [logs]
  );

  const [rentang, setRentang] = useState<{
    dari: Date;
    sampai: Date;
    jamDari: string;
    jamSampai: string;
    /** Masih bawaan — boleh ditimpa tanggal sesi terakhir saat tiba. */
    bawaan: boolean;
  }>(() => {
    const kini = new Date();
    const hari = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());
    return { dari: hari, sampai: hari, jamDari: JAM_AWAL, jamSampai: JAM_AKHIR, bawaan: true };
  });
  const [kunciSesi, setKunciSesi] = useState<string | null>(null);

  // Serapat apa pembacaan dirapatkan. Dipegang terpisah dari rentang karena
  // keduanya dijawab operator pada saat berbeda: rentang lewat popover yang
  // ditahan sampai "Tampilkan", interval langsung sekali klik.
  //
  // Bawaannya "auto" — perilaku yang sama dengan sebelum pilihan ini ada.
  const [interval, pilihInterval] = useState<IntervalGabungan>("auto");

  // Begitu tanggal sesi terakhir diketahui, rentang BAWAAN digeser ke sana.
  // Rentang yang sudah disetel operator tidak diganggu.
  const kunciBaru = `${site}|${tanggalSesi?.getTime() ?? ""}`;
  if (tanggalSesi && kunciSesi !== kunciBaru) {
    setKunciSesi(kunciBaru);
    if (rentang.bawaan) {
      setRentang({
        dari: tanggalSesi,
        sampai: tanggalSesi,
        jamDari: JAM_AWAL,
        jamSampai: JAM_AKHIR,
        bawaan: true,
      });
    }
  }

  const rentangTeks = `${fmtTanggalPendek(rentang.dari)} ${rentang.jamDari} – ${fmtTanggalPendek(
    rentang.sampai
  )} ${rentang.jamSampai}`;
  const dariStr = stempelDb(rentang.dari, rentang.jamDari, "awal");
  const sampaiStr = stempelDb(rentang.sampai, rentang.jamSampai, "akhir");

  const { hasil, isLoading, isError } = useAnalisaGabungan(
    site || null,
    dariStr,
    sampaiStr,
    interval
  );
  // Yang BERLAKU, bukan yang diminta — "auto" baru jadi salah satu dari tiga di
  // server, dan layar harus menyebut hasilnya, bukan pertanyaannya.
  const rapat = hasil?.interval ?? "mentah";

  const siteAktif = bySlug(site);
  const ambang = useMemo(() => ambangDariSite(siteAktif), [siteAktif]);
  const daftarPrisma = (hasil?.prisma ?? []) as PrismaRentang[];
  const peringatanSite = site ? siteBadge(site).peringatan : null;
  const dibuang = hasil?.dibuang;
  const r0Tanggal = hasil?.r0?.waktu ? tanggalDari(hasil.r0.waktu) : null;
  const r0Teks = r0Tanggal ? fmtTanggalPendek(r0Tanggal) : null;

  const gantiSite = (slug: string) => {
    setSitePilihan(slug);
    const q = new URLSearchParams(searchParams.toString());
    q.set("site", slug);
    // replace, bukan push — mengganti site bukan langkah navigasi yang perlu
    // bisa ditekan Back berkali-kali.
    router.replace(`/analisa-gabungan?${q}`, { scroll: false });
  };

  return (
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {/* ── Bar kontrol ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Eyebrow>Site</Eyebrow>
          <div
            role="tablist"
            aria-label="Pilih site"
            className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sites.map((s) => {
              const aktif = s.slug === site;
              const b = siteBadge(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => gantiSite(s.slug)}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                    aktif
                      ? "bg-(--navy) text-white"
                      : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                  )}
                >
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: s.badge_color }} />
                  {s.nama}
                  {b.peringatan && (
                    <AlertTriangle
                      className={cn("size-3.5", aktif ? "text-amber-300" : "text-amber-600")}
                      aria-label="Data site ini belum bisa dipercaya"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <div
              role="tablist"
              aria-label="Interval pembacaan"
              className="inline-flex gap-1 rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line)"
            >
              {INTERVAL.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={interval === id}
                  title={JUDUL_INTERVAL[id]}
                  disabled={!site}
                  onClick={() => pilihInterval(id)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-50",
                    interval === id
                      ? "bg-white text-(--ink) shadow-sm"
                      : "text-(--ink-3) hover:text-(--ink-2)"
                  )}
                >
                  {LABEL_INTERVAL[id]}
                </button>
              ))}
            </div>
            <RentangWaktu
              dari={rentang.dari}
              sampai={rentang.sampai}
              jamDari={rentang.jamDari}
              jamSampai={rentang.jamSampai}
              disabled={!site}
              catatan={
                interval === "auto"
                  ? `Mode otomatis: sampai ${AUTO_JAM} hari data mentah, sampai ${AUTO_HARI} hari per jam, lebih panjang dari itu per hari.`
                  : `Interval "${LABEL_INTERVAL[interval]}" dipakai apa adanya, sepanjang apa pun rentangnya.`
              }
              onTerapkan={(dari, sampai, jamDari, jamSampai) =>
                setRentang({ dari, sampai, jamDari, jamSampai, bawaan: false })
              }
            />
          </div>
        </div>

        {peringatanSite && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">{peringatanSite}.</span> Angka di halaman ini belum
              bisa dipakai mengambil keputusan.
            </p>
          </div>
        )}

        <Panel className="rise-in min-w-0">
          <PanelHeader title="Analisa gabungan">
            <Chip>{siteAktif?.nama ?? (site ? site.toUpperCase() : "—")}</Chip>
            <Chip mono>{rentangTeks}</Chip>
            <Chip>{KETERANGAN_RAPAT[rapat]}</Chip>
            {r0Teks && <span>acuan R0 {r0Teks}</span>}
            {hasil?.terpotong && (
              <span className="text-amber-700">
                data dipotong di batas baris — persempit rentangnya
              </span>
            )}
          </PanelHeader>

          {isError && (
            <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p>
                Data rentang ini tidak bisa dimuat. Periksa koneksi, atau persempit rentangnya lalu
                tekan Tampilkan lagi.
              </p>
            </div>
          )}

          {(dibuang?.tanpa_acuan?.length ?? 0) > 0 && (
            <p className="mx-5 mb-3 rounded-[10px] bg-(--paper) px-3.5 py-2.5 text-[12px] leading-relaxed text-(--ink-2)">
              Tidak punya bacaan sah pada sesi acuan R0, jadi pergeserannya tidak bisa dihitung:{" "}
              <span className="font-medium">
                {dibuang!.tanpa_acuan.map((n: string) => n.replace(/_/g, " ")).join(", ")}
              </span>
              .
            </p>
          )}

          <div className="flex min-h-0 flex-1 flex-col border-t border-(--line)">
            <AnalisaGabungan
              prisma={daftarPrisma}
              ambang={ambang}
              kunci={site}
              loading={isLoading}
              kosong={!site}
              interval={rapat}
              namaSite={siteAktif?.nama ?? (site ? site.toUpperCase() : "—")}
              rentangTeks={rentangTeks}
              r0Teks={r0Teks}
            />
          </div>
        </Panel>

        {sitesLoading && sites.length === 0 && (
          <p className="text-[12.5px] text-(--ink-3)">Memuat daftar site…</p>
        )}
        {!sitesLoading && sites.length === 0 && (
          <p className="text-[12.5px] text-(--ink-3)">
            Belum ada site terdaftar di Master Data → Site.
          </p>
        )}
      </div>
    </div>
  );
}

// useSearchParams() memaksa halaman jadi dinamis; Suspense boundary menjaga
// shell-nya tetap bisa di-prerender.
export default function AnalisaGabunganPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-10">
          <Loader2 className="size-8 animate-spin text-[#303481]" />
        </div>
      }
    >
      <AnalisaGabunganContent />
    </Suspense>
  );
}
