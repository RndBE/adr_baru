"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Crosshair, Loader2, Search, Send, Target } from "lucide-react";
import mqtt from "mqtt";
import { cn } from "@/lib/utils";
import { nilaiBalasanLogger, balasanSelesai, balasanGagal } from "@/lib/balasan-logger";
import {
  klasifikasiTurningTarget,
  bacaBalasanSearchArea,
  RENTANG_SETELAH_POWERON_DERAJAT,
  type BalasanSearchArea,
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
  keterangan,
  status,
  children,
  nonaktif,
  alasanNonaktif,
}: {
  nomor: number;
  judul: string;
  keterangan: string;
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
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-(--ink-3)">
          {nonaktif && alasanNonaktif ? alasanNonaktif : keterangan}
        </p>
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
  const [namaPrisma, setNamaPrisma] = useState(slot.registered ? slot.nama_prisma : "");
  const [targetHeight, setTargetHeight] = useState(
    slot.registered ? String(slot.target_height) : "0"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
  // Go To Target hanya dirender di mode "edit", jadi di mode "set"
  // goTargetStatus selamanya "idle". Syarat lama menuntut keduanya "done",
  // sehingga Simpan TIDAK PERNAH bisa aktif saat mendaftarkan prisma baru —
  // modalnya mustahil diselesaikan.
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
      setError(
        "Auto Search tidak menjawab dalam 45 detik. Periksa koneksi logger, lalu coba lagi."
      );
      setLoading(false);
    }, 45_000);
    return () => clearTimeout(timer);
  }, [autoSearchStatus]);

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

        // {"SearchArea":{"horizontal":15,"vertical":15}}
        // Perhatikan namanya: balasan memakai horizontal/vertical, sedangkan
        // permintaannya Hor/Ver.
        const bSA = bacaBalasanSearchArea(data.SearchArea);
        if (bSA.ada) {
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
  }, [onSuccess, site]);

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
  const nomorSapuan = adaGoTo ? 3 : 2;
  const nomorCari = adaGoTo ? 4 : 3;

  return (
    <ModalShell
      judul={mode === "set" ? `Isi slot ${slot.slot}` : `Ubah slot ${slot.slot}`}
      keterangan={
        <>
          Perintah di sini menggerakkan teleskop RTS. Simpan baru aktif setelah perangkat
          menjawab.
        </>
      }
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
                : `Selesaikan langkah ${nomorCari} lebih dulu — perangkat harus menemukan prismanya.`
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
          keterangan="Nama dipakai perangkat sebagai nama target, dan muncul di seluruh laporan."
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
                Tinggi target <span className="font-normal text-(--ink-3)">meter</span>
              </label>
              <input
                id="tinggi-target"
                type="number"
                step="0.001"
                value={targetHeight}
                onChange={(e) => setTargetHeight(e.target.value)}
                placeholder="0"
                className={cn(INPUT, "font-mono tabular-nums")}
              />
            </div>
          </div>
        </Langkah>

        {/* ── 2. Arahkan (edit saja) ── */}
        {adaGoTo && (
          <Langkah
            nomor={2}
            judul="Arahkan teleskop"
            keterangan="Memutar RTS ke sudut yang tersimpan untuk slot ini."
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

        {/* ── 3. Rentang sapuan ──
            SENGAJA tepat sebelum Auto Search. PowerOn menimpa SearchArea
            tersimpan dengan 7° yang ter-hardcode, dan `auto_search` yang
            dikirim sendirian memakai apa pun yang sedang ada di instrumen.
            Jadi rentang ini harus dikirim ULANG menjelang pencarian, bukan
            sekali saat menyimpan konfigurasi. */}
        <Langkah
          nomor={nomorSapuan}
          judul="Rentang sapuan"
          keterangan={`Opsional. Setelah PowerOn instrumen selalu kembali ke ${RENTANG_SETELAH_POWERON_DERAJAT}° × ${RENTANG_SETELAH_POWERON_DERAJAT}°, jadi kirim ulang bila ukurannya penting.`}
        >
          <div className="rounded-[10px] bg-(--paper) p-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="sa-hor" className={cn(LABEL, "mb-1 text-[11px] font-medium")}>
                  Horizontal °
                </label>
                <input
                  id="sa-hor"
                  type="number"
                  value={saHor}
                  onChange={(e) => setSaHor(e.target.value)}
                  className={cn(INPUT, "h-8 font-mono tabular-nums")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="sa-ver" className={cn(LABEL, "mb-1 text-[11px] font-medium")}>
                  Vertikal °
                </label>
                <input
                  id="sa-ver"
                  type="number"
                  value={saVer}
                  onChange={(e) => setSaVer(e.target.value)}
                  className={cn(INPUT, "h-8 font-mono tabular-nums")}
                />
              </div>
              <button
                type="button"
                onClick={handleSearchArea}
                disabled={saLoading}
                className={cn(TOMBOL_SEKUNDER, "h-8 shrink-0 px-3 text-[12px]")}
              >
                {saLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Kirim
              </button>
            </div>
            {searchArea && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-(--ink-2)">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: "var(--st-normal)" }}
                />
                Terpasang di perangkat:{" "}
                <span className="font-mono tabular-nums text-(--ink)">
                  {searchArea.horizontal}° × {searchArea.vertical}°
                </span>
              </p>
            )}
          </div>
        </Langkah>

        {/* ── 4. Cari prisma ── */}
        <Langkah
          nomor={nomorCari}
          judul="Cari prisma"
          keterangan="Perangkat menyapu area dan mengunci prisma. Wajib berhasil sebelum menyimpan."
          status={autoSearchStatus}
          nonaktif={adaGoTo && goTargetStatus !== "done"}
          alasanNonaktif="Arahkan teleskop lebih dulu — pencarian dimulai dari posisi teleskop sekarang."
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleAutoSearch}
              disabled={
                autoSearchStatus === "waiting" ||
                autoSearchStatus === "done" ||
                (mode === "edit" && goTargetStatus !== "done")
              }
              className={cn(TOMBOL_SEKUNDER, "ring-(--navy)/30 text-(--navy)")}
            >
              {autoSearchStatus === "waiting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Auto Search
            </button>
            <StatusPerintahChip
              status={autoSearchStatus}
              teksMenunggu="Menyapu area…"
              teksSelesai="Prisma terkunci"
              teksGagal="Prisma tidak ditemukan"
            />
          </div>
        </Langkah>
      </ol>
    </ModalShell>
  );
}
