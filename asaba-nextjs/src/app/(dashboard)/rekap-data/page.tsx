"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Database,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  CheckCircle,
  Activity,
  HardDrive,
  Download,
} from "lucide-react";

// ─────────── Types ───────────
interface RtsRow {
  id: number;
  code_logger: string;
  id_kontrol: string;
  waktu: string;
  sensor1: string;
  sensor2: string;
  sensor3: string;
  sensor4: string;
  sensor5: string;
  sensor6: string;
  sensor7: string;
  sensor8: string;
  sensor9: string;
  sensor10: string;
  sensor11: string;
  sensor12: string;
  sensor13: string;
  sensor14: number;
  sensor15: number;
  sensor16: number;
  sensor17: number;
  sensor18: string;
  sensor19: string;
  sensor20: string;
  sensor21: string;
  sensor22: string;
  sensor23: string;
  sensor24: string;
  sensor25: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─────────── Sensor Labels ───────────
const SENSOR_LABELS: Record<string, string> = {
  sensor1: "ID Prisma",
  sensor2: "Sensor 2",
  sensor3: "Nama Prisma",
  sensor4: "Sensor 4",
  sensor5: "HA",
  sensor6: "VA",
  sensor7: "Slope Dis",
  sensor8: "N1 (Y)",
  sensor9: "E1 (X)",
  sensor10: "Z1",
  sensor11: "N0",
  sensor12: "E0",
  sensor13: "Z0",
  sensor14: "Koneksi",
  sensor15: "Sensor 15",
  sensor16: "Running",
  sensor17: "SD Card",
  sensor18: "Sensor 18",
  sensor19: "Sensor 19",
  sensor20: "Sensor 20",
  sensor21: "Sensor 21",
  sensor22: "Sensor 22",
  sensor23: "Sensor 23",
  sensor24: "Tilt X",
  sensor25: "Tilt Y",
};

const ALL_SENSORS = Array.from({ length: 25 }, (_, i) => `sensor${i + 1}`);

// ─────────── Helpers ───────────
function fmtWaktu(dt: any) {
  if (!dt) return "-";
  const str = String(dt);
  const raw = str.replace("T", " ").split(".")[0];
  const [date, time] = raw.split(" ");
  if (!date) return raw;
  const parts = date.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y} ${time || ""}`.trim();
  }
  return raw;
}

function fval(v: unknown, dec = 4): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(dec);
}

// ─────────── Main Component ───────────
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function RekapDataPage() {
  const [rows, setRows]             = useState<RtsRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loggers, setLoggers]       = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Filters
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [from, setFrom]         = useState(sevenDaysAgo);
  const [to, setTo]             = useState(today);
  const [logger, setLogger]     = useState("");
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(20);
  const [searchQuery, setSearchQuery] = useState("");

  // Summary stats derived from current page
  const totalRows    = pagination?.total ?? 0;
  const connectedCount = rows.filter((r) => Number(r.sensor14) === 1).length;
  const runningCount   = rows.filter((r) => Number(r.sensor16) === 1).length;
  const sdOkCount      = rows.filter((r) => Number(r.sensor17) === 1).length;

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from)   params.set("from", from);
      if (to)     params.set("to", to);
      if (logger) params.set("logger", logger);
      params.set("page",  String(p));
      params.set("limit", String(limit));

      const res  = await fetch(`/api/rekap-data?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat data");

      setRows(json.data || []);
      setPagination(json.pagination);
      if (json.loggers?.length && loggers.length === 0) {
        setLoggers(json.loggers);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [from, to, logger, limit, loggers.length, page]);

  useEffect(() => {
    fetchData(1);
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, logger, limit]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(newPage);
  };

  // Client-side search filter on current page
  const filtered = searchQuery
    ? rows.filter(
        (r) =>
          r.sensor1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.sensor3?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.code_logger?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rows;

  // Download current data as CSV
  const handleDownload = () => {
    if (filtered.length === 0) return;
    const headers = ["#", "Waktu", "Logger", "ID Kontrol", ...ALL_SENSORS.map(s => SENSOR_LABELS[s] || s)];
    const dataRows = filtered.map((r, idx) => {
      const rowNum = (pagination ? (page - 1) * limit : 0) + idx + 1;
      const sensorVals = ALL_SENSORS.map(s => {
        const val = (r as any)[s];
        return val !== null && val !== undefined ? String(val) : "-";
      });
      return [rowNum, fmtWaktu(r.waktu), r.code_logger, r.id_kontrol || "-", ...sensorVals];
    });
    const csv = [headers, ...dataRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Rekap_Data_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function renderSensorCell(row: RtsRow, sensorKey: string) {
    const val = (row as any)[sensorKey];

    if (sensorKey === "sensor14") {
      const isConn = Number(val) === 1;
      return isConn ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#E5F7E7] text-[#06C022] border border-green-200 rounded-full text-[9px] font-bold whitespace-nowrap">
          <div className="w-1.5 h-1.5 rounded-full bg-[#06C022]"></div> Connected
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-[9px] font-bold whitespace-nowrap">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div> Disconnected
        </span>
      );
    }

    if (sensorKey === "sensor16") {
      const isRunning = Number(val) === 1;
      return isRunning ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-[#303481] rounded-full text-[9px] font-bold whitespace-nowrap">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Run
        </span>
      ) : (
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[9px] font-bold">Standby</span>
      );
    }

    if (sensorKey === "sensor17") {
      const isSdOk = Number(val) === 1;
      return isSdOk ? (
        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-bold">OK</span>
      ) : (
        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full text-[9px] font-bold">Err</span>
      );
    }

    // Numeric sensor values with decimals (coordinates, angles, etc.)
    if (["sensor5", "sensor6", "sensor7", "sensor8", "sensor9", "sensor10", "sensor11", "sensor12", "sensor13", "sensor24", "sensor25"].includes(sensorKey)) {
      return <span className="font-mono">{fval(val)}</span>;
    }

    // ID Prisma badge
    if (sensorKey === "sensor1" && val) {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10.5px] font-bold whitespace-nowrap">
          {val}
        </span>
      );
    }

    // Default
    if (val === null || val === undefined || val === "") return <span className="text-gray-300">-</span>;
    return <span>{String(val)}</span>;
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#303481] flex items-center justify-center shadow-md">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">Rekap Data Masuk</h2>
            <p className="text-[12px] text-gray-500 font-medium">Riwayat data yang masuk dari hardware RTS — semua sensor</p>
          </div>
        </div>
        <button
          onClick={() => fetchData(page)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Data",
            value: totalRows.toLocaleString("id-ID"),
            icon: <Activity className="w-5 h-5 text-[#303481]" />,
            bg: "bg-blue-50",
            sub: "baris data terekam",
          },
          {
            label: "Terhubung",
            value: connectedCount,
            icon: <Wifi className="w-5 h-5 text-emerald-600" />,
            bg: "bg-emerald-50",
            sub: "dari halaman ini",
          },
          {
            label: "Sedang Running",
            value: runningCount,
            icon: <CheckCircle className="w-5 h-5 text-[#F26522]" />,
            bg: "bg-orange-50",
            sub: "dari halaman ini",
          },
          {
            label: "SD Card OK",
            value: sdOkCount,
            icon: <HardDrive className="w-5 h-5 text-purple-600" />,
            bg: "bg-purple-50",
            sub: "dari halaman ini",
          },
        ].map((card, i) => (
          <div key={i} className="bg-white border border-[#EAEAEA] rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.bg}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11.5px] text-gray-500 font-medium">{card.label}</p>
              <p className="text-[22px] font-extrabold text-gray-900 leading-tight">{card.value}</p>
              <p className="text-[10.5px] text-gray-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Card ── */}
      <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col max-w-full">

        {/* Header + Filter bar */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[#303481]">
            <Filter className="w-4 h-4" />
            <span className="text-[13px] font-bold">Filter Data</span>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11.5px] font-semibold text-gray-600 whitespace-nowrap">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 focus:outline-none focus:border-[#303481] bg-white cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11.5px] font-semibold text-gray-600 whitespace-nowrap">Sampai</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 focus:outline-none focus:border-[#303481] bg-white cursor-pointer"
              />
            </div>

            {/* Logger filter */}
            <select
              value={logger}
              onChange={(e) => setLogger(e.target.value)}
              className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 focus:outline-none focus:border-[#303481] bg-white cursor-pointer"
            >
              <option value="">Semua Logger</option>
              {loggers.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Per page */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 focus:outline-none focus:border-[#303481] bg-white cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} / hal</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari prisma / logger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-[12.5px] font-medium text-gray-700 w-[180px] focus:outline-none focus:border-[#303481]"
              />
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 mx-5 mt-4 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-[13px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="relative w-full">
          <div className="overflow-x-auto w-full">
          <table className="w-full text-center border-collapse">
            <thead className="bg-[#FAFAFB] sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="py-2 px-2 font-bold text-gray-600 text-[10px] whitespace-nowrap text-left sticky left-0 bg-[#FAFAFB] z-30 min-w-[35px]">#</th>
                <th className="py-2 px-2 font-bold text-gray-600 text-[10px] whitespace-nowrap text-left sticky left-[35px] bg-[#FAFAFB] z-30 min-w-[125px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] border-r border-gray-200">Waktu</th>
                <th className="py-2 px-2 font-bold text-gray-600 text-[10px] whitespace-nowrap min-w-[60px]">Logger</th>
                <th className="py-2 px-2 font-bold text-gray-600 text-[10px] whitespace-nowrap min-w-[60px]">ID Kontrol</th>
                {ALL_SENSORS.map((s) => (
                  <th key={s} className="py-2 px-1.5 font-bold text-gray-600 text-[10px] whitespace-nowrap min-w-[65px] z-10">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[#303481] leading-tight">{SENSOR_LABELS[s]}</span>
                      <span className="text-[8.5px] text-gray-400 font-normal leading-tight">{s}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4 + ALL_SENSORS.length} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin text-[#303481]" />
                      <span className="text-[12px] font-medium">Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4 + ALL_SENSORS.length} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Database className="w-10 h-10 text-gray-300" />
                      <p className="text-[12px] font-medium">Tidak ada data ditemukan</p>
                      <p className="text-[11px]">Coba ubah filter tanggal atau logger</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const rowNum = (pagination ? (page - 1) * limit : 0) + idx + 1;

                  return (
                    <tr
                      key={row.id}
                      className="group border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-1.5 px-2 text-[10px] text-gray-500 text-left sticky left-0 bg-white group-hover:bg-blue-50/30 z-20 transition-colors">{rowNum}</td>
                      <td className="py-1.5 px-2 text-[10px] font-medium text-gray-800 whitespace-nowrap text-left sticky left-[35px] bg-white group-hover:bg-blue-50/30 z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] border-r border-gray-100 transition-colors">
                        {fmtWaktu(row.waktu)}
                      </td>
                      <td className="py-1.5 px-2 relative z-0">
                        <span className="px-1.5 py-0.5 bg-[#EEF2FC] text-[#303481] rounded text-[9.5px] font-bold">
                          {row.code_logger || "-"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-[10px] text-gray-600 font-medium relative z-0">
                        {row.id_kontrol || "-"}
                      </td>
                      {ALL_SENSORS.map((s) => (
                        <td key={s} className="py-1.5 px-1.5 text-[10px] text-gray-700 relative z-0">
                          {renderSensorCell(row, s)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <p className="text-[12px] text-gray-500 font-medium">
              Menampilkan{" "}
              <span className="font-bold text-gray-800">
                {Math.min((page - 1) * limit + 1, pagination.total)}–{Math.min(page * limit, pagination.total)}
              </span>{" "}
              dari <span className="font-bold text-gray-800">{pagination.total.toLocaleString("id-ID")}</span> data
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                className="w-8 h-8 rounded border border-gray-200 text-[12px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (pagination.totalPages > 5) {
                  if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 rounded text-[12px] font-bold transition-colors cursor-pointer ${
                      page === pageNum
                        ? "bg-[#303481] text-white border-none"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= pagination.totalPages}
                className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
                className="w-8 h-8 rounded border border-gray-200 text-[12px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                »
              </button>
            </div>
          </div>
        )}

        <div className="h-3 bg-gray-50 border-t border-gray-100 rounded-b-xl" />
      </div>
    </div>
  );
}
