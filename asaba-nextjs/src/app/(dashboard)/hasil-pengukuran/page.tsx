"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Box as BoxIcon,
  Table as TableIcon,
  Map as MapIcon,
  Filter,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { RtsConnectionBadge } from "@/components/RtsConnectionBadge";
import { useRtsConnectionStatus } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import type { PrismaMarkerData } from "@/components/PrismaMap";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

const CustomCheckboxItem = ({
  checked,
  onCheckedChange,
  label,
  indeterminate
}: {
  checked: boolean;
  onCheckedChange: (c: boolean) => void;
  label: string;
  indeterminate?: boolean;
}) => (
  <div
    onClick={(e) => {
      e.preventDefault();
      onCheckedChange(!checked);
    }}
    className="flex items-center gap-4 px-4 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors outline-none"
  >
    <div className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition-colors ${
      checked || indeterminate ? "bg-[#303481] border-[#303481]" : "border-gray-400 bg-white"
    }`}>
      {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      {indeterminate && !checked && <div className="w-2.5 h-[2px] bg-white rounded-full" />}
    </div>
    <span className="text-[14px] text-gray-800 select-none">{label}</span>
  </div>
);

const FilterTab = ({
  label,
  isActive,
  onClick,
  checked,
  onCheckedChange,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  checked: boolean | "indeterminate";
  onCheckedChange: (c: boolean) => void;
}) => (
  <div
    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-colors ${
      isActive ? "bg-[#EFEFEF]" : "hover:bg-gray-100"
    }`}
    onClick={onClick}
  >
    <div
      className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition-colors cursor-pointer ${
        checked === true || checked === "indeterminate" ? "bg-[#303481] border-[#303481]" : "border-gray-400 bg-white"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(checked === true ? false : true);
      }}
    >
      {checked === true && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      {checked === "indeterminate" && <div className="w-2.5 h-[2px] bg-white rounded-full" />}
    </div>
    <span className="text-[14px] text-gray-800 flex-1 select-none">{label}</span>
    {isActive && <ChevronRight className="w-4 h-4 text-gray-600" />}
  </div>
);


const PrismaMap = dynamic(() => import("@/components/PrismaMap"), { ssr: false });

// =================== TYPES ===================
interface LogKontrol {
  id_log: string;
  id_logger: string;
  datetime: string;
  site: string | null;
  r0: number;
}

interface TempTembak {
  nama_prisma: string;
  N0: number; E0: number; Z0: number;
  HA0: string; VA0: string; SD0: string;
  N1: number; E1: number; Z1: number;
  HA1: string; VA1: string; SD1: string;
  DN: string; DE: string; DZ: string;
  linear: number;
  arah_pergeseran: string;
  raw_E0: number; raw_N0: number;
  raw_E1: number; raw_N1: number;
  map_lat0: number | null; map_lon0: number | null;
  map_lat1: number | null; map_lon1: number | null;
}

interface DailyStatus {
  label: string;
  class: string;
}

interface DailySeries {
  t: string;
  mm: number;
}

interface DailyData {
  count: number;
  first_time: string | null;
  last_time: string | null;
  pergeseran_mm: number | null;
  kecepatan_mmd: number | null;
  status_pergeseran: DailyStatus | null;
  status_kecepatan: DailyStatus | null;
  series: DailySeries[];
}

interface DataPengukuran {
  id_prisma: string;
  nama_prisma: string;
  id_logger: number;
  waktu: string;
  temp_tembak: TempTembak;
  daily: DailyData;
}

interface SubColVisibility {
  X: boolean; Y: boolean; Z: boolean;
  HA: boolean; VA: boolean; SD: boolean;
}

interface PergeseranVisibility {
  DX: boolean; DY: boolean; DZ: boolean; Linier: boolean;
}

interface ColumnVisibility {
  awal: SubColVisibility;
  hasil: SubColVisibility;
  pergeseran: PergeseranVisibility;
  arah: boolean;
}

const DEFAULT_VISIBILITY: ColumnVisibility = {
  awal: { X: true, Y: true, Z: true, HA: true, VA: true, SD: true },
  hasil: { X: true, Y: true, Z: true, HA: true, VA: true, SD: true },
  pergeseran: { DX: true, DY: true, DZ: true, Linier: true },
  arah: true,
};

function Sparkline({ data }: { data: DailySeries[] }) {
  if (!data || data.length === 0) return <span className="text-gray-400 font-medium">-</span>;
  const w = 150;
  const h = 40;
  const padding = 6;
  const min = Math.min(...data.map(d => d.mm));
  const max = Math.max(...data.map(d => d.mm));
  const range = max - min === 0 ? 1 : max - min;
  
  const getX = (i: number) => data.length === 1 ? w / 2 : padding + (i / (data.length - 1)) * (w - padding * 2);
  const getY = (val: number) => h - padding - ((val - min) / range) * (h - padding * 2);

  const points = data.map((d, i) => `${getX(i)},${getY(d.mm)}`).join(" ");
  const areaPoints = `${getX(0)},${h} ${points} ${getX(data.length - 1)},${h}`;

  return (
    <svg width={w} height={h} className="mx-auto overflow-visible block">
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4338CA" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#4338CA" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkline-fill)" />
      <polyline points={points} fill="none" stroke="#4338CA" strokeWidth="1.5" />
      {data.map((d, i) => (
        <circle key={i} cx={getX(i)} cy={getY(d.mm)} r="2.5" fill="#10B981" stroke="#fff" strokeWidth="1" />
      ))}
    </svg>
  );
}

interface DeformasiResponse {
  success: boolean;
  data?: {
    tanggal: string;
    posisi_rts: { E: number; N: number; Z: number };
    data_pengukuran: DataPengukuran[];
  };
  error?: string;
}

// =================== HELPERS ===================
function formatDate(dt: string) {
  if (!dt) return "-";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Badge site berasal dari master data `t_site` lewat useSites() —
// lihat pemakaian `siteBadge` di dalam komponen.

function fval(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(4);
}

// =================== MAIN PAGE ===================
const RUNS_PER_PAGE = 10;

function HasilPengukuranContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useRtsConnectionStatus();
  const { sites: siteList, badge: siteBadge, bySlug: siteBySlug } = useSites();
  
  const [activeTab, setActiveTab] = useState("Event");
  const [activeView, setActiveView] = useState(() => searchParams.get("view") ?? "Tabel");

  // Log kontrol list (left panel)
  const [runs, setRuns] = useState<LogKontrol[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  
  // Filter state
  const [colVis, setColVis] = useState<ColumnVisibility>(DEFAULT_VISIBILITY);
  const [draftVis, setDraftVis] = useState<ColumnVisibility>(DEFAULT_VISIBILITY);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<"Awal" | "Hasil" | "Pergeseran" | "Arah">("Hasil");
  
  const handleFilterOpenChange = (open: boolean) => {
    setFilterOpen(open);
    if (open) {
      setDraftVis(JSON.parse(JSON.stringify(colVis)));
    }
  };

  const applyFilter = () => {
    setColVis(JSON.parse(JSON.stringify(draftVis)));
    setFilterOpen(false);
  };

  const cancelFilter = () => {
    setFilterOpen(false);
  };

  const isAllGroupChecked = (group: keyof ColumnVisibility) => {
    const g = draftVis[group];
    if (typeof g === 'boolean') return g;
    return Object.values(g).every(Boolean);
  };

  const isAllChecked = () => {
    return isAllGroupChecked("awal") && isAllGroupChecked("hasil") && isAllGroupChecked("pergeseran") && draftVis.arah;
  };

  const toggleAll = (checked: boolean) => {
    setDraftVis({
      awal: { X: checked, Y: checked, Z: checked, HA: checked, VA: checked, SD: checked },
      hasil: { X: checked, Y: checked, Z: checked, HA: checked, VA: checked, SD: checked },
      pergeseran: { DX: checked, DY: checked, DZ: checked, Linier: checked },
      arah: checked,
    });
  };

  const toggleGroup = (group: keyof ColumnVisibility, checked: boolean) => {
    if (group === "arah") {
      setDraftVis(prev => ({ ...prev, arah: checked }));
      return;
    }
    const newValue = group === "pergeseran" 
      ? { DX: checked, DY: checked, DZ: checked, Linier: checked }
      : { X: checked, Y: checked, Z: checked, HA: checked, VA: checked, SD: checked };
      
    setDraftVis(prev => ({ ...prev, [group]: newValue }));
  };

  const toggleCol = (group: keyof ColumnVisibility, col: string, checked: boolean) => {
    setDraftVis(prev => ({
      ...prev,
      [group]: {
        ...(prev[group] as any),
        [col]: checked
      }
    }));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRuns, setTotalRuns] = useState(0);
  const [allRuns, setAllRuns] = useState<LogKontrol[]>([]);
  // "" = semua site. Diambil dari ?site= supaya tautan dari Dashboard
  // membawa serta site yang sedang dilihat.
  const [siteFilter, setSiteFilter] = useState<string>(searchParams.get("site") ?? "");

  // Modal R0 states
  const [isR0ModalOpen, setIsR0ModalOpen] = useState(false);
  const [r0SelectedDate, setR0SelectedDate] = useState("");
  const [r0SelectedTime, setR0SelectedTime] = useState("");

  // Selected run
  const [selectedLog, setSelectedLog] = useState<LogKontrol | null>(null);

  // Deformasi data (right panel)
  const [deformasi, setDeformasi] = useState<DataPengukuran[]>([]);
  const [deformasiLoading, setDeformasiLoading] = useState(false);
  const [deformasiError, setDeformasiError] = useState("");
  const [selectedDate, setSelectedDate] = useState("-");

  // ── Fetch log kontrol ──
  // `siteFilter` kosong = semua site (perilaku lama). Daftar ini memang lintas
  // site — tiap baris punya badge site-nya — jadi filter bersifat menambah,
  // bukan mengubah tampilan bawaan.
  const fetchRuns = useCallback(async (page: number, site: string) => {
    setRunsLoading(true);
    setRunsError("");
    try {
      const params = new URLSearchParams({ limit: "100", with_prisma: "false" });
      if (site) params.set("site", site);
      const res = await fetch(`/api/log-kontrol?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat riwayat");
      setTotalRuns(json.data.length);
      setAllRuns(json.data);
      // Paginate client-side
      const start = (page - 1) * RUNS_PER_PAGE;
      const pageData = json.data.slice(start, start + RUNS_PER_PAGE);
      setRuns(pageData);
      // Pilih sesi pertama bila belum ada pilihan, atau bila sesi yang sedang
      // dipilih tidak ada lagi di daftar hasil filter.
      setSelectedLog((sebelumnya) => {
        if (sebelumnya && json.data.some((r: LogKontrol) => r.id_log === sebelumnya.id_log)) {
          return sebelumnya;
        }
        return json.data[0] ?? null;
      });
    } catch (e: unknown) {
      setRunsError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(currentPage, siteFilter); }, [currentPage, siteFilter, fetchRuns]);

  // ── Auto-select run dari query param ?log= ──
  useEffect(() => {
    const logId = searchParams.get("log");
    if (logId && allRuns.length > 0) {
      const found = allRuns.find((r) => r.id_log === logId);
      if (found) setSelectedLog(found);
    }
  }, [searchParams, allRuns]);

  // ── Fetch deformasi ketika selectedLog berubah ──
  const fetchDeformasi = useCallback(async (idLog: string) => {
    setDeformasiLoading(true);
    setDeformasiError("");
    setDeformasi([]);
    try {
      const res = await fetch(`/api/deformasi?id_log=${idLog}`);
      const json: DeformasiResponse = await res.json();
      if (!json.success || !json.data) throw new Error(json.error || "Gagal memuat data pengukuran");
      setDeformasi(json.data.data_pengukuran);
      setSelectedDate(formatDate(json.data.tanggal));
    } catch (e: unknown) {
      setDeformasiError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setDeformasiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLog?.id_log) fetchDeformasi(selectedLog.id_log);
  }, [selectedLog, fetchDeformasi]);

  const totalPages = Math.ceil(totalRuns / RUNS_PER_PAGE);

  const countVis = (g: SubColVisibility | PergeseranVisibility) => Object.values(g).filter(Boolean).length;

  // ── R0 Modal Logic ──
  const availableDates = Array.from(new Set(allRuns.map((r) => formatDate(r.datetime).split(" ")[0])));
  
  useEffect(() => {
    if (isR0ModalOpen) {
      if (!r0SelectedDate && availableDates.length > 0) {
        setR0SelectedDate(availableDates[0]);
      }
      // set current ro to selectedTime maybe? No, let user pick
    }
  }, [isR0ModalOpen, availableDates, r0SelectedDate]);

  const filteredRunsForR0 = allRuns.filter(r => formatDate(r.datetime).split(" ")[0] === r0SelectedDate);

  // ── Download Excel (ExcelJS) ──
  const handleDownloadExcel = async () => {
    if (!selectedLog || deformasi.length === 0) {
      alert("Tidak ada data tabel untuk didownload pada tanggal ini.");
      return;
    }
    
    try {
      // Dynamic import to not bloat the initial bundle
      const ExcelJS = await import("exceljs").then(m => m.default || m);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Hasil Pengukuran");

      // Set columns properties
      sheet.columns = [
        { key: "no", width: 15 },
        { key: "nama", width: 15 },
        { key: "x0", width: 12 }, { key: "y0", width: 12 }, { key: "z0", width: 10 },
        { key: "ha0", width: 11 }, { key: "va0", width: 11 }, { key: "sd0", width: 10 },
        { key: "x1", width: 12 }, { key: "y1", width: 12 }, { key: "z1", width: 10 },
        { key: "ha1", width: 11 }, { key: "va1", width: 11 }, { key: "sd1", width: 10 },
        { key: "dx", width: 8 }, { key: "dy", width: 8 }, { key: "dz", width: 8 }, { key: "lin", width: 10 },
        { key: "arah", width: 16 }
      ];

      // Row 1: Title
      const siteName =
        siteBySlug(selectedLog.site)?.nama ?? (selectedLog.site?.toUpperCase() || "");
      const titleRow = sheet.addRow([`Hasil Penembakan RTS ${siteName} PT MIP`]);
      sheet.mergeCells("A1:S1");
      titleRow.getCell(1).font = { size: 14, bold: true };
      titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      // Row 2: Tanggal
      const dateRow = sheet.addRow([`Tanggal : ${selectedDate}`]);
      sheet.mergeCells("A2:S2");
      dateRow.getCell(1).font = { size: 11 };
      dateRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      // Row 3: empty
      sheet.addRow([]);

      // Row 4: Multi-header Row 1
      const headerRow1 = sheet.addRow([
        "Nomor Prisma", "Nama Prisma",
        "Awal Pengukuran", "", "", "", "", "",
        "Hasil Pengukuran", "", "", "", "", "",
        "Pergeseran", "", "", "",
        "Arah Pergeseran"
      ]);
      
      // Merges
      sheet.mergeCells("A4:A5");
      sheet.mergeCells("B4:B5");
      sheet.mergeCells("C4:H4"); // Awal
      sheet.mergeCells("I4:N4"); // Hasil
      sheet.mergeCells("O4:R4"); // Pergeseran
      sheet.mergeCells("S4:S5");

      // Row 5: Multi-header Row 2
      const headerRow2 = sheet.addRow([
        "", "",
        "X", "Y", "Z", "HA", "VA", "Slop Dis",
        "X", "Y", "Z", "HA", "VA", "Slop Dis",
        "ΔX", "ΔY", "ΔZ", "Linear",
        ""
      ]);

      // Styling Headers
      [headerRow1, headerRow2].forEach(row => {
        row.eachCell((cell, colNumber) => {
          cell.font = { bold: true };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" }
          };
          if (row === headerRow1 && [3, 9, 15].includes(colNumber)) {
            // Apply borders to merged fields appropriately using the top-left cell
          }
        });
      });
      // Force borders on merged regions safely
      for (let R = 4; R <= 5; R++) {
        for (let C = 1; C <= 19; C++) {
          sheet.getCell(R, C).border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" }
          };
        }
      }

      // Add Data
      deformasi.forEach((row) => {
        const t = row.temp_tembak;
        const dataRow = sheet.addRow([
          row.id_prisma, row.nama_prisma || "-",
          Number(t?.E0 || 0), Number(t?.N0 || 0), Number(t?.Z0 || 0),
          t?.HA0 || "-", t?.VA0 || "-", t?.SD0 || "-",
          Number(t?.E1 || 0), Number(t?.N1 || 0), Number(t?.Z1 || 0),
          t?.HA1 || "-", t?.VA1 || "-", t?.SD1 || "-",
          Number(t?.DE || 0), Number(t?.DN || 0), Number(t?.DZ || 0), Number(t?.linear || 0),
          t?.arah_pergeseran || "-"
        ]);

        dataRow.eachCell(cell => {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" }
          };
        });
      });

      // Freeze top 5 rows
      sheet.views = [{ state: "frozen", ySplit: 5 }];

      // Download trigger
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ds = selectedDate.replace(/[\s:-]/g, "_");
      a.download = `Hasil_Pengukuran_${ds}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat memproses file Excel.");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">

      {/* Sub Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full border border-gray-200 bg-[#E5E5E5] flex items-center justify-center shadow-inner relative">
          {isConnected && <div className="absolute w-3.5 h-3.5 rounded-full bg-green-400/80 animate-ping" />}
          <div className={cn("w-3.5 h-3.5 rounded-full relative z-10", isConnected ? "bg-[#06C022]" : "bg-gray-800")} />
        </div>
        <div className="flex flex-col gap-1 items-start">
          <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">Pos RTS Site MIP</h2>
          <RtsConnectionBadge />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">

        {/* ── Left: Tanggal Running ── */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
            <div className="flex items-center gap-2.5">
              <h3 className="font-extrabold text-gray-900 text-[15px]">Tanggal Running</h3>
              <select
                value={siteFilter}
                onChange={(e) => { setSiteFilter(e.target.value); setCurrentPage(1); }}
                className="h-7 max-w-[150px] cursor-pointer rounded-md border border-gray-200 bg-white px-2 text-[11.5px] font-semibold text-gray-700 outline-none focus:border-[#303481]"
                title="Saring berdasarkan site"
              >
                <option value="">Semua site</option>
                {siteList.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.nama}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsR0ModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-[11px] font-bold text-gray-700 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>
              Atur R0
            </button>
          </div>

          {/* List */}
          <div className="flex flex-col">
            {runsLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="w-6 h-6 animate-spin text-[#303481]" />
              </div>
            ) : runsError ? (
              <div className="flex items-center gap-2 text-red-600 text-[13px] px-5 py-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {runsError}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-center text-gray-400 text-[13px] py-10">Tidak ada data</p>
            ) : (
              runs.map((run) => {
                const badge = siteBadge(run.site);
                const isActive = selectedLog?.id_log === run.id_log;
                return (
                  <div
                    key={run.id_log}
                    onClick={() => setSelectedLog(run)}
                    className={`py-3.5 px-5 border-b border-gray-100 flex items-center gap-2.5 cursor-pointer transition-colors w-full
                      ${isActive
                        ? "bg-[#F7F8FF] border-l-[3px] border-l-[#303481]"
                        : "hover:bg-gray-50 border-l-[3px] border-l-transparent bg-white"
                      }`}
                  >
                    <span className="text-[12.5px] text-gray-800 font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {formatDate(run.datetime)}
                    </span>
                    <span
                      className="px-2.5 py-[2px] rounded-full text-white text-[9.5px] font-bold tracking-wide shadow-sm flex-shrink-0"
                      style={{ backgroundColor: badge.color }}
                      title={badge.peringatan ?? badge.nama}
                    >
                      {badge.label}
                      {badge.peringatan && " ⚠"}
                    </span>
                    {run.r0 === 1 && (
                      <span className="px-2.5 py-[2px] rounded-full bg-[#64748B] text-white text-[9.5px] font-bold tracking-wide shadow-sm flex-shrink-0">
                        R0
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="py-4 flex justify-center border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 flex items-center justify-center rounded text-[12.5px] font-bold transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-[#303481] text-white border-none"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Data Prisma ── */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-[16px]">Data Prisma</h3>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadExcel}
                className="h-[38px] px-5 border-[#2E7D32] text-[#2E7D32] font-semibold text-[13px] rounded-lg hover:bg-[#E8F5E9] hover:text-[#2E7D32] cursor-pointer"
              >
                <Download className="w-[15px] h-[15px] mr-1.5" strokeWidth={2.5} />
                Download Excel
              </Button>
              <Button
                onClick={() => router.push("/visualisasi-3d")}
                className="h-[38px] px-5 bg-[#303481] hover:bg-[#1f2259] text-white font-semibold text-[13px] rounded-lg border-none cursor-pointer"
              >
                <BoxIcon className="w-[15px] h-[15px] mr-1.5" strokeWidth={2.5} />
                Buka 3D
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-3 flex gap-8 border-b border-gray-200">
            {["Event", "Harian"].map((tab) => {
              if (activeView === "Peta" && tab === "Harian") return null;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-[14px] font-bold border-b-4 transition-colors cursor-pointer ${
                    activeTab === tab
                      ? "border-[#303481] text-[#303481]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="px-6 py-4 flex flex-wrap items-center gap-5">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#EAEAEA] shadow-sm">
              {["Tabel", "Peta"].map((view, i) => (
                <button
                  key={view}
                  onClick={() => {
                    setActiveView(view);
                    if (view === "Peta") {
                      setActiveTab("Event");
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-colors cursor-pointer ${
                    activeView === view
                      ? "bg-[#303481] text-white"
                      : `bg-white text-gray-600 hover:bg-gray-50 ${i > 0 ? "border-l border-[#EAEAEA]" : ""}`
                  }`}
                >
                  {view === "Tabel" ? <TableIcon className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                  {view}
                </button>
              ))}
            </div>
            {/* Filter button - sembunyikan jika mode Peta */}
            {activeView !== "Peta" && (
              <Popover open={filterOpen} onOpenChange={handleFilterOpenChange}>
                <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-[13px] font-bold h-[38px] px-4 border border-[#EAEAEA] bg-white text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 focus-visible:outline-none">
                  <Filter className="w-4 h-4 mr-2" /> Filter
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0 flex flex-row rounded-xl border-[#EAEAEA] shadow-xl overflow-hidden bg-white" align="start">
                  {/* Left Column (Categories) */}
                  <div className="w-[220px] border-r border-[#EAEAEA] bg-[#F8F9FA] p-3 flex flex-col gap-1">
                    <FilterTab
                      label="Awal Pengukuran"
                      isActive={activeFilterTab === "Awal"}
                      onClick={() => setActiveFilterTab("Awal")}
                      checked={isAllGroupChecked("awal")}
                      onCheckedChange={(c) => toggleGroup("awal", c)}
                    />
                    <FilterTab
                      label="Hasil Pengukuran"
                      isActive={activeFilterTab === "Hasil"}
                      onClick={() => setActiveFilterTab("Hasil")}
                      checked={isAllGroupChecked("hasil")}
                      onCheckedChange={(c) => toggleGroup("hasil", c)}
                    />
                    <FilterTab
                      label="Pergeseran"
                      isActive={activeFilterTab === "Pergeseran"}
                      onClick={() => setActiveFilterTab("Pergeseran")}
                      checked={isAllGroupChecked("pergeseran")}
                      onCheckedChange={(c) => toggleGroup("pergeseran", c)}
                    />
                    <FilterTab
                      label="Arah Pergeseran"
                      isActive={activeFilterTab === "Arah"}
                      onClick={() => setActiveFilterTab("Arah")}
                      checked={draftVis.arah}
                      onCheckedChange={(c) => toggleGroup("arah", c)}
                    />
                  </div>

                  {/* Right Column (Options) */}
                  <div className="flex-1 flex flex-col bg-white">
                    <div className="p-3 flex-1 flex flex-col gap-1 min-h-[300px]">
                      {activeFilterTab === "Awal" && (
                        <>
                          <CustomCheckboxItem label="Semua" checked={isAllGroupChecked("awal") === true} onCheckedChange={(c) => toggleGroup("awal", c)} />
                          {["X", "Y", "Z", "HA", "VA", "SD"].map((col) => (
                            <CustomCheckboxItem key={col} label={col === "SD" ? "Slope Distance" : col} checked={(draftVis.awal as any)[col]} onCheckedChange={(c) => toggleCol("awal", col, c)} />
                          ))}
                        </>
                      )}
                      {activeFilterTab === "Hasil" && (
                        <>
                          <CustomCheckboxItem label="Semua" checked={isAllGroupChecked("hasil") === true} onCheckedChange={(c) => toggleGroup("hasil", c)} />
                          {["X", "Y", "Z", "HA", "VA", "SD"].map((col) => (
                            <CustomCheckboxItem key={col} label={col === "SD" ? "Slope Distance" : col} checked={(draftVis.hasil as any)[col]} onCheckedChange={(c) => toggleCol("hasil", col, c)} />
                          ))}
                        </>
                      )}
                      {activeFilterTab === "Pergeseran" && (
                        <>
                          <CustomCheckboxItem label="Semua" checked={isAllGroupChecked("pergeseran") === true} onCheckedChange={(c) => toggleGroup("pergeseran", c)} />
                          {["DX", "DY", "DZ", "Linier"].map((col) => (
                            <CustomCheckboxItem key={col} label={col === "DX" ? "Delta X" : col === "DY" ? "Delta Y" : col === "DZ" ? "Delta Z" : "Linier"} checked={(draftVis.pergeseran as any)[col]} onCheckedChange={(c) => toggleCol("pergeseran", col, c)} />
                          ))}
                        </>
                      )}
                      {activeFilterTab === "Arah" && (
                        <div className="py-8 px-4 text-[13px] text-gray-500 italic text-center leading-relaxed">
                          Tidak ada sub-opsi.
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-4 flex items-center justify-end gap-3 mt-auto border-t border-gray-100">
                      <Button variant="outline" size="sm" onClick={cancelFilter} className="w-[88px] text-[13px] h-9 border-[#303481] text-[#303481] rounded-lg font-semibold bg-white hover:bg-blue-50 cursor-pointer">
                        Batal
                      </Button>
                      <Button size="sm" onClick={applyFilter} className="w-[88px] text-[13px] h-9 bg-[#303481] hover:bg-[#1f2259] text-white rounded-lg font-semibold shadow-sm cursor-pointer">
                        Terapkan
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* Info badges */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                Date Selected
                <span className="px-3 py-1 bg-[#303481] text-white rounded-md text-[11.5px] font-bold tracking-wider">
                  {selectedDate}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                Total Prism :
                <span className="w-[28px] h-[22px] flex items-center justify-center bg-[#303481] text-white rounded-full text-[11.5px] font-bold">
                  {deformasiLoading ? "…" : deformasi.length}
                </span>
              </div>
            </div>
          </div>

          {/* Error state */}
          {deformasiError && (
            <div className="flex items-center gap-3 mx-6 mb-4 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {deformasiError}
            </div>
          )}

          {/* Peta View */}
          {activeView === "Peta" && (
            <div className="px-6 pb-6">
              {deformasiLoading ? (
                <div className="flex items-center justify-center h-[520px] text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#303481]" />
                    <span className="text-[13px] font-medium">Memuat peta...</span>
                  </div>
                </div>
              ) : !selectedLog ? (
                <div className="flex items-center justify-center h-[520px] text-gray-400 text-[13px]">
                  Pilih tanggal running di panel kiri untuk melihat peta.
                </div>
              ) : (
                <PrismaMap
                  site={selectedLog.site}
                  markers={deformasi.map(row => ({
                    id_prisma: row.id_prisma,
                    nama_prisma: row.nama_prisma,
                    site: selectedLog.site,
                    lat0: row.temp_tembak?.map_lat0 ?? null,
                    lon0: row.temp_tembak?.map_lon0 ?? null,
                    lat1: row.temp_tembak?.map_lat1 ?? null,
                    lon1: row.temp_tembak?.map_lon1 ?? null,
                    DN: row.temp_tembak?.DN ?? "-",
                    DE: row.temp_tembak?.DE ?? "-",
                    DZ: row.temp_tembak?.DZ ?? "-",
                    linear: row.temp_tembak?.linear ?? 0,
                    arah_pergeseran: row.temp_tembak?.arah_pergeseran ?? "-",
                    SD1: String(row.temp_tembak?.SD1 ?? "-"),
                    hasData: !!(row.temp_tembak?.map_lat1),
                  } as PrismaMarkerData))}
                />
              )}
            </div>
          )}

          {/* Table – only shown when Tabel view is active */}
          {activeView === "Tabel" && (
          <div className="overflow-x-auto w-full">
            {activeTab === "Event" ? (
              <table className="w-full text-center border-collapse min-w-[1100px]">
                <thead className="bg-[#FAFAFB]">
                  {/* Row 1 — Group headers */}
                  <tr className="border-b border-gray-200">
                    <th rowSpan={2} className="py-3 px-4 border-r border-gray-200 font-bold text-gray-700 text-[12px] text-left whitespace-nowrap align-middle">
                      Nomor Prisma
                    </th>
                    <th rowSpan={2} className="py-3 px-4 border-r border-gray-200 font-bold text-gray-700 text-[12px] text-left whitespace-nowrap align-middle">
                      Nama Prisma
                    </th>
                    {/* Awal Pengukuran */}
                    {countVis(colVis.awal) > 0 && (
                      <th colSpan={countVis(colVis.awal)} className="py-2.5 px-2 border-b border-r border-gray-200 font-bold text-gray-700 text-[12px] text-center">
                        Awal Pengukuran
                      </th>
                    )}
                    {/* Hasil Pengukuran */}
                    {countVis(colVis.hasil) > 0 && (
                      <th colSpan={countVis(colVis.hasil)} className="py-2.5 px-2 border-b border-r border-gray-200 font-bold text-gray-700 text-[12px] text-center">
                        Hasil Pengukuran
                      </th>
                    )}
                    {/* Pergeseran */}
                    {countVis(colVis.pergeseran) > 0 && (
                      <th colSpan={countVis(colVis.pergeseran)} className="py-2.5 px-2 border-b border-r border-gray-200 font-bold text-gray-700 text-[12px] text-center">
                        Pergeseran
                      </th>
                    )}
                    {/* Arah Pergeseran */}
                    {colVis.arah && (
                      <th rowSpan={2} className="py-3 px-4 font-bold text-gray-700 text-[12px] text-center whitespace-nowrap align-middle">
                        Arah<br />Pergeseran
                      </th>
                    )}
                  </tr>
                  {/* Row 2 — Sub-column headers */}
                  <tr className="border-b border-gray-200">
                    {/* Awal Pengukuran sub-cols */}
                    {colVis.awal.X && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">X</th>}
                    {colVis.awal.Y && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">Y</th>}
                    {colVis.awal.Z && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">Z</th>}
                    {colVis.awal.HA && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">HA</th>}
                    {colVis.awal.VA && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">VA</th>}
                    {colVis.awal.SD && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-200">Slope Distance</th>}
                    {/* Hasil Pengukuran sub-cols */}
                    {colVis.hasil.X && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">X</th>}
                    {colVis.hasil.Y && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">Y</th>}
                    {colVis.hasil.Z && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">Z</th>}
                    {colVis.hasil.HA && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">HA</th>}
                    {colVis.hasil.VA && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">VA</th>}
                    {colVis.hasil.SD && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-200">Slope Distance</th>}
                    {/* Pergeseran sub-cols */}
                    {colVis.pergeseran.DX && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">ΔX</th>}
                    {colVis.pergeseran.DY && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">ΔY</th>}
                    {colVis.pergeseran.DZ && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-100">ΔZ</th>}
                    {colVis.pergeseran.Linier && <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] text-center whitespace-nowrap border-r border-gray-200">Linier</th>}
                  </tr>
                </thead>
                <tbody>
                  {deformasiLoading ? (
                    <tr>
                      <td colSpan={17} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <Loader2 className="w-7 h-7 animate-spin text-[#303481]" />
                          <span className="text-[13px] font-medium">Memuat data pengukuran...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !selectedLog ? (
                    <tr>
                      <td colSpan={17} className="py-16 text-center text-gray-400 text-[13px]">
                        Pilih tanggal running di panel kiri untuk melihat data.
                      </td>
                    </tr>
                  ) : deformasi.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-16 text-center text-gray-400 text-[13px]">
                        Tidak ada data pengukuran untuk sesi ini.
                      </td>
                    </tr>
                  ) : (
                    deformasi.map((row, idx) => {
                      const t = row.temp_tembak;
                      return (
                        <tr
                          key={row.id_prisma + idx}
                          className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-[12px] font-bold text-gray-700 border-r border-gray-100 whitespace-nowrap">
                            <span className="inline-block bg-[#3B82F6] text-white px-2 py-[2px] rounded text-[10px] font-bold">
                              {row.id_prisma}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[12px] text-gray-700 font-medium border-r border-gray-200 whitespace-nowrap">
                            <button
                              onClick={() => router.push(`/hasil-pengukuran/${encodeURIComponent(row.nama_prisma)}?log=${selectedLog?.id_log}`)}
                              className="text-[#303481] hover:underline font-semibold cursor-pointer bg-transparent border-none p-0"
                            >
                              {row.nama_prisma || "-"}
                            </button>
                          </td>
                          {/* Awal */}
                          {colVis.awal.X && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{fval(t?.E0)}</td>}
                          {colVis.awal.Y && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{fval(t?.N0)}</td>}
                          {colVis.awal.Z && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{fval(t?.Z0)}</td>}
                          {colVis.awal.HA && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{t?.HA0 || "-"}</td>}
                          {colVis.awal.VA && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{t?.VA0 || "-"}</td>}
                          {colVis.awal.SD && <td className="py-3.5 px-2 text-[12px] text-gray-600 font-mono">{t?.SD0 || "-"}</td>}
                          {/* Hasil */}
                          {colVis.hasil.X && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono border-l border-gray-100 bg-[#F7F8FF]/40">{fval(t?.E1)}</td>}
                          {colVis.hasil.Y && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono bg-[#F7F8FF]/40">{fval(t?.N1)}</td>}
                          {colVis.hasil.Z && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono bg-[#F7F8FF]/40">{fval(t?.Z1)}</td>}
                          {colVis.hasil.HA && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono bg-[#F7F8FF]/40">{t?.HA1 || "-"}</td>}
                          {colVis.hasil.VA && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono bg-[#F7F8FF]/40">{t?.VA1 || "-"}</td>}
                          {colVis.hasil.SD && <td className="py-3.5 px-2 text-[12px] text-gray-700 font-mono bg-[#F7F8FF]/40">{t?.SD1 || "-"}</td>}
                          {/* Pergeseran */}
                          {colVis.pergeseran.DX && (
                            <td className="py-3.5 px-2 text-[12px] font-mono border-l border-gray-100 bg-[#F4F5F7]/30">
                              <span className={`font-semibold ${Number(t?.DE) < 0 ? "text-red-500" : Number(t?.DE) > 0 ? "text-emerald-600" : "text-gray-500"}`}>
                                {t?.DE || "-"}
                              </span>
                            </td>
                          )}
                          {colVis.pergeseran.DY && (
                            <td className="py-3.5 px-2 text-[12px] font-mono bg-[#F4F5F7]/30">
                              <span className={`font-semibold ${Number(t?.DN) < 0 ? "text-red-500" : Number(t?.DN) > 0 ? "text-emerald-600" : "text-gray-500"}`}>
                                {t?.DN || "-"}
                              </span>
                            </td>
                          )}
                          {colVis.pergeseran.DZ && (
                            <td className="py-3.5 px-2 text-[12px] font-mono bg-[#F4F5F7]/30">
                              <span className={`font-semibold ${Number(t?.DZ) < 0 ? "text-red-500" : Number(t?.DZ) > 0 ? "text-emerald-600" : "text-gray-500"}`}>
                                {t?.DZ || "-"}
                              </span>
                            </td>
                          )}
                          {colVis.pergeseran.Linier && (
                            <td className="py-3.5 px-2 text-[12px] font-semibold text-[#303481] font-mono bg-[#F4F5F7]/30">
                              {t?.linear ? Number(t.linear).toFixed(4) : "-"}
                            </td>
                          )}
                          {/* Arah */}
                          {colVis.arah && (
                            <td className="py-3.5 px-3 text-[12px] text-gray-700 font-medium border-l border-gray-100">
                              {t?.arah_pergeseran || "-"}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-center border-collapse min-w-[1000px]">
                <thead className="bg-[#FAFAFB]">
                  <tr className="border-b border-gray-200">
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap">No</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap text-left border-l border-gray-100">Nama Prisma</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Pergeseran<br/>(mm)</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Status Pergeseran</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Kecepatan<br/>(mm/hari)</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Status Kecepatan</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100 w-[180px]">Grafik</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Waktu Awal</th>
                    <th className="py-4 px-4 font-bold text-gray-700 text-[12px] whitespace-nowrap border-l border-gray-100">Waktu Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {deformasiLoading ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <Loader2 className="w-7 h-7 animate-spin text-[#303481]" />
                          <span className="text-[13px] font-medium">Memuat data harian...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !selectedLog ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-gray-400 text-[13px]">
                        Pilih tanggal running di panel kiri untuk melihat data.
                      </td>
                    </tr>
                  ) : deformasi.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-gray-400 text-[13px]">
                        Tidak ada data pengukuran untuk sesi ini.
                      </td>
                    </tr>
                  ) : (
                    deformasi.map((row, idx) => {
                      const d = row.daily;
                      const hasData = d && d.count > 0;
                      
                      const tFirst = d?.first_time ? new Date(d.first_time).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false }) : "-";
                      const tLast = d?.last_time ? new Date(d.last_time).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false }) : "-";

                      return (
                        <tr
                          key={row.id_prisma + "_harian_" + idx}
                          className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-[13px] font-medium text-gray-600">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 text-[12.5px] text-gray-800 font-semibold text-left border-l border-gray-100 whitespace-nowrap">
                            <button
                              onClick={() => router.push(`/hasil-pengukuran/${encodeURIComponent(row.nama_prisma)}?log=${selectedLog?.id_log}`)}
                              className="text-[#303481] hover:underline font-semibold cursor-pointer bg-transparent border-none p-0"
                            >
                              {row.nama_prisma || "-"}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-[13px] text-gray-700 font-mono border-l border-gray-100">
                            {hasData ? Number(d.pergeseran_mm).toFixed(2) : "-"}
                          </td>
                          <td className="py-3.5 px-4 border-l border-gray-100">
                            {hasData && d.status_pergeseran ? (
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${d.status_pergeseran.class}`}>
                                {d.status_pergeseran.label}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[13px] text-gray-700 font-mono border-l border-gray-100">
                            {hasData ? Number(d.kecepatan_mmd).toFixed(2) : "-"}
                          </td>
                          <td className="py-3.5 px-4 border-l border-gray-100">
                            {hasData && d.status_kecepatan ? (
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${d.status_kecepatan.class}`}>
                                {d.status_kecepatan.label}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 border-l border-gray-100 align-middle">
                            {hasData ? <Sparkline data={d.series} /> : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="py-3.5 px-4 text-[12.5px] text-gray-600 font-mono border-l border-gray-100">
                            {tFirst}
                          </td>
                          <td className="py-3.5 px-4 text-[12.5px] text-gray-600 font-mono border-l border-gray-100">
                            {tLast}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
          )}

          <div className="h-4 bg-gray-50 border-t border-gray-100 w-full rounded-b-xl" />
        </div>
      </div>

      {/* ── Modal Atur R0 ── */}
      {isR0ModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1f2937]/30 backdrop-blur-[2px]"
          onClick={() => setIsR0ModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl w-[380px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[#303481] text-white flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-gray-900 leading-none mb-1.5 mt-0.5">Atur RO</h2>
                  <p className="text-[12px] text-gray-500 leading-[1.35]">
                    Pilih running yang akan digunakan sebagai baseline perhitungan pergeseran.
                  </p>
                </div>
              </div>
              
              <div className="mb-5">
                <label className="block text-[13px] font-extrabold text-gray-900 mb-2">Tanggal Running</label>
                <div className="relative">
                  <select 
                    className="w-full border border-gray-200 rounded-lg pl-10 pr-10 py-2.5 text-[13px] text-gray-800 appearance-none bg-white font-medium focus:outline-none focus:ring-1 focus:ring-[#303481] focus:border-[#303481] transition-all cursor-pointer"
                    value={r0SelectedDate}
                    onChange={(e) => {
                      setR0SelectedDate(e.target.value);
                      setR0SelectedTime("");
                    }}
                  >
                    {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <svg className="w-[16px] h-[16px] text-[#303481] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-extrabold text-gray-900 mb-2">Waktu Running</label>
                <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {filteredRunsForR0.length === 0 && (
                    <div className="text-center text-gray-400 text-[12px] py-4">Tidak ada sesi di tanggal ini.</div>
                  )}
                  {filteredRunsForR0.map(r => {
                    const t = formatDate(r.datetime).split(" ")[1];
                    const isSel = r0SelectedTime === r.id_log;
                    return (
                      <label 
                        key={r.id_log} 
                        className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all ${
                          isSel ? 'border-[#303481] ring-1 ring-[#303481] bg-white' : 'border-gray-200 hover:border-gray-300 bg-white shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <input 
                            type="radio" 
                            name="r0_waktu" 
                            value={r.id_log}
                            checked={isSel}
                            onChange={() => setR0SelectedTime(r.id_log)}
                            className="hidden"
                          />
                          <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${isSel ? 'border-[#303481]' : 'border-gray-300'}`}>
                             {isSel && <div className="w-2.5 h-2.5 bg-[#303481] rounded-full" />}
                          </div>
                          <span className="text-[13px] text-gray-800 font-semibold">{t}</span>
                        </div>
                        {r.r0 === 1 && (
                          <span className="text-[10px] bg-[#64748B] text-white px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                            RO Saat Ini
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100 p-5 pt-4 flex justify-end gap-3 bg-white">
              <Button 
                variant="outline" 
                onClick={() => setIsR0ModalOpen(false)} 
                className="px-6 h-[40px] rounded-lg border-gray-300 text-[#303481] font-semibold hover:bg-gray-50"
              >
                Batal
              </Button>
              <Button 
                disabled={!r0SelectedTime}
                className="px-6 h-[40px] rounded-lg bg-[#303481] hover:bg-[#1f2259] text-white font-semibold disabled:opacity-50"
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HasilPengukuranPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#303481]" /></div>}>
      <HasilPengukuranContent />
    </Suspense>
  );
}
