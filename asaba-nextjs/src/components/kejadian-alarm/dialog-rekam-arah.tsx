"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import { AlertTriangle, Check, Crosshair, Loader2, RefreshCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { topikBalasan } from "@/lib/mqtt";
import { fmtWaktuPendek, type KejadianRingkas } from "@/lib/aturan-kejadian";
import {
  JalurRekamArah,
  LABEL_LANGKAH,
  type HasilKirim,
  type LangkahRekam,
  type PrismaArah,
  type RencanaArah,
  type SasaranRekam,
  type StatusBaris,
} from "@/lib/rekam-arah";
import { ModalError, ModalShell, TOMBOL_SEKUNDER, TOMBOL_UTAMA } from "@/components/monitoring/modal-shell";

/**
 * Perbarui arah bidik prisma setelah verifikasi Benar.
 *
 * Setiap prisma terpilih menjalani baca → tulis → pastikan → simpan (lihat
 * src/lib/rekam-arah.ts): sudut slot RTS ditulis langsung dengan `setTarget`,
 * teleskop tidak bergerak. Dialog tidak bisa ditutup selama jalurnya berjalan:
 * menutupnya memutus sambungan MQTT sebelum balasan slot sempat dicocokkan.
 */

function fmtMm(m: number | null): string {
  return m == null ? "—" : `${Math.round(m * 1000).toLocaleString("id-ID")} mm`;
}

function Sudut({ HA, VA }: { HA: string | null; VA: string | null }) {
  return (
    <span className="font-mono text-[11.5px] leading-snug tabular-nums text-(--ink)">
      {HA || "—"}
      <br />
      {VA || "—"}
    </span>
  );
}

function SelStatus({ s }: { s: StatusBaris | undefined }) {
  if (!s) return null;
  switch (s.tahap) {
    case "antre":
      return <span className="text-(--ink-3)">Menunggu</span>;
    case "jalan":
      return (
        <span className="inline-flex items-center gap-1.5 text-(--navy)">
          <Loader2 className="size-3.5 animate-spin" />
          {LABEL_LANGKAH[s.langkah]}
        </span>
      );
    case "selesai":
      return (
        <span className="text-[#0a7d0a]">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Check className="size-3.5" />
            Slot diperbarui
          </span>
          <span className="block font-mono text-[11px] tabular-nums">
            {s.HA} · {s.VA}
          </span>
          {s.sebelum && (
            <span className="block text-[11px] text-(--ink-3)">
              sebelumnya {s.sebelum.HA || "kosong"} · {s.sebelum.VA || "kosong"}
            </span>
          )}
        </span>
      );
    case "gagal":
      return (
        <span className="text-[#c62828]">
          <span className="inline-flex items-center gap-1 font-semibold">
            <X className="size-3.5" />
            Gagal saat {LABEL_LANGKAH[s.langkah].toLowerCase()}
          </span>
          <span className="block text-[11px] leading-snug">{s.pesan}</span>
        </span>
      );
    case "dilewati":
      return <span className="text-[11px] leading-snug text-(--ink-3)">{s.pesan}</span>;
  }
}

export function DialogRekamArah({
  kejadian: k,
  kode,
  onClose,
}: {
  kejadian: KejadianRingkas;
  /** Kode akses yang sama dengan verifikasi; diperiksa server di tiap langkah. */
  kode: string;
  onClose: () => void;
}) {
  const [rencana, setRencana] = useState<RencanaArah | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState("");
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Record<number, StatusBaris>>({});
  const [jalan, setJalan] = useState(false);
  const [terhubung, setTerhubung] = useState(false);
  const jalurRef = useRef<JalurRekamArah | null>(null);

  const url = `/api/kejadian-alarm/${k.id}/arah-bidik`;

  const muat = useCallback(
    async (pilihUlang: boolean) => {
      setMemuat(true);
      setGalatMuat("");
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: RencanaArah } | null;
        if (!json?.success || !json.data) throw new Error(json?.error || `Gagal (HTTP ${res.status})`);
        const r = json.data;
        setRencana(r);
        if (pilihUlang) {
          setPilih(new Set(r.prisma.filter((p) => p.memicu && p.terakhir).map((p) => p.slot)));
        }
      } catch (e) {
        setGalatMuat(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        setMemuat(false);
      }
    },
    [url]
  );

  useEffect(() => {
    void muat(true);
  }, [muat]);

  // Selesai satu putaran: muat ulang supaya kolom "Tersimpan" menunjukkan
  // sudut yang baru direkam, bukan yang lama.
  const jalanSebelum = useRef(false);
  useEffect(() => {
    if (jalanSebelum.current && !jalan) void muat(false);
    jalanSebelum.current = jalan;
  }, [jalan, muat]);

  // ── Jalur langkah ─────────────────────────────────────────────────────────
  const siap = rencana !== null;
  useEffect(() => {
    if (!siap) return;
    const kirimLangkah = async (body: Record<string, unknown>): Promise<HasilKirim> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: kode, ...body }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        tujuan?: { HA: string; VA: string };
      } | null;
      return json?.success
        ? { ok: true, ...(json.tujuan ? { tujuan: json.tujuan } : {}) }
        : { ok: false, pesan: json?.error || `HTTP ${res.status}` };
    };
    const jalur = new JalurRekamArah(
      {
        kirim: (langkah: LangkahRekam, slot: number) => kirimLangkah({ langkah, slot }),
        simpan: (slot, HA, VA) => kirimLangkah({ langkah: "simpan", slot, HA, VA }),
        jadwal: (ms, fn) => {
          const t = setTimeout(fn, ms);
          return () => clearTimeout(t);
        },
        ubah: (s, j) => {
          setStatus(s);
          setJalan(j);
        },
      }
    );
    jalurRef.current = jalur;
    return () => {
      jalur.hentikan();
      jalurRef.current = null;
    };
  }, [siap, kode, url]);

  // ── Sambungan MQTT ────────────────────────────────────────────────────────
  const idLogger = rencana?.idLogger ?? null;
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
    client.on("connect", () =>
      client.subscribe(topikBalasan(idLogger), { qos: 0 }, (err) => setTerhubung(!err))
    );
    client.on("close", () => setTerhubung(false));
    client.on("error", (err) => console.error("[DialogRekamArah] MQTT", err));
    client.on("message", (_t: string, message: Buffer) => {
      let data: unknown;
      try {
        data = JSON.parse(message.toString());
      } catch {
        return;
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        jalurRef.current?.terima(data as Record<string, unknown>);
      }
    });
    return () => {
      client.end(true);
      setTerhubung(false);
    };
  }, [idLogger]);

  // ── Aksi ──────────────────────────────────────────────────────────────────
  const daftar = rencana?.prisma ?? [];
  const sasaran: SasaranRekam[] = daftar
    .filter((p): p is PrismaArah & { terakhir: NonNullable<PrismaArah["terakhir"]> } => pilih.has(p.slot) && p.terakhir !== null)
    .map((p) => ({ slot: p.slot, nama: p.nama }));

  const sudahJalan = Object.keys(status).length > 0;
  const bisaMulai = !!rencana && !rencana.sibuk && !!idLogger && terhubung && !jalan && sasaran.length > 0;

  const mulai = () => {
    if (!bisaMulai) return;
    jalurRef.current?.mulai(sasaran);
  };

  const ubahPilih = (slot: number) => {
    if (jalan) return;
    setPilih((p) => {
      const n = new Set(p);
      if (n.has(slot)) n.delete(slot);
      else n.add(slot);
      return n;
    });
  };

  const selesai = sudahJalan && !jalan;
  const jumlahTerekam = Object.values(status).filter((s) => s.tahap === "selesai").length;

  return (
    <ModalShell
      judul="Perbarui arah bidik prisma"
      keterangan={`${k.namaSite} · kejadian ${fmtWaktuPendek(k.mulai)}`}
      ikon={<Crosshair className="size-4.5" />}
      lebar="max-w-[680px]"
      onClose={onClose}
      bisaDitutup={!jalan}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={jalan} className={TOMBOL_SEKUNDER}>
            {selesai ? "Tutup" : "Lewati"}
          </button>
          <button type="button" onClick={mulai} disabled={!bisaMulai} className={TOMBOL_UTAMA}>
            {jalan && <Loader2 className="size-4 animate-spin" />}
            {selesai ? "Ulangi yang dipilih" : `Perbarui ${sasaran.length} slot`}
          </button>
        </>
      }
    >
      {galatMuat && <ModalError>{galatMuat}</ModalError>}
      {rencana?.sibuk && (
        <div className="mb-3">
          <ModalError>{rencana.sibuk}</ModalError>
          <button
            type="button"
            onClick={() => void muat(false)}
            disabled={memuat}
            className={cn(TOMBOL_SEKUNDER, "mt-2 h-8 text-[12px]")}
          >
            {memuat ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
            Cek lagi
          </button>
        </div>
      )}
      {rencana && !idLogger && <ModalError>Site ini belum punya logger RTS.</ModalError>}

      <p className="mb-3 flex gap-2 rounded-[10px] bg-(--paper) px-3 py-2.5 text-[12px] leading-relaxed text-(--ink-2)">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--ink-3)" aria-hidden="true" />
        <span>
          Sudut slot tiap prisma terpilih di RTS diganti dengan sudut tembakan terakhirnya, lalu dibaca ulang untuk
          memastikan. Teleskop tidak bergerak. Salinan di web baru diperbarui bila isi slot sama persis dengan yang
          dikirim. R0 dan status alarm tidak berubah.
        </span>
      </p>

      {memuat && !rencana ? (
        <p className="flex items-center gap-2 py-6 text-[13px] text-(--ink-3)">
          <Loader2 className="size-4 animate-spin" />
          Memuat prisma…
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-(--line) text-[11px] font-semibold tracking-wide text-(--ink-3) uppercase">
                <th className="w-8 px-1 py-2" />
                <th className="px-2 py-2">Prisma</th>
                <th className="px-2 py-2">Tersimpan</th>
                <th className="px-2 py-2">Tembakan terakhir</th>
                <th className="px-2 py-2 text-right">Selisih</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => {
                const bisa = p.terakhir !== null;
                return (
                  <tr key={p.slot} className="border-b border-(--line) align-top last:border-b-0">
                    <td className="px-1 py-2.5">
                      <input
                        type="checkbox"
                        checked={pilih.has(p.slot)}
                        disabled={!bisa || jalan}
                        onChange={() => ubahPilih(p.slot)}
                        aria-label={`Pilih ${p.nama}`}
                        className="size-4 cursor-pointer accent-(--navy) disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-semibold text-(--ink)">{p.nama}</span>
                      <span className="block text-[11px] text-(--ink-3)">
                        slot {p.slot}
                        {p.memicu && <span className="ml-1.5 font-semibold text-[#c62828]">pemicu</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <Sudut HA={p.tersimpan.HA} VA={p.tersimpan.VA} />
                    </td>
                    <td className="px-2 py-2.5">
                      {p.terakhir ? (
                        <>
                          <Sudut HA={p.terakhir.HA} VA={p.terakhir.VA} />
                          <span className="block text-[11px] text-(--ink-3)">
                            {p.terakhir.SD.toFixed(3)} m · {fmtWaktuPendek(p.terakhir.waktu)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-(--ink-3)">Belum pernah terukur di site ini</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-(--ink)">{fmtMm(p.geserM)}</td>
                    <td className="max-w-[200px] px-2 py-2.5">
                      <SelStatus s={status[p.slot]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-(--ink-3)">
        Selisih = jarak arah tersimpan ke tembakan terakhir di ujung bidikan.{" "}
        {rencana && !rencana.sibuk && idLogger && !terhubung && "Menyambung ke MQTT… "}
        {selesai && `${jumlahTerekam} dari ${Object.keys(status).length} slot diperbarui.`}
      </p>
    </ModalShell>
  );
}
