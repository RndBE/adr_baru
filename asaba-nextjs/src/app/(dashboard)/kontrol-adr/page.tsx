"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Settings2,
  CalendarDays,
  Lock,
  History,
  ArrowRight,
  Loader2,
  EyeOff,
  Clock,
  X,
  FileText,
  Navigation,
  SlidersHorizontal,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── RTS Sprite Animation ──────────────────────────────────────────────────────
const TOTAL_FRAMES = 65; // frames 1.png → 65.png
const FRAME_MS     = 60; // ms per frame (~16 fps)

function RTSAnimation({ isRunning }: { isRunning: boolean }) {
  const [frame, setFrame]     = useState(1);
  const directionRef          = useRef<1 | -1>(1);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setFrame((prev) => {
          const next = prev + directionRef.current;
          if (next >= TOTAL_FRAMES) { directionRef.current = -1; return TOTAL_FRAMES; }
          if (next <= 1)            { directionRef.current =  1; return 1; }
          return next;
        });
      }, FRAME_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setFrame(1);
      directionRef.current = 1;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  if (!isRunning) {
    return (
      <Image
        src="/65 2.svg"
        width={90}
        height={140}
        alt="Sokkia Total Station"
        className="object-contain w-[90px] h-[140px]"
      />
    );
  }

  return (
    <div className="relative w-[140px] h-[140px]">
      {/* Static Base (Bagian bawah / Tribrach yang diam) */}
      <img
        src="/rts-frames/1.png"
        alt="RTS Base"
        style={{ height: '140px', width: 'auto' }}
        className="absolute left-1/2 top-0 -translate-x-1/2 object-contain"
        draggable={false}
      />

      {/* Animated Top (Bagian atas yang berputar, cut bagian bawah ~18.5%) */}
      <img
        src={`/rts-frames/${frame}.png`}
        alt={`RTS frame ${frame}`}
        style={{ 
          height: '140px', 
          width: 'auto',
          clipPath: 'inset(0 0 18.5% 0)',
          WebkitClipPath: 'inset(0 0 18.5% 0)'
        }}
        className="absolute left-1/2 top-0 -translate-x-1/2 object-contain"
        draggable={false}
      />
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RtsConnectionBadge } from "@/components/RtsConnectionBadge";
import { useRtsConnectionStatus } from "@/hooks/use-api";

// --- Helper Date Formatter ---
function fmtDate(d: string | Date | null) {
  if (!d) return "-";
  let isoStr = typeof d === "string" ? d : d.toISOString();
  if (isoStr.includes("T")) {
    const [datePart, timePart] = isoStr.split("T");
    const [year, month, day] = datePart.split("-");
    const [hr, min, sec] = timePart.split(".")[0].split(":");
    return `${day}-${month}-${year} ${hr}:${min}`;
  }
  return "-";
}

// --- Metric Cards ---
const TOP_METRICS = [
  {
    title: "Status RTS",
    value: "Disconnected",
    bg: "bg-gray-100",
  },
  {
    title: "Slope Distance",
    value: "0 m",
    imageSrc: "/slope_distance.svg",
    bg: "bg-emerald-50",
  },
  {
    title: "Vertical Angle",
    value: "000,00,00",
    imageSrc: "/vertical_angle.svg",
    bg: "bg-purple-50",
  },
  {
    title: "Horizontal Angle",
    value: "000,00,00",
    imageSrc: "/horizontal_angle.svg",
    bg: "bg-amber-50",
  },
  {
    title: "Last Updated",
    value: "01-04-2026 17:53:00",
    imageSrc: "/kalender.svg",
    bg: "bg-blue-50",
  },
];

const RIWAYAT_DATA = [
  { date: "21-11-2025", time: "10:11:09", count: 10 },
  { date: "21-11-2025", time: "10:11:09", count: 10 },
  { date: "21-11-2025", time: "10:11:09", count: 10 },
  { date: "21-11-2025", time: "10:11:09", count: 10 },
];

// --- Types ---
type TempPrisma = {
  id: number;
  id_prisma: string;
  waktu: string;
  N1: string;
  E1: string;
  Z1: string;
  N0: string;
  E0: string;
  Z0: string;
  status_get: number; // 1=success, 0=failed, 2=running
  HA: number | null;
  VA: number | null;
  SlopDis: number | null;
};

type PrismaCard = {
  name: string;
  status: "Success" | "Failed" | "Running...";
  y: string;
  x: string;
  z: string;
  waktu?: string;
};

function mapStatus(status_get: number): "Success" | "Failed" | "Running..." {
  if (status_get === 1) return "Success";
  if (status_get === 2) return "Running...";
  return "Failed";
}

// --- RTS Config Types ---
type RtsConfig = {
  jobName: string;
  prismaConst: string;
  tsHigh: string;
  coordX: string;
  coordY: string;
  coordZ: string;
  stepRecord: string;
  retries: string;
  cycleTime: string;
};

// --- Jadwal Schedules Type ---
type RunSchedule = {
  id: string;
  nama: string;
  active: boolean;
  time: string;
};

type DaySchedule = {
  day: string;
  active: boolean; // Virtual toggle based on run statuses or custom logic
  runs: RunSchedule[];
};

const DAY_MAP: Record<number, string> = {
  1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu"
};

const DEFAULT_SCHEDULES: DaySchedule[] = [1, 2, 3, 4, 5, 6, 7].map(d => ({
  day: DAY_MAP[d],
  active: false,
  runs: []
}));


export default function KontrolAdrPage() {
  const { isConnected, lastUpdate, sensor14, sensor16, sensor5, sensor6, sensor7 } = useRtsConnectionStatus();

  // Tick setiap 60 detik → paksa re-render supaya isConnected (Date.now()) dievaluasi ulang
  // Tanpa ini, status Connected/Disconnected tidak berubah otomatis saat data berhenti masuk
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [prismaCards, setPrismaCards] = useState<PrismaCard[]>([]);
  const [prismaLoading, setPrismaLoading] = useState(true);
  const [runningDate, setRunningDate] = useState<string>("-");
  const [isControlRunning, setIsControlRunning] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [totalPrisma, setTotalPrisma] = useState(0);

  // --- Data-driven Proses Log ---
  // Hitung progress berdasarkan status prisma card yang diterima dari logger
  const successCount = prismaCards.filter(c => c.status === "Success").length;
  const failedCount = prismaCards.filter(c => c.status === "Failed").length;
  const runningCount = prismaCards.filter(c => c.status === "Running...").length;
  const respondedCount = successCount + failedCount; // prisma yang sudah dijawab logger
  const allDone = totalPrisma > 0 && runningCount === 0 && isControlRunning;
  const hasAnyResponse = respondedCount > 0;

  // Sinkronkan isControlRunning dengan sensor16 dari hardware
  // sensor16=1 → RTS sedang running, sensor16=0 → selesai/idle
  useEffect(() => {
    const isRunning = String(sensor16) === "1";
    setIsControlRunning(isRunning);
    // Jika running selesai (sensor16 kembali 0), stop polling
    if (!isRunning && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [sensor16]);
  const [showRtsConfig, setShowRtsConfig] = useState(false);
  const [configId, setConfigId] = useState<number>(1);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [rtsConfig, setRtsConfig] = useState<RtsConfig>({
    jobName: "",
    prismaConst: "",
    tsHigh: "",
    coordX: "",
    coordY: "",
    coordZ: "",
    stepRecord: "",
    retries: "",
    cycleTime: "",
  });

  // Jadwal Running state
  const [showJadwalModal, setShowJadwalModal] = useState(false);
  const [jadwalLoading, setJadwalLoading] = useState(false);
  const [jadwalSaving, setJadwalSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Senin");
  const [schedules, setSchedules] = useState<DaySchedule[]>(DEFAULT_SCHEDULES);
  const [openTimePickerId, setOpenTimePickerId] = useState<string | null>(null);

  const currentSchedule = schedules.find(s => s.day === activeTab) || DEFAULT_SCHEDULES[0];

  // Auto-scroll to selected time when picker opens
  useEffect(() => {
    if (openTimePickerId) {
      setTimeout(() => {
        const activeHour = document.querySelector('.time-active-hour');
        const activeMinute = document.querySelector('.time-active-minute');
        if (activeHour) activeHour.scrollIntoView({ block: "start" });
        if (activeMinute) activeMinute.scrollIntoView({ block: "start" });
      }, 50);
    }
  }, [openTimePickerId]);

  const fetchScheduling = async () => {
    setShowJadwalModal(true);
    setJadwalLoading(true);
    try {
      const res = await fetch("/api/scheduling");
      const json = await res.json();
      if (json.success && json.data) {
        // Group by day
        const grouped: DaySchedule[] = [1, 2, 3, 4, 5, 6, 7].map(d => ({
          day: DAY_MAP[d],
          active: false,
          runs: []
        }));

        json.data.forEach((row: any) => {
          const dayId = row.days;
          const dayObj = grouped[dayId - 1];
          if (dayObj) {
            dayObj.runs.push({
              id: row.id,
              nama: row.nama,
              active: row.status === 1,
              time: row.time || ""
            });
            if (row.status === 1) dayObj.active = true;
          }
        });
        setSchedules(grouped);
      }
    } catch (err) {
      console.error("Failed to fetch scheduling", err);
    } finally {
      setJadwalLoading(false);
    }
  };

  const saveScheduling = async () => {
    setJadwalSaving(true);
    try {
      // Flatten
      const payload: any[] = [];
      schedules.forEach(s => {
        // If day is entirely inactive, we force all runs in that day to status 0
        s.runs.forEach(r => {
          payload.push({
            id: r.id,
            status: s.active && r.active ? 1 : 0,
            time: r.time
          });
        });
      });

      const res = await fetch("/api/scheduling", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: payload })
      });
      const json = await res.json();
      if (json.success) {
        setShowJadwalModal(false);
      }
    } catch (err) {
      console.error("Failed to save scheduling", err);
    } finally {
      setJadwalSaving(false);
    }
  };

  const toggleDayActive = () => {
    setSchedules(prev => prev.map(s => s.day === activeTab ? { ...s, active: !s.active } : s));
  };

  const toggleRunActive = (runId: string) => {
    setSchedules(prev => prev.map(s => s.day === activeTab ? {
      ...s,
      runs: s.runs.map(r => r.id === runId ? { ...r, active: !r.active } : r)
    } : s));
  };

  const updateRunTime = (runId: string, time: string) => {
    setSchedules(prev => prev.map(s => s.day === activeTab ? {
      ...s,
      runs: s.runs.map(r => r.id === runId ? { ...r, time } : r)
    } : s));
  };

  // Fetch config saat modal dibuka
  const openRtsConfig = async () => {
    setShowRtsConfig(true);
    setConfigLoading(true);
    try {
      const res = await fetch("/api/config-adr");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setConfigId(d.id);
        setRtsConfig({
          jobName:     String(d.job_name   ?? ""),
          prismaConst: String(d.prisma_cons ?? ""),
          tsHigh:      String(d.ts_high     ?? ""),
          coordX:      String(d.coor_x      ?? ""),
          coordY:      String(d.coor_y      ?? ""),
          coordZ:      String(d.coor_z      ?? ""),
          stepRecord:  String(d.step_record ?? ""),
          retries:     String(d.retries     ?? ""),
          cycleTime:   String(d.cycle_time  ?? ""),
        });
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  // Simpan config ke database
  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const res = await fetch("/api/config-adr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:          configId,
          job_name:    rtsConfig.jobName,
          prisma_cons: rtsConfig.prismaConst,
          ts_high:     rtsConfig.tsHigh,
          coor_x:      rtsConfig.coordX,
          coor_y:      rtsConfig.coordY,
          coor_z:      rtsConfig.coordZ,
          step_record: rtsConfig.stepRecord,
          retries:     rtsConfig.retries,
          cycle_time:  rtsConfig.cycleTime,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowRtsConfig(false);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setConfigSaving(false);
    }
  };

  const fetchPrisma = useCallback(async () => {
    try {
      const res = await fetch("/api/prisma-data");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const dbCards: PrismaCard[] = (json.data as TempPrisma[]).map((row) => ({
          name: row.id_prisma,
          status: mapStatus(row.status_get),
          y: row.N1,
          x: row.E1,
          z: row.Z1,
          waktu: row.waktu,
        }));
        if (dbCards.length > 0 && json.data[0].waktu) {
          setRunningDate(json.data[0].waktu);
        }
        setTotalPrisma(dbCards.length);
        setPrismaCards(dbCards);

        // Auto-stop polling ketika semua prisma sudah selesai (tidak ada Running lagi)
        const stillRunning = dbCards.some(c => c.status === "Running...");
        if (!stillRunning && dbCards.length > 0 && pollingRef.current) {
          // Semua sudah dijawab logger, stop polling
          // (isControlRunning akan berubah lewat sensor16)
        }
      }
    } catch (err) {
      console.error("Failed to fetch prisma data:", err);
    } finally {
      setPrismaLoading(false);
    }
  }, []);

  // Initial fetch saat halaman dibuka
  useEffect(() => {
    fetchPrisma();
    
    // Fetch initial config for RTS Card display
    fetch("/api/config-adr")
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setConfigId(json.data.id);
          setRtsConfig({
            jobName:     String(json.data.job_name   ?? ""),
            prismaConst: String(json.data.prisma_cons ?? ""),
            tsHigh:      String(json.data.ts_high     ?? ""),
            coordX:      String(json.data.coor_x      ?? ""),
            coordY:      String(json.data.coor_y      ?? ""),
            coordZ:      String(json.data.coor_z      ?? ""),
            stepRecord:  String(json.data.step_record ?? ""),
            retries:     String(json.data.retries     ?? "1"),
            cycleTime:   String(json.data.cycle_time  ?? "1"),
          });
        }
      })
      .catch(console.error);
  }, [fetchPrisma]);

  // Cleanup polling saat unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleMulaiKontrol = async () => {
    if (!accessCode.trim()) return;

    // Reset error
    setAccessCodeError("");

    // Stop polling lama jika ada
    if (pollingRef.current) clearInterval(pollingRef.current);

    setIsControlRunning(true);

    try {
      const res = await fetch("/api/kontrol/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: accessCode }),
      });
      const json = await res.json();

      if (!json.success) {
        // Kode salah atau error lain
        setAccessCodeError(
          res.status === 403
            ? "Kode akses salah. Silakan coba lagi."
            : json.error || "Gagal menjalankan kontrol."
        );
        setIsControlRunning(false);
        return;
      }

      // Kode benar — fetch data langsung, lalu polling tiap 5 detik
      await fetchPrisma();
      pollingRef.current = setInterval(() => {
        fetchPrisma();
      }, 5000);
    } catch (err) {
      setAccessCodeError("Terjadi kesalahan jaringan. Coba lagi.");
      setIsControlRunning(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="-m-4 md:-m-6 bg-[#F4F6F9] min-h-[calc(100vh-3.5rem)] flex flex-col p-4 md:p-6 gap-7">

        {/* Header Section */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
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
            {/* Right Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={openRtsConfig}
                className="bg-[#303481] hover:bg-[#1f2259] text-white flex items-center gap-2 px-5 rounded-md h-[40px] text-[13.5px] font-medium shadow-sm transition-colors border-none cursor-pointer"
              >
                <Settings2 className="w-[17px] h-[17px]" /> RTS Config
              </Button>
              <Button
                variant="outline"
                onClick={fetchScheduling}
                className="flex items-center gap-2 px-5 rounded-md h-[40px] text-[13.5px] font-medium text-[#303481] border-[#303481] hover:bg-[#303481]/5 bg-white transition-colors cursor-pointer"
              >
                <CalendarDays className="w-[17px] h-[17px]" /> Jadwal Running
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 items-start">

          {/* Left Column (Kontrol + RTS Image + Riwayat) */}
          <div className="flex flex-col gap-4 w-full">

            {/* Kontrol ADR Card */}
            <div className={`bg-white border rounded-[8px] shadow-sm overflow-hidden text-slate-800 transition-all ${!isConnected ? 'border-gray-200 opacity-75' : 'border-[#EAEAEA]'}`}>
              <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2.5">
                <Image
                  src="/kontrol_adr_fill.svg"
                  alt="Kontrol ADR"
                  width={16}
                  height={16}
                  className="object-contain"
                />
                <h3 className="font-bold text-[#303481] text-[14px]">Kontrol ADR</h3>
              </div>
              <div className="px-4 py-4">
                <label className={`block text-[12.5px] font-bold mb-2 ${!isConnected ? 'text-gray-400' : 'text-gray-900'}`}>Masukkan Kode Akses</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={accessCode}
                      onChange={(e) => { setAccessCode(e.target.value); setAccessCodeError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && isConnected && handleMulaiKontrol()}
                      placeholder={!isConnected ? "Logger tidak terhubung..." : "Masukkan kode..."}
                      disabled={!isConnected}
                      autoComplete="new-password"
                      className={`h-[38px] pr-10 text-[13px] rounded-md font-medium ${!isConnected ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : accessCodeError ? "border-red-400 focus-visible:ring-red-400" : "border-gray-300 focus-visible:ring-[#303481]"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={!isConnected}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 focus:outline-none transition-colors disabled:opacity-40"
                    >
                      {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Lock className="w-[16px] h-[16px]" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleMulaiKontrol}
                    disabled={!accessCode.trim() || isControlRunning || !isConnected}
                    className="shrink-0 h-[38px] px-6 bg-[#303481] hover:bg-[#1f2259] text-white font-medium text-[13px] rounded-lg transition-colors border-none cursor-pointer disabled:opacity-60"
                  >
                    {isControlRunning
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
                      : "Mulai Kontrol"}
                  </Button>
                </div>
                {/* Error message kode akses */}
                {accessCodeError && (
                  <p className="text-[12px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
                    <X className="w-3.5 h-3.5" />
                    {accessCodeError}
                  </p>
                )}
              </div>
            </div>
            {/* Robotic Total Station Card */}
            <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm overflow-hidden text-slate-800">
              <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2.5">
                <Image
                  src="/ikon_rts.svg"
                  alt="Robotic Total Station"
                  width={14}
                  height={14}
                  className="object-contain"
                />
                <h3 className="font-bold text-[#303481] text-[14px]">Robotic Total Station</h3>
              </div>
              <div className="p-5 flex gap-4">
                 <div className="w-[140px] shrink-0 flex items-center justify-center">
                   <RTSAnimation isRunning={isControlRunning} />
                 </div>
                 <div className="flex-1 flex flex-col">
                    <div className="flex gap-10 mb-5">
                      <div>
                        <p className="text-[13px] font-bold text-[#303481]">Retries</p>
                        <p className="text-[28px] font-bold text-gray-900 flex items-center gap-2 mt-1 leading-[1.1]">
                          <RefreshCcw className={`w-6 h-6 text-[#F26522] ${isControlRunning ? 'animate-spin' : ''}`} strokeWidth={3} style={{ animationDirection: 'reverse' }} />
                          {rtsConfig.retries || "1"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#303481]">Cycle Time</p>
                        <p className="text-[28px] font-bold text-gray-900 mt-1 leading-[1.1]">{rtsConfig.cycleTime || "1"}</p>
                      </div>
                   </div>
                   <div>
                      <p className="text-[12px] font-bold text-[#303481] mb-1.5 flex justify-between items-center">
                        Proses Log
                        {isControlRunning && <span className="text-[10px] text-gray-400 font-normal italic flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />&nbsp;Live</span>}
                      </p>
                      <div className="text-[11px] font-medium text-gray-700 leading-snug flex flex-col gap-1">
                        {(() => {
                          const step1Done = isControlRunning || allDone;
                          const step1Active = isControlRunning && !hasAnyResponse && runningCount > 0;
                          const step2Done = hasAnyResponse;
                          const step2Active = isControlRunning && !hasAnyResponse && runningCount > 0;
                          const step3Done = respondedCount === totalPrisma && totalPrisma > 0;
                          const step3Active = isControlRunning && hasAnyResponse && runningCount > 0;
                          const step4Done = respondedCount === totalPrisma && totalPrisma > 0 && runningCount === 0;
                          const step4Active = false;
                          const steps = [
                            { step: 1, label: "Directing to Target", active: step1Active, done: step1Done && !step1Active, showProgress: false },
                            { step: 2, label: "Search Target", active: step2Active, done: step2Done && !step2Active, showProgress: false },
                            { step: 3, label: "Measuring Target", active: step3Active, done: step3Done && !step3Active, showProgress: true },
                            { step: 4, label: "Recording Data", active: step4Active, done: step4Done, showProgress: false },
                          ];
                          return steps.map((log) => (
                            <p key={log.step} className="flex justify-between items-center group">
                              <span className={`truncate flex-1 tracking-tight ${log.active ? 'text-[#303481] font-bold drop-shadow-sm' : ''}`}>
                                {log.label}
                                {log.showProgress && isControlRunning && totalPrisma > 0
                                  ? <span className="text-gray-400 text-[10px] ml-1">({respondedCount}/{totalPrisma})</span>
                                  : <span className="text-gray-300">{".".repeat(Math.max(0, 35 - log.label.length))}</span>
                                }
                              </span>
                              {log.active ? (
                                <Loader2 className="w-[14px] h-[14px] animate-spin text-[#303481] ml-2 shrink-0" />
                              ) : log.done ? (
                                failedCount > 0 && log.step === 4 ? (
                                  <span className="font-bold text-amber-500 ml-2 shrink-0">{successCount} OK / {failedCount} Fail</span>
                                ) : (
                                  <span className="font-bold text-emerald-500 ml-2 shrink-0">OK!</span>
                                )
                              ) : (
                                <span className="font-bold text-gray-300 ml-2 shrink-0">-</span>
                              )}
                            </p>
                          ));
                        })()}
                      </div>
                   </div>
                 </div>
              </div>
            </div>
            {/* Riwayat Running Card */}
            <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2.5">
                <History className="w-[16px] h-[16px] text-[#303481]" />
                <h3 className="font-bold text-[#303481] text-[14px]">Riwayat Running</h3>
              </div>
              <div className="flex flex-col">
                {RIWAYAT_DATA.map((item, idx) => (
                  <div key={idx} className="p-4 py-3.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 mb-1.5">
                      <p className="text-[13px] text-gray-800 font-medium">Running Date: {item.date}</p>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Clock className="w-[13px] h-[13px]" />
                        <span className="text-[12px] font-medium">{item.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[13px] text-gray-700 font-medium tracking-tight">Prisma Count:</p>
                      <span className="px-2 py-[3px] bg-[#EBF0FF] text-[#303481] rounded-[4px] text-[11px] font-bold leading-none">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="p-3.5 border-t border-gray-100 flex justify-end">
                  <button className="text-[12.5px] font-bold text-[#303481] hover:text-[#1f2259] flex items-center gap-1.5 transition-colors hover:underline cursor-pointer">
                    Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (Metrics + Prisma Data) */}
          <div className="flex flex-col gap-4 w-full">
            
            {/* 5 Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
              {TOP_METRICS.map((metric, i) => {
                let finalValue = metric.value;
                let valueColor = "#0f172a";
                // Prioritas: sensor16=1 → Running, sensor14=1 + data < 1jam → Connected, else → Disconnected
                const isRtsRunning   = String(sensor16) === "1";
                const isRtsConnected = !isRtsRunning && String(sensor14) === "1" && isConnected;

                if (metric.title === "Status RTS") {
                  if (isRtsRunning) {
                    finalValue = "Running...";
                    valueColor = "#303481";
                  } else if (isRtsConnected) {
                    finalValue = "Connected";
                    valueColor = "#059669";
                  } else {
                    finalValue = "Disconnected";
                    valueColor = "#EF4444";
                  }
                } else if (metric.title === "Slope Distance") {
                  finalValue = `${sensor7 || 0} m`;
                } else if (metric.title === "Vertical Angle") {
                  finalValue = String(sensor6 || 0);
                } else if (metric.title === "Horizontal Angle") {
                  finalValue = String(sensor5 || 0);
                } else if (metric.title === "Last Updated") {
                  finalValue = lastUpdate ? fmtDate(lastUpdate) : metric.value;
                }

                // Pilih warna bg & ikon untuk Status RTS card
                const rtsIconSrc = isRtsRunning
                  ? "/ikon_rts_online.svg"
                  : isRtsConnected
                    ? "/ikon_rts_online.svg"
                    : "/ikon_rts_offline.svg";
                const rtsBg = isRtsRunning ? "bg-blue-50" : isRtsConnected ? "bg-green-50" : "bg-gray-50";

                return (
                  <div key={i} className="bg-white border border-[#EAEAEA] rounded-[8px] p-4 flex items-center gap-4 shadow-sm h-full hover:border-gray-300 hover:shadow-md transition-all duration-200">
                    <div className={cn("w-[42px] h-[42px] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden", metric.bg, metric.title === "Status RTS" ? rtsBg : "")}>
                      {metric.title === "Status RTS" ? (
                        <div className="relative">
                          {isRtsRunning && (
                            <span className="absolute inset-0 rounded-full bg-[#303481]/20 animate-ping" />
                          )}
                          <Image
                            src={rtsIconSrc}
                            alt="Status RTS"
                            width={26}
                            height={26}
                            className="object-contain relative z-10"
                          />
                        </div>
                      ) : (
                        <Image
                          src={metric.imageSrc!}
                          alt={metric.title}
                          width={22}
                          height={22}
                          className="object-contain"
                        />
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[12px] text-gray-500 font-medium leading-none mb-1.5">{metric.title}:</p>
                      <p className="text-[13.5px] font-bold leading-tight" style={{ color: valueColor }}>{finalValue}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prisma Data Grid Box */}
            <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm w-full h-full flex flex-col">
              {/* Header Card Prisma Data */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/prisma_data.svg"
                    alt="Prisma Data"
                    width={16}
                    height={16}
                    className="object-contain"
                  />
                  <h3 className="font-bold text-[#303481] text-[14px]">Prisma Data</h3>
                </div>
                <div className="text-[11.5px] font-medium text-gray-600 italic">
                  Running Date : {runningDate}
                </div>
              </div>

              {/* Body - Grid Prisma Cards */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
                {prismaLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="bg-gray-50 border border-[#EAEAEA] rounded-[8px] overflow-hidden flex flex-col animate-pulse">
                      <div className="bg-gray-200 h-[44px]"></div>
                      <div className="flex flex-col gap-2 p-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                ) : prismaCards.length === 0 ? (
                  <div className="col-span-4 py-12 text-center text-gray-400 text-[13px]">
                    Tidak ada data prisma tersedia.
                  </div>
                ) : (
                  prismaCards.map((prisma, idx) => (
                    <div key={idx} className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm overflow-hidden flex flex-col flex-1">
                      {/* Card Header */}
                      <div className="bg-[#FAFAFA] border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-[13.5px]">{prisma.name}</h4>
                        {prisma.status === "Success" && (
                          <span className="px-2.5 py-[3px] bg-[#DFF4DF] text-[#1B801E] text-[10px] font-bold rounded-full leading-none">Success</span>
                        )}
                        {prisma.status === "Failed" && (
                          <span className="px-2.5 py-[3px] bg-[#FDE2E4] text-[#D32F2F] text-[10px] font-bold rounded-full leading-none">Failed</span>
                        )}
                        {prisma.status === "Running..." && (
                          <span className="px-2.5 py-[3px] bg-[#EEF2FC] text-[#303481] text-[10px] font-bold rounded-full flex items-center gap-1.5 leading-none">
                            Running... <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          </span>
                        )}
                      </div>
                      {/* Card Body */}
                      <div className="flex flex-col pb-1">
                        <div className="grid grid-cols-[1fr_2fr] border-b border-gray-100 px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">Y</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : prisma.y}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr] border-b border-gray-100 px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">X</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : prisma.x}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr] px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">Z</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : prisma.z}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── RTS Config Modal ─── */}
      {showRtsConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowRtsConfig(false)}
          />

          {/* Modal Panel */}
          <div className="relative z-10 bg-white rounded-[10px] shadow-2xl w-full max-w-[600px] mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[16px] font-bold text-gray-900">RTS Configuration</h2>
              <button
                onClick={() => setShowRtsConfig(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {configLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#303481]" />
                  <span className="ml-2 text-[13px] text-gray-500">Memuat konfigurasi...</span>
                </div>
              ) : (
                <>

              {/* Card 1: Job Information */}
              <div className="border border-[#EAEAEA] rounded-[8px] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-gray-50">
                  <FileText className="w-[15px] h-[15px] text-[#303481]" />
                  <h3 className="font-bold text-[#303481] text-[13px]">Job Information</h3>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Job Name</label>
                    <Input
                      value={rtsConfig.jobName}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, jobName: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Prisma Const</label>
                    <Input
                      value={rtsConfig.prismaConst}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, prismaConst: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">TS High</label>
                    <Input
                      value={rtsConfig.tsHigh}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, tsHigh: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: RTS Coordinate */}
              <div className="border border-[#EAEAEA] rounded-[8px] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-gray-50">
                  <Image src="/prisma_data.svg" alt="RTS Coordinate" width={15} height={15} className="object-contain" />
                  <h3 className="font-bold text-[#303481] text-[13px]">RTS Coordinate</h3>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Coordinate X</label>
                    <Input
                      value={rtsConfig.coordX}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, coordX: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Coordinate Y</label>
                    <Input
                      value={rtsConfig.coordY}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, coordY: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Coordinate Z</label>
                    <Input
                      value={rtsConfig.coordZ}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, coordZ: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Running Parameters */}
              <div className="border border-[#EAEAEA] rounded-[8px] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-gray-50">
                  <SlidersHorizontal className="w-[15px] h-[15px] text-[#303481]" />
                  <h3 className="font-bold text-[#303481] text-[13px]">Running Parameters</h3>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Step Record</label>
                    <Input
                      value={rtsConfig.stepRecord}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, stepRecord: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Retries</label>
                    <Input
                      value={rtsConfig.retries}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, retries: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Cycle Time</label>
                    <Input
                      value={rtsConfig.cycleTime}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, cycleTime: e.target.value })}
                      className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-md"
                    />
                  </div>
                </div>
              </div>

                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRtsConfig(false)}
                className="h-[38px] px-5 text-[13px] font-medium border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={saveConfig}
                disabled={configSaving}
                className="h-[38px] px-6 text-[13px] font-medium bg-[#303481] hover:bg-[#1f2259] text-white border-none cursor-pointer disabled:opacity-60"
              >
                {configSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Menyimpan...</> : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Jadwal Running Modal ─── */}
      {showJadwalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowJadwalModal(false)} />
          <div className="relative z-10 bg-white rounded-[10px] shadow-2xl w-full max-w-[550px] mx-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[16px] font-bold text-gray-900">Jadwal Running RTS</h2>
              <button onClick={() => setShowJadwalModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 flex items-center gap-1 border-b border-[#EAEAEA] pt-2">
              {schedules.map(s => (
                <button
                  key={s.day}
                  onClick={() => setActiveTab(s.day)}
                  className={cn(
                    "px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 cursor-pointer",
                    activeTab === s.day ? "border-[#303481] text-[#303481] font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {s.day}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
              {jadwalLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#303481]" />
                  <span className="ml-2 text-[13px] text-gray-500">Memuat jadwal...</span>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 border border-[#EAEAEA] rounded-[8px] p-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-[13.5px] font-bold text-gray-900">Aktifkan Penjadwalan: {activeTab}</h3>
                      <p className="text-[12px] text-gray-500">Otomatis running pada waktu yang telah ditentukan</p>
                    </div>
                    {/* Custom Toggle Switch */}
                    <button
                      type="button"
                      onClick={toggleDayActive}
                      className={cn(
                        "relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303481] focus-visible:ring-offset-2",
                        currentSchedule.active ? "bg-[#303481]" : "bg-gray-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          currentSchedule.active ? "translate-x-[20px]" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {currentSchedule.active && currentSchedule.runs && currentSchedule.runs.length > 0 && (
                    <div>
                      <h3 className="text-[13.5px] font-bold text-gray-900 mb-3">Pengaturan Waktu</h3>
                      <div className="border border-[#EAEAEA] rounded-[8px] flex flex-col">
                        {currentSchedule.runs.map((r, i) => (
                          <div key={r.id} className={cn("flex items-center justify-between p-3.5", i !== currentSchedule.runs.length - 1 && "border-b border-[#EAEAEA]")}>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={r.active}
                                onChange={() => toggleRunActive(r.id)}
                                className="w-4 h-4 rounded border-gray-300 text-[#303481] focus:ring-[#303481] cursor-pointer"
                              />
                              <span className="text-[13px] font-medium text-gray-700">{r.nama}</span>
                            </div>
                            <div className="flex items-center gap-2 relative">
                              <Clock className="w-4 h-4 text-gray-400" />
                              
                              {/* Trigger Button */}
                              <button
                                type="button"
                                onClick={() => r.active && setOpenTimePickerId(openTimePickerId === r.id ? null : r.id)}
                                disabled={!r.active}
                                className="w-[85px] h-[34px] flex items-center justify-center text-[14px] text-center font-medium bg-white border border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                              >
                                {r.time || "00:00"}
                              </button>

                              {/* Custom Time Picker Dropdown */}
                              {openTimePickerId === r.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenTimePickerId(null)} />
                                  <div className="absolute right-0 top-10 flex bg-white border border-gray-200 rounded-md shadow-xl w-[120px] h-[160px] overflow-hidden z-50">
                                    
                                    {/* Hours Scroll */}
                                    <div className="w-1/2 h-full overflow-y-auto border-r border-gray-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                      {Array.from({ length: 24 }).map((_, i) => {
                                        const h = i.toString().padStart(2, '0');
                                        const isSelected = (r.time?.split(':')[0] || "00") === h;
                                        return (
                                          <button
                                            type="button"
                                            key={`h-${i}`}
                                            onClick={() => updateRunTime(r.id, `${h}:${r.time?.split(':')[1] || "00"}`)}
                                            className={cn(
                                              "w-full py-1.5 text-[14px] font-medium transition-colors hover:bg-gray-100",
                                              isSelected ? "bg-[#303481] text-white hover:bg-[#303481] time-active-hour" : "text-gray-700"
                                            )}
                                          >
                                            {h}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Minutes Scroll */}
                                    <div className="w-1/2 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                      {Array.from({ length: 60 }).map((_, i) => {
                                        const m = i.toString().padStart(2, '0');
                                        const isSelected = (r.time?.split(':')[1] || "00") === m;
                                        return (
                                          <button
                                            type="button"
                                            key={`m-${i}`}
                                            onClick={() => updateRunTime(r.id, `${r.time?.split(':')[0] || "00"}:${m}`)}
                                            className={cn(
                                              "w-full py-1.5 text-[14px] font-medium transition-colors hover:bg-gray-100",
                                              isSelected ? "bg-[#303481] text-white hover:bg-[#303481] time-active-minute" : "text-gray-700"
                                            )}
                                          >
                                            {m}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowJadwalModal(false)} className="h-[38px] px-5 text-[13px] font-medium border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">Batal</Button>
              <Button onClick={saveScheduling} disabled={jadwalSaving} className="h-[38px] px-6 text-[13px] font-medium bg-[#303481] hover:bg-[#1f2259] text-white border-none cursor-pointer disabled:opacity-60">
                {jadwalSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5"/>Menyimpan...</> : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
