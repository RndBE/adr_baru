"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Trash2 } from "lucide-react";
import mqtt from "mqtt";
import {
  ModalError,
  ModalShell,
  TOMBOL_BAHAYA,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import { topikBalasan } from "@/lib/mqtt";
import { bacaKonfirmasiConfig } from "@/lib/protokol-rts";
import {
  rencanaStepRecord,
  type HasilStepRecord,
  type RencanaStepRecord,
} from "@/lib/step-record";
import type { PrismaSlot } from "./types";

/** Logger membalas `set_rts` seketika; batasnya hanya untuk balasan yang hilang. */
const BATAS_JAWAB_MS = 20_000;

/** Balasan logger atas stepRecord: dikonfirmasi, dibalas tapi bukan OK, atau diam. */
type Ack = "ok" | "ditolak" | "diam";

/**
 * Konfirmasi hapus prisma yang sudah dikonfigurasi.
 *
 * Penghapusannya menyentuh tiga tabel sekaligus (t_prisma, temp_prisma,
 * parameter_prisma) dan tidak bisa dibatalkan, jadi slot + nama + site
 * ditampilkan apa adanya supaya operator bisa mencocokkan sebelum menekan
 * Hapus — di halaman ini "P1" saja tidak cukup untuk mengenali target.
 *
 * Sekalian menurunkan stepRecord (jumlah prisma per siklus) di logger dan di
 * RTS Config. Sebelumnya hanya database yang berubah, jadi RTS terus menembak
 * jumlah lama sampai operator ingat mengubahnya sendiri. Hasilnya ditunggu dari
 * balasan logger (`updated` memuat "stepRecord"), bukan dari HTTP 200 — yang
 * terakhir hanya membuktikan pesannya sampai ke broker.
 */
export function HapusPrismaModal({
  slot,
  site,
  namaSite,
  slots,
  idLogger,
  loggerTerhubung,
  onClose,
  onSuccess,
}: {
  slot: PrismaSlot;
  /** Slug site; slot hanya unik bersama site. */
  site: string;
  /** Nama site yang terbaca manusia, untuk ditampilkan. */
  namaSite: string;
  /** Seluruh slot site ini, untuk menghitung stepRecord sesudah dihapus. */
  slots: PrismaSlot[];
  /** Menentukan topik balasan `pub_<id>`; tanpanya konfirmasi tidak bisa ditunggu. */
  idLogger: string | null;
  /**
   * false = stepRecord hanya dicatat di aplikasi, tidak dikirim. Sama dengan
   * Simpan di RTS Config yang dikunci selama logger terputus.
   */
  loggerTerhubung: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tahap, setTahap] = useState<"konfirmasi" | "menghapus" | "selesai">("konfirmasi");
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState<HasilStepRecord | null>(null);
  const [ack, setAck] = useState<Ack | null>(null);

  // Dibaca handler MQTT yang dipasang sekali. Dinyalakan SEBELUM DELETE
  // dikirim: server mem-publish sebelum menjawab HTTP, jadi balasan logger bisa
  // tiba lebih dulu daripada respons fetch.
  const menungguRef = useRef(false);

  const rencana = rencanaStepRecord(
    slots.filter((s) => s.registered && s.slot !== slot.slot).map((s) => s.slot)
  );
  const akanDikirim = loggerTerhubung && !!idLogger;

  useEffect(() => {
    if (!idLogger || !loggerTerhubung) return;
    const broker = process.env.NEXT_PUBLIC_MQTT_HOST || "mqtt.beacontelemetry.com";
    const wsPort = process.env.NEXT_PUBLIC_MQTT_WS_PORT || "8083";
    const client = mqtt.connect(`wss://${broker}:${wsPort}/mqtt`, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "userlog",
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: false,
      connectTimeout: 10000,
    });

    client.on("connect", () => client.subscribe(topikBalasan(idLogger), { qos: 0 }));

    client.on("message", (_t: string, message: Buffer) => {
      let data: unknown;
      try {
        data = JSON.parse(message.toString());
      } catch {
        return; // Pesan non-JSON di topik yang sama.
      }
      if (!menungguRef.current) return;
      // Balasan setelan lain (RTS Config, sapuan custom) memakai bentuk yang
      // sama; yang dihitung hanya yang menyebut stepRecord.
      const k = bacaKonfirmasiConfig(data);
      if (!k.cocok || !k.updated.includes("stepRecord")) return;
      menungguRef.current = false;
      setAck(k.ok ? "ok" : "ditolak");
    });

    client.on("error", (err: Error) => console.error("[HapusPrismaModal] MQTT error:", err));
    return () => {
      client.end(true);
    };
  }, [idLogger, loggerTerhubung]);

  const menungguLogger = tahap === "selesai" && !!hasil?.dikirim && ack === null;

  useEffect(() => {
    if (!menungguLogger) return;
    const t = setTimeout(() => {
      menungguRef.current = false;
      setAck("diam");
    }, BATAS_JAWAB_MS);
    return () => clearTimeout(t);
  }, [menungguLogger]);

  const handleHapus = async () => {
    setTahap("menghapus");
    setError("");
    menungguRef.current = akanDikirim;
    try {
      const res = await fetch("/api/prism-config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.slot, site, kirim_logger: akanDikirim }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus prisma");
      const sr = (json.step_record ?? null) as HasilStepRecord | null;
      if (!sr?.dikirim) menungguRef.current = false;
      setHasil(sr);
      setTahap("selesai");
    } catch (e: unknown) {
      menungguRef.current = false;
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setTahap("konfirmasi");
    }
  };

  // Setelah baris terhapus, menutup modal lewat jalan mana pun harus memuat
  // ulang daftar — kalau tidak, slot yang sudah hilang masih tampil terisi.
  const tutup = tahap === "selesai" ? onSuccess : onClose;
  const nama = slot.nama_prisma.replace(/_/g, " ");

  return (
    <ModalShell
      judul="Hapus prisma"
      keterangan={tahap === "selesai" ? "Prisma sudah dihapus." : "Tindakan ini tidak bisa dibatalkan."}
      ikon={<Trash2 className="size-4.5" />}
      onClose={tutup}
      bisaDitutup={tahap !== "menghapus"}
      footer={
        tahap === "selesai" ? (
          <button type="button" onClick={onSuccess} className={TOMBOL_UTAMA}>
            {menungguLogger && <Loader2 className="size-4 animate-spin" />}
            {menungguLogger ? "Menunggu logger…" : "Selesai"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={tahap === "menghapus"}
              className={TOMBOL_SEKUNDER}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleHapus}
              disabled={tahap === "menghapus"}
              className={TOMBOL_BAHAYA}
            >
              {tahap === "menghapus" && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </button>
          </>
        )
      }
    >
      {error && <ModalError>{error}</ModalError>}

      <div className="flex items-center gap-3 rounded-[10px] bg-(--paper) px-3.5 py-3">
        <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-[7px] bg-(--navy)/10 px-2 font-mono text-[12px] font-semibold tabular-nums text-(--navy)">
          {slot.slot}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-(--ink)">{nama}</p>
          <p className="text-[11.5px] text-(--ink-3)">{namaSite}</p>
        </div>
      </div>

      {tahap === "selesai" ? (
        <HasilHapus hasil={hasil} ack={ack} menunggu={menungguLogger} />
      ) : (
        <>
          <p className="mt-3.5 text-[12.5px] leading-relaxed text-(--ink-2)">
            Data prisma ini dihapus dari daftar slot beserta pembacaan sementara dan parameter
            grafiknya.
          </p>
          <RencanaInfo rencana={rencana} slotDihapus={slot.slot} akanDikirim={akanDikirim} />
        </>
      )}
    </ModalShell>
  );
}

const KOTAK = "mt-3 flex gap-2.5 rounded-[10px] border px-3.5 py-3 text-[12.5px] leading-relaxed";
const KOTAK_INFO = `${KOTAK} border-(--line) bg-(--paper) text-(--ink-2)`;
const KOTAK_AWAS = `${KOTAK} border-amber-200 bg-amber-50 text-amber-900`;
const KOTAK_OK = `${KOTAK} border-emerald-200 bg-emerald-50 text-emerald-900`;

/** Yang akan terjadi pada stepRecord — ditampilkan SEBELUM operator menekan Hapus. */
function RencanaInfo({
  rencana,
  slotDihapus,
  akanDikirim,
}: {
  rencana: RencanaStepRecord;
  slotDihapus: number;
  akanDikirim: boolean;
}) {
  const n = rencana.jumlah;

  if (n === 0) {
    return (
      <div className={KOTAK_AWAS}>
        <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
        <span>
          Ini prisma terakhir di site ini. Step record tidak diubah karena 0 belum tentu diterima
          firmware — hentikan jadwal pengukuran dari Kontrol ADR.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={KOTAK_INFO}>
        <Info className="mt-px size-4 shrink-0 text-(--ink-3)" />
        <span>
          Step record jadi <span className="font-mono font-semibold text-(--ink)">{n}</span>
          {akanDikirim
            ? " — dikirim ke logger dan dicatat di RTS Config."
            : " — logger terputus, jadi hanya dicatat di RTS Config. Kirim lewat Simpan di RTS Config setelah logger terhubung."}
        </span>
      </div>

      {/* Slot di RTS tidak bisa dikosongkan dari aplikasi: firmware hanya
          punya recordTarget untuk mengisi. Kalau yang dihapus slot terakhir,
          itu tidak masalah karena slotnya di luar step record. Kalau bukan,
          jumlahnya benar tapi slot yang ditembak salah. */}
      {rencana.berurutan ? (
        <div className={KOTAK_INFO}>
          <Info className="mt-px size-4 shrink-0 text-(--ink-3)" />
          <span>
            Target slot {slotDihapus} di RTS tidak ikut dikosongkan, tapi tidak lagi ditembak
            karena berada di luar step record.
          </span>
        </div>
      ) : (
        <PeringatanUrutan rencana={rencana} />
      )}
    </>
  );
}

/**
 * Sisa slot tidak berurutan dari 1. Tidak menyebut "slot yang dihapus bukan
 * yang terakhir": lubangnya bisa sudah ada sebelumnya (P1, P3, P4 lalu P4
 * dihapus), dan kalimat itu jadi salah untuk kasus tersebut.
 */
function PeringatanUrutan({ rencana }: { rencana: RencanaStepRecord }) {
  const kosong = rencana.kosong.join(", ");
  const diLuar = rencana.diLuar.join(", ");
  return (
    <div className={KOTAK_AWAS}>
      <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
      <span>
        Sisa slot tidak berurutan dari 1. Step record hanya jumlah, dan slot yang dihapus tidak
        ikut dikosongkan di RTS. Kalau RTS menembak slot 1–{rencana.jumlah}, slot {kosong}{" "}
        ditembak padahal tidak terdaftar di aplikasi, dan slot {diLuar} terlewat. Pindahkan
        prisma slot {diLuar} ke slot {kosong} lewat Isi slot.
      </span>
    </div>
  );
}

function HasilHapus({
  hasil,
  ack,
  menunggu,
}: {
  hasil: HasilStepRecord | null;
  ack: Ack | null;
  menunggu: boolean;
}) {
  if (!hasil) return null;
  const n = hasil.jumlah;

  let isi: { kelas: string; ikon: ReactNode; teks: string };
  if (!hasil.dikirim) {
    isi = {
      kelas: KOTAK_AWAS,
      ikon: <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />,
      teks: hasil.alasan ?? `Step record ${n} tidak dikirim ke logger.`,
    };
  } else if (menunggu) {
    isi = {
      kelas: KOTAK_INFO,
      ikon: <Loader2 className="mt-px size-4 shrink-0 animate-spin text-(--ink-3)" />,
      teks: `Step record ${n} terkirim, menunggu konfirmasi logger…`,
    };
  } else if (ack === "ok") {
    isi = {
      kelas: KOTAK_OK,
      ikon: <CheckCircle2 className="mt-px size-4 shrink-0 text-emerald-600" />,
      teks: `Logger mengonfirmasi step record ${n}. RTS Config ikut menampilkan ${n}.`,
    };
  } else if (ack === "ditolak") {
    isi = {
      kelas: KOTAK_AWAS,
      ikon: <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />,
      teks: `Logger membalas, tapi tidak mengonfirmasi step record ${n}. Kirim ulang lewat Simpan di RTS Config.`,
    };
  } else {
    isi = {
      kelas: KOTAK_AWAS,
      ikon: <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />,
      teks: `Step record ${n} terkirim, tapi logger tidak menjawab dalam ${BATAS_JAWAB_MS / 1000} detik — belum tentu diterima. Periksa lewat Sinkronkan di RTS Config.`,
    };
  }

  return (
    <>
      <div className={isi.kelas}>
        {isi.ikon}
        <span>{isi.teks}</span>
      </div>
      {n > 0 && !hasil.berurutan && <PeringatanUrutan rencana={hasil} />}
    </>
  );
}
