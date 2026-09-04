"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Box, Loader2, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useDeformasi, useLogKontrol, useLoggerDetail, useLoggers } from "@/hooks/use-api";
import { POS_RTS_TANPA_NAMA, useSites, type SiteRow } from "@/hooks/use-sites";
import {
  Chip,
  Eyebrow,
  LinkLanjut,
  Panel,
  PanelFooter,
  PanelHeader,
  StatBaris,
  StatusDot,
} from "@/components/monitoring/panel";
import { RtsConsole } from "@/components/monitoring/rts-console";
import { SessionList } from "@/components/monitoring/session-list";
import { SessionTable } from "@/components/monitoring/session-table";
import { SitePlan } from "@/components/monitoring/site-plan";
import { ElevationProfile } from "@/components/monitoring/elevation-profile";
import {
  ambangBerikutnya,
  ambangDariSite,
  statusTerburuk,
} from "@/components/monitoring/status";
import {
  fmt,
  fmtDate,
  fmtJam,
  fmtTanggal,
  parseNum,
  waktuMsWib,
} from "@/components/monitoring/format";
import {
  ringkasPrisma,
  type LogKontrolRow,
  type PengukuranRow,
  type PrismaRingkas,
} from "@/components/monitoring/derive";

// ─── Tipe dari /api/loggers ──────────────────────────────────────────────────
export interface LoggerRow {
  id: number;
  id_logger: string;
  nama_logger: string;
  nama_lokasi: string;
  latitude: string;
  longitude: string;
  nama_kategori: string;
  kepanjangan: string;
  temp_data: string;
  tabel: string;
  kategori_log: string;
  lokasi_logger: string;
  icon_app?: string;
  seri?: string;
  serial_number?: string;
  masa_aktif?: string;
  nosell?: string;
}

interface RtsTempData {
  waktu?: string | Date | null;
  sensor14?: string | number | null;
  sensor16?: string | number | null;
  sensor17?: string | number | null;
  sensor20?: string | number | null;
  sensor21?: string | number | null;
  sensor22?: string | number | null;
  sensor23?: string | number | null;
  sensor24?: string | number | null;
  sensor25?: string | number | null;
}

interface LoggerDetail {
  tempData?: RtsTempData[];
}

export function groupByCategory(loggers: LoggerRow[]) {
  const groups: Record<
    string,
    { kategori: string; kepanjangan: string; loggers: LoggerRow[] }
  > = {};
  for (const l of loggers) {
    const key = l.nama_kategori || "Unknown";
    if (!groups[key]) {
      groups[key] = { kategori: key, kepanjangan: l.kepanjangan || "", loggers: [] };
    }
    groups[key].loggers.push(l);
  }
  return Object.values(groups);
}

// ─── Dasbor satu site ────────────────────────────────────────────────────────
function RtsDashboard({
  logger,
  site,
  siteRow,
  jumlahSesi,
}: {
  logger: LoggerRow;
  site: string;
  siteRow: SiteRow | null;
  /** Jumlah sesi sebenarnya untuk site ini, dihitung server. */
  jumlahSesi: number;
}) {
  const router = useRouter();
  const { detail } = useLoggerDetail(logger.id_logger) as { detail: LoggerDetail | null };
  // Riwayat DIFILTER per site — tanpa ini sesi site lain ikut tampil dan sesi
  // aktif bisa menunjuk site yang berbeda dari yang dipilih di atas.
  const { logs, isLoading: logsLoading } = useLogKontrol(site, 30);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now);

  // Tick tiap menit supaya Terhubung/Terputus ikut berubah saat data berhenti masuk.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // State tidak perlu di-reset saat site berganti: pemanggil memberi key={site}
  // sehingga komponen di-remount dan sesi terpilih milik site lama ikut hilang.
  const typedLogs = logs as LogKontrolRow[];
  const activeLog = selectedLog ?? typedLogs[0]?.id_log ?? null;
  const activeRow = typedLogs.find((l) => l.id_log === activeLog) ?? null;
  const { deformasi, isLoading: defLoading } = useDeformasi(activeLog, {
    keepPreviousData: true,
  });

  // ── Telemetri & koneksi — aturan yang sama dengan versi sebelumnya ──
  // Terhubung = data terakhir masuk dalam 1 jam (WIB); RTS terhubung juga
  // butuh power (sensor14) atau sedang running (sensor16).
  const tempRts = detail?.tempData?.[0];
  const waktuMs = waktuMsWib(tempRts?.waktu);
  const dataSegar = waktuMs !== null && waktuMs >= nowMs - 60 * 60 * 1000;
  const rtsRunning = Number(tempRts?.sensor16) === 1;
  const rtsPowerOn = Number(tempRts?.sensor14) === 1;
  const rtsTerhubung = dataSegar && (rtsRunning || rtsPowerOn);
  const sdOk = Number(tempRts?.sensor17 ?? 0) === 1;

  // ── Hasil sesi ──
  const ambang = useMemo(() => ambangDariSite(siteRow), [siteRow]);
  const pengukuran = useMemo(
    () => (deformasi?.data_pengukuran ?? []) as PengukuranRow[],
    [deformasi]
  );
  const prisma = useMemo(() => ringkasPrisma(pengukuran, ambang), [pengukuran, ambang]);

  // keepPreviousData: saat sesi berganti, `deformasi` masih berisi sesi
  // sebelumnya sementara isLoading true — tampilan lama ditahan & diredupkan,
  // bukan berkedip ke skeleton lalu melompat.
  const menahan = defLoading && prisma.length > 0;

  const puncak = useMemo(() => {
    let maks: PrismaRingkas | null = null;
    for (const p of prisma) {
      if (p.geserMm !== null && (maks === null || p.geserMm > (maks.geserMm ?? -1))) {
        maks = p;
      }
    }
    const status = statusTerburuk(prisma.map((p) => p.status));
    return {
      maks,
      status,
      ambangBerikut: status && ambang ? ambangBerikutnya(status, ambang) : null,
    };
  }, [prisma, ambang]);

  const lajuPuncak = useMemo(() => {
    let m: PrismaRingkas | null = null;
    for (const p of prisma) {
      if (p.lajuMmd !== null && (m === null || p.lajuMmd > (m.lajuMmd ?? -1))) m = p;
    }
    return m;
  }, [prisma]);

  const r0Log = typedLogs.find((l) => Number(l.r0) === 1) ?? null;
  const sesiKosong = !logsLoading && typedLogs.length === 0;

  const bukaHasil = (view: "Tabel" | "Peta", log: string | null = activeLog) =>
    router.push(`/hasil-pengukuran?log=${log ?? ""}&view=${view}`);

  const vektor = prisma
    .filter((p) => p.dxMm !== null && p.dyMm !== null)
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      dxMm: p.dxMm as number,
      dyMm: p.dyMm as number,
      status: p.status,
    }));
  const titikDenah = prisma
    .filter((p) => p.e !== null && p.n !== null)
    .map((p) => ({ id: p.id, nama: p.nama, e: p.e as number, n: p.n as number, status: p.status }));
  const posisiRts =
    siteRow?.rts_e != null && siteRow?.rts_n != null
      ? { e: Number(siteRow.rts_e), n: Number(siteRow.rts_n) }
      : null;
  const batangDz = prisma
    .filter((p) => p.dzMm !== null)
    .map((p) => ({ id: p.id, nama: p.nama, dzMm: p.dzMm as number }));

  const tombolAksi =
    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50";

  return (
    <div className="space-y-4 md:space-y-5">
      <RtsConsole
        className="rise-in"
        namaPos={logger.nama_lokasi || logger.nama_logger || POS_RTS_TANPA_NAMA}
        idLogger={logger.id_logger}
        sdOk={sdOk}
        loggerTerhubung={dataSegar}
        rtsTerhubung={rtsTerhubung}
        rtsRunning={rtsRunning}
        waktuData={tempRts?.waktu ? fmtDate(tempRts.waktu, { detik: true }) : "—"}
        tiltX={String(tempRts?.sensor24 ?? 0)}
        tiltY={String(tempRts?.sensor25 ?? 0)}
        telemetri={{
          power: parseNum(tempRts?.sensor23),
          humidity: parseNum(tempRts?.sensor20),
          battery: parseNum(tempRts?.sensor21),
          temp: parseNum(tempRts?.sensor22),
        }}
        sesi={{
          waktu: activeRow ? fmtDate(activeRow.datetime) : null,
          loading: defLoading || logsLoading,
          kosong: sesiKosong,
          maksMm: puncak.maks?.geserMm ?? null,
          maksNama: puncak.maks?.nama ?? null,
          status: puncak.status,
          ambangBerikut: puncak.ambangBerikut,
          terukur: prisma.length,
          sesiKey: activeLog ?? "kosong",
        }}
        vektor={vektor}
        ambang={ambang}
        onKontrol={() => router.push("/kontrol-adr")}
      />

      {/* ── Riwayat & hasil ── */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-12">
        <Panel className="rise-in xl:col-span-3 xl:h-[480px]" style={{ animationDelay: "120ms" }}>
          <PanelHeader title="Riwayat running">
            <span>
              <span className="font-mono tabular-nums">{jumlahSesi}</span> running tercatat
            </span>
          </PanelHeader>
          <div className="max-h-[380px] flex-1 overflow-y-auto border-t border-(--line) xl:max-h-none">
            <SessionList
              logs={typedLogs}
              activeLog={activeLog}
              loading={logsLoading}
              onSelect={setSelectedLog}
              onOpen={(id) => bukaHasil("Tabel", id)}
            />
          </div>
          <PanelFooter>
            <LinkLanjut onClick={() => bukaHasil("Tabel")}>Lihat semua running</LinkLanjut>
          </PanelFooter>
        </Panel>

        <Panel className="rise-in xl:col-span-9 xl:h-[480px]" style={{ animationDelay: "180ms" }}>
          <PanelHeader
            title="Hasil running"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => bukaHasil("Peta")}
                  className={cn(
                    tombolAksi,
                    "bg-white text-(--navy) ring-1 ring-(--navy)/30 hover:bg-(--paper)"
                  )}
                >
                  <MapIcon className="size-4" /> Buka peta
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/visualisasi-3d")}
                  className={cn(
                    tombolAksi,
                    "bg-(--navy) text-white hover:bg-(--navy-deep) focus-visible:ring-offset-2"
                  )}
                >
                  <Box className="size-4" /> Buka 3D
                </button>
              </>
            }
          >
            <Chip mono>{activeRow ? fmtDate(activeRow.datetime) : "—"}</Chip>
            <Chip>
              <span className="font-mono tabular-nums">{prisma.length}</span>&nbsp;prisma
            </Chip>
            {r0Log && <span>acuan R0 {fmtTanggal(r0Log.datetime)}</span>}
          </PanelHeader>
          <div className="flex max-h-[480px] min-h-0 flex-1 flex-col xl:max-h-none">
            <SessionTable
              prisma={prisma}
              loading={defLoading}
              kosong={sesiKosong}
              redup={menahan}
            />
          </div>
          <PanelFooter>
            <LinkLanjut onClick={() => bukaHasil("Tabel")}>Lihat semua hasil</LinkLanjut>
          </PanelFooter>
        </Panel>
      </div>

      {/* ── Ringkasan, denah, profil elevasi ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-12">
        {/* self-start: kartu ini setinggi isinya, tidak ikut diregangkan
            setinggi denah & elevasi yang punya SVG + footer. Sebelumnya tinggi
            sisa itu dibagi rata ke sela antar baris lewat `justify-between`,
            dan pada layar xl selanya jadi puluhan piksel — kartu terbaca lebih
            banyak kosong daripada angka. */}
        <Panel
          className="rise-in self-start md:col-span-2 xl:col-span-4"
          style={{ animationDelay: "240ms" }}
        >
          <PanelHeader title="Ringkasan">
            <span>site ini · running terpilih</span>
          </PanelHeader>
          {/* Daftar baris ber-pemisah, bukan grid 2×2. */}
          <div className="flex flex-col divide-y divide-(--line) px-5 pb-4">
            <StatBaris label="Total running" value={jumlahSesi} />
            {/* Tanggal di baris nilai, jam di sub — sama seperti Acuan R0 di
                bawah. Terbalik antar keduanya membuat kolom angka besar berisi
                jam di satu baris dan tanggal di baris lain. */}
            <StatBaris
              label="Running terakhir"
              value={typedLogs[0] ? fmtTanggal(typedLogs[0].datetime) : "—"}
              sub={typedLogs[0] ? `pukul ${fmtJam(typedLogs[0].datetime)}` : "belum ada running"}
            />
            <StatBaris
              label="Kecepatan maks. harian (mm/hari)"
              value={fmt(lajuPuncak?.lajuMmd ?? null)}
              sub={
                lajuPuncak ? (
                  <>
                    <StatusDot status={lajuPuncak.statusLaju} />
                    <span className="truncate">
                      {lajuPuncak.statusLaju ?? "—"} · {lajuPuncak.nama.replace(/_/g, " ")}
                    </span>
                  </>
                ) : (
                  "belum ada data harian"
                )
              }
            />
            <StatBaris
              label="Acuan R0"
              value={r0Log ? fmtTanggal(r0Log.datetime) : "—"}
              sub={r0Log ? `pukul ${fmtJam(r0Log.datetime)}` : "belum ada sesi acuan"}
            />
          </div>
        </Panel>

        <Panel className="rise-in xl:col-span-4" style={{ animationDelay: "300ms" }}>
          <PanelHeader title="Denah prisma">
            <span>posisi terkoreksi (E, N) · garis bidik dari RTS</span>
          </PanelHeader>
          <div className={cn("flex-1 px-3 transition-opacity duration-300", menahan && "opacity-50")}>
            <SitePlan titik={titikDenah} rts={posisiRts} />
          </div>
          <PanelFooter>
            <LinkLanjut onClick={() => bukaHasil("Peta")}>Buka peta</LinkLanjut>
          </PanelFooter>
        </Panel>

        <Panel className="rise-in xl:col-span-4" style={{ animationDelay: "360ms" }}>
          <PanelHeader title="Perubahan elevasi">
            <span>ΔZ per prisma terhadap acuan R0, mm</span>
          </PanelHeader>
          <div className={cn("flex-1 px-3 transition-opacity duration-300", menahan && "opacity-50")}>
            <ElevationProfile batang={batangDz} />
          </div>
          <PanelFooter>
            <LinkLanjut onClick={() => router.push("/visualisasi-3d")}>Buka visualisasi 3D</LinkLanjut>
          </PanelFooter>
        </Panel>
      </div>
    </div>
  );
}

// ─── Halaman ─────────────────────────────────────────────────────────────────
function BerandaContent() {
  const router = useRouter();
  const { loggers, isLoading, isError } = useLoggers();
  const categories = useMemo(() => groupByCategory(loggers), [loggers]);
  const rtsLoggers = useMemo(() => {
    const rts = categories.find((g) => /RTS|ADR/i.test(g.kategori));
    return rts?.loggers ?? [];
  }, [categories]);

  // Selektor memilih SITE, bukan logger: ambang bahaya, rotasi, dan peta semua
  // berkunci pada site. Logger diturunkan dari site (/api/sites?with_logger=1).
  const { sites, badge: siteBadge, isLoading: sitesLoading } = useSites(false, true);

  // Site aktif ikut di URL (`?site=`) supaya bisa dibagikan dan tidak hilang
  // saat halaman di-reload — pola yang sama dipakai Hasil Pengukuran.
  const searchParams = useSearchParams();
  const siteDariUrl = searchParams.get("site") ?? "";
  const [selectedSite, setSelectedSite] = useState<string>(siteDariUrl);
  const activeSite = sites.find((s) => s.slug === selectedSite) ?? sites[0];
  const activeSiteSlug = activeSite?.slug ?? "";

  const gantiSite = (slug: string) => {
    setSelectedSite(slug);
    // replace, bukan push — ganti site bukan langkah navigasi untuk tombol Back.
    const q = new URLSearchParams(searchParams.toString());
    q.set("site", slug);
    router.replace(`/beranda?${q}`, { scroll: false });
  };

  // Kalau site belum punya data sama sekali, jatuh ke logger RTS pertama supaya
  // panel telemetri tetap punya sesuatu untuk ditampilkan.
  const activeLogger =
    rtsLoggers.find((l) => l.id_logger === activeSite?.id_logger) ?? rtsLoggers[0];
  const peringatan = activeSiteSlug ? siteBadge(activeSiteSlug).peringatan : null;

  return (
    // Gutter layout dilepas lewat RUTE_FULL_BLEED di (dashboard)/layout.tsx.
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {isLoading || sitesLoading ? (
          <KerangkaMemuat />
        ) : isError ? (
          <Pesan
            judul="Data dashboard tidak bisa dimuat"
            isi="Periksa koneksi database, lalu muat ulang halaman ini."
          />
        ) : loggers.length === 0 ? (
          <Pesan
            judul="Belum ada logger terdaftar"
            isi="Daftarkan unit RTS lewat Master Data sebelum memantau."
          />
        ) : sites.length === 0 ? (
          <Pesan
            judul="Belum ada site terdaftar"
            isi="Tambahkan site beserta ambang bahayanya di Master Data → Site."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Eyebrow>Site</Eyebrow>
              <div
                role="tablist"
                aria-label="Pilih site"
                className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {sites.map((s) => {
                  const aktif = s.slug === activeSiteSlug;
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
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: s.badge_color }}
                      />
                      {s.nama}
                      <span
                        className={cn(
                          "font-mono text-[11px] tabular-nums",
                          aktif ? "text-white/70" : "text-(--ink-3)"
                        )}
                      >
                        {s.jumlah_sesi ?? 0}
                      </span>
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
            </div>

            {/* Peringatan site — sekali di atas, bukan hanya di tooltip */}
            {peringatan && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <span className="font-semibold">{peringatan}.</span> Angka pergeseran di
                  halaman ini belum bisa dipakai mengambil keputusan.
                </p>
              </div>
            )}

            {activeLogger && activeSiteSlug && (
              // key=site → remount saat site berganti, jadi sesi terpilih tidak
              // terbawa dari site sebelumnya.
              <RtsDashboard
                key={activeSiteSlug}
                logger={activeLogger}
                site={activeSiteSlug}
                siteRow={activeSite ?? null}
                jumlahSesi={activeSite?.jumlah_sesi ?? 0}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <Panel className="items-center px-6 py-14 text-center">
      <p className="font-display text-[20px] font-bold text-(--ink)">{judul}</p>
      <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">{isi}</p>
    </Panel>
  );
}

function KerangkaMemuat() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat dashboard">
      <div className="h-9 w-72 rounded-full bg-white ring-1 ring-(--line)" />
      <div className="h-[248px] rounded-[18px] bg-(--console) opacity-90" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="h-[480px] rounded-[14px] bg-white ring-1 ring-(--line) xl:col-span-4" />
        <div className="h-[480px] rounded-[14px] bg-white ring-1 ring-(--line) xl:col-span-8" />
      </div>
    </div>
  );
}

// useSearchParams() memaksa halaman jadi dinamis; Suspense boundary menjaga
// shell-nya tetap bisa di-prerender — pola yang sama dipakai Hasil Pengukuran.
export default function BerandaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-10">
          <Loader2 className="size-8 animate-spin text-[#303481]" />
        </div>
      }
    >
      <BerandaContent />
    </Suspense>
  );
}
