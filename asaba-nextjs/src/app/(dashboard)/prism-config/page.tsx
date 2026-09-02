"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Pencil, Trash2, ChevronLeft, ChevronRight,
  SlidersHorizontal, Plus, Loader2, X, Check, AlertCircle,
  Lock, Eye, EyeOff
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { nilaiBalasanLogger, balasanSelesai, balasanGagal } from "@/lib/balasan-logger";
import {
  klasifikasiTurningTarget,
  bacaBalasanSearchArea,
  RENTANG_SETELAH_POWERON_DERAJAT,
  type BalasanSearchArea,
} from "@/lib/protokol-rts";
import { RtsConnectionBadge } from "@/components/RtsConnectionBadge";
import { useRtsConnectionStatus } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import mqtt from "mqtt";

// =================== TYPES ===================
interface PrismaSlot {
  slot: number;
  id?: number;
  id_prisma: string;
  id_logger?: string;
  nama_prisma: string;
  status_controller?: string;
  target_height: string | number;
  HA: string;
  VA: string;
  SlopDis?: string;
  registered: boolean;
}

interface ApiResponse {
  success: boolean;
  data: PrismaSlot[];
  id_logger?: string;
  error?: string;
}

// =================== MODAL SET/EDIT ===================
function PrismaModal({
  mode,
  slot,
  site,
  onClose,
  onSuccess,
}: {
  mode: "set" | "edit";
  slot: PrismaSlot;
  /** Slot prisma hanya unik bersama site — lihat catatan di t_prisma.site. */
  site: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [namaPrisma, setNamaPrisma] = useState(
    slot.registered ? slot.nama_prisma : ""
  );
  const [targetHeight, setTargetHeight] = useState(
    slot.registered ? String(slot.target_height) : "0"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Status tracking per-button. "failed" wajib ada sebagai keadaan tersendiri:
  // Auto Search yang membalas 0 berarti prisma TIDAK KETEMU — itu jawaban
  // akhir, bukan "belum selesai". Tanpa keadaan ini statusnya diam di
  // "waiting" selamanya dan operator menunggu sesuatu yang tidak akan datang.
  type StatusPerintah = "idle" | "waiting" | "done" | "failed";
  const [goTargetStatus, setGoTargetStatus] = useState<StatusPerintah>("idle");
  const [autoSearchStatus, setAutoSearchStatus] = useState<StatusPerintah>("idle");

  // Rentang sapuan. Nilai awal disamakan dengan yang dipasang PowerOn
  // (7° × 7°) supaya kolomnya menunjukkan keadaan sebenarnya di instrumen,
  // bukan angka karangan yang belum pernah dikirim.
  const [saHor, setSaHor] = useState(String(RENTANG_SETELAH_POWERON_DERAJAT));
  const [saVer, setSaVer] = useState(String(RENTANG_SETELAH_POWERON_DERAJAT));
  const [saLoading, setSaLoading] = useState(false);
  const [searchArea, setSearchArea] = useState<BalasanSearchArea | null>(null);

  // Diturunkan, bukan disimpan sebagai state.
  //
  // Versi lama menyimpannya di useState dan effect-nya HANYA pernah menyetel
  // true — pengembalian ke false diurus manual di tiap handler, gampang
  // terlewat. Diturunkan begini, nilainya tidak bisa lagi tertinggal.
  //
  // Go To Target hanya dirender di mode "edit" (lihat JSX di bawah), jadi di
  // mode "set" goTargetStatus selamanya "idle". Syarat lama menuntut keduanya
  // "done", sehingga Simpan TIDAK PERNAH bisa aktif saat mendaftarkan prisma
  // baru — modalnya mustahil diselesaikan.
  const simpanEnabled =
    autoSearchStatus === "done" && (mode === "set" || goTargetStatus === "done");

  // Batas menunggu balasan, diturunkan dari tabel durasi maksimum di protokol
  // (Bagian A): auto_search 30 detik, turning_target 20 detik. Diberi margin
  // karena firmware menjaga koneksi tetap hidup selama menunggu dan balasannya
  // "bisa datang terlambat beberapa detik" — dokumennya melarang timeout sisi
  // server yang lebih ketat dari durasi operasinya.
  //
  // Tanpa batas ini, satu balasan yang hilang membuat modal menunggu selamanya:
  // tombolnya terkunci di "waiting" dan Simpan tidak akan pernah aktif.
  useEffect(() => {
    if (autoSearchStatus !== "waiting") return;
    const timer = setTimeout(() => {
      setAutoSearchStatus("failed");
      setError("Auto Search tidak menjawab dalam 45 detik. Periksa koneksi logger, lalu coba lagi.");
      setLoading(false);
    }, 45_000);
    return () => clearTimeout(timer);
  }, [autoSearchStatus]);

  useEffect(() => {
    if (goTargetStatus !== "waiting") return;
    const timer = setTimeout(() => {
      setGoTargetStatus("failed");
      setError("Go To Target tidak menjawab dalam 35 detik. Periksa koneksi logger, lalu coba lagi.");
      setLoading(false);
    }, 35_000);
    return () => clearTimeout(timer);
  }, [goTargetStatus]);

  // MQTT client ref
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  // Connect MQTT WebSocket saat modal dibuka (seperti PHP document.ready)
  useEffect(() => {
    const broker = process.env.NEXT_PUBLIC_MQTT_HOST || "mqtt.beacontelemetry.com";
    const wsPort = process.env.NEXT_PUBLIC_MQTT_WS_PORT || "8083";
    const topic = process.env.NEXT_PUBLIC_MQTT_TOPIC || "ADR_Tambang_Kaltara";
    const wsUrl = `wss://${broker}:${wsPort}/mqtt`;

    const client = mqtt.connect(wsUrl, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "userlog",
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: false,
      connectTimeout: 10000,
    });

    mqttClientRef.current = client;

    client.on("connect", () => {
      console.log("[PrismaModal] MQTT connected via WebSocket");
      client.subscribe(topic, { qos: 0 });
    });

    client.on("message", (_t: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. recordTarget dari logger → simpan HA/VA (seperti PHP prism_set)
        if (data.recordTarget && data.recordTarget.HA && data.recordTarget.VA) {
          const rt = data.recordTarget;
          console.log("[PrismaModal] recordTarget:", rt.TargetName, rt.HA, rt.VA);

          // Panggil API prism-set untuk simpan HA/VA ke DB
          fetch("/api/prism-config/prism-set", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nama_prisma: rt.TargetName,
              HA: rt.HA,
              VA: rt.VA,
              site,
            }),
          }).then(() => {
            // Reload data setelah simpan
            onSuccess();
          }).catch((err) => {
            console.error("[PrismaModal] prism-set error:", err);
          });
        }

        // 2. AutoSearch response → 1 = ketemu, 0 = prisma tidak ketemu
        //    Diterima pipih {"AutoSearch":1} maupun bersarang
        //    {"AutoSearch":{"value":1}}; lihat nilaiBalasanLogger().
        if (data.AutoSearch !== undefined) {
          const nilai = nilaiBalasanLogger(data.AutoSearch);
          console.log("[PrismaModal] AutoSearch response:", data.AutoSearch, "→", nilai);
          if (balasanSelesai(nilai)) {
            setAutoSearchStatus("done");
            setLoading(false);
          } else if (balasanGagal(nilai)) {
            setAutoSearchStatus("failed");
            setError("Auto Search gagal: prisma tidak ditemukan. Periksa arah teleskop dan halangan di lintasan, lalu coba lagi.");
            setLoading(false);
          }
          // Nilai lain sengaja dibiarkan "waiting": bentuk balasan yang belum
          // dikenal tidak boleh divonis gagal maupun sukses.
        }

        // {"SearchArea":{"horizontal":15,"vertical":15}}
        // Perhatikan namanya: balasan memakai horizontal/vertical, sedangkan
        // permintaannya Hor/Ver.
        const bSA = bacaBalasanSearchArea(data.SearchArea);
        if (bSA.ada) {
          console.log("[PrismaModal] SearchArea:", bSA.horizontal, bSA.vertical);
          setSearchArea(bSA);
          setSaLoading(false);
        }

        // 3. Balasan turning_target — bernama `TurningTarget` (PascalCase).
        //
        //    Revisi protokol sebelumnya menulis nama balasannya huruf kecil;
        //    itu KELIRU dan sudah diralat. PascalCase didahulukan sekarang,
        //    huruf kecil tetap dibaca karena tidak ada ruginya.
        //
        //    Balasannya bertahap:
        //      {"value":"start","target":3}   {"value":"rotate","target":3}
        //      {"value":1}   ← angka, dipertahankan demi kompatibilitas
        //      {"value":"done"}
        //      {"value":"bad target","target":99}   ← DITOLAK, di luar 1–50
        //
        //    Sebelumnya hanya pesan angka yang dikenali, jadi Go To Target
        //    bergantung pada bentuk lama yang sewaktu-waktu bisa dilepas. Dan
        //    `bad target` tidak dikenali sama sekali: nomor di luar rentang
        //    tidak mengerjakan apa pun, tapi balasannya tetap membawa status
        //    rotasi SEBELUMNYA sehingga terlihat berhasil.
        const paketTurning = data.TurningTarget ?? data.turning_target;
        const kelasTurning = klasifikasiTurningTarget(paketTurning);
        if (kelasTurning !== "bukan") {
          console.log("[PrismaModal] TurningTarget:", paketTurning, "→", kelasTurning);
          if (kelasTurning === "selesai") {
            setGoTargetStatus("done");
            setLoading(false);
          } else if (kelasTurning === "gagal") {
            setGoTargetStatus("failed");
            const nilai = String(paketTurning?.value ?? "");
            setError(
              nilai === "bad target"
                ? "Go To Target ditolak: nomor target di luar rentang 1–50 yang dikenal perangkat."
                : "Go To Target gagal: teleskop tidak sampai ke posisi target. Coba ulangi."
            );
            setLoading(false);
          }
          // "kemajuan" (start/rotate) dibiarkan menunggu.
        }
      } catch {
        // Ignore non-JSON
      }
    });

    client.on("error", (err: Error) => {
      console.error("[PrismaModal] MQTT error:", err);
    });

    // Cleanup saat modal ditutup
    return () => {
      if (client) {
        client.end(true);
        mqttClientRef.current = null;
      }
    };
    // `site` ikut jadi dependency: handler MQTT mengirimnya ke prism-set,
    // jadi handler lama akan menyimpan HA/VA ke site yang sudah tidak dipilih.
  }, [onSuccess, site]);

  const doRequest = async (method: string, body: object) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prism-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSearchArea = async () => {
    setSaLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kontrol/search-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, hor: Number(saHor), ver: Number(saVer) }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Gagal mengirim rentang sapuan");
        setSaLoading(false);
      }
      // Konfirmasinya datang lewat MQTT: {"SearchArea":{"horizontal":…,"vertical":…}}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setSaLoading(false);
    }
  };

  const handleAutoSearch = async () => {
    setLoading(true);
    setError("");
    setAutoSearchStatus("waiting");
    try {
      const res = await fetch("/api/kontrol/auto-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.slot, site }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal Auto Search");
      // Menunggu nilai 1 dari MQTT
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setAutoSearchStatus("idle");
      setLoading(false);
    }
  };

  const handleGoToTarget = async () => {
    setLoading(true);
    setError("");
    setGoTargetStatus("waiting");
    // Hasil Auto Search sebelumnya ikut dibatalkan: teleskop akan berpindah,
    // jadi pencarian yang lama tidak lagi menggambarkan posisi sekarang.
    // Tanpa ini Simpan tetap aktif memakai hasil pencarian yang basi.
    setAutoSearchStatus("idle");
    try {
      // `site` wajib dikirim walau endpoint-nya menerima tanpa itu: slot "P1"
      // ada di beberapa site dan menunjuk target fisik berbeda, jadi tanpa site
      // teleskop bisa diputar ke target site lain.
      const res = await fetch("/api/kontrol/go-to-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.slot, site }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal Go To Target");
      // Menunggu nilai 1 dari MQTT
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setGoTargetStatus("idle");
      setLoading(false);
    }
  };

  const handleSimpan = async () => {
    if (!namaPrisma.trim()) {
      setError("Nama Prisma wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prism-config", {
        method: mode === "set" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: slot.slot,
          nama_prisma: namaPrisma,
          target_height: targetHeight,
          site,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      // Jangan close modal — tunggu browser MQTT tangkap recordTarget response
      // Browser MQTT handler akan panggil prism-set → onSuccess()
      console.log("Menunggu feedback MQTT…");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[360px] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="font-bold text-gray-900 text-[16px]">
            {mode === "set" ? "Set Prisma" : "Edit Prisma"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Nama Prisma */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-gray-600">Nama Prisma</label>
            <Input
              value={namaPrisma}
              onChange={(e) => setNamaPrisma(e.target.value)}
              placeholder="cth: P1"
              className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481]"
              autoFocus
            />
          </div>

          {/* Target Height */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-gray-600">Target Height</label>
            <Input
              type="number"
              value={targetHeight}
              onChange={(e) => setTargetHeight(e.target.value)}
              placeholder="0"
              className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481]"
            />
          </div>

          {/* Go To Target — hanya di Edit */}
          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoToTarget}
                disabled={goTargetStatus === "waiting" || goTargetStatus === "done"}
                className="flex-shrink-0 h-[40px] px-4 rounded-lg bg-[#E86A1F] hover:bg-[#c55a18] text-white text-[13.5px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 border-none"
              >
                {goTargetStatus === "waiting"
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <SlidersHorizontal className="w-4 h-4" />}
                Go To Target
              </button>
              {goTargetStatus === "waiting" && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-gray-500 font-medium">
                  <span className="text-gray-400 font-semibold">Status:</span>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                  Waiting...
                </span>
              )}
              {goTargetStatus === "done" && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-green-600 font-semibold">
                  <span className="text-gray-400 font-semibold">Status:</span>
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  Target reached
                </span>
              )}
              {goTargetStatus === "failed" && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-red-600 font-semibold">
                  <span className="text-gray-400 font-semibold">Status:</span>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Gagal — coba lagi
                </span>
              )}
            </div>
          )}

          {/* Rentang sapuan — SENGAJA di sini, tepat sebelum Auto Search.
              PowerOn menimpa SearchArea tersimpan dengan 7° yang ter-hardcode,
              dan `auto_search` yang dikirim sendirian memakai apa pun yang
              sedang ada di instrumen. Jadi rentang ini harus dikirim ULANG
              menjelang pencarian, bukan sekali saat menyimpan konfigurasi. */}
          <div className="rounded-lg border border-[#EAEAEA] px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-gray-600">Rentang sapuan</p>
              {searchArea && (
                <span className="text-[11.5px] font-semibold text-emerald-700">
                  Perangkat: {searchArea.horizontal}° × {searchArea.vertical}°
                </span>
              )}
            </div>

            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-gray-500">Horizontal (°)</label>
                <Input
                  type="number"
                  value={saHor}
                  onChange={(e) => setSaHor(e.target.value)}
                  className="h-[34px] text-[12.5px] border-gray-300 focus-visible:ring-[#303481]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-gray-500">Vertikal (°)</label>
                <Input
                  type="number"
                  value={saVer}
                  onChange={(e) => setSaVer(e.target.value)}
                  className="h-[34px] text-[12.5px] border-gray-300 focus-visible:ring-[#303481]"
                />
              </div>
              <button
                onClick={handleSearchArea}
                disabled={saLoading}
                className="h-[34px] flex-shrink-0 rounded-md border border-[#303481] px-3.5 text-[12px] font-bold text-[#303481] transition-colors hover:bg-[#303481] hover:text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kirim"}
              </button>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Setelah PowerOn, instrumen selalu kembali ke{" "}
              {RENTANG_SETELAH_POWERON_DERAJAT}° × {RENTANG_SETELAH_POWERON_DERAJAT}°.
              Kirim rentang ini dulu kalau ukurannya penting untuk pencarian berikutnya.
            </p>
          </div>

          {/* Auto Search */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoSearch}
              disabled={autoSearchStatus === "waiting" || autoSearchStatus === "done" || (mode === "edit" && goTargetStatus !== "done")}
              className="flex-shrink-0 h-[40px] px-4 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-[13.5px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 border-none"
            >
              {autoSearchStatus === "waiting"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
              Auto Search
            </button>
            {autoSearchStatus === "waiting" && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-gray-500 font-medium">
                <span className="text-gray-400 font-semibold">Status:</span>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                Waiting...
              </span>
            )}
            {autoSearchStatus === "done" && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-green-600 font-semibold">
                <span className="text-gray-400 font-semibold">Status:</span>
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                Auto search complete
              </span>
            )}
            {autoSearchStatus === "failed" && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-red-600 font-semibold">
                <span className="text-gray-400 font-semibold">Status:</span>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Prisma tidak ditemukan
              </span>
            )}
          </div>
        </div>

        {/* Footer — Simpan */}
        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={handleSimpan}
            disabled={!simpanEnabled || loading}
            className={`h-[38px] px-7 rounded-lg text-[13px] font-semibold transition-colors border-none ${
              simpanEnabled
                ? "bg-[#303481] hover:bg-[#1f2259] text-white cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}


// =================== MODAL HAPUS ===================
/**
 * Konfirmasi hapus prisma yang sudah dikonfigurasi.
 *
 * Penghapusannya menyentuh tiga tabel sekaligus (t_prisma, temp_prisma,
 * parameter_prisma) dan tidak bisa dibatalkan, jadi slot + nama + site
 * ditampilkan apa adanya supaya operator bisa mencocokkan sebelum menekan
 * Hapus — di halaman ini "P1" saja tidak cukup untuk mengenali target.
 */
function HapusPrismaModal({
  slot,
  site,
  onClose,
  onSuccess,
}: {
  slot: PrismaSlot;
  site: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleHapus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prism-config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.slot, site }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus prisma");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[400px] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="font-bold text-gray-900 text-[16px]">Hapus Prisma</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 cursor-pointer disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3.5 py-3">
            <span className="inline-block bg-[#3B82F6] text-white px-2.5 py-[3px] rounded text-[11px] font-bold tracking-wider">
              {slot.id_prisma}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gray-800">
                {slot.nama_prisma}
              </p>
              <p className="text-[11.5px] text-gray-500">site {site}</p>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-gray-600">
            Data prisma ini akan dihapus dari daftar slot beserta pembacaan
            sementara dan parameter grafiknya. Tindakan ini tidak bisa dibatalkan.
          </p>

          {/* Perangkat tidak ikut dibersihkan: endpoint DELETE hanya menghapus
              baris di database, tidak mengirim perintah MQTT apa pun. Slot yang
              sama masih tersimpan di RTS sampai ditimpa lewat Set/Edit. */}
          <div className="flex gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
            <AlertCircle className="mt-[1px] h-4 w-4 flex-shrink-0" />
            <span>
              Hanya data di aplikasi yang dihapus. Slot {slot.slot} di RTS tidak
              ikut dikosongkan dan masih menyimpan target lama sampai ditimpa
              lewat Set.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-[38px] px-5 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
          <button
            onClick={handleHapus}
            disabled={loading}
            className="h-[38px] px-7 rounded-lg text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}


// =================== MODAL AKSES KODE ===================
function AccessCodeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kontrol/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Kode Akses Salah");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[16px] shadow-2xl w-full max-w-[450px] mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-[20px] font-bold text-black font-sans tracking-tight">Masukkan Kode Akses</h2>
          <button onClick={onClose} className="text-black hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none mt-0.5">
            <X className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>
        </div>
        
        <p className="text-[14px] text-[#1c1c1c] font-sans mb-5 font-medium leading-relaxed">
          Masukkan kode akses untuk memulai konfigurasi
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5 text-[13px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col mb-8">
          <label className="text-[14px] font-bold text-black mb-2.5">Kode Akses</label>
          <div className="relative">
            <Lock className="w-[18px] h-[18px] text-black absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
            <Input
              type={showPassword ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pl-[42px] pr-[42px] h-[48px] text-[20px] tracking-[4px] font-bold text-black border-[#C0C4DF] rounded-[10px] bg-white focus-visible:ring-1 focus-visible:ring-[#303481]"
              autoComplete="new-password"
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:opacity-70 cursor-pointer bg-transparent border-none"
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2.5} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-[20px] mt-2">
          <button
            onClick={onClose}
            className="w-[120px] h-[42px] border border-[#303481] rounded-lg text-[14.5px] font-semibold text-[#303481] hover:bg-[#F8F9FC] transition-colors cursor-pointer bg-white"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className="w-[120px] h-[42px] bg-[#303481] hover:bg-[#20235a] text-white rounded-lg text-[14.5px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer border-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim"}
          </button>
        </div>

      </div>
    </div>
  );
}

// =================== MAIN PAGE ===================
const PAGE_SIZE = 10;

export default function PrismConfigPage() {
  const { isConnected } = useRtsConnectionStatus();
  // withLogger=true supaya `nama_lokasi` ikut terbawa untuk judul pos RTS.
  const { sites: siteList, namaPos } = useSites(false, true);

  // Slot prisma (P1, P2, …) dipakai ulang di tiap site dan menunjuk target
  // fisik yang berbeda, jadi halaman ini harus selalu terikat ke satu site.
  // Nilai efektifnya diturunkan, bukan disinkronkan lewat effect: sebelum
  // daftar site termuat, `site` berisi "" dan fetch-nya memang ditunda.
  const [sitePilihan, setSitePilihan] = useState("");
  const site = sitePilihan || siteList[0]?.slug || "";
  const setSite = setSitePilihan;

  const [searchTerm, setSearchTerm] = useState("");
  const [allData, setAllData] = useState<PrismaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "set" | "edit";
    slot: PrismaSlot | null;
  }>({ open: false, mode: "set", slot: null });
  const [hapusSlot, setHapusSlot] = useState<PrismaSlot | null>(null);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  // ── Fetch data dari /api/prism-config ──
  const fetchData = useCallback(async () => {
    if (!site) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/prism-config?site=${encodeURIComponent(site)}`);
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengambil data");
      setAllData(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ganti site → kembali ke halaman 1, karena daftar slotnya berbeda.
  useEffect(() => {
    setCurrentPage(1);
  }, [site]);

  // ── Filter berdasarkan search ──
  const filtered = allData.filter((row) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      row.id_prisma.toLowerCase().includes(q) ||
      row.nama_prisma.toLowerCase().includes(q)
    );
  });

  // ── Pagination ──
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const registeredCount = allData.filter((d) => d.registered).length;

  const handleModalSuccess = () => {
    setModal({ open: false, mode: "set", slot: null });
    fetchData();
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">

      {/* Sub Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-gray-200 bg-[#E5E5E5] flex items-center justify-center shadow-inner relative">
            {isConnected && <div className="absolute w-3.5 h-3.5 rounded-full bg-green-400/80 animate-ping" />}
            <div className={cn("w-3.5 h-3.5 rounded-full relative z-10", isConnected ? "bg-[#06C022]" : "bg-gray-800")} />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">{namaPos(site)}</h2>
            <RtsConnectionBadge />
          </div>
        </div>
        {isConfigUnlocked ? (
          <Button 
            onClick={() => setIsConfigUnlocked(false)}
            className="group bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-5 py-5 rounded-lg shadow-sm hover:shadow-md active:scale-95 hover:-translate-y-0.5 font-bold text-[13.5px] transition-all duration-200 flex items-center gap-2.5 cursor-pointer"
          >
            <Lock className="w-4 h-4 group-hover:-translate-y-[1px] transition-transform duration-200" strokeWidth={2.5} />
            Selesai Konfigurasi
          </Button>
        ) : (
          <Button 
            onClick={() => setAccessModalOpen(true)}
            className="group bg-[#303481] hover:bg-[#1f2259] text-white px-5 py-5 rounded-lg shadow-sm hover:shadow-md active:scale-95 hover:-translate-y-0.5 font-medium text-[13.5px] transition-all duration-200 border-none flex items-center gap-2.5 cursor-pointer"
          >
            <Image src="/mulai_konfigurasi.svg" alt="Mulai Konfigurasi" width={18} height={18} className="group-hover:rotate-12 transition-transform duration-300" />
            Mulai Konfigurasi
          </Button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col w-full text-slate-800">

        {/* Card Header */}
        <div className="p-5 px-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 text-[15px]">Daftar Prisma</h3>
            {!loading && (
              <span className="text-[12px] text-gray-400 font-medium">
                ({registeredCount} terdaftar dari 50 slot)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Slot P1 di site berbeda adalah target fisik berbeda, jadi daftar
                ini selalu terikat ke satu site. */}
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="h-[38px] cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-[13px] font-semibold text-gray-700 outline-none focus:border-[#303481]"
              title="Site"
            >
              {siteList.map((s) => (
                <option key={s.slug} value={s.slug}>{s.nama}</option>
              ))}
            </select>
            <div className="relative w-[320px] group text-gray-400 focus-within:text-[#303481] transition-colors duration-300">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300" />
              <Input
                type="text"
                placeholder="Cari nama/ID prisma..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                autoComplete="off"
                className="pl-9 pr-4 h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-lg bg-white transition-shadow duration-300"
              />
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 mx-6 mt-4 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-[13px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={fetchData} className="ml-auto text-[#303481] font-bold hover:underline cursor-pointer bg-transparent border-none">
              Coba Lagi
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 border-b border-gray-100">
              <tr>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide w-[70px]">No</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">ID Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Nama Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Horizontal Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Vertical Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Target Height</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 className="w-7 h-7 animate-spin text-[#303481]" />
                      <span className="text-[13px] font-medium">Memuat data prisma...</span>
                    </div>
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 text-[13px]">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              ) : (
                pageData.map((row, idx) => {
                  const isNotSet = !row.registered;
                  const globalIdx = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr
                      key={row.id_prisma}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center text-[13px] text-gray-500 font-medium">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-[#3B82F6] text-white px-2.5 py-[3px] rounded text-[11px] font-bold tracking-wider">
                          {row.id_prisma}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400 italic" : "text-gray-800"}`}>
                        {isNotSet ? "Not Set" : row.nama_prisma}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.HA || "-")}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.VA || "-")}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.target_height ?? "-")}
                      </td>
                      <td className="py-3.5 px-4 flex justify-center items-center gap-2">
                        {!isNotSet ? (
                          <>
                            <button
                              onClick={() => setModal({ open: true, mode: "edit", slot: row })}
                              disabled={!isConfigUnlocked}
                              className={`group flex items-center gap-1.5 px-4 py-1.5 border rounded-md text-[12px] font-bold active:scale-90 transition-all duration-200 ${
                                !isConfigUnlocked
                                  ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                                  : "border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white hover:shadow-sm cursor-pointer"
                              }`}
                            >
                              <Pencil className="w-[12px] h-[12px] group-hover:-translate-y-[1px] transition-transform duration-200" strokeWidth={2.5} />
                              Edit
                            </button>
                            {/* Dikunci oleh kode akses yang sama dengan Edit:
                                menghapus konfigurasi lebih merusak daripada
                                mengubahnya, jadi tidak boleh lebih longgar. */}
                            <button
                              onClick={() => setHapusSlot(row)}
                              disabled={!isConfigUnlocked}
                              title={isConfigUnlocked ? `Hapus ${row.id_prisma}` : "Buka kunci konfigurasi dulu"}
                              aria-label={`Hapus ${row.id_prisma}`}
                              className={`group flex items-center justify-center px-2.5 py-1.5 border rounded-md active:scale-90 transition-all duration-200 ${
                                !isConfigUnlocked
                                  ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                                  : "border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-sm cursor-pointer"
                              }`}
                            >
                              <Trash2 className="w-[13px] h-[13px] group-hover:-translate-y-[1px] transition-transform duration-200" strokeWidth={2.5} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setModal({ open: true, mode: "set", slot: row })}
                            disabled={!isConfigUnlocked}
                            className={`group flex items-center gap-1 px-4 py-1.5 border rounded-md text-[12px] font-bold active:scale-90 transition-all duration-200 ${
                              !isConfigUnlocked
                                ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                                : "border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white hover:shadow-sm cursor-pointer"
                            }`}
                          >
                            <Plus className="w-[12px] h-[12px] group-hover:rotate-90 transition-transform duration-200" strokeWidth={3} />
                            Set
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-between bg-gray-100 text-slate-800">
          <p className="text-[12.5px] text-gray-500 font-medium tracking-tight">
            {loading
              ? "Memuat..."
              : `Menampilkan ${filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} - ${Math.min(currentPage * PAGE_SIZE, filtered.length)} dari ${filtered.length} data`}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setCurrentPage(1); setSearchTerm(""); }}
              className="text-[12.5px] font-bold text-[#303481] hover:underline cursor-pointer transition-colors bg-transparent border-none"
            >
              Lihat Semua
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-[12.5px] font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? "bg-[#303481] text-white border-none"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Set / Edit Prisma */}
      {modal.open && modal.slot && (
        <PrismaModal
          mode={modal.mode}
          slot={modal.slot}
          site={site}
          onClose={() => setModal({ open: false, mode: "set", slot: null })}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Modal Hapus Prisma */}
      {hapusSlot && (
        <HapusPrismaModal
          slot={hapusSlot}
          site={site}
          onClose={() => setHapusSlot(null)}
          onSuccess={() => {
            setHapusSlot(null);
            fetchData();
          }}
        />
      )}

      {/* Modal Kode Akses */}
      {accessModalOpen && (
        <AccessCodeModal 
          onClose={() => setAccessModalOpen(false)}
          onSuccess={() => {
            setAccessModalOpen(false);
            setIsConfigUnlocked(true);
          }}
        />
      )}
    </div>
  );
}
