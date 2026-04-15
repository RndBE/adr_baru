"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Gamepad2,
  MapPin,
  Thermometer,
  Zap,
  Droplets,
  Battery,
  Map as MapIcon,
  Box,
  RotateCcw,
  RefreshCw,
  Info,
  Clock,
  Activity,
  History,
  ArrowRight,
  TrendingUp,
  Loader2,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoggers, useLogKontrol, useDeformasi, useLoggerDetail } from "@/hooks/use-api";
import Image from "next/image";

// ─── Helper: format date nicely ──────────────────────────────
function fmtDate(d: string | Date | null, showSeconds = false, shortYear = false) {
  if (!d) return "-";
  const dt = new Date(d);
  const dateStr = dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: shortYear ? "2-digit" : "numeric",
  }).replace(/\//g, '-');
  const timeStr = dt.toLocaleTimeString("en-GB", { 
    hour: "2-digit", 
    minute: "2-digit", 
    second: showSeconds ? "2-digit" : undefined,
    hour12: false
  });
  return `${dateStr} ${timeStr}`;
}

// ─── Helper: badge colors ───────────────────────
function getSiteBadge(site: string) {
  switch (site?.toLowerCase()) {
    case "ccp":
    case "cpp 3":
      return { text: "CPP 3", bg: "bg-[#5484EE]" };
    case "wp":
      return { text: "WP", bg: "bg-[#EC7D30]" };
    case "rd":
      return { text: "RD", bg: "bg-[#8D93A4]" };
    default:
      return { text: site?.toUpperCase() || "UNK", bg: "bg-gray-400" };
  }
}

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
function RtsDashboard({ logger }: { logger: any }) {
  const { detail, isLoading: detailLoading } = useLoggerDetail(logger.id_logger);
  const { logs, isLoading: logsLoading } = useLogKontrol(undefined, 30);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const activeLog = selectedLog || (logs.length > 0 ? logs[0].id_log : null);
  const { deformasi, isLoading: defLoading } = useDeformasi(activeLog);

  const recentLogs = logs.slice(0, 8);

  const tempRts = detail?.tempData?.[0];
  const isConnected = !!tempRts;
  // Based on your UI, usually "Disconnected" is shown in red
  const statusRtsText = isConnected ? "Connected" : "Disconnected";
  const powerRts = tempRts?.sensor2 ?? 9; 
  const humidity = tempRts?.sensor3 ?? 41.99;
  const battery = tempRts?.sensor4 ?? 12;
  const temperature = tempRts?.sensor5 ?? 32.75;
  const lastUpdateStr = tempRts?.waktu ? fmtDate(tempRts.waktu, true) : "24-01-2026 17:19:00";

  const pengukuran = deformasi?.data_pengukuran || [];
  
  const totalRunning = logs.length;
  // Mocking exact values from your image
  const maxPergeseran = 13.74;
  const maxKecepatan = 2.25;

  return (
    <div className="space-y-4">
      {/* ─── TOP SEC: OVERVIEW CARDS ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Pos RTS Site Map */}
        <Card className="col-span-1 xl:col-span-3 rounded-lg shadow-sm border-[#EAEAEA]">
          <CardContent className="p-5 flex flex-col h-full justify-center">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="font-extrabold text-gray-900 text-[17px]">Pos RTS Site Map</h3>
                <div className="w-4 h-4 bg-[#2B3270] rounded-full flex items-center justify-center text-white text-[10px] font-bold">i</div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100/80 text-[11px] text-gray-700 font-medium border border-gray-200">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-600"></div>
                {lastUpdateStr}
              </div>
            </div>
            <Button className="w-full bg-[#2B3270] hover:bg-[#1a1e4a] text-white rounded-md h-[42px] flex items-center justify-center text-sm font-medium shadow-sm transition-colors">
              <Image src="/robot-arm.svg" width={18} height={18} alt="Robot Arm" className="mr-2 object-contain" />
              Kontrol ADR
            </Button>
          </CardContent>
        </Card>

        {/* RTS Widgets Row */}
        <div className="col-span-1 xl:col-span-9 grid grid-cols-2 md:grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr_1fr] gap-4 items-stretch">
          {/* Status Main Card */}
          <Card className="col-span-2 md:col-span-1 border-[#EAEAEA] shadow-sm rounded-lg flex flex-row items-center justify-start py-4 pr-4 pl-[115px] flex-nowrap relative overflow-hidden h-full">
            {/* Left Image positioned exactly at bottom */}
            <div className="absolute left-1 bottom-1 w-[150px] h-[110%] pointer-events-none flex items-end">
              <Image src="/sokkia.svg" width={140} height={150} alt="Sokkia Total Station" className="object-contain drop-shadow-sm translate-y-[2px]" />
            </div>
            {/* Right Status */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1 lg:mb-1.5">STATUS RTS</p>
              <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-1.5">
                <div className={cn("h-4 w-4 lg:h-[20px] lg:w-[20px] rounded-full flex-shrink-0", isConnected ? "bg-[#2DB77B]" : "bg-[#EF4444]")}></div>
                <span className={cn("font-extrabold text-[22px] sm:text-2xl lg:text-[28px] xl:text-[32px] tracking-tight truncate", isConnected ? "text-[#2DB77B]" : "text-[#EF4444]")}>
                  {statusRtsText}
                </span>
              </div>
              <p className="text-[9px] lg:text-[11px] text-gray-800 font-medium truncate">Terakhir terhubung: {lastUpdateStr}</p>
            </div>
          </Card>

          {/* Metric Cards */}
          <SmallMetricCard title="POWER RTS" value={powerRts} unit="Volt" iconBg="bg-[#FEF1D1]" imageSrc="/power_rts.svg" />
          <SmallMetricCard title="HUMIDITY LOGGER" value={humidity} unit="%" iconBg="bg-[#DEEBF5]" imageSrc="/humidity.svg"  />
          <SmallMetricCard title="BATTERY LOGGER" value={battery} unit="Volt" iconBg="bg-[#CDF2D3]" imageSrc="/battery.svg" />
          <SmallMetricCard title="TEMPERATURE LOGGER" value={temperature} unit="°C" iconBg="bg-[#FEF1D1]" imageSrc="/temperature.svg" />
        </div>
      </div>

      {/* ─── MIDDLE SEC: HISTORY & PRISMA DATA ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Riwayat Running Terbaru */}
        <Card className="col-span-1 xl:col-span-3 rounded-lg shadow-sm border-[#EAEAEA] h-[520px] flex flex-col pt-5 bg-white">
          <div className="px-5 flex items-center justify-between mb-4">
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
              recentLogs.map((log: any) => {
                const isActive = log.id_log === activeLog;
                const activeClasses = isActive ? "border-l-[3px] border-[#2B3270] bg-[#F4F6F9]" : "border-l-[3px] border-transparent";
                const badgeInfo = getSiteBadge(log.site);
                const isR0 = log.r0 === 1;

                return (
                  <button 
                    key={log.id_log}
                    onClick={() => setSelectedLog(log.id_log)}
                    className={cn(
                      "w-full flex items-center gap-3 py-3.5 px-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left",
                      activeClasses
                    )}
                  >
                    <span className="text-[13px] text-gray-700 font-medium min-w-[110px]">{fmtDate(log.datetime)}</span>
                    <div className="flex gap-1">
                       <span className={cn("text-[9px] font-bold px-2.5 py-0.5 rounded-full text-white", badgeInfo.bg)}>
                         {badgeInfo.text}
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
          <div className="border-t border-gray-100 p-3.5 flex justify-end">
             <button className="text-[13px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline">
               Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
             </button>
          </div>
        </Card>

        {/* Preview Data Prisma */}
        <Card className="col-span-1 xl:col-span-9 rounded-lg shadow-sm border border-[#EAEAEA] overflow-hidden flex flex-col h-[520px] bg-white">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg mb-1.5">Preview Data Prisma</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                  Date Selected
                  <span className="bg-[#2B3270] text-white px-2 py-0.5 rounded-full text-[10px]">{activeLog ? fmtDate(logs.find((l:any)=>l.id_log===activeLog)?.datetime) : "-"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                  Total Prism :
                  <span className="bg-[#2B3270] text-white px-2 py-0.5 rounded-full text-[10px] shadow-sm">{pengukuran.length || 0}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="outline" size="sm" className="h-[38px] border-[#2B3270] text-[#2B3270] bg-white hover:bg-[#2B3270] hover:text-white rounded-md font-semibold transition-colors px-4">
                <MapIcon className="mr-2 h-4 w-4" /> Buka Peta
              </Button>
              <Button size="sm" className="h-[38px] bg-[#2B3270] hover:bg-[#1a1e4a] text-white rounded-md font-semibold shadow-sm px-4">
                <Box className="mr-2 h-4 w-4" /> Buka 3D
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white border-t border-gray-100">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-10">
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
                  pengukuran.map((pr: any, idx: number) => {
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
          <div className="border-t border-gray-100 p-3.5 flex justify-end">
            <button className="text-[13px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline">
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>
      </div>

      {/* ─── BOTTOM SEC: SUMMARIES & MAP PREVIEWS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr_3fr] gap-4">
        {/* Ringkasan Harian */}
        <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white lg:col-span-1">
          <CardHeader className="p-4 2xl:px-5 pb-0">
            <CardTitle className="text-[15px] font-extrabold text-gray-900">Ringkasan Harian</CardTitle>
          </CardHeader>
          <CardContent className="p-4 2xl:p-5 grid grid-cols-2 gap-3 xl:gap-4">
             {/* Total Running */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#E5F5ED] flex items-center justify-center"><Activity className="h-[20px] w-[20px] text-[#2DB77B]"/></div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total Running</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none">{totalRunning} <span className="text-[10px] font-medium text-gray-500">running</span></p>
                </div>
             </div>
             {/* Running Terakhir */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#EBF3FF] flex items-center justify-center"><Clock className="h-[20px] w-[20px] text-[#4B90EE]"/></div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Running Terakhir</p>
                   {/* mock time layout */}
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none">{lastUpdateStr.split(' ')[1]?.slice(0,5)}<span className="text-[10px] font-bold text-gray-500">:{lastUpdateStr.split(' ')[1]?.slice(6)}</span></p>
                </div>
             </div>
             {/* Pergeseran Maks */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#FFF2DE] flex items-center justify-center"><TrendingUp className="h-[20px] w-[20px] text-[#F1A23A]"/></div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Pergeseran Maks.</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none mb-1">{maxPergeseran} <span className="text-[10px] font-medium text-gray-500">mm</span></p>
                   <div className="inline-block bg-[#FFF4E5] text-[#F1A23A] text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Prism C1 • 10:54:00</div>
                </div>
             </div>
             {/* Kecepatan Maks */}
             <div className="flex gap-2.5 items-start">
                <div className="min-w-[36px] w-9 h-9 rounded-lg bg-[#E8EAFD] flex items-center justify-center"><RefreshCw className="h-[20px] w-[20px] text-[#6A78D1]"/></div>
                <div>
                   <p className="text-[8px] xl:text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Kecepatan Maks.</p>
                   <p className="font-extrabold text-lg xl:text-xl text-gray-900 leading-none mb-1">{maxKecepatan} <span className="text-[10px] font-medium text-gray-500">mm/hari</span></p>
                   <div className="inline-block bg-[#E8EAFD] text-[#6A78D1] text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Prism C6 • 10:50:00</div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Peta Prisma Preview */}
        <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white lg:col-span-1 min-h-[160px] relative overflow-hidden flex flex-col">
           <div className="p-4 2xl:p-5 flex-1 z-10 relative">
              <h3 className="font-extrabold text-[15px] text-gray-900 mb-0.5">Peta Prisma</h3>
              <p className="text-[11px] text-gray-500 font-medium leading-tight mb-4">Preview persebaran<br/>titik prisma</p>
              
              <div className="mt-auto absolute bottom-4 left-4 xl:left-5">
                 <button className="text-[12px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline">
                   Lihat Peta <ArrowRight className="h-3 w-3" />
                 </button>
              </div>
           </div>
           
           {/* Map graphic mockup positioned exactly on the right */}
           <div className="absolute right-3 top-0 bottom-0 w-[55%] flex items-center justify-center">
              <div className="relative w-full h-[120px] bg-white border border-gray-200 rounded-lg overflow-hidden group">
                  <div className="absolute inset-x-0 bottom-0 top-6 left-6 border-l border-t border-gray-300 rounded-tl-3xl"></div>
                   {/* RTS marker */}
                  <div className="absolute top-1/2 left-1/2 text-[9px] text-green-700 bg-white border border-green-200 px-1 py-0.5 rounded shadow-sm flex items-center gap-0.5 ml-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> RTS
                  </div>
                  {/* points */}
                  <div className="absolute top-1/2 left-8 flex gap-[2px] flex-wrap w-8 transform rotate-45">
                    {Array.from({length: 8}).map((_,i) => <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-sm"></div>)}
                  </div>
              </div>
           </div>
        </Card>

        {/* Visualisasi 3D Preview */}
        <Card className="rounded-lg shadow-sm border-[#EAEAEA] bg-white lg:col-span-1 min-h-[160px] relative overflow-hidden flex flex-col">
           <div className="p-4 2xl:p-5 flex-1 z-10 relative">
              <h3 className="font-extrabold text-[15px] text-gray-900 mb-0.5">Visualisasi 3D</h3>
              <p className="text-[11px] text-gray-500 font-medium leading-tight mb-4">Preview visualisasi<br/>deformasi prisma</p>
              
              <div className="mt-auto absolute bottom-4 left-4 xl:left-5">
                 <button className="text-[12px] text-[#2B3270] font-bold flex items-center gap-1.5 hover:underline">
                   Lihat 3D <ArrowRight className="h-3 w-3" />
                 </button>
              </div>
           </div>
           
           {/* 3D graphic mockup positioned exactly on the right */}
           <div className="absolute right-3 top-0 bottom-0 w-[55%] flex items-center justify-center">
              <div className="relative w-full h-[120px] bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                 <div className="w-full h-full relative" style={{perspective: '150px'}}>
                    <div className="absolute top-1/2 left-1/2 w-[80%] h-[80%] border border-gray-300 rounded-[50%] -translate-x-1/2 -translate-y-1/2 transform rotate-x-[60deg] opacity-70"></div>
                     <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-gray-300 border border-gray-400 rotate-45 shadow-lg -translate-x-1/2 -translate-y-1/2"></div>
                    {/* axis line */}
                    <div className="absolute top-1/2 left-1/2 w-16 h-[1px] bg-red-400 -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
                    <div className="absolute top-1/2 left-1/2 w-16 h-[1px] bg-gray-400 -translate-x-1/2 -translate-y-1/2 -rotate-45"></div>
                    {/* dots */}
                    <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-red-500 rounded-full"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-red-500 rounded-full"></div>
                 </div>
              </div>
           </div>
        </Card>

      </div>
    </div>
  );
}

// ─── Small Metric Card Helper ───
function SmallMetricCard({title, value, unit, iconBg, iconColor, Icon, imageSrc}: {title: string, value: string|number, unit: string, iconBg: string, iconColor?: string, Icon?: React.ElementType, imageSrc?: string}) {
  return (
    <Card className="col-span-1 rounded-lg shadow-sm border border-[#EAEAEA] flex flex-col justify-center items-start p-3 bg-white h-full">
      <div className={cn("w-12 h-12 flex-shrink-0 rounded-[10px] flex items-center justify-center", iconBg)}>
        {imageSrc ? (
           <Image src={imageSrc} width={30} height={30} alt={title} className="object-contain" />
        ) : Icon ? (
           <Icon className={cn("h-6 w-6", iconColor)} strokeWidth={2.5} />
        ) : null}
      </div>
      <p className="text-[12px] uppercase text-gray-950 font-semibold tracking-wider leading-tight w-full truncate">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="font-extrabold text-[24px] text-gray-950 leading-none">{value}</span>
        <span className="text-[12px] font-medium text-gray-950">{unit}</span>
      </div>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function BerandaPage() {
  const { loggers, isLoading, isError } = useLoggers();

  const categories = useMemo(() => groupByCategory(loggers), [loggers]);
  const rtsCategory = categories.find((g) => g.kategori.toUpperCase().includes("RTS") || g.kategori.toUpperCase().includes("ADR"));
  const firstRtsLogger = rtsCategory?.loggers?.[0]; 

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-12 gap-4">
             <Skeleton className="col-span-4 h-96" />
             <Skeleton className="col-span-8 h-96" />
          </div>
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500 font-medium">
            Gagal memuat data dashboard. Pastikan koneksi database sudah benar.
          </CardContent>
        </Card>
      ) : loggers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 font-medium">
            Belum ada logger terdaftar di sistem.
          </CardContent>
        </Card>
      ) : (
        <>
          {firstRtsLogger && (
             <RtsDashboard logger={firstRtsLogger} />
          )}
        </>
      )}
    </div>
  );
}
