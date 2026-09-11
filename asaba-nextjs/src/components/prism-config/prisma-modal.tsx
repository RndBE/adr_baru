"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Crosshair, Gauge, Loader2, Search, Target } from "lucide-react";
import mqtt from "mqtt";
import { cn } from "@/lib/utils";
import { nilaiBalasanLogger, balasanSelesai, balasanGagal } from "@/lib/balasan-logger";
import {
  bacaManualHaVa,
  klasifikasiTurningTarget,
} from "@/lib/protokol-rts";
import {
  INPUT,
  LABEL,
  ModalError,
  ModalShell,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import type { PrismaSlot } from "./types";
import { topikBalasan } from "@/lib/mqtt";

/**
 * Status satu perintah ke perangkat.
 *
 * "failed" WAJIB ada sebagai keadaan tersendiri: Auto Search yang membalas 0
 * berarti prisma TIDAK KETEMU — itu jawaban akhir, bukan "belum selesai".
 * Tanpa keadaan ini statusnya diam di "waiting" selamanya dan operator
 * menunggu sesuatu yang tidak akan datang.
 */
type StatusPerintah = "idle" | "waiting" | "done" | "failed";

/** Satu langkah prosedur, ditampilkan sebagai baris bernomor. */
function Langkah({
  nomor,
  judul,
  status,
  children,
  nonaktif,
  alasanNonaktif,
}: {
  nomor: number;
  judul: string;
  status?: StatusPerintah;
  children: React.ReactNode;
  nonaktif?: boolean;
  alasanNonaktif?: string;
}) {
  const selesai = status === "done";
  return (
    <li
      className={cn(
        "grid grid-cols-[26px_minmax(0,1fr)] gap-x-3 transition-opacity",
        nonaktif && "opacity-45"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-[26px] items-center justify-center rounded-full font-mono text-[11.5px] font-semibold tabular-nums",
          selesai
            ? "bg-(--st-normal) text-white"
            : "bg-(--paper) text-(--ink-2) ring-1 ring-(--line)"
        )}
      >
        {nomor}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-(--ink)">{judul}</p>
        {nonaktif && alasanNonaktif && (
          <p className="mt-0.5 text-[11.5px] text-(--ink-3)">{alasanNonaktif}</p>
        )}
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

/** Status perintah sebagai titik + teks — tidak pernah warna saja. */
function StatusPerintahChip({
  status,
  teksMenunggu,
  teksSelesai,
  teksGagal,
}: {
  status: StatusPerintah;
  teksMenunggu: string;
  teksSelesai: string;
  teksGagal: string;
}) {
  if (status === "idle") return null;
  if (status === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-(--ink-2)">
        <Loader2 className="size-3.5 animate-spin" />
        {teksMenunggu}
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-(--ink)">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: "var(--st-normal)" }}
        />
        {teksSelesai}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-(--ink)">
      <AlertCircle className="size-3.5 text-(--st-awas)" />
      {teksGagal}
    </span>
  );
}

/**
 * Mendaftarkan atau mengubah satu slot target.
 *
 * Isinya adalah PROSEDUR, bukan sekadar formulir: teleskop harus diarahkan ke
 * target, prismanya dicari, baru konfigurasinya disimpan. Karena itu langkahnya
 * dinomori dan tombol Simpan baru aktif setelah perangkat menjawab — urutan ini
 * bukan hiasan, melainkan syarat yang memang ditegakkan kodenya.
 */
export function PrismaModal({
  mode,
  slot,
  site,
  idLogger,
  onClose,
  onSuccess,
}: {
  mode: "set" | "edit";
  slot: PrismaSlot;
  /** Slot prisma hanya unik bersama site — lihat catatan di t_prisma.site. */
  site: string;
  /**
   * ID alat penerima perintah. Menentukan topiknya: balasan logger keluar di
   * `pub_<idAlat>`, bukan lagi di satu topik bersama. Tanpa ini tidak ada
   * topik yang bisa didengarkan, jadi sambungan MQTT-nya tidak dibuka.
   */
  idLogger: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [namaPrisma, setNamaPrisma] = useState(slot.registered ? slot.nama_prisma : "");
  const [targetHeight, setTargetHeight] = useState(
    slot.registered ? String(slot.target_height) : "0"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [goTargetStatus, setGoTargetStatus] = useState<StatusPerintah>("idle");
  const [autoSearchStatus, setAutoSearchStatus] = useState<StatusPerintah>("idle");

  /**
   * Jalur MANUAL: operator membidik sendiri di lapangan, lalu menekan tombol ini
   * untuk membaca sudut teleskop sekarang.
   *
   * Ada karena RTS ini sering gagal mengunci prisma yang jauh dengan Auto
   * Search. Perlu ditegaskan: `manual_hava` TIDAK mengarahkan apa pun, ia hanya
   * membaca. Yang merekam target tetap `recordTarget` saat Simpan, dan perintah
   * itu merekam ke mana pun teleskop sedang menghadap. Jadi tombol ini bukan
   * pengganti pembidikan — ia buktinya bahwa instrumen menjawab dan teleskopnya
   * memang sedang mengarah ke sesuatu.
   */
  const [manualStatus, setManualStatus] = useState<StatusPerintah>("idle");
  const [manualHaVa, setManualHaVa] = useState<{ HA: string; VA: string } | null>(null);

  /**
   * Backsight atau foresight. Bawaannya "fs" — hampir semua prisma titik
   * pantau; backsight biasanya hanya satu atau dua per site.
   */
  const [jenis, setJenis] = useState<"bs" | "fs">(
    slot.jenis === "bs" ? "bs" : "fs"
  );

  // Diturunkan, bukan disimpan sebagai state.
  //
  // Versi lama menyimpannya di useState dan effect-nya HANYA pernah menyetel
  // true — pengembalian ke false diurus manual di tiap handler, gampang
  // terlewat. Diturunkan begini, nilainya tidak bisa lagi tertinggal.
  //
  // Go To Target hanya dirender di mode "edit", jadi di mode "set"
  // goTargetStatus selamanya "idle". Syarat lama menuntut keduanya "done",
  // sehingga Simpan TIDAK PERNAH bisa aktif saat mendaftarkan prisma baru —
  // modalnya mustahil diselesaikan.
  // Salah satu dari dua jalur cukup: Auto Search yang mengunci prismanya, atau
  // pembacaan manual yang membuktikan instrumen menjawab. Keduanya sama-sama
  // berakhir dengan teleskop mengarah ke target, dan itulah yang direkam.
  const targetSiap = autoSearchStatus === "done" || manualStatus === "done";
  const simpanEnabled = targetSiap && (mode === "set" || goTargetStatus === "done");

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
      setError(
        "Auto Search tidak menjawab dalam 45 detik. Periksa koneksi logger, lalu coba lagi."
      );
      setLoading(false);
    }, 45_000);
    return () => clearTimeout(timer);
  }, [autoSearchStatus]);

  // 5 detik menurut tabel durasi protokol (Bagian A) untuk `manual_hava`,
  // diberi margin. Perintah ini tidak menggerakkan instrumen, jadi diamnya
  // berarti tidak sampai — bukan sedang bekerja.
  useEffect(() => {
    if (manualStatus !== "waiting") return;
    const timer = setTimeout(() => {
      setManualStatus("failed");
      setError("Instrumen tidak menjawab dalam 12 detik. Periksa koneksi logger, lalu coba lagi.");
      setLoading(false);
    }, 12_000);
    return () => clearTimeout(timer);
  }, [manualStatus]);

  useEffect(() => {
    if (goTargetStatus !== "waiting") return;
    const timer = setTimeout(() => {
      setGoTargetStatus("failed");
      setError(
        "Go To Target tidak menjawab dalam 35 detik. Periksa koneksi logger, lalu coba lagi."
      );
      setLoading(false);
    }, 35_000);
    return () => clearTimeout(timer);
  }, [goTargetStatus]);

  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  // Sambungan MQTT lewat WebSocket dibuka selama modal terbuka: balasan
  // perangkat datang di topic, bukan sebagai respons HTTP.
  useEffect(() => {
    if (!idLogger) return;
    const broker = process.env.NEXT_PUBLIC_MQTT_HOST || "mqtt.beacontelemetry.com";
    const wsPort = process.env.NEXT_PUBLIC_MQTT_WS_PORT || "8083";
    const topic = topikBalasan(idLogger);
    const wsUrl = `wss://${broker}:${wsPort}/mqtt`;

    const client = mqtt.connect(wsUrl, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "userlog",
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: false,
      connectTimeout: 10000,
    });

    mqttClientRef.current = client;

    client.on("connect", () => {
      client.subscribe(topic, { qos: 0 });
    });

    client.on("message", (_t: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. recordTarget dari logger → simpan HA/VA (seperti PHP prism_set)
        if (data.recordTarget && data.recordTarget.HA && data.recordTarget.VA) {
          const rt = data.recordTarget;
          fetch("/api/prism-config/prism-set", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nama_prisma: rt.TargetName,
              HA: rt.HA,
              VA: rt.VA,
              site,
            }),
          })
            .then(() => {
              onSuccess();
            })
            .catch((err) => {
              console.error("[PrismaModal] prism-set error:", err);
            });
        }

        // 2. AutoSearch response → 1 = ketemu, 0 = prisma tidak ketemu
        //    Diterima pipih {"AutoSearch":1} maupun bersarang
        //    {"AutoSearch":{"value":1}}; lihat nilaiBalasanLogger().
        if (data.AutoSearch !== undefined) {
          const nilai = nilaiBalasanLogger(data.AutoSearch);
          if (balasanSelesai(nilai)) {
            setAutoSearchStatus("done");
            setLoading(false);
          } else if (balasanGagal(nilai)) {
            setAutoSearchStatus("failed");
            setError(
              "Auto Search gagal: prisma tidak ditemukan. Periksa arah teleskop dan halangan di lintasan, lalu coba lagi."
            );
            setLoading(false);
          }
          // Nilai lain sengaja dibiarkan "waiting": bentuk balasan yang belum
          // dikenal tidak boleh divonis gagal maupun sukses.
        }

        // 2b. Balasan manual_hava — bernama `ManualHAVA`.
        //
        //     Sudutnya ditampilkan APA ADANYA. Dokumen protokol menyebut
        //     `manual_hava` termasuk yang kena bug sudut: firmware memotong
        //     desimal derajat seolah menit dan detik, jadi nilai seperti
        //     "151,38,71" (detik 71) memang yang dikirim alat. Mengonversinya
        //     hanya akan menghasilkan angka yang salah dengan cara berbeda.
        const bHaVa = bacaManualHaVa(data.ManualHAVA);
        if (bHaVa.ada) {
          if (bHaVa.gagal) {
            setManualStatus("failed");
            setError(
              "Instrumen membalas tanpa sudut yang sah. Pastikan RTS menyala dan teleskopnya sudah diarahkan."
            );
          } else {
            setManualHaVa({ HA: bHaVa.HA, VA: bHaVa.VA });
            setManualStatus("done");
          }
          setLoading(false);
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
        // Abaikan pesan non-JSON di topic yang sama.
      }
    });

    client.on("error", (err: Error) => {
      console.error("[PrismaModal] MQTT error:", err);
    });

    return () => {
      if (client) {
        client.end(true);
        mqttClientRef.current = null;
      }
    };
    // `site` ikut jadi dependency: handler MQTT mengirimnya ke prism-set,
    // jadi handler lama akan menyimpan HA/VA ke site yang sudah tidak dipilih.
  }, [onSuccess, site, idLogger]);

  const handleAutoSearch = async () => {
    setLoading(true);
    setError("");
    // Pembacaan manual sebelumnya dibatalkan: teleskop akan menyapu dan
    // berpindah, jadi sudut yang tadi dibaca tidak lagi menggambarkan arahnya.
    setManualStatus("idle");
    setManualHaVa(null);
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

  const handleManualHaVa = async () => {
    setLoading(true);
    setError("");
    setManualHaVa(null);
    setManualStatus("waiting");
    try {
      const res = await fetch("/api/kontrol/manual-hava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal membaca sudut");
      // Hasilnya datang lewat MQTT sebagai {"ManualHAVA":{"HA":…,"VA":…}}.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setManualStatus("idle");
      setLoading(false);
    }
  };

  const handleGoToTarget = async () => {
    setLoading(true);
    setError("");
    setGoTargetStatus("waiting");
    // Hasil Auto Search dan pembacaan manual sebelumnya ikut dibatalkan:
    // teleskop akan berpindah, jadi keduanya tidak lagi menggambarkan posisi
    // sekarang. Tanpa ini Simpan tetap aktif memakai hasil yang basi.
    setAutoSearchStatus("idle");
    setManualStatus("idle");
    setManualHaVa(null);
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
      setError("Nama prisma wajib diisi.");
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
          jenis,
          site,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      // Modal SENGAJA tidak ditutup di sini: perangkat masih harus mengirim
      // recordTarget lewat MQTT, dan handler di atas yang memanggil onSuccess().
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  // Go To Target hanya ada di mode edit — slot kosong belum punya sudut yang
  // bisa dituju. Penomoran langkahnya karena itu ikut bergeser.
  const adaGoTo = mode === "edit";
  const nomorCari = adaGoTo ? 3 : 2;
  const nomorJenis = nomorCari + 1;

  // Lingkaran nomor langkah jadi hijau begitu SALAH SATU jalur berhasil.
  const statusKunci: StatusPerintah = targetSiap
    ? "done"
    : autoSearchStatus === "waiting" || manualStatus === "waiting"
      ? "waiting"
      : autoSearchStatus === "failed" || manualStatus === "failed"
        ? "failed"
        : "idle";

  return (
    <ModalShell
      judul={mode === "set" ? `Isi slot ${slot.slot}` : `Ubah slot ${slot.slot}`}
      ikon={<Target className="size-4.5" />}
      lebar="max-w-[440px]"
      onClose={onClose}
      bisaDitutup={!loading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className={TOMBOL_SEKUNDER}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={!simpanEnabled || loading}
            title={
              simpanEnabled
                ? undefined
                : `Selesaikan langkah ${nomorCari} lebih dulu.`
            }
            className={TOMBOL_UTAMA}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Simpan
          </button>
        </>
      }
    >
      {error && <ModalError>{error}</ModalError>}

      <ol className="flex flex-col gap-5">
        {/* ── 1. Identitas ── */}
        <Langkah
          nomor={1}
          judul="Identitas prisma"
        >
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="nama-prisma" className={LABEL}>
                Nama prisma
              </label>
              <input
                id="nama-prisma"
                value={namaPrisma}
                onChange={(e) => setNamaPrisma(e.target.value)}
                placeholder="cth: BS_1"
                className={INPUT}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="tinggi-target" className={LABEL}>
                Tinggi target
              </label>
              <div className="relative">
                <input
                  id="tinggi-target"
                  type="number"
                  step="0.001"
                  value={targetHeight}
                  onChange={(e) => setTargetHeight(e.target.value)}
                  placeholder="0"
                  className={cn(INPUT, "pr-7 font-mono tabular-nums")}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-(--ink-3)"
                >
                  m
                </span>
              </div>
            </div>
          </div>
        </Langkah>

        {/* ── 2. Arahkan (edit saja) ── */}
        {adaGoTo && (
          <Langkah
            nomor={2}
            judul="Arahkan teleskop"
            status={goTargetStatus}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleGoToTarget}
                disabled={goTargetStatus === "waiting" || goTargetStatus === "done"}
                className={cn(TOMBOL_SEKUNDER, "ring-(--navy)/30 text-(--navy)")}
              >
                {goTargetStatus === "waiting" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Crosshair className="size-4" />
                )}
                Go To Target
              </button>
              <StatusPerintahChip
                status={goTargetStatus}
                teksMenunggu="Teleskop berputar…"
                teksSelesai="Sampai di target"
                teksGagal="Gagal — coba lagi"
              />
            </div>
          </Langkah>
        )}

        {/* ── Kunci prisma: dua jalur, salah satu cukup ──
            Auto Search menyapu dan mengunci sendiri. Jalur manual dipakai saat
            prismanya terlalu jauh untuk disapu RTS ini: operator membidik di
            lapangan, tombolnya hanya MEMBACA sudut teleskop sekarang sebagai
            bukti instrumen menjawab. Yang merekam target tetap `recordTarget`
            saat Simpan, dan itu merekam ke mana pun teleskop menghadap. */}
        <Langkah
          nomor={nomorCari}
          judul="Kunci prisma"
          status={statusKunci}
          nonaktif={adaGoTo && goTargetStatus !== "done"}
          alasanNonaktif="Arahkan teleskop lebih dulu."
        >
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAutoSearch}
                disabled={
                  autoSearchStatus === "waiting" ||
                  manualStatus === "waiting" ||
                  (mode === "edit" && goTargetStatus !== "done")
                }
                className={cn(
                  TOMBOL_SEKUNDER,
                  "w-full",
                  autoSearchStatus === "done"
                    ? "ring-(--st-normal)/40 text-(--st-normal)"
                    : "ring-(--navy)/30 text-(--navy)"
                )}
              >
                {autoSearchStatus === "waiting" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Auto Search
              </button>
              <button
                type="button"
                onClick={handleManualHaVa}
                disabled={
                  autoSearchStatus === "waiting" ||
                  manualStatus === "waiting" ||
                  (mode === "edit" && goTargetStatus !== "done")
                }
                className={cn(
                  TOMBOL_SEKUNDER,
                  "w-full",
                  manualStatus === "done"
                    ? "ring-(--st-normal)/40 text-(--st-normal)"
                    : "ring-(--navy)/30 text-(--navy)"
                )}
              >
                {manualStatus === "waiting" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Gauge className="size-4" />
                )}
                Manual HA/VA
              </button>
            </div>

            <StatusPerintahChip
              status={autoSearchStatus}
              teksMenunggu="Menyapu area…"
              teksSelesai="Prisma terkunci"
              teksGagal="Prisma tidak ditemukan"
            />
            <StatusPerintahChip
              status={manualStatus}
              teksMenunggu="Membaca sudut…"
              teksSelesai="Sudut terbaca"
              teksGagal="Instrumen tidak menjawab"
            />

            {/* Sudut ditulis APA ADANYA. Dokumen protokol menyebut manual_hava
                termasuk yang kena bug sudut, jadi nilai seperti "151,38,71"
                memang yang dikirim alat — mengonversinya hanya menghasilkan
                angka yang salah dengan cara lain. */}
            {manualHaVa && (
              <dl className="grid grid-cols-2 gap-x-4 rounded-[10px] bg-(--paper) px-3 py-2 font-mono text-[12px] tabular-nums">
                <div>
                  <dt className="font-sans text-[11px] text-(--ink-3)">HA</dt>
                  <dd className="text-(--ink)">{manualHaVa.HA || "—"}</dd>
                </div>
                <div>
                  <dt className="font-sans text-[11px] text-(--ink-3)">VA</dt>
                  <dd className="text-(--ink)">{manualHaVa.VA || "—"}</dd>
                </div>
              </dl>
            )}
          </div>
        </Langkah>

        {/* ── Jenis prisma ──
            Menentukan perintah ukur yang dipakai nanti: backsight mengirim
            `measure_bs` (*ST2), foresight `measure_fs` (*ST3). Sebelumnya
            operator memilihnya tiap kali mengukur di modal Arahkan teleskop,
            dan jenisnya tidak tersimpan di mana pun. */}
        <Langkah nomor={nomorJenis} judul="Jenis prisma">
          <div className="grid grid-cols-2 gap-2">
            {([
              ["fs", "Foresight", "Titik pantau"],
              ["bs", "Backsight", "Titik acuan"],
            ] as const).map(([kode, label, arti]) => (
              <button
                key={kode}
                type="button"
                onClick={() => setJenis(kode)}
                aria-pressed={jenis === kode}
                className={cn(
                  "flex cursor-pointer flex-col items-start rounded-[9px] px-3 py-2 text-left outline-none ring-1 transition-colors focus-visible:ring-2",
                  jenis === kode
                    ? "bg-(--navy) text-white ring-(--navy)"
                    : "bg-white text-(--ink-2) ring-(--line) hover:text-(--ink)"
                )}
              >
                <span className="text-[13px] font-semibold">{label}</span>
                <span
                  className={cn(
                    "text-[11px]",
                    jenis === kode ? "text-white/70" : "text-(--ink-3)"
                  )}
                >
                  {arti}
                </span>
              </button>
            ))}
          </div>
        </Langkah>
      </ol>
    </ModalShell>
  );
}
