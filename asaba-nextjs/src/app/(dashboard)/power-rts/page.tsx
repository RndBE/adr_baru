"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Info, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ─── Mock Data Generator ───
const generateHourlyData = (date: string) => {
  const hours = Array.from({ length: 11 }, (_, i) => i);
  return hours.map((h) => {
    const label = `${String(h).padStart(2, "0")}:00`;
    const base = 0.75 + Math.sin(h * 0.8) * 0.5;
    const rerata = parseFloat(base.toFixed(2));
    const min = parseFloat((rerata - 0.25).toFixed(2));
    const maks = parseFloat((rerata + 0.25).toFixed(2));
    return { waktu: label, rerata, min, maks };
  });
};

const PARAMETER_OPTIONS = [
  { value: "power_rts", label: "Power RTS" },
  { value: "humidity", label: "Humidity Logger" },
  { value: "battery", label: "Battery Logger" },
  { value: "temperature", label: "Temperature Logger" },
];

const ANALISA_OPTIONS = [
  { value: "hari", label: "Hari" },
  { value: "tahun", label: "Tahun" },
  { value: "bulan", label: "Bulan" },
  { value: "rentang", label: "Rentang" },
];

// ─── Custom Tooltip ───
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">{p.value} V</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Format date to DD-MM-YYYY ───
function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// ─── Logger Info Type ───
type LoggerInfo = {
  id_logger: string;
  nama_lokasi: string | null;
  nama_logger: string;
  seri: string | null;
  sensor: string | null;
  serial_number: string | null;
  nosell: string | null;
  imei: string | null;
  tgl_kontrak: string | null;
  tgl_aktif: string | null;
  garansi: string | null;
};

// ─── Main Page ───
const LOGGER_ID = "30002";

export default function PowerRtsPage() {
  const router = useRouter();
  const [parameter, setParameter] = useState("power_rts");
  const [analisaDalam, setAnalisaDalam] = useState("hari");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 3, 2));
  const [calOpen, setCalOpen] = useState(false);
  const [chartData, setChartData] = useState(() =>
    generateHourlyData("02-04-2026")
  );
  const [loggerInfo, setLoggerInfo] = useState<LoggerInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch logger info from database on mount
  useEffect(() => {
    setInfoLoading(true);
    fetch(`/api/loggers/${LOGGER_ID}/informasi`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setLoggerInfo(json.data as LoggerInfo);
      })
      .catch((err) => console.error("Failed to fetch logger info:", err))
      .finally(() => setInfoLoading(false));
  }, []);

  const paramLabel =
    PARAMETER_OPTIONS.find((p) => p.value === parameter)?.label || "Power RTS";

  const handleTampilData = () => {
    setChartData(generateHourlyData(selectedDate ? formatDate(selectedDate) : "02-04-2026"));
  };

  const displayDate = selectedDate ? formatDate(selectedDate) : "-";

  const chartTitle = `Rerata ${paramLabel} pada ${displayDate}`;

  const yDomain = [-3, 1];

  return (
    <div className="-m-4 md:-m-6 bg-[#F4F6F9] min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2">
        <p className="text-sm text-gray-500">
          <span
            onClick={() => router.push("/beranda")}
            className="cursor-pointer hover:text-[#2B3270] transition-colors"
          >
            Dashboard
          </span>{" "}
          /{" "}
          <span className="text-gray-900 font-semibold">Power RTS</span>
        </p>
      </div>

      {/* Header Card */}
      <div className="px-6 pb-4">
        <div className="bg-white border border-[#EAEAEA] rounded-[6px] shadow-sm px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-[38px] h-[38px] rounded-full bg-[#E5E5E5] flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-bold text-black text-[15.5px] leading-tight">
                {loggerInfo?.nama_lokasi || "Pos RTS Site MIP"}
              </p>
              <p className="text-[13px] text-gray-800 font-medium">
                {isConnected ? "Koneksi Terhubung" : "Koneksi Terputus"}
              </p>
            </div>
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button className="flex items-center gap-2 text-sm bg-[#303481] text-white hover:bg-[#1f2259] transition-colors border-none shadow-sm rounded-md h-[38px] px-4 cursor-pointer" />
              }
            >
              <Info className="w-[18px] h-[18px]" />
              Informasi
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[480px] p-0 bg-white">
              <SheetHeader className="px-6 py-5 border-b border-gray-100 flex flex-row items-center justify-center relative">
                <SheetTitle className="text-center font-semibold text-black text-[15px] w-full pt-1">Informasi Logger</SheetTitle>
              </SheetHeader>

              {infoLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-[#303481] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-6 px-10 py-8">
                  {[
                    { label: "Id Logger",       value: loggerInfo?.id_logger },
                    { label: "Seri Logger",     value: loggerInfo?.seri },
                    { label: "Sensor",          value: loggerInfo?.sensor },
                    { label: "Serial Number",   value: loggerInfo?.serial_number },
                    { label: "No. Seluler",     value: loggerInfo?.nosell },
                    { label: "IMEI",            value: loggerInfo?.imei },
                    { label: "Tanggal Kontrak", value: loggerInfo?.tgl_kontrak },
                    { label: "Logger Aktif",    value: loggerInfo?.tgl_aktif },
                    { label: "Masa Garansi",    value: loggerInfo?.garansi },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[13.5px] font-bold text-black">{label}</span>
                      <span className="text-[13.5px] text-gray-800">{value || "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-6 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
        {/* ─── Left Sidebar Filter ─── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 h-fit text-slate-800">
          <div className="grid grid-cols-1 gap-3">
            <div>
              {/* Parameter */}
              <div className="text-[15px] font-semibold mb-2 mt-1">Parameter</div>
              <Select value={parameter} onValueChange={(val) => { if (val !== null) setParameter(val); }}>
                <SelectTrigger className="w-full h-[42px] px-3 text-sm border border-[#303481] rounded-lg cursor-pointer bg-white text-slate-700 outline-none focus:ring-2 focus:ring-[#303481]/20 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  alignItemWithTrigger={false} 
                  side="bottom" 
                  sideOffset={4}
                  className="rounded-[10px] border-[#EAEAEA] shadow-[0_4px_12px_rgba(0,0,0,0.1)] p-1 blue-scrollbar max-h-[160px]"
                >
                  {PARAMETER_OPTIONS.map((opt) => (
                    <SelectItem 
                      key={opt.value} 
                      value={opt.value} 
                      className="text-sm py-2 px-3 mx-0.5 my-0.5 rounded-md cursor-pointer text-slate-700 focus:bg-[#D6D6E6] focus:text-slate-900 [&_span.absolute]:hidden"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Analisa Dalam */}
              <div className="text-[15px] font-semibold mb-2 mt-5">Analisa Dalam</div>
              <RadioGroup
                value={analisaDalam}
                onValueChange={setAnalisaDalam}
                className="grid grid-cols-2 gap-x-4 gap-y-3 cursor-pointer"
              >
                {ANALISA_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={opt.value}
                      id={`analisa-${opt.value}`}
                      className="border-[#303481] text-[#303481]"
                    />
                    <Label
                      htmlFor={`analisa-${opt.value}`}
                      className="text-[14px] text-slate-700 cursor-pointer font-normal"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Tanggal */}
              <div className="text-[15px] font-semibold mb-2 mt-5">Tanggal</div>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger className="w-full h-[42px] px-3 flex items-center justify-between text-sm border border-[#303481] rounded-lg cursor-pointer bg-white text-slate-700 outline-none focus:ring-2 focus:ring-[#303481]/20 shadow-none">
                  <span>{displayDate}</span>
                  <CalendarIcon className="w-4 h-4 text-slate-700" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border border-slate-200 shadow-xl rounded-[10px]" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      setSelectedDate(d);
                      setCalOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <button
                 type="button"
                 onClick={handleTampilData}
                 className="w-full mt-6 bg-[#303481] hover:bg-[#1f2259] text-white rounded-lg h-[42px] text-sm font-medium transition-colors cursor-pointer"
              >
                 Tampil Data
              </button>
            </div>
          </div>
        </div>

        {/* ─── Right: Chart + Table ─── */}
        <div className="flex flex-col gap-5 max-w-[2000px] w-full">
          {/* Chart Card */}
          <div className="bg-white border border-[#EAEAEA] rounded-[6px] shadow-sm p-5 pb-4">
            <h2 className="text-center font-bold text-gray-900 text-[15px] leading-tight mb-0.5">
              {chartTitle}
            </h2>
            <p className="text-center text-xs text-gray-500 mb-4">
              Pos RTS Site MIP
            </p>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradRerata" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2196F3" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2196F3" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradRange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#90CAF9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#90CAF9" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="waktu"
                  tick={{ fontSize: 11, fill: "#9E9E9E" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#9E9E9E" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v} V`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                  formatter={(value) => (
                    <span className="text-gray-600">Rerata {paramLabel}</span>
                  )}
                />
                {/* Batas Range (min–maks) sebagai area biru transparan */}
                <Area
                  type="monotone"
                  dataKey="maks"
                  stroke="none"
                  fill="url(#gradRange)"
                  fillOpacity={1}
                  legendType="none"
                  name="Maks"
                />
                <Area
                  type="monotone"
                  dataKey="min"
                  stroke="none"
                  fill="#F4F6F9"
                  fillOpacity={1}
                  legendType="none"
                  name="Min"
                />
                {/* Garis Rerata */}
                <Area
                  type="monotone"
                  dataKey="rerata"
                  stroke="#1565C0"
                  strokeWidth={2}
                  fill="none"
                  dot={{ r: 4, fill: "#FFFFFF", stroke: "#1565C0", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  name="Rerata Power RTS"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table Card */}
          <div className="bg-white border border-[#EAEAEA] rounded-[6px] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-[15px]">
                Tabel Rerata {paramLabel}
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs border-green-600 text-green-700 hover:bg-green-600 hover:text-white transition-colors rounded-md h-8 px-3"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel
              </Button>
            </div>
            <div className="overflow-auto max-h-[340px]">
              <Table>
                <TableHeader className="bg-gray-100 sticky top-0 z-10">
                  <TableRow className="border-b border-gray-200">
                    <TableHead className="text-xs font-bold text-gray-800 py-3 text-left pl-5">
                      WAKTU
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-800 py-3 text-center">
                      RERATA
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-800 py-3 text-center">
                      MINIMUM
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-800 py-3 text-center">
                      MAKSIMUM
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        "border-b border-gray-50 hover:bg-gray-50 transition-colors",
                        i % 2 === 0 ? "bg-white" : "bg-white"
                      )}
                    >
                      <TableCell className="py-3 pl-5 text-sm text-gray-700 font-medium">
                        {row.waktu}
                      </TableCell>
                      <TableCell className="py-3 text-center text-sm text-gray-700">
                        {row.rerata} V
                      </TableCell>
                      <TableCell className="py-3 text-center text-sm text-gray-700">
                        {row.min} Volt
                      </TableCell>
                      <TableCell className="py-3 text-center text-sm text-gray-700">
                        {row.maks} Volt
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
