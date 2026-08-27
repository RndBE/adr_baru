"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedRTS from "@/components/AnimatedRTS";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Map as MapIcon,
  Box,
  History,
  ArrowRight,
  Loader2,
  Check,
  X,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoggers, useLogKontrol, useDeformasi, useLoggerDetail } from "@/hooks/use-api";
import { useSites, POS_RTS_TANPA_NAMA } from "@/hooks/use-sites";
import Image from "next/image";

// ─── Helper: parse waktu dari berbagai format MySQL ──────────────────────────
// Prisma $queryRaw bisa return Date object ATAU string "YYYY-MM-DD HH:MM:SS"
// tergantung versi driver. Fungsi ini normalize semua format ke ISO string.
function parseWaktuToIso(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    if (d instanceof Date) {
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    if (typeof d === "string") {
      // Format MySQL: "2026-04-20 09:43:00" → ganti spasi dengan T
      const normalized = d.trim().replace(" ", "T");
      const dt = new Date(normalized);
      if (isNaN(dt.getTime())) return null;
      return normalized.includes("T") ? normalized : dt.toISOString();
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Helper: format date nicely ──────────────────────────────
function fmtDate(d: string | Date | null, showSeconds = false, shortYear = false) {
  if (!d) return "-";

  const isoStr = parseWaktuToIso(d);
  if (!isoStr) return "-";

  if (isoStr.includes("T")) {
    const [datePart, timePart] = isoStr.split("T");
    const parts = datePart.split("-");
    if (parts.length < 3) return "-";
    const [year, month, day] = parts;
    const timeParts = timePart.split(".")[0].split(":");
    if (timeParts.length < 2) return "-";
    const [hr, min, sec] = timeParts;

    const yFormat = shortYear ? year.slice(2) : year;
    const sFormat = showSeconds && sec ? `:${sec}` : "";
    return `${day}-${month}-${yFormat} ${hr}:${min}${sFormat}`;
  }

  return "-";
}

// Badge site sekarang berasal dari master data `t_site` lewat useSites(),
// bukan dari daftar switch-case yang harus diedit tiap kali ada site baru.

// ─── Helper: group loggers by category ───────────────────────
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

interface LogKontrolRow {
  id_log: string;
  datetime?: string | Date | null;
  site?: string;
  r0?: number;
}

interface PengukuranRow {
  id_prisma: string | number;
  nama_prisma?: string;
  temp_tembak?: {
    DE?: string | number;
    E1?: string | number;
    DN?: string | number;
    N1?: string | number;
    DZ?: string | number;
    Z1?: string | number;
    linear?: string | number;
    arah_pergeseran?: string;
  };
  daily?: {
    pergeseran_mm?: number | null;
    kecepatan_mmd?: number | null;
    last_time?: string | null;
  };
}

export function groupByCategory(loggers: LoggerRow[]) {
  const groups: Record<string, { kategori: string; kepanjangan: string; loggers: LoggerRow[] }> = {};
  for (const l of loggers) {
    const key = l.nama_kategori || "Unknown";
    if (!groups[key]) {
      groups[key] = { kategori: key, kepanjangan: l.kepanjangan || "", loggers: [] };
    }
    groups[key].loggers.push(l);
  }
  return Object.values(groups);
}

// ─── RTS Detail Dashboard Component ────────────────────────────────
function RtsDashboard({
  logger,
  site,
  jumlahSesi,
}: {
  logger: LoggerRow;
  site: string;
  /** Jumlah sesi sebenarnya untuk site ini, dihitung server. */
  jumlahSesi: number;
}) {
  const router = useRouter();
  const { detail } = useLoggerDetail(logger.id_logger) as { detail: LoggerDetail | null };
  // Riwayat DIFILTER per site. Tanpa filter, daftar ini menampilkan sesi dari
  // semua site sekaligus, dan `activeLog` di bawah bisa menunjuk sesi milik
  // site lain — sehingga kartu deformasi menampilkan angka site yang berbeda
  // dari yang dipilih di selektor.
  const { logs, isLoading: logsLoading } = useLogKontrol(site, 30);
  const { badge: siteBadge } = useSites();
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now);

  // Tick setiap 60 detik → paksa re-render supaya Date.now() dievaluasi ulang
  // Tanpa ini, status Connected/Disconnected tidak berubah otomatis saat data berhenti masuk
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Catatan: state di komponen ini tidak perlu di-reset manual saat site
  // berganti — pemanggilnya memberi `key={site}` sehingga komponen di-remount
  // dan `selectedLog` (yang berisi id_log milik site lama) ikut hilang.

  const typedLogs = logs as LogKontrolRow[];
  const activeLog = selectedLog || (typedLogs.length > 0 ? typedLogs[0].id_log : null);
  const { deformasi, isLoading: defLoading } = useDeformasi(activeLog);

  const recentLogs = typedLogs.slice(0, 8);

  const tempRts = detail?.tempData?.[0];

  // Status dihitung berdasarkan waktu terakhir update (sama seperti CI3 Beranda.php)
  // Connected jika data terakhir diterima dalam 1 jam terakhir
  const isLoggerConnected = (() => {
    if (!tempRts?.waktu) return false;
    const isoStr = parseWaktuToIso(tempRts.waktu);
    if (!isoStr) return false;
    // Hapus timezone suffix lalu tambah +07:00 (WIB)
    const normalized = isoStr.replace(/Z$/, "").replace(/\+\d{2}:\d{2}$/, "");
    const waktuMs = new Date(normalized + "+07:00").getTime();
    if (isNaN(waktuMs)) return false;
    return waktuMs >= nowMs - 60 * 60 * 1000;
  })();

  // Status RTS: sensor14 harus = 1 DAN data terakhir masuk dalam 1 jam terakhir
  // Jika tidak ada data baru (timeout), otomatis Disconnected meskipun sensor14 = 1
  // Tambahan: Jika sensor16 = 1 (sedang running), anggap RTS connected
  const isRtsConnected = (() => {
    if (!tempRts) return false;
    const isRunning = Number(tempRts.sensor16) === 1;
    const isPowerOn = Number(tempRts.sensor14) === 1;
    if (!isRunning && !isPowerOn) return false;
    // Cek waktu data terakhir — harus dalam 1 jam terakhir
    const isoStr = parseWaktuToIso(tempRts.waktu);
    if (!isoStr) return false;
    const normalized = isoStr.replace(/Z$/, "").replace(/\+\d{2}:\d{2}$/, "");
    const waktuMs = new Date(normalized + "+07:00").getTime();
    if (isNaN(waktuMs)) return false;
    return waktuMs >= nowMs - 60 * 60 * 1000;
  })();

  const statusRtsText = isRtsConnected ? "Connected" : "Disconnected";
  const tiltX       = tempRts?.sensor24 ?? "000'000\"";
  const tiltY       = tempRts?.sensor25 ?? "000'000\"";
  const powerRts    = tempRts?.sensor23 ?? 0;   // Power RTS (Volt)
  const humidity    = tempRts?.sensor20 ?? 0;   // Humidity (%)
  const battery     = tempRts?.sensor21 ?? 0;   // Battery (Volt)
  const temperature = tempRts?.sensor22 ?? 0;   // Temperature (°C)
  // Status SD Card dari sensor17: 1 = OK, 0 = Error
  const isSdCardOk = Number(tempRts?.sensor17 ?? 0) === 1;
  // "-" bila logger belum pernah mengirim data. Sebelumnya jatuh ke tanggal
  // hardcode "01-01-2026 17:19:00" yang terbaca seperti timestamp sungguhan.
  const lastUpdateStr = tempRts?.waktu ? fmtDate(tempRts.waktu, true) : "-";
  const lastUpdateJam = lastUpdateStr.split(" ")[1] ?? null;

  const pengukuran = useMemo(
    () => (deformasi?.data_pengukuran ?? []) as PengukuranRow[],
    [deformasi]
  );

  // Dari server, bukan logs.length — daftar log dibatasi limit 30 sehingga
  // site dengan sesi lebih banyak akan salah hitung.
  const totalRunning = jumlahSesi;

  // Pergeseran & kecepatan maksimum dihitung dari data sesi aktif. Sebelumnya
  // keduanya konstanta hardcode (13.74 / 2.25) dengan label prisma karangan
  // ("Prism C1", "Prism C6") — angkanya tidak pernah berubah meski site atau
  // sesinya berganti, jadi terbaca seolah nyata padahal bukan.
  const ringkasan = useMemo(() => {
    let maxGeser: { nilai: number; prisma: string; waktu: string | null } | null = null;
    let maxLaju: { nilai: number; prisma: string; waktu: string | null } | null = null;

    for (const row of pengukuran) {
      const nama = String(row.nama_prisma || row.id_prisma || "-");
      const geser = row.daily?.pergeseran_mm;
      const laju = row.daily?.kecepatan_mmd;
      const waktu = row.daily?.last_time ?? null;

      if (typeof geser === "number" && (!maxGeser || geser > maxGeser.nilai)) {
        maxGeser = { nilai: geser, prisma: nama, waktu };
      }
      if (typeof laju === "number" && (!maxLaju || laju > maxLaju.nilai)) {
        maxLaju = { nilai: laju, prisma: nama, waktu };
      }
    }
    return { maxGeser, maxLaju };
  }, [pengukuran]);

  /** Jam saja dari timestamp; "-" bila tidak ada. */
  const jamDari = (w: string | null) => {
    if (!w) return null;
    const d = new Date(w);
    if (isNaN(d.getTime())) return null;
    return d.toTimeString().slice(0, 8);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ─── TOP SEC: OVERVIEW CARDS ─── */}
      <div className="grid grid-cols-1 gap-3 md:gap-5 xl:grid-cols-12">
        {/* Pos RTS Site Map */}
        <Card className="col-span-1 xl:col-span-3 rounded-[6px] shadow-sm border-[#EAEAEA] overflow-visible gap-0 py-0">
          <CardContent className="p-4 lg:p-4.5 flex flex-col h-full justify-center">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5 relative w-full">
                {/* Nama pos RTS dari t_lokasi; nama_logger hanya cadangan. */}
                <h3 className="min-w-0 flex-1 truncate font-extrabold text-gray-900 text-[17px]">{logger.nama_lokasi || logger.nama_logger || POS_RTS_TANPA_NAMA}</h3>
                <button 
                  onClick={() => setShowInfo(!showInfo)}
                  className="w-5 h-5 shrink-0 bg-[#2B3270] rounded-full flex items-center justify-center text-white text-[12px] font-bold hover:bg-[#1a1e4a] transition-colors cursor-pointer"
                >
                  i
                </button>

                {showInfo && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                    <div className="absolute right-0 top-[120%] mt-1 z-50 w-[min(280px,calc(100vw-2rem))] bg-white rounded-lg shadow-xl border border-gray-200 py-1 sm:left-[150px] sm:right-auto">
                      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200">
                        <span className="text-[13px] text-black font-semibold">ID Logger</span>
                        <span className="text-[13px] text-gray-800">{logger.id_logger || "10005"}</span>
                      </div>
                      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200">
                        <span className="text-[13px] text-black font-semibold">Status Logger</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-gray-800">{isLoggerConnected ? "Koneksi Terhubung" : "Koneksi Terputus"}</span>
                          {!isLoggerConnected && (
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 border border-red-200 text-red-500 bg-red-50">
                              <X className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-4 py-3 flex justify-between items-center">
                        <span className="text-[13px] text-black font-semibold">Status SD Card</span>
                        {isSdCardOk ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] text-gray-800">OK</span>
                            <div className="w-[14px] h-[14px] rounded-full border border-green-500 text-green-500 flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] text-red-500 font-semibold">Error</span>
                            <div className="w-[14px] h-[14px] rounded-full border border-red-400 text-red-500 flex items-center justify-center flex-shrink-0">
                              <X className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                isLoggerConnected 
                  ? "bg-[#E5F7E7] text-[#06C022] border-green-200" 
                  : "bg-gray-100/80 text-gray-700 border-gray-200"
              )}>
                <div className={cn("h-1.5 w-1.5 rounded-full", isLoggerConnected ? "bg-[#06C022]" : "bg-gray-600")}></div>
                {lastUpdateStr}
              </div>
            </div>
            <Button
              onClick={() => router.push("/kontrol-adr")}
              className="w-full bg-[#2B3270] hover:bg-[#1a1e4a] text-white rounded-md h-[42px] flex items-center justify-center text-sm font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Image src="/kontrol_adr_fill.svg" width={18} height={18} alt="Kontrol ADR" className="mr-2 object-contain brightness-0 invert" />
              Kontrol ADR
            </Button>
          </CardContent>
        </Card>

        {/* RTS Widgets Row */}
        <div className="col-span-1 grid grid-cols-2 items-stretch gap-3 md:grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr_1fr] md:gap-5 xl:col-span-9">
          {/* Status Main Card */}
          <Card className="col-span-2 md:col-span-1 border-[#EAEAEA] shadow-sm rounded-[6px] flex min-h-[150px] flex-row items-center justify-start py-3 pr-3 pl-[96px] sm:pl-[115px] md:min-h-0 md:py-3.5 md:pr-4 flex-nowrap relative overflow-hidden h-full">
            {/* Left Image positioned exactly at bottom */}
            <div className="absolute left-0 bottom-1 w-[120px] h-[110%] pointer-events-none flex items-end sm:left-1 sm:w-[150px]">
              <AnimatedRTS
                isOnline={isRtsConnected}
                className="w-[112px] h-[130px] object-contain drop-shadow-sm translate-y-[2px] sm:w-[140px] sm:h-[150px]"
              />
            </div>
            {/* Right Status */}
            <div className="flex-1 min-w-0 pl-1 lg:pl-3">
              <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1 lg:mb-1.5">STATUS RTS</p>
              <div className="flex items-center gap-1.5 lg:gap-2 mb-2 lg:mb-2.5">
                {/* Titik ikut mengecil bersama teksnya supaya proporsinya tetap. */}
                <div className={cn("h-3 w-3 lg:h-3.5 lg:w-3.5 rounded-full flex-shrink-0", isRtsConnected ? "bg-[#2DB77B]" : "bg-[#EF4444]")}></div>
                <span className={cn("font-extrabold text-[16px] sm:text-[17px] lg:text-[19px] xl:text-[20px] tracking-tight truncate", isRtsConnected ? "text-[#2DB77B]" : "text-[#EF4444]")}>
                  {statusRtsText}
                </span>
              </div>
              <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1">TILT</p>
              <div className="flex items-center gap-2">
                <div className="relative w-[40px] h-[40px] flex-shrink-0">
                  <Image 
                    src="/tilt_off.svg" 
                    fill
                    alt="Tilt Safe" 
                    className={cn(
                      "object-contain transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      isRtsConnected ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-45"
                    )} 
                  />
                  <Image 
                    src="/tilt_on.svg" 
                    fill
                    alt="Tilt Warning" 
                    className={cn(
                      "object-contain transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      !isRtsConnected ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-45"
                    )} 
                  />
                </div>
                <div className="flex flex-col text-[18px] sm:text-[21px] lg:text-[21px] font-extrabold text-gray-900 leading-[1.15] tracking-tight">
                  <div className="flex items-center gap-1">
                    <span>{tiltX}</span>
                    <span className="text-[#303481] text-[15px] lg:text-[16px] font-bold">X</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{tiltY}</span>
                    <span className="text-[#303481] text-[15px] lg:text-[16px] font-bold">Y</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Metric Cards */}
          <SmallMetricCard title="POWER RTS" value={powerRts} unit="Volt" iconBg="bg-[#FEF1D1]" imageSrc="/power_rts.svg" onClick={() => router.push('/power-rts')} />
          <SmallMetricCard title="HUMIDITY LOGGER" value={humidity} unit="%" iconBg="bg-[#DEEBF5]" imageSrc="/humidity.svg"  />
          <SmallMetricCard title="BATTERY LOGGER" value={battery} unit="Volt" iconBg="bg-[#CDF2D3]" imageSrc="/battery.svg" />
          <SmallMetricCard title="TEMPERATURE LOGGER" value={temperature} unit="°C" iconBg="bg-[#FEF1D1]" imageSrc="/temperature.svg" />
        </div>
      </div>

      {/* ─── MIDDLE SEC: HISTORY & PRISMA DATA ─── */}
      <div className="grid grid-cols-1 gap-3 md:gap-5 xl:grid-cols-12">
        {/* Riwayat Running Terbaru */}
        {/* py-0 gap-0 mematikan padding & gap bawaan Card: header, daftar, dan
            footer di dalamnya sudah mengatur spasinya masing-masing, jadi tanpa
            ini keduanya bertumpuk. */}
        <Card className="col-span-1 xl:col-span-3 rounded-lg shadow-sm border-[#EAEAEA] h-[360px] md:h-[520px] flex flex-col gap-0 py-0 bg-white">
          <div className="px-4 md:px-5 pt-4 pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-base">Riwayat Running Terbaru</h3>
            <History className="h-4 w-4 text-gray-800" />
          </div>
          <div className="flex-1 overflow-y-auto w-full">
            {logsLoading ? (
               <div className="px-5">
                 {Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)}
               </div>
            ) : recentLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-10">Belum ada riwayat.</p>
            ) : (
              recentLogs.map((log) => {
                const isActive = log.id_log === activeLog;
                const activeClasses = isActive ? "border-l-[3px] border-[#2B3270] bg-[#F4F6F9]" : "border-l-[3px] border-transparent";
                const badgeInfo = siteBadge(log.site ?? "");
                const isR0 = log.r0 === 1;

                return (
                  <button 
                    key={log.id_log}
                    onClick={() => setSelectedLog(log.id_log)}
                    onDoubleClick={() => router.push(`/hasil-pengukuran?log=${log.id_log}&view=Tabel`)}
                    title="Klik sekali untuk preview, klik dua kali untuk buka detail"
                    className={cn(
                      "w-full flex items-center gap-3 py-3.5 px-4 md:px-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left",
                      activeClasses
                    )}
                  >
                    <span className="text-[13px] text-gray-700 font-medium min-w-[110px]">{fmtDate(log.datetime ?? null)}</span>
                    <div className="flex gap-1">
                       <span
                         className="text-[9px] font-bold px-2.5 py-0.5 rounded-full text-white"
                         style={{ backgroundColor: badgeInfo.color }}
                         title={badgeInfo.peringatan ?? badgeInfo.nama}
                       >
                         {badgeInfo.label}
                         {badgeInfo.peringatan && " ⚠"}
                       </span>
                       {isR0 && (
                          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full text-white bg-gray-500">
                            R0
                          </span>
                       )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-3 md:px-5 flex justify-end">
             <button
               onClick={() => router.push(`/hasil-pengukuran?log=${activeLog ?? ""}&view=Tabel`)}
               className="text-[13px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
             >
               Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
             </button>
          </div>
        </Card>

        {/* Preview Data Prisma */}
        <Card className="col-span-1 xl:col-span-9 rounded-lg shadow-sm border-[#EAEAEA] overflow-hidden flex flex-col h-[520px] gap-0 py-0 bg-white">
          {/* md:pt-1/pb-1 dulu dipakai untuk mengimbangi py-4 + gap-4 bawaan Card.
              Setelah keduanya dimatikan, header ini butuh padding sebenarnya. */}
          <div className="px-4 py-3 md:px-5 md:py-3.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h3 className="font-extrabold text-gray-900 text-lg mb-1.5">Preview Data Prisma</h3>
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                  Date Selected
                  <span className="bg-[#2B3270] text-white px-2 py-0.5 rounded-full text-[10px]">{activeLog ? fmtDate(typedLogs.find((l) => l.id_log === activeLog)?.datetime ?? null) : "-"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                  Total Prism :
                  <span className="bg-[#2B3270] text-white px-2 py-0.5 rounded-full text-[10px] shadow-sm">{pengukuran.length || 0}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:flex md:items-center">
              <Button 
                onClick={() => router.push(`/hasil-pengukuran?log=${activeLog ?? ""}&view=Peta`)}
                variant="outline" 
                size="sm" 
                className="h-[38px] border-[#2B3270] text-[#2B3270] bg-white hover:bg-[#2B3270] hover:text-white rounded-md font-semibold transition-colors px-3 md:px-4 cursor-pointer active:scale-95"
              >
                <MapIcon className="mr-2 h-4 w-4" /> Buka Peta
              </Button>
              <Button 
                onClick={() => router.push("/visualisasi-3d")}
                size="sm" 
                className="h-[38px] bg-[#2B3270] hover:bg-[#1a1e4a] text-white rounded-md font-semibold shadow-sm px-3 md:px-4 cursor-pointer active:scale-95"
              >
                <Box className="mr-2 h-4 w-4" /> Buka 3D
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white border-t border-gray-200">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-gray-100 sticky top-0 z-10">
                <TableRow className="border-b border-gray-200">
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">Nomor Prisma</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">Nama Prisma</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">ΔX</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">ΔY</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">ΔZ</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">Linier</TableHead>
                  <TableHead className="text-center text-[12px] font-bold text-black py-4">Arah Pergeseran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defLoading ? (
                  <TableRow>
                     <TableCell colSpan={7} className="h-48 text-center">
                       <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2B3270]" />
                     </TableCell>
                  </TableRow>
                ) : pengukuran.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={7} className="h-48 text-center text-gray-500 font-medium">
                       Tidak ada data prisma
                     </TableCell>
                  </TableRow>
                ) : (
                  pengukuran.map((pr, idx) => {
                    const t = pr.temp_tembak || {};
                    const linierStr = typeof t.linear === "number" ? t.linear.toFixed(2) : (t.linear || "0.00");
                    const dy = t.DN !== undefined ? t.DN : t.N1;
                    const dz = t.DZ !== undefined ? t.DZ : t.Z1;
                    
                    return (
                      <TableRow key={pr.id_prisma} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <TableCell className="text-center text-[13px] text-gray-700 py-4 tabular-nums">{idx + 1}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4">{pr.nama_prisma}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4 tabular-nums">{t.DE !== undefined ? t.DE : t.E1 || "0.000"}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4 tabular-nums">{dy || "0.000"}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4 tabular-nums">{dz || "0.000"}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4 tabular-nums">{linierStr}</TableCell>
                        <TableCell className="text-center text-[13px] text-gray-700 py-4">{t.arah_pergeseran || "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-gray-100 px-4 py-3 md:px-5 flex justify-end">
            <button
              onClick={() => router.push(`/hasil-pengukuran?log=${activeLog ?? ""}&view=Tabel`)}
              className="text-[13px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>
      </div>

      {/* ─── BOTTOM SEC: SUMMARIES & MAP PREVIEWS ─── */}
      <div className="grid grid-cols-1 gap-3 md:gap-5 xl:grid-cols-12">
        {/* Ringkasan Harian */}
        <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white xl:col-span-3 gap-0 py-0">
          <CardHeader className="p-4 2xl:px-5 pb-0">
            <CardTitle className="text-[15px] font-extrabold text-gray-900">Ringkasan Harian</CardTitle>
          </CardHeader>
          <CardContent className="p-4 2xl:p-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:gap-4">
             {/* Total Running */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#E5F5ED] flex items-center justify-center">
                  <Image src="/riwayat.svg" alt="Total Running" width={20} height={20} className="object-contain" />
                </div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total Running</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none">{totalRunning} <span className="text-[10px] font-medium text-gray-500">running</span></p>
                </div>
             </div>
             {/* Running Terakhir */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#EBF3FF] flex items-center justify-center">
                  <Image src="/riwayat_running.svg" alt="Running Terakhir" width={20} height={20} className="object-contain" />
                </div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Running Terakhir</p>
                   {/* mock time layout */}
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none">
                     {lastUpdateJam ? (
                       <>
                         {lastUpdateJam.slice(0, 5)}
                         <span className="text-[10px] font-bold text-gray-500">:{lastUpdateJam.slice(6)}</span>
                       </>
                     ) : (
                       "-"
                     )}
                   </p>
                </div>
             </div>
             {/* Pergeseran Maks */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#FFF2DE] flex items-center justify-center">
                  <Image src="/pergeseran_maks.svg" alt="Pergeseran Maks" width={20} height={20} className="object-contain" />
                </div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Pergeseran Maks.</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none mb-1">
                     {ringkasan.maxGeser ? ringkasan.maxGeser.nilai.toFixed(2) : "-"} <span className="text-[10px] font-medium text-gray-500">mm</span>
                   </p>
                   {ringkasan.maxGeser && (
                     <div className="inline-block bg-[#FFF4E5] text-[#F1A23A] text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                       {ringkasan.maxGeser.prisma}
                       {jamDari(ringkasan.maxGeser.waktu) ? ` • ${jamDari(ringkasan.maxGeser.waktu)}` : ""}
                     </div>
                   )}
                </div>
             </div>
             {/* Kecepatan Maks */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#E8EAFD] flex items-center justify-center">
                  <Image src="/kecepatan_maks.svg" alt="Kecepatan Maks" width={20} height={20} className="object-contain" />
                </div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Kecepatan Maks.</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none mb-1">
                     {ringkasan.maxLaju ? ringkasan.maxLaju.nilai.toFixed(2) : "-"} <span className="text-[10px] font-medium text-gray-500">mm/hari</span>
                   </p>
                   {ringkasan.maxLaju && (
                     <div className="inline-block bg-[#E8EAFD] text-[#6A78D1] text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                       {ringkasan.maxLaju.prisma}
                       {jamDari(ringkasan.maxLaju.waktu) ? ` • ${jamDari(ringkasan.maxLaju.waktu)}` : ""}
                     </div>
                   )}
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Wrapper Peta & 3D */}
        <div className="xl:col-span-9 grid grid-cols-1 gap-3 md:gap-5 lg:grid-cols-2">
          {/* Peta Prisma Preview */}
          <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white min-h-[190px] sm:min-h-[160px] relative overflow-hidden flex flex-col gap-0 py-0">
           <div className="p-4 2xl:p-5 flex-1 z-10 relative w-[45%] sm:w-[35%]">
              <h3 className="font-extrabold text-[15px] text-gray-900 mb-0.5">Peta Prisma</h3>
              <p className="text-[11px] text-gray-500 font-medium leading-tight mb-4 pr-1">Preview persebaran titik prisma</p>
              
              <div className="mt-auto absolute bottom-4 left-4 xl:left-5">
                 <button
                   onClick={() => router.push(`/hasil-pengukuran?log=${activeLog ?? ""}&view=Peta`)}
                   className="text-[12px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline cursor-pointer whitespace-nowrap"
                 >
                   Lihat Peta <ArrowRight className="h-3 w-3" />
                 </button>
              </div>
           </div>
           
           {/* Map graphic mockup positioned exactly on the right */}
           <div className="absolute right-3 top-3 bottom-3 w-[52%] pointer-events-none sm:w-[63%]">
              <div className="relative w-full h-full rounded-[10px] border border-[#EAEAEA] bg-white overflow-hidden flex items-center justify-center">
                <Image src="/Peta_Preview.svg" fill alt="Peta Prisma Preview" className="object-cover object-center" />
              </div>
           </div>
        </Card>

        {/* Visualisasi 3D Preview */}
        <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white min-h-[190px] sm:min-h-[160px] relative overflow-hidden flex flex-col gap-0 py-0">
           <div className="p-4 2xl:p-5 flex-1 z-10 relative w-[45%] sm:w-[35%]">
              <h3 className="font-extrabold text-[15px] text-gray-900 mb-0.5">Visualisasi 3D</h3>
              <p className="text-[11px] text-gray-500 font-medium leading-tight mb-4 pr-1">Preview visualisasi deformasi prisma</p>
              
              <div className="mt-auto absolute bottom-4 left-4 xl:left-5">
                 <button
                   onClick={() => router.push("/visualisasi-3d")}
                   className="text-[12px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline cursor-pointer whitespace-nowrap"
                 >
                   Lihat 3D <ArrowRight className="h-3 w-3" />
                 </button>
              </div>
           </div>
           
           {/* 3D graphic mockup positioned exactly on the right */}
           <div className="absolute right-3 top-3 bottom-3 w-[52%] pointer-events-none sm:w-[63%]">
              <div className="relative w-full h-full rounded-[10px] border border-[#EAEAEA] bg-white overflow-hidden flex items-center justify-center">
                 <Image src="/visual_3D.svg" fill alt="Visualisasi 3D Preview" className="object-cover object-center" />
              </div>
           </div>
        </Card>
        </div>

      </div>
    </div>
  );
}

// ─── Small Metric Card Helper ───
function SmallMetricCard({title, value, unit, iconBg, iconColor, Icon, imageSrc, onClick}: {title: string, value: string|number, unit: string, iconBg: string, iconColor?: string, Icon?: React.ElementType, imageSrc?: string, onClick?: () => void}) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        // gap-0 py-0: div di dalam sudah punya p-3/p-4 sendiri.
        "col-span-1 border-[#EAEAEA] shadow-sm rounded-md relative overflow-hidden min-h-[128px] h-full transition-all duration-300 gap-0 py-0",
        onClick && "cursor-pointer hover:border-gray-400 hover:shadow-md active:scale-[0.98]"
      )}
    >
      <div className="p-3 lg:p-4 h-full flex flex-col justify-center items-center gap-2.5 lg:gap-3">
        <div className={cn("w-10 h-10 lg:w-11 lg:h-11 flex-shrink-0 rounded-[10px] flex items-center justify-center", iconBg)}>
          {imageSrc ? (
             <Image src={imageSrc} width={35} height={35} alt={title} className="object-contain w-5 h-5 lg:w-[30px] lg:h-[30px]" />
          ) : Icon ? (
             <Icon className={cn("h-5 w-5 lg:h-[22px] lg:w-[22px]", iconColor)} strokeWidth={2.5} />
          ) : null}
        </div>
        {/* w-full supaya `truncate` pada judul punya lebar acuan — tanpa itu
            items-center menyusutkan kolom ini seukuran isinya dan judul panjang
            (TEMPERATURE LOGGER) melebar keluar, bukan terpotong. */}
        <div className="flex flex-col items-center gap-0.5 w-full">
          <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-gray-700 font-bold w-full text-center truncate">{title}</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-extrabold text-[18px] sm:text-[19px] lg:text-[21px] xl:text-[22px] tracking-tight leading-none">{value}</span>
            <span className="text-[11px] lg:text-[12px] font-medium text-gray-800">{unit}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────
function BerandaContent() {
  const router = useRouter();
  const { loggers, isLoading, isError } = useLoggers();

  const categories = useMemo(() => groupByCategory(loggers), [loggers]);
  const rtsLoggers = useMemo(() => {
    const rtsCategory = categories.find((g) => g.kategori.toUpperCase().includes("RTS") || g.kategori.toUpperCase().includes("ADR"));
    return rtsCategory?.loggers || [];
  }, [categories]);
  
  // Selektor sekarang memilih SITE, bukan logger. Sebelumnya memilih logger tapi
  // menampilkan nama lokasi — terbaca seperti site, padahal riwayat dan angka
  // deformasi di bawahnya tidak ikut tersaring. Ambang bahaya, rotasi, dan peta
  // semuanya berkunci pada site, jadi site yang seharusnya jadi kendali utama.
  const { sites, badge: siteBadge } = useSites(false, true);

  // Site aktif ikut di URL (`?site=`) supaya bisa dibagikan dan tidak hilang
  // saat halaman di-reload — pola yang sama dipakai halaman Hasil Pengukuran.
  const searchParams = useSearchParams();
  const siteDariUrl = searchParams.get("site") ?? "";
  const [selectedSite, setSelectedSite] = useState<string>(siteDariUrl);

  const activeSite = sites.find((s) => s.slug === selectedSite) ?? sites[0];
  const activeSiteSlug = activeSite?.slug ?? "";

  const gantiSite = (slug: string) => {
    setSelectedSite(slug);
    // replace, bukan push — ganti site bukan langkah navigasi yang perlu
    // bisa ditekan Back berkali-kali.
    const q = new URLSearchParams(searchParams.toString());
    q.set("site", slug);
    router.replace(`/beranda?${q}`, { scroll: false });
  };

  // Logger diturunkan dari site (lihat /api/sites?with_logger=1). Kalau site
  // belum punya data sama sekali, jatuh ke logger RTS pertama supaya panel
  // telemetri tetap punya sesuatu untuk ditampilkan.
  const activeLogger =
    rtsLoggers.find((l) => l.id_logger === activeSite?.id_logger) ?? rtsLoggers[0];

  return (
    <div className="-m-4 md:-m-6 bg-[#F4F6F9] min-h-[calc(100vh-3.5rem)] p-3 sm:p-4 md:p-6 space-y-3 md:space-y-6">

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
             <Skeleton className="h-80 md:col-span-4 md:h-96" />
             <Skeleton className="h-80 md:col-span-8 md:h-96" />
          </div>
        </div>
      ) : isError ? (
        <Card className="py-0">
          <CardContent className="py-12 text-center text-red-500 font-medium">
            Gagal memuat data dashboard. Pastikan koneksi database sudah benar.
          </CardContent>
        </Card>
      ) : loggers.length === 0 ? (
        <Card className="py-0">
          <CardContent className="py-12 text-center text-gray-500 font-medium">
            Belum ada logger terdaftar di sistem.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top Controls: Site Selector */}
          <div className="flex w-full flex-col gap-2 bg-white border border-[#EAEAEA] rounded-[8px] px-4 py-3 sm:w-max sm:flex-row sm:items-center sm:gap-3 sm:py-2">
            <span className="text-[13px] font-bold text-gray-800">Site Aktif:</span>
            {isLoading ? (
              <div className="h-8 w-full bg-gray-200 animate-pulse rounded-md sm:w-[200px]" />
            ) : (
              <Select value={activeSiteSlug} onValueChange={(val) => { if (val) gantiSite(val); }}>
                <SelectTrigger className="h-8 w-full bg-transparent border-none shadow-none text-[13px] font-semibold text-gray-800 focus:ring-0 p-0 sm:w-[260px]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#303481]" />
                    <span className="truncate">{activeSite?.nama || "Pilih Site"}</span>
                    {activeSite && (
                      <span
                        className="rounded-full px-2 py-[1px] text-[9px] font-bold text-white"
                        style={{ backgroundColor: activeSite.badge_color }}
                      >
                        {activeSite.badge_label}
                      </span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} sideOffset={4} className="rounded-xl border-gray-100 shadow-lg">
                  {sites.map((s) => (
                    <SelectItem key={s.slug} value={s.slug} className="text-[13px] font-medium cursor-pointer">
                      {s.nama}
                      <span className="ml-1.5 text-[11px] text-gray-400">
                        {s.jumlah_sesi ?? 0} sesi
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Peringatan site — muncul sekali di atas, bukan hanya di tooltip badge */}
          {activeSiteSlug && siteBadge(activeSiteSlug).peringatan && (
            <div className="flex items-start gap-2.5 rounded-[8px] border border-amber-300 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="text-[12.5px] leading-relaxed text-amber-900">
                {siteBadge(activeSiteSlug).peringatan}. Angka pergeseran di bawah
                belum bisa dipakai mengambil keputusan.
              </div>
            </div>
          )}

          {activeLogger && activeSiteSlug && (
             // key=site → remount saat site berganti, jadi state internal
             // (mis. sesi yang dipilih) tidak terbawa dari site sebelumnya.
             <RtsDashboard
               key={activeSiteSlug}
               logger={activeLogger}
               site={activeSiteSlug}
               jumlahSesi={activeSite?.jumlah_sesi ?? 0}
             />
          )}
        </>
      )}
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
          <Loader2 className="w-8 h-8 animate-spin text-[#303481]" />
        </div>
      }
    >
      <BerandaContent />
    </Suspense>
  );
}
