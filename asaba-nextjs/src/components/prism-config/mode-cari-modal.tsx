"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Route } from "lucide-react";
import mqtt from "mqtt";
import {
  ModalError,
  ModalShell,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import {
  bacaBalasanTargetSearch,
  formatModeCari,
  uraiModeCari,
  type KodeModeCari,
} from "@/lib/protokol-rts";
import { topikBalasan } from "@/lib/mqtt";
import { PemilihModeCari } from "./pemilih-mode-cari";
import type { PrismaSlot } from "./types";

/** firmware membalas `targetSearch` seketika; batasnya hanya untuk balasan yang hilang. */
const BATAS_JAWAB_MS = 20_000;

/**
 * Ubah cara cari satu slot SAJA — sudut, nama, tinggi, dan jenisnya tidak
 * disentuh.
 *
 * Memakai `targetSearch`, bukan jalur Simpan modal slot: itu mengirim ulang
 * `recordTarget`, yang merekam ulang arah bidik sekarang dan menimpa sudut slot.
 * Yang dicatat di basis data hanya cara cari yang sudah DIKONFIRMASI alat
 * (`value:"OK"`), jadi alat yang menolak tidak meninggalkan catatan palsu.
 */
export function ModeCariModal({
  slot,
  site,
  idLogger,
  onClose,
  onSuccess,
}: {
  slot: PrismaSlot;
  site: string;
  /** Menentukan topik balasan `pub_<id>`; tanpanya konfirmasi tidak bisa ditunggu. */
  idLogger: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const asal = uraiModeCari(slot.mode_cari) ?? (["as"] as KodeModeCari[]);
  const [rantai, setRantai] = useState<KodeModeCari[]>(asal);
  const [menunggu, setMenunggu] = useState(false);
  const [galat, setGalat] = useState("");

  // Dibaca handler MQTT yang dipasang sekali: nilainya harus yang TERKIRIM,
  // bukan yang kebetulan sedang di layar saat balasan datang.
  const terkirimRef = useRef<string | null>(null);

  // onSuccess dari halaman berganti identitas tiap render. Kalau jadi dependency
  // efek MQTT di bawah, tiap render ulang halaman memutus dan menyambung ulang
  // koneksinya — dan balasan yang sedang ditunggu bisa lewat di antaranya.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const berubah = formatModeCari(rantai) !== formatModeCari(asal);

  useEffect(() => {
    if (!idLogger) return;
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
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(message.toString());
      } catch {
        return; // Pesan non-JSON di topik yang sama.
      }

      const b = bacaBalasanTargetSearch(data.targetSearch);
      const terkirim = terkirimRef.current;
      // Hanya balasan untuk slot INI, dan hanya saat ada perintah menunggu.
      if (!b.ada || terkirim === null || (b.slot !== null && b.slot !== slot.slot)) return;

      terkirimRef.current = null;
      if (!b.ok) {
        setGalat(b.galat ? `Instrumen menolak: ${b.galat}` : "Instrumen tidak mengonfirmasi perubahan cara cari.");
        setMenunggu(false);
        return;
      }

      // Alat sudah mengonfirmasi — baru sekarang dicatat di basis data.
      fetch("/api/prism-config/mode-cari", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, slot_id: slot.slot, mode_cari: terkirim }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!j.success) throw new Error(j.error || "Gagal mencatat");
          onSuccessRef.current();
        })
        .catch((e: unknown) => {
          setGalat(
            `Instrumen sudah memakai cara cari baru, tapi gagal dicatat di aplikasi: ${
              e instanceof Error ? e.message : "kesalahan tak dikenal"
            }. Muat ulang daftar untuk melihat nilai sebenarnya.`
          );
          setMenunggu(false);
        });
    });

    client.on("error", (err: Error) => console.error("[ModeCariModal] MQTT error:", err));
    return () => {
      client.end(true);
    };
  }, [idLogger, site, slot.slot]);

  useEffect(() => {
    if (!menunggu) return;
    const t = setTimeout(() => {
      terkirimRef.current = null;
      setMenunggu(false);
      setGalat(
        `Instrumen tidak menjawab dalam ${BATAS_JAWAB_MS / 1000} detik. Cara cari belum berubah; periksa koneksi logger, lalu coba lagi.`
      );
    }, BATAS_JAWAB_MS);
    return () => clearTimeout(t);
  }, [menunggu]);

  const simpan = async () => {
    setGalat("");
    const mode = formatModeCari(rantai);
    terkirimRef.current = mode;
    setMenunggu(true);
    try {
      const res = await fetch("/api/prism-config/mode-cari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, slot_id: slot.slot, mode_cari: mode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengirim");
      if (json.data?.mqtt_sent === false) throw new Error("Perintah tidak sampai ke broker MQTT");
      // Selanjutnya menunggu konfirmasi dari alat lewat MQTT.
    } catch (e: unknown) {
      terkirimRef.current = null;
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
      setMenunggu(false);
    }
  };

  return (
    <ModalShell
      judul={`Cara cari slot ${slot.slot}`}
      keterangan={
        <>
          {slot.nama_prisma.replace(/_/g, " ")} · mengubah cara cari saja, sudut slot tidak
          disentuh.
        </>
      }
      ikon={<Route className="size-4.5" />}
      lebar="max-w-[460px]"
      onClose={onClose}
      bisaDitutup={!menunggu}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={menunggu} className={TOMBOL_SEKUNDER}>
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={menunggu || !berubah || !idLogger}
            className={TOMBOL_UTAMA}
          >
            {menunggu && <Loader2 className="size-4 animate-spin" />}
            {menunggu ? "Menunggu instrumen…" : "Simpan"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {galat && <ModalError>{galat}</ModalError>}
        <PemilihModeCari nilai={rantai} onChange={setRantai} disabled={menunggu} />
        {!idLogger && (
          <p className="text-[12px] font-medium text-(--st-awas)">
            Logger site ini belum diketahui, jadi konfirmasi dari instrumen tidak bisa ditunggu.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
