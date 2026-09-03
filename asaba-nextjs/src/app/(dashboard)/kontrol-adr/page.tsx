"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Crosshair,
  Eye,
  EyeOff,
  FileText,
  Home,
  Loader2,
  Move,
  Power,
  RefreshCcw,
  Ruler,
  Settings2,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useRtsConnectionStatus, useLogKontrol } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { Chip, Eyebrow, Panel, PanelHeader } from "@/components/monitoring/panel";
import {
  INPUT,
  LABEL,
  ModalShell,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import { fmtDate as fmtWaktu, fmtJam, fmtTanggal } from "@/components/monitoring/format";
import { AttitudeDial } from "@/components/kontrol-adr/attitude-dial";
import { PrismaGrid } from "@/components/kontrol-adr/prisma-grid";
import { ProcessSteps, type LangkahProses } from "@/components/kontrol-adr/process-steps";
import { mapStatus, type PrismaCard, type TempPrisma } from "@/components/kontrol-adr/prisma";
import {
  nilaiRts,
  nilaiRtsLama,
  klasifikasiPower,
  klasifikasiTracking,
  bacaKonfirmasiConfig,
  bacaBalasanSetHome,
  RENTANG_CYCLE_TIME_MS,
  RENTANG_RETRIES,
  validasiCycleTime,
  validasiRetries,
  bacaBalasanJog,
  bacaManualHaVa,
  SEBAB_TOLAK_JOG,
  LANGKAH_JOG,
  bacaBalasanUkur,
  JENIS_UKUR,
  bacaDiagnostik,
  NAMA_DIAGNOSTIK,
  OPERASI_DIAGNOSTIK,
  ARTI_ALASAN_DIAGNOSTIK,
  type Diagnostik,
  type NamaDiagnostik,
  type BalasanJog,
  type BacaanHaVa,
  type BalasanUkur,
  type KodeUkur,
} from "@/lib/protokol-rts";

// ── Pemberitahuan perintah ────────────────────────────────────────────────────
type PowerAlert = {
  type: "on" | "off" | "error";
  message: string;
  /** Menimpa judul bawaan. Tanpa ini setiap toast berjudul "RTS Power",
   *  yang keliru untuk pesan di luar urusan daya (mis. Set Home). */
  title?: string;
};

/**
 * Toast hasil perintah, menutup sendiri setelah beberapa detik.
 *
 * Pesan galat SENGAJA bertahan lebih lama daripada pesan berhasil: yang
 * berhasil cuma perlu dikonfirmasi sekilas, sedangkan yang gagal biasanya perlu
 * dibaca sampai habis untuk tahu tahap mana yang berhenti.
 */
function PowerAlertToast({ alert, onClose }: { alert: PowerAlert; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, alert.type === "error" ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [alert, onClose]);

  const galat = alert.type === "error";
  const judul = alert.title ?? (galat ? "Perintah gagal" : "RTS Power");

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="tema-monitoring fixed top-20 right-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-[12px] bg-white p-3.5 shadow-xl ring-1 ring-(--line)"
      style={{ animation: "rise-in 0.35s cubic-bezier(0.2,0.8,0.2,1) both" }}
    >
      <div className="flex items-start gap-2.5">
        {galat ? (
          <XCircle className="mt-px size-4 shrink-0 text-(--st-awas)" />
        ) : (
          <CheckCircle2 className="mt-px size-4 shrink-0 text-(--st-normal)" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-(--ink)">{judul}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-(--ink-2)">{alert.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-(--ink-3) outline-none hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Animasi sprite RTS ────────────────────────────────────────────────────────
const TOTAL_FRAMES = 65; // frames 1.png → 65.png
const FRAME_MS = 60; // ms per frame (~16 fps)

/**
 * Foto instrumen: bagian atas berputar bolak-balik saat sesi berjalan.
 *
 * Dasar yang diam dan bagian yang berputar adalah dua gambar bertumpuk —
 * frame-nya dipotong 18,5% di bawah supaya tribrach tidak ikut bergoyang.
 * Berkasnya berlatar putih pekat (bukan transparan), jadi di atas kertas ia
 * menyatu tanpa perlakuan khusus.
 */
function RTSAnimation({ isRunning }: { isRunning: boolean }) {
  const [frame, setFrame] = useState(1);
  const arah = useRef<1 | -1>(1);
  const mulaiUlang = useRef(false);

  useEffect(() => {
    if (!isRunning) return;
    arah.current = 1;
    mulaiUlang.current = true;
    const cache = Array.from({ length: TOTAL_FRAMES }, (_, i) => {
      const im = new window.Image();
      im.src = `/rts-frames/${i + 1}.png`;
      return im;
    });
    const id = setInterval(() => {
      setFrame((prev) => {
        if (mulaiUlang.current) {
          mulaiUlang.current = false;
          return 1;
        }
        let next = prev + arah.current;
        if (next >= TOTAL_FRAMES) {
          arah.current = -1;
          next = TOTAL_FRAMES;
        } else if (next <= 1) {
          arah.current = 1;
          next = 1;
        }
        return next;
      });
    }, FRAME_MS);
    return () => {
      clearInterval(id);
      cache.length = 0;
    };
  }, [isRunning]);

  const frameTampil = isRunning ? frame : 1;

  return (
    <div aria-hidden="true" className="relative size-[104px] shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rts-frames/1.png"
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {isRunning && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/rts-frames/${frameTampil}.png`}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain"
          style={{ clipPath: "inset(0 0 18.5% 0)" }}
        />
      )}
    </div>
  );
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

// ── Konfirmasi RTS Config dari logger ────────────────────────────────────────
//
// Balasan setelan berbeda bentuk dari semua balasan lain: DATAR di tingkat atas,
// tidak dibungkus nama perintah seperti {"PowerOn":{…}}.
//
//   {"updated":["jobName","prismConst","tsHigh","locCoor","stepRecord",
//               "retries","cycleTime"],
//    "set_rts":"OK",
//    "jobName":"Demo Tambang MIP","prismConst":"30","tsHigh":"10",
//    "locCoor":["401320.988","525952","62.559"]}
//
// Perhatikan: `updated` menyebut TUJUH medan, tapi yang di-echo balik hanya
// EMPAT. Jadi untuk stepRecord, retries, dan cycleTime satu-satunya bukti hanya
// namanya muncul di `updated` — nilainya tidak bisa dicocokkan. Itu penting
// karena protokol menyebut retries dan cycleTime di luar rentang TERSIMPAN
// tanpa penolakan lalu diam-diam diganti bawaan saat alat menyala berikutnya.
const LABEL_MEDAN_CONFIG: Record<string, string> = {
  jobName: "Job Name",
  prismConst: "Prism Constant",
  tsHigh: "TS High",
  locCoor: "Koordinat RTS",
  stepRecord: "Step Record",
  retries: "Retries",
  cycleTime: "Cycle Time",
};

type KonfirmasiConfig = {
  status: "menunggu" | "ok" | "gagal";
  /** Nama medan yang dinyatakan logger sudah diterapkan. */
  updated?: string[];
  /** Isi kunci `set_rts` pada balasan; "OK" berarti berhasil. */
  setRts?: string;
  /** Medan yang nilai echo-nya BERBEDA dari yang dikirim. */
  beda?: Array<{ medan: string; dikirim: string; diterima: string }>;
};

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
  // ── Remote kontrol arah (jog) ──
  const [showJog, setShowJog] = useState(false);
  const [langkahJog, setLangkahJog] = useState(LANGKAH_JOG[1].derajat); // 1' sebagai awal
  const [jogStatus, setJogStatus] = useState<"idle" | "waiting" | "done" | "gagal">("idle");
  const [jogPesan, setJogPesan] = useState("");
  const [jogTarget, setJogTarget] = useState<BalasanJog | null>(null);
  const [haVa, setHaVa] = useState<BacaanHaVa | null>(null);
  const [haVaLoading, setHaVaLoading] = useState(false);

  // ── Ukur backsight / foresight ──
  const [ukurJalan, setUkurJalan] = useState<KodeUkur | null>(null);
  const [ukurHasil, setUkurHasil] = useState<Record<KodeUkur, BalasanUkur | null>>({ bs: null, fs: null });
  const [ukurGagal, setUkurGagal] = useState<KodeUkur | null>(null);

  /**
   * Diagnostik instrumen terakhir (Rotate / Idle / Tilt).
   *
   * `Rotate` datang dari SETIAP jalur rotasi — jog, turning_target, pulang ke
   * home, dan tiap target di AutoTracking. Jadi ini sinyal lintas perintah,
   * bukan milik satu tombol, dan tempatnya di panel yang selalu terlihat.
   */
  const [diagnostik, setDiagnostik] = useState<Diagnostik | null>(null);

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
  /**
   * Geser arah teleskop.
   *
   * `va` adalah sudut ZENIT: 0° menghadap lurus ke atas, 90° mendatar, 180°
   * lurus ke bawah. Jadi MENAMBAH va berarti MENUNDUK — tombol "atas" harus
   * mengirim nilai negatif. Pemetaan itu dikunci di sini, di satu tempat, biar
   * tidak ada yang menebaknya lagi di tempat lain.
   */
  const handleJog = async (arah: "atas" | "bawah" | "kiri" | "kanan") => {
    const n = langkahJog;
    const delta =
      arah === "kiri" ? { ha: -n, va: 0 }
      : arah === "kanan" ? { ha: n, va: 0 }
      : arah === "atas" ? { ha: 0, va: -n }   // zenit mengecil = mendongak
      : { ha: 0, va: n };                      // zenit membesar = menunduk

    setJogStatus("waiting");
    setJogPesan("");
    setJogTarget(null);
    try {
      const res = await fetch("/api/kontrol/jog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: selectedSite, ...delta }),
      });
      const json = await res.json();
      if (!json.success) {
        setJogStatus("gagal");
        setJogPesan(json.error || "Gagal mengirim perintah");
      }
      // Sukses tidak diumumkan di sini: yang selesai baru pengiriman ke broker.
      // Tahapan dan hasilnya datang lewat MQTT sebagai balasan bernama `Jog`.
    } catch (err) {
      console.error("[handleJog]", err);
      setJogStatus("gagal");
      setJogPesan("Terjadi kesalahan jaringan");
    }
  };

  /** Baca sudut instrumen sekarang. Tidak menggerakkan apa pun. */
  const handleBacaHaVa = async () => {
    setHaVaLoading(true);
    try {
      const res = await fetch("/api/kontrol/manual-hava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: selectedSite }),
      });
      const json = await res.json();
      if (!json.success) {
        setHaVaLoading(false);
        setPowerAlert({ type: "error", title: "Baca sudut", message: json.error || "Gagal" });
      }
      // Hasilnya ditangkap handler MQTT (ManualHAVA); loading dimatikan di sana.
    } catch (err) {
      console.error("[handleBacaHaVa]", err);
      setHaVaLoading(false);
      setPowerAlert({ type: "error", title: "Baca sudut", message: "Terjadi kesalahan jaringan" });
    }
  };

  /** Ukur backsight atau foresight. Tidak menggerakkan teleskop. */
  const handleUkur = async (jenis: KodeUkur) => {
    setUkurJalan(jenis);
    setUkurGagal(null);
    setUkurHasil((p) => ({ ...p, [jenis]: null }));
    try {
      const res = await fetch("/api/kontrol/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: selectedSite, jenis }),
      });
      const json = await res.json();
      if (!json.success) {
        setUkurJalan(null);
        setUkurGagal(jenis);
        setPowerAlert({ type: "error", title: "Ukur", message: json.error || "Gagal" });
      }
      // Hasilnya ditangkap handler MQTT (MeasureBS/MeasureFS).
    } catch (err) {
      console.error("[handleUkur]", err);
      setUkurJalan(null);
      setUkurGagal(jenis);
      setPowerAlert({ type: "error", title: "Ukur", message: "Terjadi kesalahan jaringan" });
    }
  };

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

          // Konfirmasi RTS Config:
          //   {"updated":[…],"set_rts":"OK","jobName":…,"locCoor":[…]}
          //
          // Dikenali dari `updated` berupa ARRAY di tingkat atas. Sengaja bukan
          // dari `set_rts`, karena string itu juga muncul sebagai nilai
          // `command` di payload PERINTAH yang kita kirim sendiri — memakai itu
          // sebagai penanda berisiko menganggap perintah sendiri sebagai balasan.
          const konfCfg = bacaKonfirmasiConfig(data, configTerkirimRef.current);
          if (konfCfg.cocok) {
            console.log("[KontrolADR] konfirmasi config:", konfCfg.setRts, konfCfg.updated, konfCfg.beda);
            setKonfirmasiConfig({
              status: konfCfg.ok ? "ok" : "gagal",
              updated: konfCfg.updated,
              setRts: konfCfg.setRts,
              beda: konfCfg.beda.length ? konfCfg.beda : undefined,
            });
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
          // {"Jog":{"value":"start"|"check"|"read"|"rotate"|"done"}}
          // {"Jog":{"value":"target","dari_HA":…,"ke_HA":…}}
          // {"Jog":{"value":"RTS Off"|"read failed"|"bad base"|"failed"}}
          const bJog = bacaBalasanJog(data.Jog);
          if (bJog.jenis !== "bukan") {
            console.log("[KontrolADR] Jog:", bJog.jenis, bJog.nilai);
            if (bJog.jenis === "ditolak") {
              setJogStatus("gagal");
              setJogPesan(
                SEBAB_TOLAK_JOG[bJog.nilai] ??
                  `Geseran ditolak (${bJog.nilai}).`
              );
              // Pada "bad base", sudut awal yang dianggap tidak sah ikut
              // dikirim — ditampilkan supaya kelihatan APA yang ngawur.
              if (bJog.HA || bJog.VA) {
                setJogTarget(bJog);
              }
            } else if (bJog.jenis === "target") {
              // Titik awal dan tujuan sekaligus: kalau hasilnya meleset,
              // langsung kelihatan salahnya di pembacaan atau di perhitungan.
              setJogTarget(bJog);
            } else if (bJog.jenis === "selesai") {
              setJogStatus("done");
              setJogPesan("");
            }
            // "tahap" (start/check/read/rotate) dibiarkan menunggu.
          }

          // {"Rotate":{"value":"ok","ms":1840}}
          // {"Rotate":{"value":"failed","reason":"no_response","ms":3001,"raw":""}}
          // {"Idle":…} / {"Tilt":…} — bentuk sama, operasi berbeda.
          for (const nd of NAMA_DIAGNOSTIK) {
            const d = bacaDiagnostik(nd, data[nd]);
            if (d.ada) {
              console.log(`[KontrolADR] ${nd}:`, d.ok ? "ok" : d.alasan, d.ms, d.raw);
              setDiagnostik(d);
            }
          }

          // {"MeasureBS":…} / {"MeasureFS":…}
          //
          // Dipilah lewat NAMA KUNCI, bukan dari perintah yang barusan dikirim.
          // Sebelum revisi protokol ini `measure_fs` salah dibalas `MeasureBS`;
          // kalau masih ada unit lama, hasilnya tampil di kolom yang salah —
          // dan itu lebih jujur daripada menerka mana yang dimaksud.
          for (const kode of ["bs", "fs"] as const) {
            const bUkur = bacaBalasanUkur(data[JENIS_UKUR[kode].balasan]);
            if (bUkur.jenis === "bukan") continue;
            console.log(`[KontrolADR] ${JENIS_UKUR[kode].balasan}:`, bUkur.jenis, bUkur.nilai);

            if (bUkur.jenis === "hasil") {
              // Baris berisi medan kosong mendahului "failed" — JANGAN
              // ditampilkan sebagai bacaan. Di revisi lama `SDis` tetap terisi
              // saat gagal, jadi membaca angka apa adanya menampilkan jarak
              // yang tidak pernah terukur.
              if (!bUkur.kosong) setUkurHasil((p) => ({ ...p, [kode]: bUkur }));
            } else if (bUkur.jenis === "gagal") {
              setUkurJalan(null);
              setUkurGagal(kode);
              setUkurHasil((p) => ({ ...p, [kode]: null }));
            } else if (bUkur.jenis === "selesai") {
              setUkurJalan(null);
            }
            // "tahap" (start/measure) dibiarkan menunggu.
          }

          // {"ManualHAVA":{"HA":"151,38,71","VA":"206,04,62"}}
          const bHaVa = bacaManualHaVa(data.ManualHAVA);
          if (bHaVa.ada) {
            console.log("[KontrolADR] ManualHAVA:", bHaVa.HA, bHaVa.VA, "gagal:", bHaVa.gagal);
            setHaVa(bHaVa);
            setHaVaLoading(false);
          }

          const bSetHome = bacaBalasanSetHome(data.setHome);
          if (bSetHome.jenis !== "bukan") {
            console.log("[KontrolADR] setHome:", bSetHome.jenis, bSetHome.nilai || bSetHome.rekaman);
            if (bSetHome.jenis === "ditolak") {
              // EEPROM TIDAK disentuh — posisi home lama tetap utuh. Kode
              // sebelumnya membaca `value` tanpa memilah, sehingga penolakan
              // ini tampil sebagai "Set Home tersimpan".
              setSetHomeStatus("idle");
              setPowerAlert({
                type: "error",
                title: "Set Home gagal",
                message:
                  bSetHome.nilai === "RTS Off"
                    ? "RTS tidak menjawab. Posisi home lama tidak berubah."
                    : "Sudut instrumen tidak terbaca. Posisi home lama tidak berubah.",
              });
            } else if (bSetHome.jenis === "tersimpan") {
              setSetHomeStatus("done");
              setSetHomeJawaban(bSetHome.rekaman);
              setPowerAlert({
                type: "on",
                title: "Set Home tersimpan",
                message: `RTS membalas: ${bSetHome.rekaman}`,
              });
            } else if (bSetHome.jenis === "selesai") {
              // Penutup rangkaian. Kalau rekamannya sudah masuk lebih dulu,
              // status "done" tinggal dipertahankan.
              setSetHomeStatus("done");
            }
            // jenis "tahap" (start/check/read) dibiarkan: tombolnya tetap
            // menampilkan "Menunggu RTS…" sampai rekaman atau penolakan masuk.
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
  const [konfirmasiConfig, setKonfirmasiConfig] = useState<KonfirmasiConfig | null>(null);
  /**
   * Nilai yang BARU SAJA dikirim, disimpan di ref supaya bisa dibaca handler
   * MQTT. Handler itu dipasang sekali dengan dependency [] sehingga ia menutup
   * (closure) nilai render pertama — membaca `rtsConfig` dari sana akan selalu
   * mendapat isi form yang basi, bukan yang barusan disimpan.
   */
  const configTerkirimRef = useRef<Record<string, string> | null>(null);

  // Timeout konfirmasi RTS Config.
  //
  // 20 detik: menulis setelan tidak menggerakkan instrumen, jadi jauh lebih
  // cepat dari operasi di tabel durasi protokol (terlama auto_search 30 detik).
  // Pesannya membedakan dua hal yang sangat berbeda dan gampang tertukar —
  // tersimpan di database vs sampai ke perangkat.
  useEffect(() => {
    if (konfirmasiConfig?.status !== "menunggu") return;
    const timer = setTimeout(() => {
      setKonfirmasiConfig({
        status: "gagal",
        setRts: "Tidak ada balasan dari logger dalam 20 detik. Setelan sudah tersimpan di aplikasi, tapi belum tentu sampai ke perangkat.",
      });
    }, 20_000);
    return () => clearTimeout(timer);
  }, [konfirmasiConfig]);
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
    // Konfirmasi dari sesi simpan sebelumnya dibersihkan. Kalau dibiarkan,
    // modal terbuka dengan centang hijau untuk setelan yang belum dikirim.
    setKonfirmasiConfig(null);
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

  // Simpan config ke database + kirim ke logger
  const saveConfig = async () => {
    setConfigSaving(true);
    setKonfirmasiConfig(null);
    // Disimpan SEBELUM dikirim: ini yang nanti dicocokkan dengan echo dari
    // logger. locCoor disusun [coor_x, coor_y, coor_z] mengikuti urutan yang
    // dipakai server saat menyusun payload MQTT — perhatikan coor_x itu
    // Northing dan coor_y Easting, penamaannya terbalik dari dugaan.
    configTerkirimRef.current = {
      jobName: String(rtsConfig.jobName ?? ""),
      prismConst: String(rtsConfig.prismaConst ?? ""),
      tsHigh: String(rtsConfig.tsHigh ?? ""),
      locCoor: [rtsConfig.coordX, rtsConfig.coordY, rtsConfig.coordZ].map((v) => String(v ?? "")).join(","),
    };
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
        // Modal SENGAJA tidak ditutup di sini. Tersimpan di database bukan
        // berarti sampai ke logger — dan itu justru yang ingin dilihat operator.
        // Konfirmasinya datang lewat MQTT sebagai {"updated":[…],"set_rts":"OK"}.
        setKonfirmasiConfig({ status: "menunggu" });
      } else {
        setKonfirmasiConfig({ status: "gagal", setRts: json.error || "Gagal menyimpan" });
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      setKonfirmasiConfig({ status: "gagal", setRts: "Terjadi kesalahan jaringan" });
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

  // ── Tahapan sesi, disimpulkan dari status kartu prisma ──
  //
  // Aturannya dipertahankan apa adanya dari versi sebelumnya; yang berubah cuma
  // cara menampilkannya (lihat ProcessSteps).
  const wasRunning = isControlRunning || respondedCount > 0;
  const measuring = runningCount > 0 && respondedCount > 0;
  const allResponded = respondedCount === totalPrisma && totalPrisma > 0;
  const finished = allResponded && runningCount === 0;
  const step1Active = isControlRunning && runningCount > 0 && !hasAnyResponse;
  const step2Active = step1Active;
  const step3Active = isControlRunning && measuring;

  const langkahProses: LangkahProses[] = [
    {
      label: "Mengarahkan ke target",
      aktif: step1Active,
      selesai: wasRunning && (hasAnyResponse || finished) && !step1Active,
    },
    {
      label: "Mencari target",
      aktif: step2Active,
      selesai: hasAnyResponse && !step2Active,
    },
    {
      label: "Mengukur target",
      aktif: step3Active,
      selesai: allResponded && !step3Active,
      kemajuan: totalPrisma > 0 ? `${respondedCount}/${totalPrisma}` : undefined,
    },
    {
      label: "Merekam data",
      aktif: false,
      selesai: finished,
      hasil: finished && failedCount > 0 ? `${successCount} OK / ${failedCount} gagal` : undefined,
    },
  ];

  const rtsBerjalan = String(sensor16) === "1";
  const rtsSiap = !rtsBerjalan && String(sensor14) === "1" && isConnected;
  const labelStatusRts = rtsBerjalan
    ? "Sedang mengukur"
    : rtsSiap
      ? "Menyala, siap"
      : "Tidak aktif";
  const warnaStatusRts = rtsBerjalan
    ? "var(--navy)"
    : rtsSiap
      ? "var(--st-normal)"
      : "var(--ink-3)";

  const tombol =
    "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

  /** Alasan sebuah perintah instrumen tidak bisa dijalankan, atau null. */
  const alasanTerkunci = !selectedSite
    ? "Pilih site dulu"
    : !isConnected
      ? "RTS tidak terhubung"
      : null;

  return (
    // <div>, bukan <main>: layout (dashboard) sudah membungkus halaman dengan
    // <main>, dan versi sebelumnya membuka <main> kedua di dalamnya sehingga
    // dokumennya punya dua landmark utama.
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      {powerAlert && <PowerAlertToast alert={powerAlert} onClose={() => setPowerAlert(null)} />}

      <div className="mx-auto max-w-[1600px] space-y-4 md:space-y-5">
        {/* ── Bar kontrol ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Eyebrow>Site</Eyebrow>
          <div
            role="tablist"
            aria-label="Pilih site pengukuran"
            className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {siteList.map((s) => {
              const aktif = s.slug === selectedSite;
              const b = siteBadge(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => {
                    setSelectedSite(s.slug);
                    setAccessCodeError("");
                  }}
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
            <span
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-medium text-(--ink-2) ring-1 ring-(--line)"
              title={
                lastUpdate
                  ? `Data terakhir ${fmtWaktu(lastUpdate, { detik: true })}`
                  : "Belum ada data masuk"
              }
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: isConnected ? "var(--st-normal)" : "var(--st-awas)" }}
              />
              Logger {isConnected ? "terhubung" : "terputus"}
            </span>
            {/* Pengaturan — tidak menggerakkan apa pun, jadi tempatnya di bar
                kontrol, bukan bersama perintah instrumen di bawah. */}
            <button
              type="button"
              onClick={openRtsConfig}
              className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
            >
              <Settings2 className="size-4" /> RTS Config
            </button>
            <button
              type="button"
              onClick={fetchScheduling}
              className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
            >
              <CalendarDays className="size-4" /> Jadwal running
            </button>
          </div>
        </div>

        {selectedSiteBadge?.peringatan && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">{selectedSiteBadge.peringatan}.</span> Sesi
              pengukuran tetap bisa dijalankan, tapi hasilnya belum bisa dipakai mengambil
              keputusan.
            </p>
          </div>
        )}

        {/* ── Baris A: keadaan, perintah, sesi ── */}
        {/* Tanpa items-start: ketiga panel mengikuti tinggi yang tertinggi.
            Blok terakhir di tiap panel dipatok ke bawah dengan mt-auto,
            jadi ruang lebihnya terbagi di antara kelompok — bukan menumpuk
            jadi satu rongga kosong di kaki kartu. */}
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.05fr)]">
          {/* Sikap instrumen — elemen tanda tangan halaman ini. */}
          {/* @container di tiap panel: isinya melipat menurut lebar PANEL, bukan
              lebar layar. Sidebar yang diciutkan menambah ~200px tanpa mengubah
              lebar viewport sedikit pun, dan aturan berbasis breakpoint layar
              buta terhadap itu — pelajaran yang sama sudah tercatat di kartu
              metrik versi sebelumnya. */}
          <Panel className="@container rise-in">
            <PanelHeader title="Sikap instrumen">
              <span>{namaPos(selectedSite)}</span>
            </PanelHeader>
            <div className="flex flex-1 flex-col px-5 pb-4 @lg:flex-row @lg:items-start @lg:gap-5">
              <AttitudeDial ha={sensor5} va={sensor6} basi={!isConnected} />

              <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-(--line) pt-3 @lg:mt-0 @lg:grid-cols-1 @lg:gap-y-3 @lg:border-t-0 @lg:pt-1">
                <div>
                  <dt className="text-[11.5px] text-(--ink-2)">Slope distance</dt>
                  <dd className="font-mono text-[14px] tabular-nums text-(--ink)">
                    {sensor7 || 0}
                    <span className="ml-1 text-[11px] text-(--ink-3)">m</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-(--ink-2)">Data terakhir</dt>
                  <dd className="font-mono text-[13px] tabular-nums text-(--ink)">
                    {lastUpdate ? fmtWaktu(lastUpdate) : "—"}
                  </dd>
                </div>
              </dl>

              {/* Diagnostik instrumen terakhir.
                  Rotate datang dari SETIAP jalur rotasi — jog, turning_target,
                  pulang ke home, dan tiap target AutoTracking — jadi ini sinyal
                  milik instrumen, bukan milik satu tombol. Tempatnya di panel
                  keadaan, bukan di dalam modal yang harus dibuka dulu.

                  `raw` ditampilkan APA ADANYA: itulah yang membedakan instrumen
                  yang diam sama sekali dari yang menjawab tapi isinya lain — dua
                  masalah dengan penanganan yang sangat berbeda. */}
              {diagnostik && (
                <div
                  className={cn(
                    "mt-3 rounded-[10px] border px-3.5 py-2.5",
                    diagnostik.ok
                      ? "border-(--line) bg-(--paper)"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-(--ink)">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{
                          background: diagnostik.ok ? "var(--st-normal)" : "var(--st-awas)",
                        }}
                      />
                      {OPERASI_DIAGNOSTIK[diagnostik.nama as NamaDiagnostik] ?? diagnostik.nama}
                      {diagnostik.ok ? " berhasil" : " gagal"}
                    </span>
                    {diagnostik.ms !== null && (
                      <span className="font-mono text-[11.5px] tabular-nums text-(--ink-3)">
                        {diagnostik.ms} ms
                      </span>
                    )}
                  </div>
                  {!diagnostik.ok && diagnostik.alasan && (
                    <p className="mt-1 text-[11.5px] leading-relaxed text-red-800">
                      {ARTI_ALASAN_DIAGNOSTIK[diagnostik.alasan] ?? diagnostik.alasan}
                    </p>
                  )}
                  {!diagnostik.ok && diagnostik.raw && (
                    <p className="mt-1 break-all font-mono text-[10.5px] text-red-900">
                      {diagnostik.raw}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Panel>

          {/* Perintah yang menggerakkan instrumen. */}
          <Panel className="@container rise-in" style={{ animationDelay: "70ms" }}>
            <PanelHeader title="Perintah instrumen">
              <span>menggerakkan alat di lapangan</span>
            </PanelHeader>
            {/* Saat panel melebar, foto alat + statusnya pindah ke kolom kiri
                yang sempit dan kedua kelompok tombol menumpuk di kanan. Kolom
                tombolnya sengaja yang mendapat sisa lebar: percobaan sebelumnya
                membagi panel jadi dua kolom sama besar, dan pada 457px tiap
                tombol tinggal ~90px sampai label "Set Home" pecah dua baris. */}
            <div className="flex flex-1 flex-col px-5 pb-4 @md:flex-row @md:gap-5">
              <div className="flex items-center gap-4 @md:w-[124px] @md:shrink-0 @md:flex-col @md:items-start @md:gap-3">
                <RTSAnimation isRunning={isControlRunning} />
                <div className="min-w-0">
                  <Eyebrow>Status RTS</Eyebrow>
                  <p className="mt-1 inline-flex items-center gap-2 font-display text-[19px] font-bold leading-tight text-(--ink)">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: warnaStatusRts }}
                    />
                    {labelStatusRts}
                  </p>
                  <p className="mt-1 text-[11.5px] text-(--ink-3)">
                    Logger <span className="font-mono tabular-nums">{idLogger ?? "—"}</span>
                  </p>
                </div>
              </div>

              {/* Daya. Dua tombol terpisah, bukan sakelar: sakelar menyiratkan
                  keadaan yang bisa dibalik seketika, padahal keduanya perintah
                  bertahap yang bisa gagal di tengah jalan. */}
              <div className="flex flex-1 flex-col">
              <div className="mt-4 @md:mt-0">
                <Eyebrow>Daya</Eyebrow>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePower("on")}
                    disabled={powerLoading}
                    className={cn(
                      tombol,
                      rtsPowerState === "on"
                        ? "bg-(--st-normal)/12 text-(--ink) ring-1 ring-(--st-normal)/40"
                        : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                    )}
                  >
                    <Power className="size-4" /> Nyalakan
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePower("off")}
                    disabled={powerLoading}
                    className={cn(
                      tombol,
                      rtsPowerState === "off"
                        ? "bg-(--st-awas)/10 text-(--ink) ring-1 ring-(--st-awas)/40"
                        : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                    )}
                  >
                    <Power className="size-4" /> Matikan
                  </button>
                </div>

                {/* Progres bertahap power. Muncul sejak perintah dikirim dan
                    hilang begitu tahap terakhir masuk atau timeout tercapai. */}
                {progresPower && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-2 flex items-center gap-2 rounded-[9px] bg-(--paper) px-3 py-2"
                  >
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-(--navy)" />
                    <span className="text-[12px] font-medium text-(--ink-2)">
                      {progresPower.action === "on" ? "Menyalakan" : "Mematikan"}:{" "}
                      {LABEL_NILAI_POWER[progresPower.action][progresPower.nilai] ??
                        progresPower.nilai}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4">
                <Eyebrow>Arah teleskop</Eyebrow>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJog(true)}
                    disabled={!!alasanTerkunci}
                    title={alasanTerkunci ?? "Geser arah teleskop sedikit demi sedikit"}
                    className={cn(tombol, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
                  >
                    <Move className="size-4" /> Arahkan
                  </button>
                  {/* Set Home SENGAJA tidak ditempel ke grup daya: bentuknya
                      mirip perintah daya padahal akibatnya jauh berbeda, dan
                      salah pencet baru ketahuan saat teleskop pulang ke arah
                      yang keliru. */}
                  <button
                    type="button"
                    onClick={() => {
                      // Kotak nama dikosongkan tiap modal dibuka. Nama home
                      // menimpa titik acuan pulang teleskop, jadi isian lama
                      // yang tertinggal mengundang penyimpanan atas nama yang
                      // sebetulnya sisa percobaan sebelumnya.
                      setNamaHome("");
                      setKonfirmasiSetHome(true);
                    }}
                    disabled={setHomeStatus === "waiting" || !!alasanTerkunci}
                    title={
                      alasanTerkunci ??
                      (setHomeJawaban
                        ? `Balasan terakhir: ${setHomeJawaban}`
                        : "Simpan arah teleskop saat ini sebagai posisi home")
                    }
                    className={cn(
                      tombol,
                      "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                    )}
                  >
                    {setHomeStatus === "waiting" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Home className="size-4" />
                    )}
                    {setHomeStatus === "waiting" ? "Menunggu…" : "Set Home"}
                  </button>
                </div>
                {alasanTerkunci && (
                  <p className="mt-2 text-[11.5px] text-(--ink-3)">{alasanTerkunci}.</p>
                )}
              </div>
              </div>
            </div>
          </Panel>

          {/* Sesi pengukuran. */}
          <Panel className="@container rise-in" style={{ animationDelay: "140ms" }}>
            <PanelHeader title="Sesi pengukuran">
              <Chip mono>{runningDate !== "-" ? fmtWaktu(runningDate) : "belum ada"}</Chip>
              {totalPrisma > 0 && (
                <Chip>
                  <span className="font-mono tabular-nums">{totalPrisma}</span>&nbsp;prisma
                </Chip>
              )}
            </PanelHeader>
            <div className="flex flex-1 flex-col px-5 pb-4">
              <div className="@lg:grid @lg:grid-cols-2 @lg:items-start @lg:gap-x-6">
              <div>
              <label htmlFor="kode-akses-kontrol" className={LABEL}>
                Kode akses
              </label>
              <div className="flex items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="kode-akses-kontrol"
                    type={showPassword ? "text" : "password"}
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      setAccessCodeError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && isConnected && handleMulaiKontrol()}
                    placeholder={isConnected ? "Masukkan kode" : "Logger tidak terhubung"}
                    disabled={!isConnected}
                    autoComplete="off"
                    className={cn(
                      INPUT,
                      "pr-10 font-mono tracking-[0.18em]",
                      accessCodeError && "border-(--st-awas) focus:ring-(--st-awas)/25",
                      !isConnected && "cursor-not-allowed bg-(--paper) text-(--ink-3)"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!isConnected}
                    aria-label={showPassword ? "Sembunyikan kode" : "Tampilkan kode"}
                    className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-(--ink-3) outline-none transition-colors hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleMulaiKontrol}
                  disabled={
                    !accessCode.trim() || !selectedSite || isControlRunning || !isConnected
                  }
                  className={cn(tombol, "shrink-0 bg-(--navy) text-white hover:bg-(--navy-deep)")}
                >
                  {isControlRunning ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Berjalan
                    </>
                  ) : (
                    "Mulai"
                  )}
                </button>
              </div>
              {accessCodeError && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-(--st-awas)">
                  <XCircle className="size-3.5" />
                  {accessCodeError}
                </p>
              )}

              {/* Progres AutoTracking langsung dari firmware. Dibedakan dari
                  tahapan di bawahnya yang disimpulkan dari kartu prisma — yang
                  ini angka yang dilaporkan alatnya sendiri, termasuk target yang
                  belum sempat menjawab. */}
              {progresTracking && (
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "mt-3 rounded-[10px] border px-3.5 py-2.5",
                    progresTracking.diam
                      ? "border-amber-200 bg-amber-50"
                      : "border-(--line) bg-(--paper)"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        progresTracking.diam ? "text-amber-900" : "text-(--ink)"
                      )}
                    >
                      {progresTracking.diam
                        ? "AutoTracking tidak merespons"
                        : LABEL_NILAI_TRACKING[progresTracking.nilai] ?? progresTracking.nilai}
                    </span>
                    {progresTracking.nilai === "target" && progresTracking.total > 0 && (
                      <span className="font-mono text-[11.5px] tabular-nums text-(--ink-3)">
                        {progresTracking.current} / {progresTracking.total}
                      </span>
                    )}
                  </div>
                  {progresTracking.nilai === "target" && progresTracking.status && (
                    <p className="mt-0.5 text-[11.5px] text-(--ink-3)">
                      Target {progresTracking.current}:{" "}
                      {LABEL_STATUS_TARGET[progresTracking.status] ?? progresTracking.status}
                      {progresTracking.retries ? ` · ${progresTracking.retries}× percobaan` : ""}
                    </p>
                  )}
                  {progresTracking.diam && (
                    <p className="mt-0.5 text-[11.5px] text-amber-800">
                      Tidak ada kabar baru selama {BATAS_DIAM_TRACKING_MS / 1000} detik terakhir.
                    </p>
                  )}
                  {progresTracking.total > 0 && !progresTracking.diam && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-(--navy) transition-[width] duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((progresTracking.current / progresTracking.total) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              </div>

              <div className="mt-4 border-t border-(--line) pt-3 @lg:mt-0 @lg:border-t-0 @lg:pt-0">
                <Eyebrow>Tahapan</Eyebrow>
                <div className="mt-2.5">
                  <ProcessSteps langkah={langkahProses} />
                </div>
              </div>
              </div>

              <dl className="mt-auto grid grid-cols-2 gap-x-4 border-t border-(--line) pt-3">
                <div>
                  <dt className="text-[11.5px] text-(--ink-2)">Percobaan ulang</dt>
                  <dd className="inline-flex items-baseline gap-1.5 font-mono text-[15px] tabular-nums text-(--ink)">
                    {rtsConfig.retries || "1"}
                    <RefreshCcw
                      className={cn("size-3.5 text-(--ink-3)", isControlRunning && "animate-spin")}
                      style={{ animationDirection: "reverse" }}
                      aria-hidden="true"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-(--ink-2)">Cycle time</dt>
                  <dd className="font-mono text-[15px] tabular-nums text-(--ink)">
                    {rtsConfig.cycleTime || "1"}
                    <span className="ml-1 text-[11px] text-(--ink-3)">ms</span>
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>
        </div>

        {/* ── Baris B: hasil & riwayat ── */}
        <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Panel className="rise-in" style={{ animationDelay: "200ms" }}>
            <PanelHeader title="Hasil prisma">
              <span>sesi terakhir · koordinat dalam meter</span>
            </PanelHeader>
            <div className="border-t border-(--line) p-4">
              <PrismaGrid
                cards={prismaCards}
                loading={prismaLoading}
                adaSite={!!selectedSite}
              />
            </div>
          </Panel>

          <Panel className="rise-in" style={{ animationDelay: "260ms" }}>
            <PanelHeader title="Riwayat running" />
            <div className="border-t border-(--line)">
              {!selectedSite ? (
                <p className="px-5 py-8 text-center text-[12.5px] text-(--ink-3)">
                  Pilih site untuk melihat riwayat.
                </p>
              ) : riwayatLogs.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12.5px] text-(--ink-3)">
                  Belum ada running untuk site ini.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {riwayatLogs.map(
                    (item: {
                      id_log: string;
                      datetime?: string | null;
                      prisma_count?: number;
                    }) => (
                      <li
                        key={item.id_log}
                        className="flex items-baseline justify-between gap-3 border-b border-(--line) px-5 py-3 last:border-0"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-(--ink)">
                            {fmtTanggal(item.datetime ?? null)}
                          </span>
                          <span className="font-mono text-[11.5px] tabular-nums text-(--ink-3)">
                            {fmtJam(item.datetime ?? null)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11.5px] text-(--ink-2)">
                          <span className="font-mono tabular-nums text-(--ink)">
                            {item.prisma_count ?? 0}
                          </span>{" "}
                          prisma
                        </span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end border-t border-(--line) px-5 py-3">
              <a
                href={`/hasil-pengukuran${selectedSite ? `?site=${encodeURIComponent(selectedSite)}` : ""}`}
                className="group inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-(--navy) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/40"
              >
                Lihat semua
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </Panel>
        </div>
      </div>

      {/* ─── RTS Config ─── */}
      {showRtsConfig && (
        <ModalShell
          judul="RTS Config"
          keterangan="Setelan yang dikirim ke instrumen saat menyala dan di awal setiap sesi."
          ikon={<Settings2 className="size-4.5" />}
          lebar="max-w-[600px]"
          onClose={() => setShowRtsConfig(false)}
          bisaDitutup={!configSaving && konfirmasiConfig?.status !== "menunggu"}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowRtsConfig(false)}
                className={TOMBOL_SEKUNDER}
              >
                {konfirmasiConfig?.status === "ok" ? "Tutup" : "Batal"}
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={configSaving || konfirmasiConfig?.status === "menunggu"}
                className={TOMBOL_UTAMA}
              >
                {configSaving || konfirmasiConfig?.status === "menunggu" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan…
                  </>
                ) : (
                  "Simpan"
                )}
              </button>
            </>
          }
        >
          {configLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-(--ink-3)">
              <Loader2 className="size-5 animate-spin text-(--navy)" />
              Memuat konfigurasi…
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <fieldset>
                <legend className="mb-2 inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)">
                  <FileText className="size-3.5" /> Informasi job
                </legend>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cfg-job" className={LABEL}>
                      Job name
                    </label>
                    <input
                      id="cfg-job"
                      value={rtsConfig.jobName}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, jobName: e.target.value })}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-prisma" className={LABEL}>
                      Prisma const
                    </label>
                    <input
                      id="cfg-prisma"
                      value={rtsConfig.prismaConst}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, prismaConst: e.target.value })}
                      className={cn(INPUT, "font-mono tabular-nums")}
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-tshigh" className={LABEL}>
                      TS high
                    </label>
                    <input
                      id="cfg-tshigh"
                      value={rtsConfig.tsHigh}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, tsHigh: e.target.value })}
                      className={cn(INPUT, "font-mono tabular-nums")}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)">
                  <Crosshair className="size-3.5" /> Koordinat RTS
                </legend>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["coordX", "Coordinate X"],
                      ["coordY", "Coordinate Y"],
                      ["coordZ", "Coordinate Z"],
                    ] as const
                  ).map(([kunci, label]) => (
                    <div key={kunci}>
                      <label htmlFor={`cfg-${kunci}`} className={LABEL}>
                        {label}
                      </label>
                      <input
                        id={`cfg-${kunci}`}
                        value={rtsConfig[kunci]}
                        onChange={(e) => setRtsConfig({ ...rtsConfig, [kunci]: e.target.value })}
                        className={cn(INPUT, "font-mono tabular-nums")}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-(--ink-2)">
                  <SlidersHorizontal className="size-3.5" /> Parameter running
                </legend>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cfg-step" className={LABEL}>
                      Step record
                    </label>
                    <input
                      id="cfg-step"
                      value={rtsConfig.stepRecord}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, stepRecord: e.target.value })}
                      className={cn(INPUT, "font-mono tabular-nums")}
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-retries" className={LABEL}>
                      Retries{" "}
                      <span className="font-normal text-(--ink-3)">
                        {RENTANG_RETRIES.min}–{RENTANG_RETRIES.maks}
                      </span>
                    </label>
                    <input
                      id="cfg-retries"
                      value={rtsConfig.retries}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, retries: e.target.value })}
                      className={cn(INPUT, "font-mono tabular-nums")}
                    />
                  </div>
                  <div>
                    {/* Satuannya WAJIB tertulis. Menu serial dan Bluetooth
                        memakai DETIK untuk setelan yang sama, jadi angka yang
                        identik memberi hasil 1000× berbeda tergantung jalurnya —
                        dan firmware tidak menolak nilai di luar rentang, ia
                        hanya diam-diam menggantinya dengan bawaan. */}
                    <label htmlFor="cfg-cycle" className={LABEL}>
                      Cycle time{" "}
                      <span className="font-normal text-(--ink-3)">
                        milidetik, {RENTANG_CYCLE_TIME_MS.min.toLocaleString("id-ID")}–
                        {RENTANG_CYCLE_TIME_MS.maks.toLocaleString("id-ID")}
                      </span>
                    </label>
                    <input
                      id="cfg-cycle"
                      value={rtsConfig.cycleTime}
                      onChange={(e) => setRtsConfig({ ...rtsConfig, cycleTime: e.target.value })}
                      className={cn(INPUT, "font-mono tabular-nums")}
                    />
                    {Number(rtsConfig.cycleTime) >= RENTANG_CYCLE_TIME_MS.min &&
                      Number(rtsConfig.cycleTime) <= RENTANG_CYCLE_TIME_MS.maks && (
                        <p className="mt-1 text-[11px] text-(--ink-3)">
                          = {(Number(rtsConfig.cycleTime) / 1000).toLocaleString("id-ID")} detik
                        </p>
                      )}
                  </div>
                </div>

                {/* Peringatan untuk nilai tersimpan yang di luar rentang. Nilai
                    seperti ini sudah terlanjur ada di database: firmware
                    menerimanya tanpa protes lalu menggantinya dengan bawaan,
                    jadi setelannya tidak pernah berlaku dan tidak ada yang
                    memberi tahu. */}
                {(validasiCycleTime(rtsConfig.cycleTime) || validasiRetries(rtsConfig.retries)) && (
                  <div className="mt-3 flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900">
                    <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
                    <span>
                      {[validasiCycleTime(rtsConfig.cycleTime), validasiRetries(rtsConfig.retries)]
                        .filter(Boolean)
                        .join(". ")}
                      . Nilai di luar rentang diterima perangkat tanpa penolakan lalu diganti
                      bawaan saat menyala berikutnya — setelannya tidak akan pernah berlaku.
                    </span>
                  </div>
                )}
              </fieldset>

              {/* Konfirmasi dari logger. Dipisah dari status simpan-ke-database
                  dengan sengaja: tersimpan di aplikasi dan sampai ke perangkat
                  adalah dua hal berbeda, dan yang kedua itulah yang menentukan
                  RTS benar-benar memakai setelan baru. */}
              {konfirmasiConfig && (
                <div className="border-t border-(--line) pt-3.5">
                  {konfirmasiConfig.status === "menunggu" && (
                    <div className="flex items-center gap-2.5 rounded-[10px] bg-(--paper) px-3.5 py-2.5 text-[12.5px] text-(--ink-2)">
                      <Loader2 className="size-4 shrink-0 animate-spin text-(--navy)" />
                      Tersimpan di aplikasi. Menunggu logger mengonfirmasi…
                    </div>
                  )}

                  {konfirmasiConfig.status === "ok" && (
                    <div className="rounded-[10px] bg-(--paper) px-3.5 py-2.5">
                      <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-(--ink)">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ background: "var(--st-normal)" }}
                        />
                        Logger menerima setelan ({konfirmasiConfig.setRts})
                      </p>
                      {konfirmasiConfig.updated?.length ? (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-(--ink-2)">
                          Diterapkan:{" "}
                          {konfirmasiConfig.updated
                            .map((m) => LABEL_MEDAN_CONFIG[m] ?? m)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {konfirmasiConfig.status === "gagal" && (
                    <div className="flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
                      <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
                      <span>
                        {konfirmasiConfig.setRts || "Logger tidak mengonfirmasi setelan."}
                      </span>
                    </div>
                  )}

                  {/* Nilai yang kembali BERBEDA dari yang dikirim. Ditampilkan
                      terpisah dari status: logger bisa menjawab OK sambil
                      menyimpan angka lain. */}
                  {konfirmasiConfig.beda?.length ? (
                    <div className="mt-2 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-900">
                      <p className="font-semibold">Nilai yang dikembalikan logger berbeda:</p>
                      <ul className="mt-1 space-y-0.5">
                        {konfirmasiConfig.beda.map((b) => (
                          <li key={b.medan} className="font-mono text-[11.5px]">
                            {LABEL_MEDAN_CONFIG[b.medan] ?? b.medan}: dikirim{" "}
                            <strong>{b.dikirim || "(kosong)"}</strong> → tersimpan{" "}
                            <strong>{b.diterima || "(kosong)"}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {/* ─── Jadwal running ─── */}
      {showJadwalModal && (
        <ModalShell
          judul="Jadwal running"
          keterangan="Sesi berjalan otomatis pada waktu yang ditentukan, tanpa kode akses."
          ikon={<CalendarDays className="size-4.5" />}
          lebar="max-w-[560px]"
          onClose={() => setShowJadwalModal(false)}
          bisaDitutup={!jadwalSaving}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowJadwalModal(false)}
                className={TOMBOL_SEKUNDER}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveScheduling}
                disabled={jadwalSaving}
                className={TOMBOL_UTAMA}
              >
                {jadwalSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan…
                  </>
                ) : (
                  "Simpan"
                )}
              </button>
            </>
          }
        >
          {jadwalLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-(--ink-3)">
              <Loader2 className="size-5 animate-spin text-(--navy)" />
              Memuat jadwal…
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Pilih hari"
                className="flex gap-1 overflow-x-auto rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {schedules.map((s) => (
                  <button
                    key={s.day}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === s.day}
                    onClick={() => setActiveTab(s.day)}
                    className={cn(
                      "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                      activeTab === s.day
                        ? "bg-white text-(--ink) shadow-sm"
                        : "text-(--ink-3) hover:text-(--ink-2)"
                    )}
                  >
                    {/* Titik penanda hari yang punya jadwal aktif — tanpa ini
                        operator harus membuka tujuh tab untuk tahu mana yang
                        sudah diatur. */}
                    {s.active && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full"
                        style={{ background: "var(--st-normal)" }}
                      />
                    )}
                    {s.day}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-[10px] bg-(--paper) px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-(--ink)">
                    Penjadwalan {activeTab}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-(--ink-2)">
                    Otomatis running pada waktu yang ditentukan
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentSchedule.active}
                  aria-label={`Aktifkan penjadwalan ${activeTab}`}
                  onClick={toggleDayActive}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                    currentSchedule.active ? "bg-(--navy)" : "bg-(--ink-3)/40"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition",
                      currentSchedule.active ? "translate-x-[22px]" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {currentSchedule.active && currentSchedule.runs && currentSchedule.runs.length > 0 && (
                <div className="mt-4">
                  <Eyebrow>Waktu running</Eyebrow>
                  <ul className="mt-2 rounded-[10px] ring-1 ring-(--line)">
                    {currentSchedule.runs.map((r, i) => (
                      <li
                        key={r.id}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3.5 py-2.5",
                          i > 0 && "border-t border-(--line)"
                        )}
                      >
                        <label className="inline-flex min-w-0 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={() => toggleRunActive(r.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                              r.active
                                ? "border-(--navy) bg-(--navy)"
                                : "border-(--ink-3)/50 bg-white"
                            )}
                          >
                            {r.active && <Check className="size-3 text-white" strokeWidth={3.5} />}
                          </span>
                          <span className="truncate text-[13px] text-(--ink)">{r.nama}</span>
                        </label>

                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              r.active && setOpenTimePickerId(openTimePickerId === r.id ? null : r.id)
                            }
                            disabled={!r.active}
                            className="inline-flex h-8 w-[92px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-white font-mono text-[13px] tabular-nums text-(--ink) ring-1 ring-(--line) outline-none transition-colors hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:bg-(--paper) disabled:text-(--ink-3)"
                          >
                            <Clock className="size-3.5 text-(--ink-3)" />
                            {r.time || "00:00"}
                          </button>

                          {openTimePickerId === r.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenTimePickerId(null)}
                              />
                              <div className="absolute top-9 right-0 z-50 flex h-[168px] w-[124px] overflow-hidden rounded-[10px] bg-white shadow-xl ring-1 ring-(--line)">
                                <div className="h-full w-1/2 overflow-y-auto border-r border-(--line) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {Array.from({ length: 24 }, (_, i) => {
                                    const h = String(i).padStart(2, "0");
                                    const dipilih = (r.time?.split(":")[0] || "00") === h;
                                    return (
                                      <button
                                        type="button"
                                        key={`h-${i}`}
                                        onClick={() =>
                                          updateRunTime(r.id, `${h}:${r.time?.split(":")[1] || "00"}`)
                                        }
                                        className={cn(
                                          "w-full cursor-pointer py-1.5 font-mono text-[13px] tabular-nums transition-colors",
                                          dipilih
                                            ? "bg-(--navy) text-white"
                                            : "text-(--ink-2) hover:bg-(--paper)"
                                        )}
                                      >
                                        {h}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="h-full w-1/2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {Array.from({ length: 60 }, (_, i) => {
                                    const m = String(i).padStart(2, "0");
                                    const dipilih = (r.time?.split(":")[1] || "00") === m;
                                    return (
                                      <button
                                        type="button"
                                        key={`m-${i}`}
                                        onClick={() =>
                                          updateRunTime(r.id, `${r.time?.split(":")[0] || "00"}:${m}`)
                                        }
                                        className={cn(
                                          "w-full cursor-pointer py-1.5 font-mono text-[13px] tabular-nums transition-colors",
                                          dipilih
                                            ? "bg-(--navy) text-white"
                                            : "text-(--ink-2) hover:bg-(--paper)"
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
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </ModalShell>
      )}

      {/* ─── Arahkan RTS ───
          Menggeser teleskop secara relatif lewat perintah `jog`. Sengaja dialog
          terpisah, bukan tombol lepas di panel: setiap penekanan menggerakkan
          instrumen sungguhan, jadi harus jelas sedang berada di mode ini. */}
      {showJog && (
        <ModalShell
          judul="Arahkan RTS"
          keterangan="Setiap penekanan memutar teleskop di lapangan."
          ikon={<Move className="size-4.5" />}
          lebar="max-w-[440px]"
          onClose={() => setShowJog(false)}
        >
          <div className="flex flex-col gap-4">
            {/* Sudut sekarang */}
            <div className="rounded-[10px] bg-(--paper) px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>Sudut instrumen sekarang</Eyebrow>
                <button
                  type="button"
                  onClick={handleBacaHaVa}
                  disabled={haVaLoading || !isConnected}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-[11.5px] font-semibold text-(--navy) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:text-(--ink-3) disabled:no-underline"
                >
                  {haVaLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-3" />
                  )}
                  Baca
                </button>
              </div>
              {haVa?.gagal ? (
                // Kedua nilai "000,00,00" adalah penanda gagal, bukan sudut
                // sungguhan — kalau ditampilkan apa adanya akan terbaca sebagai
                // instrumen menghadap titik nol.
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-(--ink)">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: "var(--st-awas)" }}
                  />
                  Instrumen tidak menjawab (000,00,00)
                </p>
              ) : haVa ? (
                <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono text-[13px] tabular-nums text-(--ink)">
                  <span>
                    <span className="text-(--ink-3)">HA</span> {haVa.HA}
                  </span>
                  <span>
                    <span className="text-(--ink-3)">VA</span> {haVa.VA}
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-(--ink-3)">Belum dibaca</p>
              )}
            </div>

            {/* Pemilih langkah */}
            <div>
              <p className={LABEL}>Besar langkah</p>
              <div className="grid grid-cols-4 gap-2">
                {LANGKAH_JOG.map((l) => (
                  <button
                    key={l.label}
                    type="button"
                    onClick={() => setLangkahJog(l.derajat)}
                    title={`${l.keterangan} — dikirim sebagai ${String(l.derajat).replace(".", ",")}°`}
                    className={cn(
                      "h-9 cursor-pointer rounded-[9px] text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                      langkahJog === l.derajat
                        ? "bg-(--navy) text-white"
                        : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tombol arah */}
            <div className="flex flex-col items-center gap-2">
              {(() => {
                const sibuk = jogStatus === "waiting";
                const mati = sibuk || !isConnected || !selectedSite;
                const kelas = cn(
                  "flex size-11 items-center justify-center rounded-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                  mati
                    ? "cursor-not-allowed bg-(--paper) text-(--ink-3)/50"
                    : "cursor-pointer bg-white text-(--navy) ring-1 ring-(--navy)/30 hover:bg-(--navy) hover:text-white"
                );
                const Tombol = ({
                  arah,
                  children,
                }: {
                  arah: "atas" | "bawah" | "kiri" | "kanan";
                  children: React.ReactNode;
                }) => (
                  <button
                    type="button"
                    onClick={() => handleJog(arah)}
                    disabled={mati}
                    className={kelas}
                    aria-label={`Geser ${arah}`}
                  >
                    {children}
                  </button>
                );
                return (
                  <>
                    <Tombol arah="atas">
                      <ChevronUp className="size-5" />
                    </Tombol>
                    <div className="flex items-center gap-2">
                      <Tombol arah="kiri">
                        <ChevronLeft className="size-5" />
                      </Tombol>
                      <div className="flex size-11 items-center justify-center rounded-[10px] bg-(--paper) font-mono text-[11px] font-semibold tabular-nums text-(--ink-2)">
                        {sibuk ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          LANGKAH_JOG.find((l) => l.derajat === langkahJog)?.label
                        )}
                      </div>
                      <Tombol arah="kanan">
                        <ChevronRight className="size-5" />
                      </Tombol>
                    </div>
                    <Tombol arah="bawah">
                      <ChevronDown className="size-5" />
                    </Tombol>
                  </>
                );
              })()}
            </div>

            {/* VA adalah sudut zenit, bukan elevasi. Disebut supaya operator
                tahu kenapa angkanya mengecil saat mendongak.

                Batas ZA 30°–150° tidak dijaga aplikasi maupun firmware — di luar
                itu instrumen menolak DIAM-DIAM, dan satu-satunya jejaknya adalah
                `Rotate` gagal dengan alasan `no_response` setelah menunggu.
                Disebutkan supaya kegagalan itu tidak terbaca sebagai alat rusak. */}
            <p className="text-center text-[11px] leading-relaxed text-(--ink-3)">
              Atas/bawah mengubah VA (sudut zenit — mendongak membuat angkanya mengecil),
              kiri/kanan mengubah HA. Teropong hanya bisa dipakai sekitar VA 30°–150°.
            </p>

            {/* Titik awal → tujuan dari balasan `target` */}
            {jogTarget && (jogTarget.keHA || jogTarget.HA) && (
              <div
                className={cn(
                  "rounded-[10px] px-3.5 py-3 text-[11.5px] leading-relaxed",
                  jogTarget.jenis === "ditolak"
                    ? "border border-red-200 bg-red-50 text-red-900"
                    : "bg-(--paper) text-(--ink-2)"
                )}
              >
                {jogTarget.jenis === "ditolak" ? (
                  <>
                    <p className="font-semibold">Sudut awal yang ditolak</p>
                    <p className="mt-0.5 font-mono tabular-nums">
                      HA {jogTarget.HA} · VA {jogTarget.VA}
                    </p>
                  </>
                ) : (
                  <>
                    {/* Dua satuan berbeda dalam satu balasan: `dari_*` desimal
                        derajat, `ke_*` DMS. Diberi label karena tanpa itu
                        bentuknya terlihat seperti data rusak. */}
                    <p className="font-semibold text-(--ink)">Perpindahan</p>
                    <p className="mt-0.5 font-mono tabular-nums">
                      dari HA {jogTarget.dariHA} · VA {jogTarget.dariVA}
                      <span className="ml-1.5 font-sans text-[10.5px] text-(--ink-3)">
                        desimal
                      </span>
                    </p>
                    <p className="font-mono tabular-nums">
                      ke&nbsp;&nbsp; HA {jogTarget.keHA} · VA {jogTarget.keVA}
                      <span className="ml-1.5 font-sans text-[10.5px] text-(--ink-3)">d,m,d</span>
                    </p>
                  </>
                )}
              </div>
            )}

            {jogStatus === "gagal" && jogPesan && (
              <div className="flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
                <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
                <span>{jogPesan}</span>
              </div>
            )}

            {/* Ukur — melengkapi alurnya: arahkan, baca sudut, lalu ukur.
                Tidak menggerakkan teleskop, hanya membaca. */}
            <div className="border-t border-(--line) pt-4">
              <p className={LABEL}>Ukur dari arah sekarang</p>
              <div className="grid grid-cols-2 gap-2">
                {(["bs", "fs"] as const).map((kode) => {
                  const mati = ukurJalan !== null || !isConnected || !selectedSite;
                  return (
                    <button
                      key={kode}
                      type="button"
                      onClick={() => handleUkur(kode)}
                      disabled={mati}
                      className={cn(
                        tombol,
                        "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                      )}
                    >
                      {ukurJalan === kode ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Ruler className="size-4" />
                      )}
                      {JENIS_UKUR[kode].label}
                    </button>
                  );
                })}
              </div>

              {(["bs", "fs"] as const).map((kode) => {
                const h = ukurHasil[kode];
                if (!h) return null;
                return (
                  <div key={kode} className="mt-2 rounded-[10px] bg-(--paper) px-3.5 py-2.5">
                    <Eyebrow>{JENIS_UKUR[kode].label}</Eyebrow>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px] tabular-nums text-(--ink)">
                      <div className="flex justify-between gap-2">
                        <dt className="text-(--ink-3)">HA</dt>
                        <dd>{h.HADMS}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-(--ink-3)">VA</dt>
                        <dd>{h.VADMS}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-(--ink-3)">SD</dt>
                        <dd>{h.SDis}</dd>
                      </div>
                      {/* HD hanya ada di balasan ini — payload data berkala
                          tidak memuat jarak horizontal sama sekali. */}
                      <div className="flex justify-between gap-2">
                        <dt className="text-(--ink-3)">HD</dt>
                        <dd>{h.HD}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}

              {ukurGagal && (
                <div className="mt-2 flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
                  <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
                  <span>
                    Pengukuran {JENIS_UKUR[ukurGagal].label} gagal. Instrumen tidak mendapat
                    pantulan — periksa bidikan dan halangan di lintasan.
                  </span>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* ─── Konfirmasi Set Home ───
          Wajib ada: perintah ini menimpa titik acuan yang dipakai PowerOff dan
          akhir siklus AutoTracking untuk memulangkan teleskop. Menyetelnya saat
          teleskop sedang membidik target membuat semua homing berikutnya
          mengarah ke tempat yang salah — dan karena firmware tidak membalas,
          kekeliruannya baru ketahuan jauh kemudian. */}
      {konfirmasiSetHome && (
        <ModalShell
          judul="Set Home"
          keterangan={`Arah teleskop saat ini akan disimpan sebagai posisi home untuk ${namaPos(selectedSite)}, menimpa yang lama.`}
          ikon={<Home className="size-4.5" />}
          lebar="max-w-[420px]"
          onClose={() => setKonfirmasiSetHome(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setKonfirmasiSetHome(false)}
                className={TOMBOL_SEKUNDER}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSetHome}
                disabled={!namaHomeSah}
                className={TOMBOL_UTAMA}
              >
                Simpan sebagai home
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3.5">
            {/* Nama home. Kunci `setHome` mengirim NAMA ini, bukan penanda aksi,
                jadi kotak ini bukan pelengkap — tanpa isian tidak ada perintah
                yang layak dikirim. Enter ikut mengirim supaya alur ketik-lalu-
                simpan tidak memaksa pindah ke mouse. */}
            <div>
              <label htmlFor="nama-home" className={LABEL}>
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
                className={cn(INPUT, "font-mono placeholder:font-sans")}
              />
              {/* Peringatan hanya muncul setelah ada yang diketik: kotak yang
                  masih kosong saat dialog baru terbuka bukan kesalahan operator. */}
              {namaHomeBersih.length > 0 && /[,;]/.test(namaHomeBersih) && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-(--st-awas)">
                  Koma dan titik koma tidak boleh dipakai — keduanya pemisah medan di balasan
                  RTS, jadi nama yang memuatnya membuat balasannya tidak bisa dibaca.
                </p>
              )}
            </div>

            <div className="flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
              <span>
                Pastikan teleskop sedang menghadap posisi home yang benar, bukan sedang
                membidik target. Titik ini dipakai saat mematikan RTS dan di akhir setiap
                siklus AutoTracking.
              </span>
            </div>

            <p className="text-[12px] leading-relaxed text-(--ink-3)">
              RTS akan membalas dengan nama itu diikuti sederet angka mentah, mis.{" "}
              <span className="font-mono">HOME,0,151,42,06,206,04,54;</span> — ditampilkan apa
              adanya karena formatnya tidak terdokumentasi. Kehadirannya menandakan perintah
              diterima, bukan bahwa arahnya sudah benar.
            </p>

            {setHomeJawaban && (
              <div className="rounded-[10px] bg-(--paper) px-3.5 py-2.5">
                <Eyebrow>Balasan terakhir</Eyebrow>
                <p className="mt-1 break-all font-mono text-[12px] text-(--ink)">
                  {setHomeJawaban}
                </p>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
