"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Move,
  RefreshCcw,
  Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { topikBalasan } from "@/lib/mqtt";
import {
  bacaBalasanJog,
  bacaBalasanUkur,
  bacaManualHaVa,
  klasifikasiTurningTarget,
  JENIS_UKUR,
  LANGKAH_JOG,
  SEBAB_TOLAK_JOG,
  type BacaanHaVa,
  type BalasanJog,
  type BalasanUkur,
  type KodeUkur,
} from "@/lib/protokol-rts";
import { LABEL, ModalShell } from "@/components/monitoring/modal-shell";
import { Eyebrow } from "@/components/monitoring/panel";
import type { PrismaSlot } from "./types";

/**
 * Arahkan RTS — menggeser teleskop dan mengukur backsight/foresight.
 *
 * Dulu ada di halaman Kontrol ADR. Dipindah ke Prism Config karena di sinilah
 * daftar slotnya hidup: `measure_bs`/`measure_fs` TIDAK punya parameter target
 * (Bagian C.2) — keduanya mengukur ke arah teleskop sedang menghadap. Jadi
 * "prisma mana yang jadi backsight" hanya bisa dijawab dengan memutar teleskop
 * ke slot itu lebih dulu, dan slot-slot itu ada di halaman ini.
 *
 * Tetap dialog terpisah, bukan panel lepas: setiap tombol di sini menggerakkan
 * instrumen sungguhan di lapangan, jadi harus jelas sedang berada di mode ini.
 */

/**
 * Satu pengukuran yang sedang berjalan.
 *
 * `tahap` memisahkan dua perintah yang harus dikirim BERURUTAN, bukan sekaligus:
 * dokumen melarang mencampur perintah aksi dalam satu payload, dan urutan
 * eksekusinya di firmware bukan urutan penulisan di JSON. Jadi `turning_target`
 * dikirim dulu, ditunggu sampai `done`, baru `measure_*` menyusul.
 *
 * `slot` dan `nama` dibawa serta supaya hasilnya bisa dilabeli milik prisma
 * mana. Balasan ukur sendiri tidak menyebut target apa pun — kalau tidak
 * dicatat di sisi ini, angkanya jadi tidak punya pemilik.
 */
type Alur = {
  jenis: KodeUkur;
  slot: number;
  nama: string;
  tahap: "putar" | "ukur";
};

type HasilUkur = { data: BalasanUkur; slot: number; nama: string };

/**
 * Batas menunggu balasan, diturunkan dari tabel durasi di Bagian A dengan
 * margin: `turning_target` 20 detik, `measure_*` 10 detik, `jog` 20 detik,
 * `manual_hava` 5 detik. Dokumennya melarang timeout yang lebih ketat dari
 * durasi operasinya, dan menyebut balasan bisa datang terlambat beberapa detik.
 *
 * Tanpa batas ini satu balasan yang hilang membuat tombolnya terkunci di
 * "waiting" selamanya — operator menunggu sesuatu yang tidak akan datang.
 */
const BATAS_MS = { putar: 35_000, ukur: 20_000, jog: 25_000, hava: 15_000 };

type Arah = "atas" | "bawah" | "kiri" | "kanan";

/**
 * Satu tombol arah.
 *
 * Di level modul, bukan di dalam ArahkanModal: komponen yang didefinisikan saat
 * render adalah tipe baru tiap render, jadi React membongkar dan memasang ulang
 * seluruh subtree-nya alih-alih memperbaruinya. Pada tombol yang sedang ditekan
 * itu berarti kehilangan fokus dan state DOM-nya.
 */
function TombolArah({
  arah,
  mati,
  onJog,
  children,
}: {
  arah: Arah;
  mati: boolean;
  onJog: (arah: Arah) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onJog(arah)}
      disabled={mati}
      aria-label={`Geser ${arah}`}
      className={cn(
        "flex size-11 items-center justify-center rounded-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
        mati
          ? "cursor-not-allowed bg-(--paper) text-(--ink-3)/50"
          : "cursor-pointer bg-white text-(--navy) ring-1 ring-(--navy)/30 hover:bg-(--navy) hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function ArahkanModal({
  site,
  idLogger,
  slots,
  slotAwal,
  namaPos,
  onClose,
}: {
  /** Slot prisma hanya unik bersama site — lihat catatan di t_prisma.site. */
  site: string;
  /**
   * ID alat penerima perintah. Menentukan topiknya: balasan logger keluar di
   * `pub_<idAlat>`. Tanpa ini tidak ada topik yang bisa didengarkan, jadi
   * sambungan MQTT-nya tidak dibuka dan seluruh tombol dimatikan.
   */
  idLogger: string | null;
  slots: PrismaSlot[];
  /** Slot yang sedang dipilih di daftar, dipakai sebagai pilihan awal. */
  slotAwal: number | null;
  namaPos: string;
  onClose: () => void;
}) {
  // ── Target ────────────────────────────────────────────────────────────────
  //
  // Hanya slot TERDAFTAR yang bisa jadi target: `turning_target` memutar ke
  // rekaman di instrumen, dan go-to-target menolak slot yang belum terdaftar
  // dengan 404. Menawarkan slot kosong hanya menghasilkan galat.
  const slotTerdaftar = slots.filter((s) => s.registered);
  const [slotPilihan, setSlotPilihan] = useState<number | null>(slotAwal);

  // Diturunkan, bukan disinkronkan lewat effect. `slotAwal` bisa menunjuk slot
  // kosong (daftar di halaman boleh memilih slot mana pun), dan daftar slotnya
  // berubah saat site berganti — dengan diturunkan begini, pilihan yang sudah
  // tidak sah tidak bisa tertinggal sebagai nilai basi.
  const target =
    slotTerdaftar.find((s) => s.slot === slotPilihan) ?? slotTerdaftar[0] ?? null;

  // ── Sudut sekarang ────────────────────────────────────────────────────────
  const [haVa, setHaVa] = useState<BacaanHaVa | null>(null);
  const [haVaLoading, setHaVaLoading] = useState(false);

  // ── Jog ───────────────────────────────────────────────────────────────────
  const [langkahJog, setLangkahJog] = useState(LANGKAH_JOG[0].derajat);
  const [jogStatus, setJogStatus] = useState<"idle" | "waiting" | "done" | "gagal">("idle");
  const [jogPesan, setJogPesan] = useState("");
  const [jogTarget, setJogTarget] = useState<BalasanJog | null>(null);

  // ── Ukur ──────────────────────────────────────────────────────────────────
  const [alur, setAlur] = useState<Alur | null>(null);
  const [hasil, setHasil] = useState<Record<KodeUkur, HasilUkur | null>>({
    bs: null,
    fs: null,
  });
  const [gagal, setGagal] = useState<{ jenis: KodeUkur; pesan: string } | null>(null);

  // Cermin state untuk dibaca dari handler MQTT. Handler-nya dipasang sekali
  // per sambungan; kalau ia membaca `alur` langsung, yang terbaca adalah nilai
  // saat effect dijalankan — selalu null, sehingga tahap "ukur" tidak pernah
  // menyusul tahap "putar".
  const alurRef = useRef<Alur | null>(null);
  useEffect(() => {
    alurRef.current = alur;
  }, [alur]);

  const siteRef = useRef(site);
  useEffect(() => {
    siteRef.current = site;
  }, [site]);

  const terkunci = !idLogger || !site || !target;
  const sibuk = alur !== null;

  /** Kirim `measure_*` — dipanggil setelah `turning_target` menjawab `done`. */
  const lanjutUkur = useCallback(async (a: Alur) => {
    setAlur({ ...a, tahap: "ukur" });
    try {
      const res = await fetch("/api/kontrol/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteRef.current, jenis: a.jenis }),
      });
      const json = await res.json();
      if (!json.success) {
        setAlur(null);
        setGagal({ jenis: a.jenis, pesan: json.error || "Gagal mengirim perintah ukur" });
      }
      // Sukses tidak diumumkan di sini: yang selesai baru pengiriman ke broker.
      // Hasilnya datang lewat MQTT sebagai MeasureBS/MeasureFS.
    } catch (err) {
      console.error("[ArahkanModal] measure", err);
      setAlur(null);
      setGagal({ jenis: a.jenis, pesan: "Terjadi kesalahan jaringan" });
    }
  }, []);

  // ── Sambungan MQTT ────────────────────────────────────────────────────────
  //
  // Dibuka selama dialog terbuka: balasan perangkat datang di topic, bukan
  // sebagai respons HTTP dari route yang mengirim perintahnya.
  useEffect(() => {
    if (!idLogger) return;
    const broker = process.env.NEXT_PUBLIC_MQTT_HOST || "mqtt.beacontelemetry.com";
    const wsPort = process.env.NEXT_PUBLIC_MQTT_WS_PORT || "8083";
    const wsUrl = `wss://${broker}:${wsPort}/mqtt`;
    const topic = topikBalasan(idLogger);

    const client = mqtt.connect(wsUrl, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "userlog",
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "b34c0n",
      rejectUnauthorized: false,
      connectTimeout: 10000,
    });

    client.on("connect", () => client.subscribe(topic, { qos: 0 }));
    client.on("error", (err) => console.error("[ArahkanModal] MQTT", err));

    client.on("message", (_t: string, message: Buffer) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(message.toString());
      } catch {
        return;
      }

      // Data pengukuran berkala punya topic sendiri, `Logger_<idAlat>`
      // (Bagian F), jadi seharusnya tidak pernah mendarat di sini. Gerbangnya
      // murah dan menjaga kalau suatu saat kedua topic disatukan: balasan
      // perintah tidak pernah punya `id_alat` di tingkat teratas.
      if (data.id_alat !== undefined) return;

      // ── manual_hava ──
      const bHaVa = bacaManualHaVa(data.ManualHAVA);
      if (bHaVa.ada) {
        setHaVa(bHaVa);
        setHaVaLoading(false);
      }

      // ── jog ──
      const bJog = bacaBalasanJog(data.Jog);
      if (bJog.jenis !== "bukan") {
        if (bJog.jenis === "ditolak") {
          setJogStatus("gagal");
          setJogPesan(SEBAB_TOLAK_JOG[bJog.nilai] ?? `Jog ditolak: ${bJog.nilai}`);
          setJogTarget(bJog);
        } else if (bJog.jenis === "selesai") {
          setJogStatus("done");
          // Sudut yang terpampang sudah tidak berlaku begitu teleskop bergerak.
          // Dikosongkan, bukan dibiarkan: angka basi yang terlihat seperti
          // bacaan sekarang lebih menyesatkan daripada tidak ada angka.
          setHaVa(null);
        } else {
          setJogStatus("waiting");
          if (bJog.jenis === "target") setJogTarget(bJog);
        }
      }

      const a = alurRef.current;
      if (!a) return;

      // ── turning_target, tahap 1 dari alur ukur ──
      if (a.tahap === "putar") {
        const kelas = klasifikasiTurningTarget(data.TurningTarget);
        if (kelas === "selesai") {
          lanjutUkur(a);
        } else if (kelas === "gagal") {
          setAlur(null);
          setGagal({
            jenis: a.jenis,
            pesan: `Teleskop gagal diputar ke slot ${a.slot} (${a.nama}). Pengukuran dibatalkan — tanpa arah yang benar, angkanya akan milik target lain.`,
          });
        }
        return;
      }

      // ── measure_bs / measure_fs, tahap 2 ──
      //
      // Dipilah lewat NAMA KUNCI balasan, bukan dari perintah yang dikirim.
      // Hasilnya datang SEBELUM "done", jadi jangan menunggu "done" dulu baru
      // membaca angkanya.
      const bUkur = bacaBalasanUkur(data[JENIS_UKUR[a.jenis].balasan]);
      if (bUkur.jenis === "hasil") {
        if (bUkur.kosong) {
          // Keempat medan dikosongkan adalah satu-satunya penanda gagal yang
          // bisa dipercaya, dan ia mendahului "failed".
          setAlur(null);
          setGagal({
            jenis: a.jenis,
            pesan: `Pengukuran ${JENIS_UKUR[a.jenis].label} ke slot ${a.slot} (${a.nama}) tidak mendapat pantulan. Periksa bidikan dan halangan di lintasan.`,
          });
        } else {
          setHasil((p) => ({ ...p, [a.jenis]: { data: bUkur, slot: a.slot, nama: a.nama } }));
        }
      } else if (bUkur.jenis === "gagal") {
        setAlur(null);
        setGagal({
          jenis: a.jenis,
          pesan: `Pengukuran ${JENIS_UKUR[a.jenis].label} ke slot ${a.slot} (${a.nama}) gagal.`,
        });
      } else if (bUkur.jenis === "selesai") {
        setAlur(null);
      }
    });

    return () => {
      client.end(true);
    };
  }, [idLogger, lanjutUkur]);

  // ── Batas menunggu ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!alur) return;
    const t = setTimeout(() => {
      setAlur(null);
      setGagal({
        jenis: alur.jenis,
        pesan:
          alur.tahap === "putar"
            ? `Perintah putar ke slot ${alur.slot} tidak dijawab dalam ${BATAS_MS.putar / 1000} detik. Pengukuran dibatalkan.`
            : `Pengukuran ${JENIS_UKUR[alur.jenis].label} tidak dijawab dalam ${BATAS_MS.ukur / 1000} detik.`,
      });
    }, alur.tahap === "putar" ? BATAS_MS.putar : BATAS_MS.ukur);
    return () => clearTimeout(t);
  }, [alur]);

  useEffect(() => {
    if (jogStatus !== "waiting") return;
    const t = setTimeout(() => {
      setJogStatus("gagal");
      setJogPesan(
        `Perintah jog tidak dijawab dalam ${BATAS_MS.jog / 1000} detik. Periksa koneksi logger.`
      );
    }, BATAS_MS.jog);
    return () => clearTimeout(t);
  }, [jogStatus]);

  useEffect(() => {
    if (!haVaLoading) return;
    const t = setTimeout(() => setHaVaLoading(false), BATAS_MS.hava);
    return () => clearTimeout(t);
  }, [haVaLoading]);

  // ── Aksi ──────────────────────────────────────────────────────────────────

  /** Baca sudut instrumen sekarang. Tidak menggerakkan apa pun. */
  const bacaHaVa = async () => {
    setHaVaLoading(true);
    try {
      const res = await fetch("/api/kontrol/manual-hava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });
      const json = await res.json();
      if (!json.success) setHaVaLoading(false);
      // Hasilnya ditangkap handler MQTT (ManualHAVA).
    } catch (err) {
      console.error("[ArahkanModal] manual-hava", err);
      setHaVaLoading(false);
    }
  };

  /**
   * Geser arah teleskop.
   *
   * `va` adalah sudut ZENIT: 0° menghadap lurus ke atas, 90° mendatar, 180°
   * lurus ke bawah. Jadi MENAMBAH va berarti MENUNDUK — tombol "atas" harus
   * mengirim nilai negatif. Pemetaan itu dikunci di satu tempat, di sini.
   */
  const jog = async (arah: "atas" | "bawah" | "kiri" | "kanan") => {
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
        body: JSON.stringify({ site, ...delta }),
      });
      const json = await res.json();
      if (!json.success) {
        setJogStatus("gagal");
        setJogPesan(json.error || "Gagal mengirim perintah");
      }
      // Tahapan dan hasilnya datang lewat MQTT sebagai balasan bernama `Jog`.
    } catch (err) {
      console.error("[ArahkanModal] jog", err);
      setJogStatus("gagal");
      setJogPesan("Terjadi kesalahan jaringan");
    }
  };

  /** Putar ke slot terpilih, lalu ukur. Dua perintah, dikirim berurutan. */
  const ukur = async (jenis: KodeUkur) => {
    if (!target) return;
    const a: Alur = {
      jenis,
      slot: target.slot,
      nama: target.registered ? target.nama_prisma : target.id_prisma,
      tahap: "putar",
    };
    setGagal(null);
    setHasil((p) => ({ ...p, [jenis]: null }));
    setAlur(a);
    try {
      const res = await fetch("/api/kontrol/go-to-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: target.slot, site }),
      });
      const json = await res.json();
      if (!json.success) {
        setAlur(null);
        setGagal({ jenis, pesan: json.error || "Gagal mengirim perintah putar" });
      }
      // Tahap "ukur" menyusul dari handler MQTT setelah TurningTarget `done`.
    } catch (err) {
      console.error("[ArahkanModal] go-to-target", err);
      setAlur(null);
      setGagal({ jenis, pesan: "Terjadi kesalahan jaringan" });
    }
  };

  // ── Tampilan ──────────────────────────────────────────────────────────────

  const tombol =
    "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

  const matiArah = terkunci || sibuk || jogStatus === "waiting";

  return (
    <ModalShell
      judul="Arahkan RTS"
      keterangan={`Setiap penekanan memutar teleskop di ${namaPos}.`}
      ikon={<Move className="size-4.5" />}
      lebar="max-w-[440px]"
      onClose={onClose}
      // Alur ukur dua tahap tidak boleh diputus di tengah: menutup dialog
      // membongkar sambungan MQTT-nya, sehingga `turning_target` yang sudah
      // jalan tidak akan pernah disusul `measure_*`. Teleskop terputar tanpa
      // ada yang mengukur, dan protokol tidak punya perintah untuk
      // membatalkannya. Paling lama terkunci sampai batas menunggu di atas.
      bisaDitutup={!sibuk}
    >
      <div className="flex flex-col gap-4">
        {/* ── Prisma target ──
            Yang menentukan backsight/foresight adalah slot ini, bukan perintah
            ukurnya: measure_bs/measure_fs tidak punya parameter target. */}
        <div>
          <label htmlFor="slot-arahkan" className={LABEL}>
            Prisma target
          </label>
          {slotTerdaftar.length === 0 ? (
            <p className="rounded-[10px] bg-(--paper) px-3.5 py-2.5 text-[12.5px] leading-relaxed text-(--ink-2)">
              Belum ada slot terdaftar di site ini. Daftarkan prisma lewat Set/Edit di daftar
              slot sebelum bisa diukur — teleskop hanya bisa diputar ke slot yang sudah
              direkam di instrumen.
            </p>
          ) : (
            <>
              <select
                id="slot-arahkan"
                value={target?.slot ?? ""}
                onChange={(e) => setSlotPilihan(Number(e.target.value))}
                disabled={sibuk}
                className="h-9 w-full cursor-pointer rounded-[9px] bg-white px-3 text-[13px] text-(--ink) ring-1 ring-(--line) outline-none transition-colors focus:ring-2 focus:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {slotTerdaftar.map((s) => (
                  <option key={s.slot} value={s.slot}>
                    Slot {s.slot} · {s.id_prisma} — {s.nama_prisma}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-(--ink-3)">
                Backsight dan Foresight di bawah memutar teleskop ke slot ini lebih dulu, lalu
                mengukur. Perannya ditentukan tombol yang ditekan, bukan slotnya — satu prisma
                bisa diukur sebagai keduanya.
              </p>
            </>
          )}
        </div>

        {/* ── Sudut sekarang ── */}
        <div className="rounded-[10px] bg-(--paper) px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Sudut instrumen sekarang</Eyebrow>
            <button
              type="button"
              onClick={bacaHaVa}
              disabled={haVaLoading || terkunci || sibuk}
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

        {/* ── Pemilih langkah ──
            Semuanya derajat sekarang; lihat catatan di LANGKAH_JOG. */}
        <div>
          <p className={LABEL}>Besar langkah</p>
          <div className="grid grid-cols-3 gap-2">
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

        {/* ── Tombol arah ── */}
        <div className="flex flex-col items-center gap-2">
          <TombolArah arah="atas" mati={matiArah} onJog={jog}>
            <ChevronUp className="size-5" />
          </TombolArah>
          <div className="flex items-center gap-2">
            <TombolArah arah="kiri" mati={matiArah} onJog={jog}>
              <ChevronLeft className="size-5" />
            </TombolArah>
            <div className="flex size-11 items-center justify-center rounded-[10px] bg-(--paper) font-mono text-[11px] font-semibold tabular-nums text-(--ink-2)">
              {jogStatus === "waiting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                LANGKAH_JOG.find((l) => l.derajat === langkahJog)?.label
              )}
            </div>
            <TombolArah arah="kanan" mati={matiArah} onJog={jog}>
              <ChevronRight className="size-5" />
            </TombolArah>
          </div>
          <TombolArah arah="bawah" mati={matiArah} onJog={jog}>
            <ChevronDown className="size-5" />
          </TombolArah>
        </div>

        {/* VA adalah sudut zenit, bukan elevasi. Disebut supaya operator tahu
            kenapa angkanya mengecil saat mendongak.

            Batas ZA 30°–150° tidak dijaga aplikasi maupun firmware — di luar
            itu instrumen menolak DIAM-DIAM, dan satu-satunya jejaknya adalah
            `Rotate` gagal dengan alasan `no_response` setelah menunggu. */}
        <p className="text-center text-[11px] leading-relaxed text-(--ink-3)">
          Atas/bawah mengubah VA (sudut zenit — mendongak membuat angkanya mengecil),
          kiri/kanan mengubah HA. Teropong hanya bisa dipakai sekitar VA 30°–150°.
        </p>

        {/* ── Titik awal → tujuan dari balasan `target` ── */}
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
                  <span className="ml-1.5 font-sans text-[10.5px] text-(--ink-3)">desimal</span>
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

        {/* ── Ukur ── */}
        <div className="border-t border-(--line) pt-4">
          <p className={LABEL}>Ukur prisma terpilih</p>
          <div className="grid grid-cols-2 gap-2">
            {(["bs", "fs"] as const).map((kode) => (
              <button
                key={kode}
                type="button"
                onClick={() => ukur(kode)}
                disabled={terkunci || sibuk || jogStatus === "waiting"}
                className={cn(
                  tombol,
                  "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                )}
              >
                {alur?.jenis === kode ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Ruler className="size-4" />
                )}
                {JENIS_UKUR[kode].label}
              </button>
            ))}
          </div>

          {/* Tahap yang sedang berjalan disebut eksplisit: putarannya sendiri
              bisa 20 detik, dan tanpa keterangan ini indikator yang berputar
              lama terlihat seperti macet. */}
          {alur && (
            <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-(--ink-2)">
              <Loader2 className="size-3.5 animate-spin text-(--navy)" />
              {alur.tahap === "putar"
                ? `Memutar ke slot ${alur.slot} (${alur.nama})…`
                : `Mengukur ${JENIS_UKUR[alur.jenis].label} di slot ${alur.slot} (${alur.nama})…`}
            </p>
          )}

          {(["bs", "fs"] as const).map((kode) => {
            const h = hasil[kode];
            if (!h) return null;
            return (
              <div key={kode} className="mt-2 rounded-[10px] bg-(--paper) px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Eyebrow>{JENIS_UKUR[kode].label}</Eyebrow>
                  <span className="text-[11px] text-(--ink-3)">
                    slot {h.slot} · {h.nama}
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px] tabular-nums text-(--ink)">
                  <div className="flex justify-between gap-2">
                    <dt className="text-(--ink-3)">HA</dt>
                    <dd>{h.data.HADMS}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-(--ink-3)">VA</dt>
                    <dd>{h.data.VADMS}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-(--ink-3)">SD</dt>
                    <dd>{h.data.SDis}</dd>
                  </div>
                  {/* HD hanya ada di balasan ini — payload data berkala tidak
                      memuat jarak horizontal sama sekali. */}
                  <div className="flex justify-between gap-2">
                    <dt className="text-(--ink-3)">HD</dt>
                    <dd>{h.data.HD}</dd>
                  </div>
                </dl>
              </div>
            );
          })}

          {gagal && (
            <div className="mt-2 flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
              <span>{gagal.pesan}</span>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
