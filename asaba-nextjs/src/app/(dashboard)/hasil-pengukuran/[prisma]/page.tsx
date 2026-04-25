"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Loader2, CalendarIcon, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RtsConnectionBadge } from "@/components/RtsConnectionBadge";
import { useRtsConnectionStatus } from "@/hooks/use-api";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0");
  return `${h}:00`;
});

const PARAM_OPTIONS = [
  { value: "sensor8", label: "Northing Y", short: "NORTHING Y" },
  { value: "sensor9", label: "Easting X", short: "EASTING X" },
  { value: "sensor10", label: "Elevation", short: "ELEVATION" },
];

function fmtDate(dt: string) {
  if (!dt) return "-";
  const d = new Date(dt);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtDateShort(date: Date | string | number) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${dd}`;
}

function toISODate(date: Date | string | number) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "1970-01-01";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fmtDateLong(date: Date | string | number) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const ChartTooltip = ({ active, payload, label, paramLabel }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {paramLabel}: <span className="font-semibold">{Number(p.value).toFixed(3)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface PrismaRow {
  id_prisma: string;
  nama_prisma: string;
  waktu: string;
  temp_tembak: {
    nama_prisma: string;
    N0: number; E0: number; Z0: number;
    N1: number; E1: number; Z1: number;
    HA0: string; VA0: string; SD0: string;
    HA1: string; VA1: string; SD1: string;
  };
}

function InfoCard({ title, data }: {
  title: string;
  data: { label: string; value: string; iconBg: string; iconSrc: string }[];
}) {
  return (
    <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm p-4 flex flex-col gap-3.5">
      <h4 className="font-bold text-[14.5px] text-gray-900">{title}</h4>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map((item, i) => (
          <div key={i} className="border border-[#EAEAEA] rounded-lg p-2.5 flex flex-col items-start justify-between gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className={cn("w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 mb-1", item.iconBg)}>
              <Image src={item.iconSrc} width={14} height={14} alt={item.label} className="object-contain opacity-80" />
            </div>
            <div className="flex flex-col gap-0.5 w-full">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold truncate">{item.label}</p>
              <p className="text-[11.5px] font-extrabold text-gray-900 truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Content ───
function PrismaDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected } = useRtsConnectionStatus();

  const prismaName = decodeURIComponent(params.prisma as string);
  const idLog = searchParams.get("log") || "";

  const [selectedPrisma, setSelectedPrisma] = useState(prismaName);
  const [parameter, setParameter] = useState("sensor8");
  const [dateFrom, setDateFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; });
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  
  // Custom Date Range Picker State
  const [rangeOpen, setRangeOpen] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState<Date>(dateFrom);
  const [tempDateTo, setTempDateTo] = useState<Date>(dateTo);
  const [monthFrom, setMonthFrom] = useState<Date>(dateFrom);
  const [monthTo, setMonthTo] = useState<Date>(dateTo);
  const [timeFrom, setTimeFrom] = useState("00:00");
  const [timeTo, setTimeTo] = useState("23:59");
  
  const timeFromRef = useRef<HTMLDivElement>(null);
  const timeToRef = useRef<HTMLDivElement>(null);

  const [prismaList, setPrismaList] = useState<PrismaRow[]>([]);
  const [currentPrisma, setCurrentPrisma] = useState<PrismaRow | null>(null);
  const [deformasiLoading, setDeformasiLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [tanggalData, setTanggalData] = useState("");

  const paramLabel = PARAM_OPTIONS.find(p => p.value === parameter)?.label || "Northing Y";
  const paramShort = PARAM_OPTIONS.find(p => p.value === parameter)?.short || "NORTHING Y";

  // Fetch prisma list
  useEffect(() => {
    if (!idLog) return;
    setDeformasiLoading(true);
    fetch(`/api/deformasi?id_log=${idLog}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setPrismaList(json.data.data_pengukuran);
          setTanggalData(json.data.tanggal || "");
          const found = json.data.data_pengukuran.find((p: PrismaRow) => p.nama_prisma === selectedPrisma);
          if (found) setCurrentPrisma(found);
        }
      })
      .catch(console.error)
      .finally(() => setDeformasiLoading(false));
  }, [idLog]);

  // Helper: parse chart data from API response
  const parseChartData = useCallback((data: any[]) => {
    return data.map((d: any) => {
      const dt = new Date(d.waktu);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      return {
        waktu: `${dd}/${mm} ${hh}:${mi}`,
        nilai: d.nilai != null ? parseFloat(Number(d.nilai).toFixed(4)) : null,
        rawWaktu: d.waktu,
      };
    });
  }, []);

  // Unified effect: find prisma + auto-fetch chart data
  const lastAutoFetchKeyRef = useRef<string>("");
  useEffect(() => {
    if (prismaList.length === 0) return;
    const found = prismaList.find(p => p.nama_prisma === selectedPrisma);
    if (!found) return;

    setCurrentPrisma(found);

    // Auto-adjust date range
    if (found.waktu) {
      const latestDate = new Date(found.waktu);
      const pastDate = new Date(latestDate);
      pastDate.setDate(pastDate.getDate() - 7);

      setDateTo(latestDate);
      setTempDateTo(latestDate);
      setDateFrom(pastDate);
      setTempDateFrom(pastDate);

      // Auto-fetch chart — skip if same prisma+parameter already fetched
      const key = `${found.id_prisma}_${parameter}`;
      if (key === lastAutoFetchKeyRef.current) return;
      lastAutoFetchKeyRef.current = key;

      const dari = `${toISODate(pastDate)} 00:00:00`;
      const sampai = `${toISODate(latestDate)} 23:59:00`;

      setIsFetching(true);
      fetch(`/api/analisa?type=range&id_prisma=${encodeURIComponent(found.id_prisma)}&kolom=${parameter}&dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`)
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data) {
            setChartData(parseChartData(json.data.chart_data));
            setTableData(json.data.tabel_data || []);
          }
        })
        .catch(console.error)
        .finally(() => setIsFetching(false));
    }
  }, [selectedPrisma, prismaList, parameter, parseChartData]);

  const fetchAnalisa = useCallback(async (overrideDateFrom?: Date, overrideDateTo?: Date) => {
    if (!selectedPrisma || !currentPrisma?.id_prisma) return;
    setIsFetching(true);
    try {
      const useDateFrom = overrideDateFrom || dateFrom;
      const useDateTo = overrideDateTo || dateTo;
      const dari = `${toISODate(useDateFrom)} ${timeFrom}:00`;
      const sampai = `${toISODate(useDateTo)} ${timeTo}:00`;
      const res = await fetch(
        `/api/analisa?type=range&id_prisma=${encodeURIComponent(currentPrisma.id_prisma)}&kolom=${parameter}&dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setChartData(parseChartData(json.data.chart_data));
        setTableData(json.data.tabel_data || []);
      }
    } catch (err) {
      console.error("Fetch analisa error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [selectedPrisma, currentPrisma?.id_prisma, parameter, dateFrom, dateTo, timeFrom, timeTo, parseChartData]);

  const handlePrismaChange = (val: string) => {
    setSelectedPrisma(val);
    router.replace(`/hasil-pengukuran/${encodeURIComponent(val)}?log=${idLog}`, { scroll: false });
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    if (tableData.length === 0) { alert("Tidak ada data untuk didownload."); return; }
    try {
      const ExcelJS = await import("exceljs").then(m => m.default || m);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Analisa Prisma");
      ws.columns = [{ key: "waktu", width: 25 }, { key: "nilai", width: 20 }];
      const titleRow = ws.addRow([`${paramLabel} - Prisma ${selectedPrisma}`]);
      ws.mergeCells("A1:B1");
      titleRow.getCell(1).font = { size: 14, bold: true };
      titleRow.getCell(1).alignment = { horizontal: "center" };
      ws.addRow([]);
      const hdr = ws.addRow(["WAKTU", paramShort]);
      hdr.eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: "center" }; c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
      tableData.forEach(r => {
        const row = ws.addRow([r.waktu ? new Date(r.waktu).toLocaleString("id-ID") : "-", r.nilai ?? "-"]);
        row.eachCell(c => { c.alignment = { horizontal: "center" }; c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
      });
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `Analisa_${selectedPrisma}_${paramLabel}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert("Gagal membuat file Excel."); }
  };

  const t = currentPrisma?.temp_tembak;
  const chartTitle = `${paramLabel} dari ${fmtDateShort(dateFrom)} sampai ${fmtDateShort(dateTo)}`;

  return (
    <div className="flex flex-col gap-5 w-full pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13.5px]">
        <span onClick={() => router.push("/hasil-pengukuran")} className="text-gray-500 cursor-pointer hover:text-[#303481] transition-colors font-medium">
          Hasil Pengukuran
        </span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-semibold">Prisma {selectedPrisma}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white border border-[#EAEAEA] rounded-[8px] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-full bg-[#E5E5E5] flex items-center justify-center flex-shrink-0 relative">
            {isConnected && <div className="absolute w-3.5 h-3.5 rounded-full bg-green-400/80 animate-ping" />}
            <div className={cn("w-2.5 h-2.5 rounded-full relative z-10", isConnected ? "bg-[#06C022]" : "bg-gray-800")} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="font-bold text-black text-[15.5px] leading-tight">Pos RTS Site MIP</p>
            <RtsConnectionBadge />
          </div>
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button className="flex items-center gap-2 text-sm bg-[#303481] text-white hover:bg-[#1f2259] transition-colors border-none shadow-sm rounded-md h-[38px] px-4 cursor-pointer" />
            }
          >
            <Info className="w-[18px] h-[18px]" /> Informasi
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[480px] p-0 bg-white">
            <SheetHeader className="px-6 py-5 border-b border-gray-100 flex flex-row items-center justify-center relative">
              <SheetTitle className="text-center font-semibold text-black text-[15px] w-full pt-1">Informasi Prisma</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-10 py-8">
              {[
                { label: "Nama Prisma", value: currentPrisma?.nama_prisma },
                { label: "ID Prisma", value: currentPrisma?.id_prisma },
                { label: "Waktu Pengukuran", value: currentPrisma?.waktu ? fmtDate(currentPrisma.waktu) : "-" },
                { label: "Easting (X)", value: t?.E1?.toFixed(4) },
                { label: "Northing (Y)", value: t?.N1?.toFixed(4) },
                { label: "Elevation (Z)", value: t?.Z1?.toFixed(4) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-black">{label}</span>
                  <span className="text-[13.5px] text-gray-800">{value || "-"}</span>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Left Sidebar */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl p-5 h-fit text-slate-800">
          {/* Prisma */}
          <div className="text-[13.5px] font-bold mb-2 text-gray-900">Prisma</div>
          <Select value={selectedPrisma} onValueChange={(v) => v && handlePrismaChange(v)}>
            <SelectTrigger className="w-full h-[38px] px-3 text-[12px] border border-[#8385B3] rounded-md cursor-pointer bg-white text-[#8385B3] shadow-sm hover:border-[#6163a0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="rounded-[10px] border-[#EAEAEA] shadow-lg p-1 max-h-[200px]">
              {deformasiLoading ? (
                <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                prismaList.map(p => (
                  <SelectItem key={p.id_prisma} value={p.nama_prisma} className="text-sm py-2 px-3 rounded-md cursor-pointer focus:bg-[#D6D6E6]">
                    {p.nama_prisma}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Parameter */}
          <div className="text-[13.5px] font-bold mb-2 mt-5 text-gray-900">Parameter</div>
          <Select value={parameter} onValueChange={(v) => v && setParameter(v)}>
            <SelectTrigger className="w-full h-[38px] px-3 text-[12px] border border-[#8385B3] rounded-md cursor-pointer bg-white text-[#8385B3] shadow-sm hover:border-[#6163a0]">
              <SelectValue>{paramLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="rounded-[10px] border-[#EAEAEA] shadow-lg p-1">
              {PARAM_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm py-2 px-3 rounded-md cursor-pointer focus:bg-[#D6D6E6]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rentang */}
          <div className="text-[13.5px] font-bold mb-2 mt-5 text-gray-900">Rentang</div>
          <div className="flex flex-col gap-2 relative w-full">
            <Popover open={rangeOpen} onOpenChange={(open) => {
              setRangeOpen(open);
              if (open) {
                setTempDateFrom(dateFrom);
                setTempDateTo(dateTo);
                setMonthFrom(dateFrom);
                setMonthTo(dateTo);
                setTimeout(() => {
                  if (timeFromRef.current) {
                    const activeEl = timeFromRef.current.querySelector('[data-active="true"]');
                    if (activeEl) activeEl.scrollIntoView({ block: "center" });
                  }
                  if (timeToRef.current) {
                    const activeEl = timeToRef.current.querySelector('[data-active="true"]');
                    if (activeEl) activeEl.scrollIntoView({ block: "center" });
                  }
                }, 50);
              }
            }}>
              <PopoverTrigger className="w-full h-[38px] px-3 flex items-center justify-between text-[12px] border border-[#8385B3] rounded-md cursor-pointer bg-white text-[#8385B3] shadow-sm hover:border-[#6163a0]">
                <span className="truncate mr-2 font-medium">
                  {toISODate(dateFrom).replace(/-/g, '/')} {timeFrom} - {toISODate(dateTo).replace(/-/g, '/')} {timeTo}
                </span>
                <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </PopoverTrigger>
              <PopoverContent className="w-[640px] p-5 border border-slate-200 shadow-2xl rounded-2xl bg-white flex flex-col" align="start" sideOffset={8}>
                
                {/* Top Controls: Start Date/Time -> End Date/Time */}
                <div className="flex items-center gap-3">
                  {/* Left Side Inputs */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-9 px-3 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 bg-white">
                      <CalendarIcon className="w-4 h-4 text-slate-500" />
                      {fmtDateLong(tempDateFrom)}
                    </div>
                    <Select value={timeFrom} onValueChange={(v) => v && setTimeFrom(v)}>
                      <SelectTrigger className="h-9 px-3 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 bg-white shadow-none min-w-[100px] focus:ring-0 focus:ring-offset-0 data-[state=open]:border-[#303481] data-[state=open]:ring-1 data-[state=open]:ring-[#303481]/20 [&>svg:last-child]:hidden hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>
                          <SelectValue placeholder={timeFrom} />
                        </div>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[260px] rounded-[10px] min-w-[100px] p-1">
                        {HOURS.map(h => (
                          <SelectItem key={h} value={h} className="text-xs font-medium cursor-pointer focus:bg-[#8385B3] focus:text-white rounded-md py-2 justify-center">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Divider */}
                  <div className="w-8 flex items-center justify-center text-slate-700">→</div>

                  {/* Right Side Inputs */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-9 px-3 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 bg-white">
                      <CalendarIcon className="w-4 h-4 text-slate-500" />
                      {fmtDateLong(tempDateTo)}
                    </div>
                    <Select value={timeTo} onValueChange={(v) => v && setTimeTo(v)}>
                      <SelectTrigger className="h-9 px-3 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 bg-white shadow-none min-w-[100px] focus:ring-0 focus:ring-offset-0 data-[state=open]:border-[#303481] data-[state=open]:ring-1 data-[state=open]:ring-[#303481]/20 [&>svg:last-child]:hidden hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>
                          <SelectValue placeholder={timeTo} />
                        </div>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[260px] rounded-[10px] min-w-[100px] p-1">
                        {HOURS.map(h => (
                          <SelectItem key={h} value={h} className="text-xs font-medium cursor-pointer focus:bg-[#8385B3] focus:text-white rounded-md py-2 justify-center">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Duration Indicator */}
                <div className="mt-2 text-center text-xs text-slate-600">
                  <span>{Math.max(1, Math.ceil(Math.abs(tempDateTo.getTime() - tempDateFrom.getTime()) / (1000 * 60 * 60 * 24)))} hari</span>
                </div>

                {/* Calendars Grid */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* Left Calendar */}
                  <div className="rounded-xl border border-slate-200 p-3 bg-white flex justify-center" style={{ '--primary': '#8385B3', '--muted': '#E8E8F0' } as React.CSSProperties}>
                    <Calendar 
                      mode="range" 
                      selected={{ from: tempDateFrom, to: tempDateTo }} 
                      onSelect={(_range, selectedDay) => {
                        if (selectedDay) {
                          setTempDateFrom(selectedDay);
                          if (selectedDay > tempDateTo) {
                            setTempDateTo(selectedDay);
                          }
                        }
                      }} 
                      month={monthFrom} 
                      onMonthChange={setMonthFrom} 
                      className="p-0" 
                    />
                  </div>

                  {/* Right Calendar */}
                  <div className="rounded-xl border border-slate-200 p-3 bg-white flex justify-center" style={{ '--primary': '#8385B3', '--muted': '#E8E8F0' } as React.CSSProperties}>
                    <Calendar 
                      mode="range" 
                      selected={{ from: tempDateFrom, to: tempDateTo }} 
                      onSelect={(_range, selectedDay) => {
                        if (selectedDay) {
                          setTempDateTo(selectedDay);
                          if (selectedDay < tempDateFrom) {
                            setTempDateFrom(selectedDay);
                          }
                        }
                      }} 
                      month={monthTo} 
                      onMonthChange={setMonthTo} 
                      className="p-0" 
                    />
                  </div>
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-end gap-3 mt-2 pt-4">
                  <Button variant="outline" onClick={() => setRangeOpen(false)} className="h-[38px] px-6 text-[13px] font-semibold text-slate-600 border border-slate-300 rounded-[8px] hover:bg-slate-50 cursor-pointer">
                    Batal
                  </Button>
                  <Button onClick={() => { setDateFrom(tempDateFrom); setDateTo(tempDateTo); setRangeOpen(false); }} className="h-[38px] px-6 text-[13px] font-semibold bg-[#303481] hover:bg-[#1f2259] text-white rounded-[8px] cursor-pointer">
                    Terapkan
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <button
            type="button"
            onClick={() => fetchAnalisa()}
            disabled={isFetching}
            className="w-full mt-6 bg-[#303481] hover:bg-[#1f2259] text-white rounded-lg h-[42px] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            {isFetching ? "Memuat..." : "Tampil Data"}
          </button>
        </div>

        {/* Right Content */}
        <div className="flex flex-col gap-5 w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <InfoCard
              title="Pengukuran Terbaru"
              data={[
                { label: "Tanggal", value: currentPrisma?.waktu ? fmtDate(currentPrisma.waktu) : "-", iconBg: "bg-[#EBF1FF]", iconSrc: "/kalender.svg" },
                { label: "Easting (X)", value: t?.E1 != null ? t.E1.toFixed(4) : "-", iconBg: "bg-[#FDE2E4]", iconSrc: "/slope_distance.svg" },
                { label: "Northing (Y)", value: t?.N1 != null ? t.N1.toFixed(4) : "-", iconBg: "bg-[#DCFCE7]", iconSrc: "/vertical_angle.svg" },
                { label: "Elevation", value: t?.Z1 != null ? t.Z1.toFixed(4) : "-", iconBg: "bg-[#FFEDD5]", iconSrc: "/horizontal_angle.svg" },
              ]}
            />
            <InfoCard
              title="Awal Pengukuran"
              data={[
                { label: "Tanggal", value: currentPrisma?.waktu ? fmtDate(currentPrisma.waktu) : "-", iconBg: "bg-[#EBF1FF]", iconSrc: "/kalender.svg" },
                { label: "Easting (X)", value: t?.E0 != null ? t.E0.toFixed(4) : "-", iconBg: "bg-[#FDE2E4]", iconSrc: "/slope_distance.svg" },
                { label: "Northing (Y)", value: t?.N0 != null ? t.N0.toFixed(4) : "-", iconBg: "bg-[#DCFCE7]", iconSrc: "/vertical_angle.svg" },
                { label: "Elevation", value: t?.Z0 != null ? t.Z0.toFixed(4) : "-", iconBg: "bg-[#FFEDD5]", iconSrc: "/horizontal_angle.svg" },
              ]}
            />
          </div>

          {/* Chart */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] p-5 pb-4">
            <h2 className="text-center font-bold text-gray-900 text-[15px] leading-tight mb-0.5">{chartTitle}</h2>
            <p className="text-center text-xs text-gray-500 mb-4">Pos RTS Site MIP</p>
            {isFetching ? (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#303481]" />
                  <span className="text-[13px] font-medium">Memuat grafik...</span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-400 text-[13px]">
                Tidak ada data pada rentang ini. Klik &quot;Tampil Data&quot; untuk memuat.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradNilai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#303481" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#303481" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis
                    dataKey="waktu"
                    tick={{ fontSize: 10, fill: "#9E9E9E" }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 12) - 1)}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#9E9E9E" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip paramLabel={paramLabel} />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} formatter={() => <span className="text-gray-600">{paramLabel}</span>} />
                  <Area type="monotone" dataKey="nilai" stroke="#303481" strokeWidth={2} fill="url(#gradNilai)" dot={chartData.length <= 50 ? { r: 3, fill: "#fff", stroke: "#303481", strokeWidth: 2 } : false} activeDot={{ r: 5 }} name={paramLabel} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
              <h3 className="font-bold text-gray-900 text-[14.5px]">
                {chartTitle}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 text-xs border-[#2E7D32] text-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] font-semibold transition-colors rounded-md h-[34px] px-3 cursor-pointer shadow-sm"
              >
                <Download className="w-[14px] h-[14px]" strokeWidth={2.5} /> Download Excel
              </Button>
            </div>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader className="bg-[#EAEAEA]/40 sticky top-0 z-10">
                  <TableRow className="border-b border-[#EAEAEA]">
                    <TableHead className="text-[11px] font-bold text-gray-600 py-3 text-left pl-5 uppercase">WAKTU</TableHead>
                    <TableHead className="text-[11px] font-bold text-gray-600 py-3 text-left uppercase pl-5">{paramShort}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetching ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-gray-400">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#303481]" />
                      </TableCell>
                    </TableRow>
                  ) : tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-gray-500 font-medium">
                        Tidak ada data pada rentang ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...tableData].reverse().map((row: any, i: number) => (
                      <TableRow key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <TableCell className="py-3 pl-5 text-[12px] text-gray-700 font-mono">
                          {row.waktu ? new Date(row.waktu).toLocaleString("id-ID") : "-"}
                        </TableCell>
                        <TableCell className="py-3 text-left pl-5 text-[12px] text-gray-700 tabular-nums font-mono">
                          {row.nilai != null ? row.nilai : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrismaDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#303481]" /></div>}>
      <PrismaDetailContent />
    </Suspense>
  );
}
