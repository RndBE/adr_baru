"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

// ── Power Alert Toast ──────────────────────────────────────────────────────────
type PowerAlert = {
  type: "on" | "off" | "error";
  message: string;
  /** Menimpa judul bawaan. Tanpa ini setiap toast berjudul "RTS Power",
   *  yang keliru untuk pesan di luar urusan daya (mis. Set Home). */
  title?: string;
};

function PowerAlertToast({ alert, onClose }: { alert: PowerAlert; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    on:    { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-800", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />, title: "RTS Power ON" },
    off:   { bg: "bg-red-50 border-red-300",         text: "text-red-800",     icon: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,         title: "RTS Power OFF" },
    error: { bg: "bg-amber-50 border-amber-300",     text: "text-amber-800",   icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />, title: "RTS Power" },
  }[alert.type];

  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm animate-in slide-in-from-top-2 fade-in duration-300 ${config.bg}`}>
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold ${config.text}`}>{alert.title ?? config.title}</p>
        <p className={`text-[12px] mt-0.5 ${config.text} opacity-80`}>{alert.message}</p>
      </div>
      <button onClick={onClose} className={`shrink-0 ${config.text} opacity-50 hover:opacity-100 transition-opacity`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
import mqtt from "mqtt";
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
  Power,
  Home,
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
import { useRtsConnectionStatus, useLogKontrol } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { nilaiRts, nilaiRtsLama, klasifikasiPower, klasifikasiTracking } from "@/lib/protokol-rts";

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

// Riwayat running dulu berupa array hardcode berisi 4 baris identik
// ("21-11-2025 10:11:09, 10 prisma") yang tidak pernah berubah, apa pun
// site-nya. Sekarang diambil dari log_kontrol per site — lihat `riwayat`
// di dalam komponen.

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

/**
 * "Running..."    – sesi kontrol sedang berjalan, menunggu hasil tembakan
 * "Menunggu"      – status di-reset tapi tidak ada sesi berjalan
 * "Belum diukur"  – prisma terdaftar tapi belum pernah ditembak sama sekali
 */
type PrismaStatus = "Success" | "Failed" | "Running..." | "Menunggu" | "Belum diukur";

type PrismaCard = {
  name: string;
  status: PrismaStatus;
  y: string;
  x: string;
  z: string;
  waktu?: string;
};

/**
 * Prisma yang belum pernah diukur menyimpan '0' di temp_prisma. Menampilkannya
 * apa adanya membuatnya terbaca seperti koordinat nol yang sah, padahal artinya
 * "tidak ada data" — jadi ditampilkan sebagai tanda hubung.
 */
function nilaiPrisma(status: PrismaStatus, nilai: string): string {
  if (status === "Belum diukur" || status === "Menunggu") return "–";
  return nilai;
}

/**
 * Terjemahkan baris temp_prisma menjadi status kartu.
 *
 * `status_get = 0` di DB mencampur DUA keadaan yang berbeda: "sedang menunggu
 * hasil tembakan" dan "belum pernah diukur sama sekali". Dulu keduanya
 * diterjemahkan jadi "Running...", sehingga prisma yang tidak pernah tertembak
 * berputar selamanya meski tidak ada kontrol yang berjalan.
 *
 * Pembedanya dua hal yang memang tersedia:
 *   - `kontrolBerjalan` — apakah RTS sedang menjalankan sesi (sensor16).
 *   - `waktu` — prisma yang belum pernah diukur nilainya '-' atau kosong.
 */
function mapStatus(
  status_get: number | string,
  n1: string,
  e1: string,
  z1: string,
  kontrolBerjalan: boolean,
  waktu?: string | null
): PrismaStatus {
  // Gunakan String() karena dari raw query Prisma bisa berupa number atau string
  if (String(status_get) === "0") {
    if (kontrolBerjalan) return "Running...";
    const pernahDiukur = !!waktu && waktu !== "-" && waktu.trim() !== "";
    return pernahDiukur ? "Menunggu" : "Belum diukur";
  }

  // Jika sudah Done (1) tapi nilainya 0 semua, berarti Failed / Not Found
  if (Number(n1) === 0 && Number(e1) === 0 && Number(z1) === 0) {
    return "Failed";
  }

  return "Success";
}

// --- RTS Config Types ---
// ── Protokol balasan RTS (PROTOKOL_MQTT_ADR, revisi memutus kompatibilitas) ───
//
// Kunci `stage` DIHAPUS seluruhnya; semua balasan RTS kini memakai `value`.
// Pemilahan kemajuan vs hasil akhir tidak lagi lewat nama kunci, melainkan
// lewat ISI `value`-nya. Kunci `stage` tetap ikut dibaca sebagai fallback
// selama masih ada unit yang belum di-flash — dokumennya sendiri menyebut
// backend harus siap sebelum unit produksi diperbarui, jadi dua versi firmware
// akan hidup berdampingan untuk sementara.
//
// Perangkap yang sudah menelan korban di kode sebelumnya:
//
// 1. PowerOn "Success" BUKAN penanda siap. Instrumen menjawab, tapi konstanta
//    prisma dan koreksi atmosfer belum dikirim. Penanda siap adalah "done".
//    Kode lama memakai "config" sebagai penutup — itu justru tahap kemajuan.
// 2. Kata "done" muncul di dua tingkat berbeda: {"PowerOn":{"value":"done"}}
//    berarti instrumen siap, sedangkan {"AutoTracking":{"value":"target",
//    "status":"done"}} cuma berarti satu target selesai. Jangan mencari string
//    tanpa melihat tingkatnya.
// 3. Perintah `AutoTrackingStart` dijawab dengan nama `AutoTracking`.
// 4. {"AutoTrack":{"value":"done"}} dihapus, bukan diganti nama.

const LABEL_NILAI_POWER: Record<"on" | "off", Record<string, string>> = {
  on: {
    start: "Mengirim perintah",
    ping: "Menghubungi RTS",
    // Disebut apa adanya: instrumen sudah menjawab tapi BELUM terkonfigurasi.
    Success: "RTS menjawab, memuat konfigurasi",
    config: "Memuat konfigurasi",
  },
  off: {
    start: "Mengirim perintah",
    check: "Memeriksa status",
    home: "Kembali ke posisi home",
    off: "Mengirim perintah mati",
    Success: "Perintah mati terkirim",
  },
};

/** Balasan yang menutup rangkaian power dengan sukses. */
const NILAI_SELESAI_POWER = "done";

/**
 * Balasan yang menutup rangkaian power dengan GAGAL.
 *
 * `Failed` = instrumen tidak menjawab setelah 8 percobaan (PowerOn).
 * `RTS Off` = urutan dibatalkan karena instrumen tidak menjawab (PowerOff).
 */
const NILAI_GAGAL_POWER: Record<"on" | "off", string[]> = {
  on: ["Failed"],
  off: ["RTS Off"],
};

const LABEL_NILAI_TRACKING: Record<string, string> = {
  start: "Menyiapkan pengukuran",
  target: "Mengukur target",
  homing: "Kembali ke posisi home",
  finished: "Selesai",
};

const LABEL_STATUS_TARGET: Record<string, string> = {
  search: "mencari",
  measure: "mengukur",
  done: "selesai",
  failed: "gagal",
};

/**
 * Batas diam antar-balasan untuk rangkaian POWER.
 *
 * Operasi terlama di jalur ini PowerOn ~20 detik (Bagian A dokumen protokol),
 * jadi 45 detik memberi margin lebih dari dua kali lipat. Dokumennya melarang
 * timeout sisi server yang lebih ketat dari durasi operasinya.
 */
const BATAS_DIAM_POWER_MS = 45_000;

/**
 * Batas diam antar-balasan untuk AUTOTRACKING — jauh lebih longgar.
 *
 * Satu target bisa memakan 45 detik tanpa pesan apa pun bila instrumen lambat
 * menjawab, dan dokumen protokolnya secara eksplisit melarang indikator
 * "koneksi putus" yang lebih sensitif dari 60 detik. Nilai 45 detik yang
 * dipakai sebelumnya melanggar batas itu dan akan memvonis siklus sehat
 * sebagai tidak merespons.
 */
const BATAS_DIAM_TRACKING_MS = 90_000;

type ProgresPower = {
  action: "on" | "off";
  nilai: string;
  /** Dipakai untuk membuat identitas objek berubah tiap balasan, supaya effect
   *  timeout ikut ter-reset walau isi `value`-nya kebetulan sama. */
  urutan: number;
};

type ProgresTracking = {
  nilai: string;
  current: number;
  total: number;
  status: string;
  retries?: number;
  urutan: number;
  /** true = sudah melewati BATAS_DIAM_TRACKING_MS tanpa balasan baru. */
  diam?: boolean;
};

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
  const { isConnected, lastUpdate, sensor14, sensor16, sensor5, sensor6, sensor7, idLogger } = useRtsConnectionStatus();

  // Tick setiap 60 detik → paksa re-render supaya isConnected (Date.now()) dievaluasi ulang
  // Tanpa ini, status Connected/Disconnected tidak berubah otomatis saat data berhenti masuk
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [accessCode, setAccessCode] = useState("");
  // withLogger=true supaya `nama_lokasi` ikut terbawa untuk judul pos RTS.
  const { sites: siteList, badge: siteBadge, namaPos } = useSites(false, true);
  // Nilai efektifnya diturunkan, bukan disinkronkan lewat effect: sebelum daftar
  // site termuat, `selectedSite` masih "" dan semua fetch-nya memang ditunda.
  const [sitePilihan, setSitePilihan] = useState("");
  const selectedSite = sitePilihan || siteList[0]?.slug || "";
  const setSelectedSite = setSitePilihan;
  const selectedSiteBadge = selectedSite ? siteBadge(selectedSite) : null;
  // Riwayat running site terpilih (4 sesi terakhir).
  const { logs: riwayatLogs } = useLogKontrol(selectedSite || undefined, 4);
  const [showPassword, setShowPassword] = useState(false);
  const [prismaCards, setPrismaCards] = useState<PrismaCard[]>([]);
  const [prismaLoading, setPrismaLoading] = useState(true);
  const [runningDate, setRunningDate] = useState<string>("-");
  const [isControlRunning, setIsControlRunning] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [totalPrisma, setTotalPrisma] = useState(0);

  // --- Power On/Off RTS ---
  const [powerLoading, setPowerLoading] = useState(false);
  const [powerAlert, setPowerAlert] = useState<PowerAlert | null>(null);
  const [rtsPowerState, setRtsPowerState] = useState<"on" | "off" | "unknown">("off");
  // Set Home ternyata DIBALAS firmware, walau tabel C.1 protokol menulis kolom
  // Balasannya kosong. Karena itu statusnya bisa ditunggu, bukan sekadar
  // "terkirim". `jawaban` menyimpan string mentah dari instrumen apa adanya —
  // formatnya tidak terdokumentasi, jadi ditampilkan tanpa ditafsirkan.
  const [setHomeStatus, setSetHomeStatus] = useState<"idle" | "waiting" | "done">("idle");
  const [setHomeJawaban, setSetHomeJawaban] = useState<string | null>(null);
  const [konfirmasiSetHome, setKonfirmasiSetHome] = useState(false);
  /**
   * Nama posisi home yang diisi operator, mis. `HOME-01`.
   *
   * Nilai kunci `setHome` adalah nama ini, bukan penanda aksi — jadi tanpa isian
   * ini tidak ada perintah yang layak dikirim. Batas 20 karakter dan larangan
   * `,`/`;` disamakan dengan yang divalidasi ulang di route; kembar begini
   * disengaja supaya kesalahan ketik tertangkap sebelum menyentuh instrumen,
   * sementara route tetap aman dipanggil dari luar UI ini.
   */
  const [namaHome, setNamaHome] = useState("");
  const namaHomeBersih = namaHome.trim();
  const namaHomeSah =
    namaHomeBersih.length > 0 &&
    namaHomeBersih.length <= 20 &&
    !/[,;]/.test(namaHomeBersih);

  /**
   * Batas menunggu balasan setHome.
   *
   * Durasinya tidak ada di tabel Bagian A protokol karena perintah ini memang
   * tidak tercatat punya balasan. Dipakai 30 detik — selonggar operasi yang
   * menyentuh instrumen (rotate/turning_target 20 detik) plus margin, sesuai
   * larangan dokumen soal timeout yang lebih ketat dari durasi operasinya.
   */
  useEffect(() => {
    if (setHomeStatus !== "waiting") return;
    const timer = setTimeout(() => {
      setSetHomeStatus("idle");
      setPowerAlert({
        type: "error",
        title: "Set Home",
        message: "Tidak ada balasan dalam 30 detik. Perintah mungkin terkirim tapi belum tentu tersimpan — periksa arah pulang teleskop sebelum mengandalkannya.",
      });
    }, 30_000);
    return () => clearTimeout(timer);
  }, [setHomeStatus]);
  const [progresPower, setProgresPower] = useState<ProgresPower | null>(null);
  const [progresTracking, setProgresTracking] = useState<ProgresTracking | null>(null);
  /** Penghitung monoton supaya tiap balasan menghasilkan objek state baru. */
  const urutanStage = useRef(0);

  // Timeout power: rangkaian yang berhenti di tengah dianggap gagal.
  // Dependensinya objek `progresPower` yang identitasnya berubah tiap balasan,
  // jadi timer-nya otomatis ter-reset selama balasan masih berdatangan.
  useEffect(() => {
    if (!progresPower) return;
    const timer = setTimeout(() => {
      const label = LABEL_NILAI_POWER[progresPower.action][progresPower.nilai] ?? progresPower.nilai;
      setPowerAlert({
        type: "error",
        message: `RTS berhenti merespons di tahap "${label}". Perintah ${progresPower.action.toUpperCase()} kemungkinan tidak tuntas.`,
      });
      setProgresPower(null);
    }, BATAS_DIAM_POWER_MS);
    return () => clearTimeout(timer);
  }, [progresPower]);

  // Timeout tracking: badge-nya ditandai diam, bukan dihapus — menghilangkannya
  // begitu saja justru terbaca seperti "sudah selesai".
  useEffect(() => {
    if (!progresTracking || progresTracking.diam) return;
    const timer = setTimeout(() => {
      setProgresTracking((p) => (p ? { ...p, diam: true } : p));
    }, BATAS_DIAM_TRACKING_MS);
    return () => clearTimeout(timer);
  }, [progresTracking]);

  // Sinkronkan local power state dengan actual status dari logger
  useEffect(() => {
    const isRtsOn = String(sensor16) === "1" || (String(sensor14) === "1" && isConnected);
    console.log(`[Debug Power] sensor16: ${sensor16}, sensor14: ${sensor14}, isConnected: ${isConnected} => isRtsOn: ${isRtsOn}`);
    setRtsPowerState(isRtsOn ? "on" : "off");
  }, [sensor16, sensor14, isConnected]);

  const handlePower = async (action: "on" | "off") => {
    setPowerLoading(true);
    // Progres dimulai dari sisi klien, bukan menunggu stage pertama: kalau RTS
    // tidak menjawab sama sekali, tanpa ini tidak ada apa pun yang memicu
    // timeout dan perintahnya hilang tanpa jejak di layar.
    urutanStage.current += 1;
    setProgresPower({ action, nilai: "start", urutan: urutanStage.current });
    try {
      const res = await fetch("/api/kontrol/power", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // site menentukan unit RTS mana yang dinyalakan/dimatikan
        body: JSON.stringify({ action, site: selectedSite }),
      });
      const json = await res.json();
      if (!json.success) {
        // Tampilkan pesan error asli dari server (misal: "ADR logger not found")
        const errMsg = json.error || "Gagal mengirim command ke server";
        console.error("[handlePower] API error:", errMsg);
        setPowerAlert({ type: "error", message: errMsg });
        setProgresPower(null);
      }
      // Jika berhasil dikirim, balasan dari logger akan ditangkap via MQTT listener di bawah
    } catch (err) {
      console.error("Power command error:", err);
      setPowerAlert({ type: "error", message: "Terjadi kesalahan jaringan" });
      setProgresPower(null);
    } finally {
      setPowerLoading(false);
    }
  };


  /**
   * Simpan orientasi teleskop saat ini sebagai posisi home, di bawah nama yang
   * diisi operator.
   *
   * Balasan datang lewat MQTT sebagai {"setHome":{"setHome":"NAMA,…;"}}, jadi
   * statusnya benar-benar bisa ditunggu — bukan sekadar "terkirim". Yang dikirim
   * ke server adalah nama yang sudah di-trim, sama dengan yang dipakai untuk
   * menilai `namaHomeSah`, supaya tombol dan permintaan tidak menilai dua hal
   * yang berbeda.
   */
  const handleSetHome = async () => {
    if (!namaHomeSah) return;
    setKonfirmasiSetHome(false);
    setSetHomeJawaban(null);
    setSetHomeStatus("waiting");
    try {
      const res = await fetch("/api/kontrol/set-home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: selectedSite, namaHome: namaHomeBersih }),
      });
      const json = await res.json();
      if (!json.success) {
        setSetHomeStatus("idle");
        setPowerAlert({ type: "error", title: "Set Home", message: json.error || "Gagal mengirim perintah" });
      }
      // Sukses TIDAK diumumkan di sini: yang selesai baru pengiriman ke broker.
      // Konfirmasinya datang lewat MQTT sebagai {"setHome":{"setHome":"…"}}.
    } catch (err) {
      console.error("[handleSetHome]", err);
      setSetHomeStatus("idle");
      setPowerAlert({ type: "error", title: "Set Home", message: "Terjadi kesalahan jaringan" });
    }
  };

  // --- Data-driven Proses Log ---
  // Hitung progress berdasarkan status prisma card yang diterima dari logger
  const successCount = prismaCards.filter(c => c.status === "Success").length;
  const failedCount = prismaCards.filter(c => c.status === "Failed").length;
  const runningCount = prismaCards.filter(c => c.status === "Running...").length;
  const respondedCount = successCount + failedCount; // prisma yang sudah dijawab logger
  const hasAnyResponse = respondedCount > 0;

  // Sinkronkan isControlRunning dengan sensor16 dari hardware
  // → dipindahkan ke bawah setelah deklarasi fetchPrisma

  // --- MQTT WebSocket subscription (seperti Paho.js di PHP) ---
  const mqttRef = useRef<mqtt.MqttClient | null>(null);
  useEffect(() => {
    const broker = process.env.NEXT_PUBLIC_MQTT_HOST || "mqtt.beacontelemetry.com";
    const wsPort = process.env.NEXT_PUBLIC_MQTT_WS_PORT || "8083";
    const wsUrl = `wss://${broker}:${wsPort}/mqtt`;

    const client = mqtt.connect(wsUrl, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "userlog",
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: false,
      connectTimeout: 10000,
    });
    mqttRef.current = client;

    client.on("connect", () => {
      console.log("[KontrolADR] MQTT connected");
      // Subscribe ke 3 topic
      const targetTopic = `Logger_${idLogger || "30002"}`;
      const adrTopic = "ADR_Tambang_Kaltara"; // hardcode langsung untuk test
      console.log("[KontrolADR] Subscribing to:", targetTopic, "kontrol-asaba", adrTopic);
      client.subscribe(targetTopic, { qos: 0 }, (err) => {
        if (err) console.error("[KontrolADR] Subscribe FAIL:", targetTopic, err);
        else console.log("[KontrolADR] Subscribe OK:", targetTopic);
      });
      client.subscribe("kontrol-asaba", { qos: 0 }, (err) => {
        if (err) console.error("[KontrolADR] Subscribe FAIL: kontrol-asaba", err);
        else console.log("[KontrolADR] Subscribe OK: kontrol-asaba");
      });
      client.subscribe(adrTopic, { qos: 0 }, (err) => {
        if (err) console.error("[KontrolADR] Subscribe FAIL:", adrTopic, err);
        else console.log("[KontrolADR] Subscribe OK:", adrTopic);
      });
    });

    client.on("message", (topic: string, message: Buffer) => {
      console.log("[KontrolADR] RAW msg on:", topic, message.toString().substring(0, 200));
      try {
        const data = JSON.parse(message.toString());
        console.log("[KontrolADR] MSG on topic:", topic, data);

        if (topic === "kontrol-asaba") {
          // Status kontrol: {status: "1", datetime: "..."} → Running
          //                  {status: "0"} → Selesai
          //
          // Pesan tanpa `status` diabaikan, bukan dianggap "selesai". Kode lama
          // memakai else polos, sehingga bentuk pesan apa pun yang tidak dikenal
          // di topic ini menghentikan running dan memicu refetch. Stage firmware
          // dipastikan TIDAK dikirim ke sini (hanya ke ADR_Tambang_Kaltara),
          // jadi ini pengaman, bukan penambal masalah yang sedang terjadi.
          if (data.status === undefined) {
            console.log("[KontrolADR] kontrol-asaba: pesan tanpa status, diabaikan", data);
          } else if (data.status === "1" || data.status === 1) {
            console.log("[KontrolADR] kontrol-asaba: Running", data.datetime);
            setIsControlRunning(true);
            if (data.datetime) setRunningDate(data.datetime);
            // Set semua prisma ke Running
            setPrismaCards(prev => prev.map(c => ({ ...c, status: "Running..." as const, y: "-", x: "-", z: "-" })));
          } else {
            console.log("[KontrolADR] kontrol-asaba: Done");
            setIsControlRunning(false);
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            // Refresh data final
            fetchPrisma();
          }
        } else if (topic.startsWith("Logger_")) {
          // Data prisma individual: {id_prisma: "P1", N1: "...", E1: "...", Z1: "...", ...}
          if (data.id_prisma) {
            console.log(`[KontrolADR] ${topic}:`, data.id_prisma, data.N1, data.E1, data.Z1);
            const isFailed = Number(data.N1) === 0 && Number(data.E1) === 0 && Number(data.Z1) === 0;
            setPrismaCards(prev => prev.map(c =>
              c.name === data.id_prisma
                ? {
                    ...c,
                    status: isFailed ? "Failed" as const : "Success" as const,
                    y: String(data.N1) || "0",
                    x: String(data.E1) || "0",
                    z: String(data.Z1) || "0",
                  }
                : c
            ));
          }
        } else {
          // ADR_Tambang_Kaltara topic
          // ── Balasan RTS ──────────────────────────────────────────────────
          //
          // Semuanya datang HANYA lewat topic ADR_Tambang_Kaltara — bukan lewat
          // kontrol-asaba maupun Logger_*. Cabang else ini memang cabang topic
          // itu, jadi tidak perlu pemeriksaan topic tambahan.
          //
          // {"PowerOn":{"value":"start"|"ping"|"Success"|"config"|"done"|"Failed"}}
          // {"PowerOff":{"value":"start"|"check"|"home"|"off"|"Success"|"done"|"RTS Off"}}
          for (const action of ["on", "off"] as const) {
            const paket = action === "on" ? data.PowerOn : data.PowerOff;
            if (!paket) continue;

            const nilai = nilaiRts(paket);
            const lama = nilaiRtsLama(paket);
            if (nilai === null && lama === null) continue;

            const nama = action === "on" ? "PowerOn" : "PowerOff";
            urutanStage.current += 1;

            // Jalur protokol LAMA (`nilai`). Dipisah karena string yang sama
            // berarti hal berbeda: di sana "Success" penutup sukses, di sini
            // cuma kemajuan.
            if (nilai === null && lama !== null) {
              const gagal = lama.toLowerCase().includes("failed") || lama.toLowerCase().includes("tidak terhubung");
              console.log(`[KontrolADR] ${nama} (protokol lama):`, lama, "gagal:", gagal);
              setProgresPower(null);
              if (gagal) {
                setPowerAlert({ type: "error", message: lama });
              } else {
                setRtsPowerState(action);
                setPowerAlert({ type: action, message: lama });
              }
              continue;
            }

            console.log(`[KontrolADR] ${nama} value:`, nilai);
            switch (klasifikasiPower(action, nilai as string)) {
              case "selesai":
                // "done", BUKAN "Success" dan bukan "config" — dua-duanya masih
                // tahap kemajuan di protokol sekarang.
                setRtsPowerState(action);
                setPowerAlert({
                  type: action,
                  message: action === "on" ? "RTS menyala dan siap dipakai" : "RTS sudah benar-benar mati",
                });
                setProgresPower(null);
                break;
              case "gagal":
                setPowerAlert({
                  type: "error",
                  message:
                    nilai === "RTS Off"
                      ? "Perintah OFF ditolak: RTS tidak menjawab, urutan dibatalkan."
                      : "RTS tidak menjawab setelah 8 percobaan. Periksa daya dan kabel instrumen.",
                });
                setProgresPower(null);
                break;
              default:
                setProgresPower({ action, nilai: nilai as string, urutan: urutanStage.current });
            }
          }

          // {"AutoTracking":{"value":"start","total":50,"retries":1}}
          // {"AutoTracking":{"value":"target","current":N,"total":50,"status":…}}
          // {"AutoTracking":{"value":"homing"}} → {"AutoTracking":{"value":"finished"}}
          // {"AutoTracking":{"value":"RTS Off"}} → DITOLAK, instrumen mati
          //
          // Perintahnya bernama AutoTrackingStart tapi SEMUA balasannya bernama
          // AutoTracking — satu-satunya perintah yang nama balasannya berbeda.
          //
          // Status per target TIDAK dipakai untuk mewarnai kartu prisma: nilai
          // aslinya sudah datang lewat topic Logger_* yang menyebut `id_prisma`
          // secara eksplisit. `current` di sini nomor urut target, dan
          // menyamakannya dengan slot berarti menebak — kalau tebakannya meleset,
          // kartu yang salah yang ditandai gagal.
          const nilaiTracking = nilaiRts(data.AutoTracking);
          if (nilaiTracking !== null) {
            const nilai = nilaiTracking;
            const kelas = klasifikasiTracking(nilai);
            urutanStage.current += 1;
            console.log("[KontrolADR] AutoTracking value:", nilai, kelas, data.AutoTracking);

            if (kelas === "selesai") {
              // Perhatikan tingkatnya: "finished" = SELURUH siklus selesai.
              // Jangan tertukar dengan {"value":"target","status":"done"} yang
              // cuma berarti satu target selesai.
              setProgresTracking(null);
              setIsControlRunning(false);
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              fetchPrisma();
            } else if (kelas === "gagal") {
              // Gerbang firmware menolak dalam ~5 detik dan TIDAK membangunkan
              // instrumen yang mati. Operator harus PowerOn dulu, lalu menunggu
              // "done" — bukan "Success" — sebelum menjalankan tracking lagi.
              setProgresTracking(null);
              setIsControlRunning(false);
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              setPowerAlert({
                type: "error",
                message: "AutoTracking ditolak: RTS masih mati. Nyalakan lewat tombol ON dan tunggu sampai siap, baru jalankan lagi.",
              });
            } else {
              if (nilai === "start") setIsControlRunning(true);
              setProgresTracking((prev) => ({
                nilai,
                // `total` hanya ikut di start/target; jangan sampai "homing"
                // yang tidak membawanya mengosongkan angka yang sudah ada.
                total: Number(data.AutoTracking.total ?? prev?.total ?? 0),
                current: Number(data.AutoTracking.current ?? prev?.current ?? 0),
                status: String(data.AutoTracking.status ?? ""),
                retries: data.AutoTracking.retries ?? prev?.retries,
                urutan: urutanStage.current,
              }));
            }
          }

          // {"setHome":{"setHome":",0,061,41,90,199,18,72;"}}
          //
          // Kunci dalamnya MENGULANG nama perintahnya, bukan `value` — bentuk
          // yang menyalahi aturan dasar #2 protokol dan tidak terdaftar di
          // Bagian E. Tabel C.1 bahkan menulis perintah ini tidak punya
          // balasan; kenyataannya ada.
          //
          // Isinya string mentah dari instrumen dan formatnya tidak
          // terdokumentasi, jadi ditampilkan apa adanya — sama seperti anjuran
          // dokumen untuk medan `raw` di Bagian E.5. Menebak artinya lebih
          // berbahaya daripada tidak menerjemahkannya: ini titik acuan pulang
          // teleskop, dan tafsir yang salah tidak akan terkoreksi sendiri.
          const jawabanSetHome = nilaiRts(data.setHome, "setHome");
          if (jawabanSetHome !== null) {
            console.log("[KontrolADR] setHome:", jawabanSetHome);
            setSetHomeStatus("done");
            setSetHomeJawaban(jawabanSetHome);
            setPowerAlert({
              type: "on",
              title: "Set Home tersimpan",
              message: `RTS membalas: ${jawabanSetHome}`,
            });
          }

          // ── Fallback firmware lama ───────────────────────────────────────
          // {"AutoTrack":{"nilai":"done"}} sudah DIHAPUS dari protokol dan
          // digantikan {"AutoTracking":{"value":"finished"}}. Tetap dibaca
          // selama masih ada unit yang belum di-flash.
          if (data.AutoTrack && data.AutoTrack.nilai === "done") {
            console.log("[KontrolADR] AutoTrack done (protokol lama)");
            setProgresTracking(null);
            setIsControlRunning(false);
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            fetchPrisma();
          }
        }
      } catch {
        // Ignore non-JSON
      }
    });

    client.on("error", (err: Error) => {
      console.error("[KontrolADR] MQTT error:", err);
    });

    return () => {
      if (client) client.end(true);
      mqttRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showRtsConfig, setShowRtsConfig] = useState(false);
  // (state configId dihapus: PUT /api/config-adr sekarang dikunci berdasarkan
  //  `site`, bukan id baris, jadi id-nya tidak perlu disimpan di klien.)
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
      const res = await fetch(`/api/config-adr?site=${encodeURIComponent(selectedSite)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
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
          site:        selectedSite,
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

  // Daftar prisma DIBATASI per site. Nomor slot (P1, P2, …) dipakai ulang di
  // tiap site dan menunjuk target fisik yang berbeda, jadi tanpa scope ini
  // panel menampilkan prisma milik site lain.
  const fetchPrisma = useCallback(async () => {
    if (!selectedSite) {
      setPrismaCards([]);
      setTotalPrisma(0);
      // Wajib dimatikan juga di jalur ini — kalau tidak, skeleton loading
      // tidak pernah selesai dan panel terlihat menggantung selamanya.
      setPrismaLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/prisma-data?site=${encodeURIComponent(selectedSite)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const dbCards: PrismaCard[] = (json.data as TempPrisma[]).map((row) => ({
          name: row.id_prisma,
          // sensor16 = 1 berarti RTS sedang menjalankan sesi. Dipakai langsung
          // (bukan state isControlRunning) supaya nilainya selalu sinkron dengan
          // hardware, termasuk saat halaman baru dimuat ulang.
          status: mapStatus(
            row.status_get,
            row.N1,
            row.E1,
            row.Z1,
            String(sensor16) === "1",
            row.waktu
          ),
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
  }, [selectedSite, sensor16]);

  // Sinkronkan isControlRunning dengan sensor16 dari hardware (PENTING untuk saat page di-refresh)
  // sensor16 === "1" → animasi jalan + semua cards jadi Running
  // sensor16 === "0" → fetch prisma dulu (data final), baru stop animasi
  useEffect(() => {
    if (String(sensor16) === "1") {
      // RTS sedang jalan → start animasi + reset semua cards ke "Running..."
      setIsControlRunning(true);
      setPrismaCards(prev => prev.map(c => ({ ...c, status: "Running..." as const, y: "-", x: "-", z: "-" })));
    } else if (String(sensor16) === "0") {
      // RTS selesai → fetch data final dulu, baru berhentikan animasi
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      fetchPrisma().then(() => {
        setIsControlRunning(false);
      });
    }
  }, [sensor16, fetchPrisma]);

  // Fetch ulang tiap kali site berganti — konfigurasi RTS (job name, prism
  // constant, titik origin) berbeda per site.
  useEffect(() => {
    fetchPrisma();

    if (!selectedSite) return;
    fetch(`/api/config-adr?site=${encodeURIComponent(selectedSite)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
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
  }, [fetchPrisma, selectedSite]);

  // Cleanup polling saat unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleMulaiKontrol = async () => {
    if (!accessCode.trim()) return;
    if (!selectedSite) { setAccessCodeError("Pilih site pengukuran lebih dulu."); return; }

    // Reset error
    setAccessCodeError("");

    // Stop polling lama jika ada
    if (pollingRef.current) clearInterval(pollingRef.current);

    setIsControlRunning(true);

    try {
      const res = await fetch("/api/kontrol/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: accessCode, site: selectedSite }),
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

      // Kode benar — set semua prisma card ke "Running..." (seperti PHP)
      setPrismaCards(prev => prev.map(c => ({ ...c, status: "Running..." as const, y: "-", x: "-", z: "-" })));
      // Data akan masuk real-time via MQTT rts-30002, jadi tidak perlu polling
    } catch (err) {
      setAccessCodeError("Terjadi kesalahan jaringan. Coba lagi.");
      setIsControlRunning(false);
    }
  };

  return (
    <main className="min-h-screen">
      {/* Power Alert Toast */}
      {powerAlert && (
        <PowerAlertToast alert={powerAlert} onClose={() => setPowerAlert(null)} />
      )}
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
                <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">{namaPos(selectedSite)}</h2>
                <RtsConnectionBadge />
              </div>
            </div>
            {/* Right Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Power On/Off — warna mengikuti state yang disinkronkan dengan status RTS aktual */}
              <div className="flex items-center bg-white border border-[#EAEAEA] rounded-md h-[40px] overflow-hidden shadow-sm">
                <button
                  onClick={() => handlePower("on")}
                  disabled={powerLoading}
                  className={cn(
                    "flex items-center gap-1.5 px-4 h-full text-[12.5px] font-semibold transition-colors cursor-pointer border-r border-[#EAEAEA]",
                    rtsPowerState === "on"
                      ? "bg-[#E5F7E7] text-[#06C022]"
                      : "text-gray-500 hover:bg-green-50 hover:text-green-600"
                  )}
                >
                  <Power className="w-[15px] h-[15px]" />
                  ON
                </button>
                <button
                  onClick={() => handlePower("off")}
                  disabled={powerLoading}
                  className={cn(
                    "flex items-center gap-1.5 px-4 h-full text-[12.5px] font-semibold transition-colors cursor-pointer",
                    rtsPowerState === "off"
                      ? "bg-red-50 text-red-500"
                      : "text-gray-500 hover:bg-red-50 hover:text-red-500"
                  )}
                >
                  <Power className="w-[15px] h-[15px]" />
                  OFF
                </button>
              </div>

              {/* Progres bertahap power. Muncul sejak perintah dikirim dan
                  hilang begitu stage terakhir masuk atau timeout tercapai. */}
              {progresPower && (
                <div
                  className="flex items-center gap-2 h-[40px] px-3.5 rounded-md border border-[#EAEAEA] bg-white shadow-sm"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="w-[15px] h-[15px] animate-spin text-[#303481]" />
                  <span className="text-[12.5px] font-semibold text-gray-600">
                    {progresPower.action === "on" ? "Menyalakan" : "Mematikan"}:{" "}
                    {LABEL_NILAI_POWER[progresPower.action][progresPower.nilai] ?? progresPower.nilai}
                  </span>
                </div>
              )}

              {/* Set Home — menimpa posisi home tersimpan dengan arah teleskop
                  saat ini. Sengaja TIDAK ditempel ke grup ON/OFF: bentuknya
                  mirip perintah daya padahal akibatnya jauh berbeda, dan salah
                  pencet baru ketahuan saat teleskop pulang ke arah yang keliru. */}
              <Button
                variant="outline"
                onClick={() => {
                  // Kotak nama dikosongkan tiap modal dibuka. Nama home menimpa
                  // titik acuan pulang teleskop, jadi membiarkan isian lama
                  // tertinggal di sana mengundang penyimpanan atas nama yang
                  // sebetulnya sisa percobaan sebelumnya.
                  setNamaHome("");
                  setKonfirmasiSetHome(true);
                }}
                disabled={setHomeStatus === "waiting" || !selectedSite || !isConnected}
                title={
                  !selectedSite
                    ? "Pilih site dulu"
                    : !isConnected
                      ? "RTS tidak terhubung"
                      : setHomeJawaban
                        ? `Balasan terakhir: ${setHomeJawaban}`
                        : "Simpan arah teleskop saat ini sebagai posisi home"
                }
                className="flex items-center gap-2 px-5 rounded-md h-[40px] text-[13.5px] font-medium text-[#E86A1F] border-[#E86A1F] hover:bg-[#E86A1F]/5 bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setHomeStatus === "waiting"
                  ? <Loader2 className="w-[17px] h-[17px] animate-spin" />
                  : <Home className="w-[17px] h-[17px]" />}
                {setHomeStatus === "waiting" ? "Menunggu RTS…" : "Set Home"}
              </Button>

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
                {/* Selektor site SENGAJA tidak ikut dinonaktifkan saat logger
                    terputus. Memilih site adalah tindakan melihat data (riwayat,
                    daftar prisma, konfigurasi RTS) yang tetap berguna meski
                    perangkat offline — yang butuh koneksi hanya tombol Mulai
                    Kontrol di bawah. */}
                <label className="block text-[12.5px] font-bold mb-2 text-gray-900">Site Pengukuran</label>
                <select
                  value={selectedSite}
                  onChange={(e) => { setSelectedSite(e.target.value); setAccessCodeError(""); }}
                  className="mb-3 h-[38px] w-full cursor-pointer rounded-md border border-gray-300 px-3 text-[13px] font-medium outline-none transition-colors focus:border-[#303481]"
                >
                  {siteList.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.nama}
                      {!s.terkalibrasi ? " (belum dikalibrasi)" : s.data_dummy ? " (data contoh)" : ""}
                    </option>
                  ))}
                </select>
                {selectedSiteBadge?.peringatan && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-900">
                    <AlertTriangle className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                    <span>
                      {selectedSiteBadge.peringatan}. Hasil pengukuran di site ini
                      belum bisa dipakai mengambil keputusan.
                    </span>
                  </div>
                )}

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
                    disabled={!accessCode.trim() || !selectedSite || isControlRunning || !isConnected}
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

                      {/* Progres AutoTracking langsung dari firmware. Dibedakan
                          dari "Proses Log" di bawahnya yang disimpulkan dari
                          kartu prisma — yang ini angka yang dilaporkan alatnya
                          sendiri, termasuk target yang belum sempat menjawab. */}
                      {progresTracking && (
                        <div
                          className={cn(
                            "mb-2 rounded-md border px-3 py-2",
                            progresTracking.diam
                              ? "border-amber-300 bg-amber-50"
                              : "border-[#EAEAEA] bg-[#F8F9FB]"
                          )}
                          role="status"
                          aria-live="polite"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "text-[11px] font-bold",
                              progresTracking.diam ? "text-amber-800" : "text-[#303481]"
                            )}>
                              {progresTracking.diam
                                ? "AutoTracking tidak merespons"
                                : LABEL_NILAI_TRACKING[progresTracking.nilai] ?? progresTracking.nilai}
                            </span>
                            {progresTracking.nilai === "target" && progresTracking.total > 0 && (
                              <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                                {progresTracking.current} / {progresTracking.total}
                              </span>
                            )}
                          </div>

                          {progresTracking.nilai === "target" && progresTracking.status && (
                            <p className="mt-0.5 text-[10.5px] text-gray-500">
                              Target {progresTracking.current}:{" "}
                              {LABEL_STATUS_TARGET[progresTracking.status] ?? progresTracking.status}
                              {progresTracking.retries ? ` · ${progresTracking.retries}× percobaan` : ""}
                            </p>
                          )}

                          {progresTracking.diam && (
                            <p className="mt-0.5 text-[10.5px] text-amber-700">
                              Tidak ada kabar baru selama {BATAS_DIAM_TRACKING_MS / 1000} detik terakhir.
                            </p>
                          )}

                          {progresTracking.total > 0 && !progresTracking.diam && (
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full bg-[#303481] transition-[width] duration-300"
                                style={{
                                  width: `${Math.min(100, Math.round((progresTracking.current / progresTracking.total) * 100))}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] font-medium text-gray-700 leading-snug flex flex-col gap-1">
                        {(() => {
                          // Fase:
                          // 1. Directing to Target: semua prisma masih Running, belum ada response
                          // 2. Search Target: transisi, data pertama mulai masuk
                          // 3. Measuring Target: beberapa prisma sudah response, beberapa masih Running
                          // 4. Recording Data: semua prisma selesai (tidak ada Running lagi)
                          const wasRunning = isControlRunning || respondedCount > 0;
                          const measuring = runningCount > 0 && respondedCount > 0;
                          const allResponded = respondedCount === totalPrisma && totalPrisma > 0;
                          const finished = allResponded && runningCount === 0;

                          const step1Active = isControlRunning && runningCount > 0 && !hasAnyResponse;
                          const step1Done = wasRunning && (hasAnyResponse || finished);

                          const step2Active = isControlRunning && runningCount > 0 && !hasAnyResponse;
                          const step2Done = hasAnyResponse;

                          const step3Active = isControlRunning && measuring;
                          const step3Done = allResponded;

                          const step4Active = false;
                          const step4Done = finished;
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
                                {log.showProgress && (isControlRunning || measuring) && totalPrisma > 0
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
                {!selectedSite ? (
                  <p className="px-4 py-8 text-center text-[12.5px] text-gray-400">
                    Pilih site untuk melihat riwayat.
                  </p>
                ) : riwayatLogs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12.5px] text-gray-400">
                    Belum ada riwayat running untuk site ini.
                  </p>
                ) : (
                  riwayatLogs.map((item: { id_log: string; datetime?: string | null; prisma_count?: number }) => {
                    const d = item.datetime ? new Date(item.datetime) : null;
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const tanggal = d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : "-";
                    const jam = d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : "-";
                    return (
                      <div key={item.id_log} className="p-4 py-3.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 mb-1.5">
                          <p className="text-[13px] text-gray-800 font-medium">Running Date: {tanggal}</p>
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Clock className="w-[13px] h-[13px]" />
                            <span className="text-[12px] font-medium">{jam}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[13px] text-gray-700 font-medium tracking-tight">Prisma Count:</p>
                          <span className="px-2 py-[3px] bg-[#EBF0FF] text-[#303481] rounded-[4px] text-[11px] font-bold leading-none">
                            {item.prisma_count ?? 0}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="p-3.5 border-t border-gray-100 flex justify-end">
                  <a
                    href={`/hasil-pengukuran${selectedSite ? `?site=${encodeURIComponent(selectedSite)}` : ""}`}
                    className="text-[12.5px] font-bold text-[#303481] hover:text-[#1f2259] flex items-center gap-1.5 transition-colors hover:underline cursor-pointer"
                  >
                    Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
                  </a>
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
                ) : !selectedSite ? (
                  <div className="col-span-4 py-12 text-center text-gray-400 text-[13px]">
                    Pilih site pengukuran untuk melihat daftar prisma.
                  </div>
                ) : prismaCards.length === 0 ? (
                  <div className="col-span-4 py-12 text-center text-gray-400 text-[13px]">
                    Tidak ada data prisma untuk site ini.
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
                        {/* Keadaan diam — tanpa spinner, supaya tidak terbaca
                            seolah ada proses yang sedang berjalan. */}
                        {prisma.status === "Menunggu" && (
                          <span className="px-2.5 py-[3px] bg-[#FFF4E5] text-[#B26A00] text-[10px] font-bold rounded-full leading-none">Menunggu</span>
                        )}
                        {prisma.status === "Belum diukur" && (
                          <span className="px-2.5 py-[3px] bg-[#F0F1F5] text-[#6B7280] text-[10px] font-bold rounded-full leading-none">Belum diukur</span>
                        )}
                      </div>
                      {/* Card Body */}
                      <div className="flex flex-col pb-1">
                        <div className="grid grid-cols-[1fr_2fr] border-b border-gray-100 px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">Y</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : nilaiPrisma(prisma.status, prisma.y)}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr] border-b border-gray-100 px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">X</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : nilaiPrisma(prisma.status, prisma.x)}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr] px-2 py-2.5">
                          <div className="text-[13.5px] text-gray-500 font-bold text-center">Z</div>
                          <div className="text-[13.5px] text-gray-900 text-center font-medium">
                            {prisma.status === "Running..." ? <Loader2 className="w-[14px] h-[14px] animate-spin mx-auto text-gray-400" /> : nilaiPrisma(prisma.status, prisma.z)}
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

      {/* Konfirmasi Set Home.
          Wajib ada: perintah ini menimpa titik acuan yang dipakai PowerOff dan
          akhir siklus AutoTracking untuk memulangkan teleskop. Menyetelnya saat
          teleskop sedang membidik target membuat semua homing berikutnya
          mengarah ke tempat yang salah — dan karena firmware tidak membalas,
          kekeliruannya baru ketahuan jauh kemudian. */}
      {konfirmasiSetHome && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setKonfirmasiSetHome(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="font-bold text-gray-900 text-[16px]">Set Home</h3>
              <button
                onClick={() => setKonfirmasiSetHome(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-4 flex flex-col gap-3.5">
              <p className="text-[13px] leading-relaxed text-gray-600">
                Arah teleskop <strong>saat ini</strong> akan disimpan sebagai posisi
                home untuk <strong>{namaPos(selectedSite)}</strong> dengan nama di
                bawah, menimpa posisi home yang lama.
              </p>

              {/* Nama home. Kunci `setHome` mengirim NAMA ini, bukan penanda
                  aksi, jadi kotak ini bukan pelengkap — tanpa isian tidak ada
                  perintah yang layak dikirim. Enter ikut mengirim supaya alur
                  ketik-lalu-simpan tidak memaksa pindah ke mouse. */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nama-home" className="text-[12px] font-semibold text-gray-700">
                  Nama posisi home
                </label>
                <input
                  id="nama-home"
                  type="text"
                  value={namaHome}
                  onChange={(e) => setNamaHome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && namaHomeSah) handleSetHome();
                  }}
                  maxLength={20}
                  autoFocus
                  placeholder="mis. HOME-01"
                  className="h-[38px] rounded-lg border border-gray-300 px-3 font-mono text-[13px] text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-[#E86A1F] focus:outline-none"
                />
                {/* Peringatan hanya muncul setelah ada yang diketik: kotak yang
                    masih kosong saat modal baru terbuka bukan kesalahan operator. */}
                {namaHomeBersih.length > 0 && /[,;]/.test(namaHomeBersih) && (
                  <p className="text-[11.5px] leading-relaxed text-red-600">
                    Koma dan titik koma tidak boleh dipakai — keduanya pemisah medan
                    di balasan RTS, jadi nama yang memuatnya membuat balasannya tidak
                    bisa dibaca.
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
                <AlertTriangle className="mt-[1px] h-4 w-4 flex-shrink-0" />
                <span>
                  Pastikan teleskop sedang menghadap posisi home yang benar, bukan
                  sedang membidik target. Titik ini dipakai saat mematikan RTS dan
                  di akhir setiap siklus AutoTracking.
                </span>
              </div>

              <p className="text-[12px] leading-relaxed text-gray-500">
                RTS akan membalas dengan nama itu diikuti sederet angka mentah,
                mis. <span className="font-mono">HOME,0,151,42,06,206,04,54;</span>
                {" "}— ditampilkan apa adanya karena formatnya tidak
                terdokumentasi. Kehadirannya menandakan perintah diterima, bukan
                bahwa arahnya sudah benar.
              </p>

              {setHomeJawaban && (
                <div className="rounded-lg bg-gray-50 px-3.5 py-2.5">
                  <p className="text-[11px] font-semibold text-gray-500">Balasan terakhir</p>
                  <p className="mt-0.5 break-all font-mono text-[12px] text-gray-800">
                    {setHomeJawaban}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4">
              <button
                onClick={() => setKonfirmasiSetHome(false)}
                className="h-[38px] px-5 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSetHome}
                disabled={!namaHomeSah}
                className="h-[38px] px-7 rounded-lg text-[13px] font-semibold text-white bg-[#E86A1F] hover:bg-[#c55a18] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Simpan sebagai Home
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
