"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Crosshair, Loader2, Send, Square, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/monitoring/panel";
import {
  INPUT,
  LABEL,
  ModalShell,
  TOMBOL_BAHAYA,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import { validasiSapuan } from "@/lib/protokol-rts";
import {
  arahGagalTerkirim,
  BATAS_JAWAB_PERTAMA_MS,
  formatDurasi,
  formatMeter,
  lebarDiJarak,
  mulaiArah,
  mulaiKirim,
  tutupTanpaJawaban,
  type EntriRiwayatUji,
  type KeadaanSapuan,
  type ParameterUji,
} from "@/lib/uji-sapuan";

/**
 * Batas tunggu balasan pertama firmware. Dipasang di HALAMAN, bukan di modal:
 * menutup modal tidak boleh membuat sapuan yang sudah dikirim menggantung di
 * "mengirim" selamanya.
 */
export function useBatasJawabSapuan(
  keadaan: KeadaanSapuan,
  setKeadaan: Dispatch<SetStateAction<KeadaanSapuan>>
) {
  const mengirim = keadaan.fase === "mengirim";
  const mulaiMs = keadaan.mulaiMs;
  useEffect(() => {
    if (!mengirim) return;
    const t = setTimeout(
      () =>
        setKeadaan((k) =>
          tutupTanpaJawaban(
            k,
            `Logger tidak menjawab dalam ${BATAS_JAWAB_PERTAMA_MS / 1000} detik. Periksa koneksi logger dan instrumen, lalu coba lagi.`
          )
        ),
      BATAS_JAWAB_PERTAMA_MS
    );
    return () => clearTimeout(t);
  }, [mengirim, mulaiMs, setKeadaan]);
}

/**
 * Titik awal, BUKAN rekomendasi. Angka yang cocok untuk target jauh baru
 * diketahui dari uji lapangan — itulah gunanya panel ini.
 */
const PRESET = [
  { nama: "Contoh dokumen", step: "0,30,00", Hlebar: "1,00,00", Vlebar: "1,00,00", rehat: "500" },
  { nama: "Halus", step: "0,10,00", Hlebar: "0,30,00", Vlebar: "0,30,00", rehat: "500" },
];

const LABEL_FASE: Record<KeadaanSapuan["fase"], string> = {
  diam: "Siap",
  mengirim: "Menunggu logger…",
  berjalan: "Menyapu",
  selesai: "Selesai",
  ditolak: "Berhenti",
};

const LABEL_TAHAP: Record<string, string> = {
  check: "Memeriksa instrumen menyala",
  read: "Membaca arah bidik (titik tengah)",
  sweep: "Menyapu titik demi titik",
  search: "AutoSearch instrumen",
  measure: "Mengukur",
};

const LABEL_HASIL: Record<EntriRiwayatUji["hasil"], string> = {
  ketemu: "Ketemu",
  gagal: "Tidak ketemu",
  dibatalkan: "Dibatalkan",
  ditolak: "Berhenti",
};

const WARNA_HASIL: Record<EntriRiwayatUji["hasil"], string> = {
  ketemu: "text-(--st-normal)",
  gagal: "text-(--st-awas)",
  dibatalkan: "text-(--ink-3)",
  ditolak: "text-(--st-awas)",
};

async function kirimJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && data.success === true, data };
  } catch {
    return { ok: false, data: { error: "Tidak bisa menghubungi server" } };
  }
}

function ringkasParameter(p: ParameterUji): string {
  return `${p.step} ±${p.Hlebar}/${p.Vlebar}${p.rehat ? ` · ${p.rehat} ms` : ""}`;
}

export function UjiSapuanModal({
  site,
  slotList,
  terkunci,
  keadaan,
  setKeadaan,
  onClose,
}: {
  site: string;
  slotList: number[];
  /** Alasan perintah gerak tidak boleh dikirim sekarang (logger putus, dll). */
  terkunci: string | null;
  keadaan: KeadaanSapuan;
  setKeadaan: Dispatch<SetStateAction<KeadaanSapuan>>;
  onClose: () => void;
}) {
  const [slot, setSlot] = useState(keadaan.parameter?.slot?.toString() ?? keadaan.arahSlot?.toString() ?? slotList[0]?.toString() ?? "");
  const [jarak, setJarak] = useState(keadaan.parameter?.jarakM?.toString() ?? "");
  const [step, setStep] = useState(keadaan.parameter?.step ?? PRESET[0].step);
  const [hlebar, setHlebar] = useState(keadaan.parameter?.Hlebar ?? PRESET[0].Hlebar);
  const [vlebar, setVlebar] = useState(keadaan.parameter?.Vlebar ?? PRESET[0].Vlebar);
  const [rehat, setRehat] = useState(keadaan.parameter?.rehat ?? PRESET[0].rehat);
  const [galat, setGalat] = useState("");
  const [tersalin, setTersalin] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const aktif = keadaan.fase === "mengirim" || keadaan.fase === "berjalan";

  // Jam berdetak hanya selama sapuan aktif — cukup untuk waktu berjalan.
  useEffect(() => {
    if (!aktif) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aktif]);

  const cek = useMemo(
    () => validasiSapuan({ step, Hlebar: hlebar, Vlebar: vlebar, rehat }),
    [step, hlebar, vlebar, rehat]
  );
  const jarakM = Number(jarak) > 0 ? Number(jarak) : null;
  const nomorSlot = Number(slot);

  const arahkan = async () => {
    if (!Number.isInteger(nomorSlot) || nomorSlot < 1) return;
    setGalat("");
    setKeadaan((k) => mulaiArah(k, nomorSlot));
    const { ok, data } = await kirimJson("/api/kontrol/go-to-target", { slot_id: nomorSlot, site });
    if (!ok) {
      setKeadaan((k) => arahGagalTerkirim(k));
      setGalat(String(data.error ?? "Gagal mengirim perintah arahkan"));
    }
  };

  const mulai = async () => {
    if (!cek.ok) return;
    setGalat("");
    const parameter: ParameterUji = {
      slot: Number.isInteger(nomorSlot) && nomorSlot > 0 ? nomorSlot : null,
      step: step.trim(),
      Hlebar: hlebar.trim(),
      Vlebar: vlebar.trim(),
      rehat: rehat.trim(),
      jarakM,
      titik: cek.rencana.titik,
    };
    setKeadaan((k) => mulaiKirim(k, parameter, Date.now()));
    const { ok, data } = await kirimJson("/api/kontrol/auto-search-custom", {
      site,
      aksi: "mulai",
      step: parameter.step,
      Hlebar: parameter.Hlebar,
      Vlebar: parameter.Vlebar,
      rehat: parameter.rehat === "" ? undefined : parameter.rehat,
    });
    if (!ok) {
      setKeadaan((k) => tutupTanpaJawaban(k, String(data.error ?? "Gagal mengirim perintah")));
      return;
    }
    const d = data.data as { mqtt_sent?: boolean } | undefined;
    if (d?.mqtt_sent === false) {
      setKeadaan((k) => tutupTanpaJawaban(k, "Perintah tidak sampai ke broker MQTT. Instrumen tidak bergerak."));
    }
  };

  const stop = async () => {
    setGalat("");
    const { ok, data } = await kirimJson("/api/kontrol/auto-search-custom", { site, aksi: "stop" });
    if (!ok) setGalat(String(data.error ?? "Gagal mengirim perintah stop"));
  };

  const salin = async () => {
    const baris = keadaan.riwayat.map((e) =>
      [
        new Date(e.waktuMs).toLocaleString("id-ID"),
        e.parameter.slot ?? "",
        e.parameter.jarakM ?? "",
        e.parameter.step,
        e.parameter.Hlebar,
        e.parameter.Vlebar,
        e.parameter.rehat,
        e.parameter.titik,
        LABEL_HASIL[e.hasil],
        e.SDis ?? "",
        e.titikKe ?? "",
        e.durasiDetik,
      ].join("\t")
    );
    const kepala = ["waktu", "slot", "jarak_m", "step", "Hlebar", "Vlebar", "rehat_ms", "titik", "hasil", "SDis", "titik_ke", "durasi_dtk"].join("\t");
    try {
      await navigator.clipboard.writeText([kepala, ...baris].join("\n"));
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setGalat("Peramban menolak menyalin ke clipboard.");
    }
  };

  const persen =
    keadaan.dari && keadaan.dari > 0 ? Math.min(100, Math.round((keadaan.tembakan / keadaan.dari) * 100)) : 0;
  const lamaDetik = keadaan.mulaiMs === null ? 0 : Math.max(0, Math.round((now - keadaan.mulaiMs) / 1000));

  const tombolMulaiMati = !!terkunci || aktif || !cek.ok || keadaan.arah === "menunggu";

  return (
    <ModalShell
      judul="Uji sapuan custom"
      keterangan="Menyapu dengan langkah dan rentang pilihan sendiri, sekali jalan. Untuk menguji target jauh, di mana jendela bawaan terlalu kasar."
      ikon={<Crosshair className="size-4.5" />}
      lebar="max-w-[760px]"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={TOMBOL_SEKUNDER}>
          Tutup
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          role="note"
          className="flex items-start gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Instrumen <strong>akan berputar</strong>. Titik tengah sapuan adalah arah bidik{" "}
            <strong>saat sapuan dimulai</strong>, jadi arahkan ke perkiraan posisi prisma dulu.
            Setelan tersimpan di instrumen tidak diubah.
          </p>
        </div>

        {terkunci && (
          <p className="text-[12px] font-medium text-(--st-awas)" role="status">
            {terkunci}.
          </p>
        )}

        {/* ── 1. Arahkan ── */}
        <section aria-labelledby="us-arah" className="rounded-[12px] border border-(--line) p-3.5">
          <h4 id="us-arah" className="mb-2.5 text-[13px] font-bold text-(--ink)">
            1 · Arahkan ke target
          </h4>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="us-slot" className={LABEL}>
                Slot target
              </label>
              <select
                id="us-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                disabled={aktif}
                className={cn(INPUT, "font-mono")}
              >
                {slotList.length === 0 && <option value="">Belum ada prisma</option>}
                {slotList.map((s) => (
                  <option key={s} value={s}>
                    P{s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="us-jarak" className={LABEL}>
                Jarak perkiraan (m){" "}
                <span className="font-normal text-(--ink-3)">catatan, tidak dikirim</span>
              </label>
              <input
                id="us-jarak"
                type="number"
                min={0}
                inputMode="numeric"
                value={jarak}
                onChange={(e) => setJarak(e.target.value)}
                placeholder="1200"
                className={cn(INPUT, "font-mono tabular-nums")}
              />
            </div>
            <button
              type="button"
              onClick={arahkan}
              disabled={!!terkunci || aktif || !slot || keadaan.arah === "menunggu"}
              className={TOMBOL_SEKUNDER}
            >
              {keadaan.arah === "menunggu" ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
              Arahkan
            </button>
          </div>
          {keadaan.arah !== "diam" && (
            <p
              role="status"
              className={cn(
                "mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium",
                keadaan.arah === "selesai" && "text-(--st-normal)",
                keadaan.arah === "gagal" && "text-(--st-awas)",
                keadaan.arah === "menunggu" && "text-(--ink-2)"
              )}
            >
              {keadaan.arah === "menunggu" && <Loader2 className="size-3.5 animate-spin" />}
              {keadaan.arah === "selesai" && <CheckCircle2 className="size-3.5" />}
              {keadaan.arah === "gagal" && <XCircle className="size-3.5" />}
              {keadaan.arah === "menunggu" && `Memutar ke P${keadaan.arahSlot}…`}
              {keadaan.arah === "selesai" && `Instrumen sudah mengarah ke P${keadaan.arahSlot}`}
              {keadaan.arah === "gagal" && `Gagal mengarah ke P${keadaan.arahSlot}`}
            </p>
          )}
        </section>

        {/* ── 2. Parameter ── */}
        <section aria-labelledby="us-param" className="rounded-[12px] border border-(--line) p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h4 id="us-param" className="text-[13px] font-bold text-(--ink)">
              2 · Parameter sapuan
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-(--ink-3)">Titik awal:</span>
              {PRESET.map((p) => (
                <button
                  key={p.nama}
                  type="button"
                  disabled={aktif}
                  onClick={() => {
                    setStep(p.step);
                    setHlebar(p.Hlebar);
                    setVlebar(p.Vlebar);
                    setRehat(p.rehat);
                  }}
                  className={cn(TOMBOL_SEKUNDER, "h-7 px-2.5 text-[11.5px]")}
                >
                  {p.nama}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="us-step" className={LABEL}>
                Step <span className="font-normal text-(--ink-3)">HA &amp; VA</span>
              </label>
              <input id="us-step" value={step} onChange={(e) => setStep(e.target.value)} disabled={aktif} placeholder="0,30,00" className={cn(INPUT, "font-mono tabular-nums")} />
            </div>
            <div>
              <label htmlFor="us-hlebar" className={LABEL}>
                Hlebar <span className="font-normal text-(--ink-3)">± tiap sisi</span>
              </label>
              <input id="us-hlebar" value={hlebar} onChange={(e) => setHlebar(e.target.value)} disabled={aktif} placeholder="1,00,00" className={cn(INPUT, "font-mono tabular-nums")} />
            </div>
            <div>
              <label htmlFor="us-vlebar" className={LABEL}>
                Vlebar <span className="font-normal text-(--ink-3)">± tiap sisi</span>
              </label>
              <input id="us-vlebar" value={vlebar} onChange={(e) => setVlebar(e.target.value)} disabled={aktif} placeholder="1,00,00" className={cn(INPUT, "font-mono tabular-nums")} />
            </div>
            <div>
              <label htmlFor="us-rehat" className={LABEL}>
                Rehat <span className="font-normal text-(--ink-3)">ms, 0–10000</span>
              </label>
              <input id="us-rehat" type="number" min={0} max={10000} value={rehat} onChange={(e) => setRehat(e.target.value)} disabled={aktif} placeholder="500" className={cn(INPUT, "font-mono tabular-nums")} />
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-3)">
            Sudut dalam <span className="font-mono">d,m,s</span> atau derajat desimal; lebih dari 0 dan
            paling besar 45°. Rehat kosong memakai setelan tersimpan di instrumen.
          </p>

          <div aria-live="polite" className="mt-3 rounded-[10px] bg-(--paper) px-3.5 py-2.5 text-[12.5px] leading-relaxed">
            {cek.ok ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    <span className="font-mono font-semibold tabular-nums text-(--ink)">{cek.rencana.titik}</span> titik
                  </span>
                  <span>
                    minimal{" "}
                    <span className="font-mono font-semibold tabular-nums text-(--ink)">{formatDurasi(cek.rencana.minimalDetik)}</span>
                  </span>
                  <span className="text-(--ink-3)">belum termasuk waktu ukur tiap titik</span>
                </div>
                {jarakM !== null && (
                  <p className="mt-1 text-(--ink-2)">
                    Di {Math.round(jarakM)} m: langkah ≈{" "}
                    <span className="font-mono tabular-nums">{formatMeter(lebarDiJarak(cek.rencana.stepDerajat, jarakM))}</span>, jangkauan HA ±
                    <span className="font-mono tabular-nums">{formatMeter(lebarDiJarak(cek.rencana.hlebarDerajat, jarakM))}</span>, VA ±
                    <span className="font-mono tabular-nums">{formatMeter(lebarDiJarak(cek.rencana.vlebarDerajat, jarakM))}</span>.
                  </p>
                )}
                {cek.rencana.minimalDetik > 600 && (
                  <p className="mt-1 font-medium text-amber-800">
                    Sapuan ini lama dan menahan instrumen. Perbesar step atau perkecil lebar kalau tidak perlu.
                  </p>
                )}
              </>
            ) : (
              <p className="font-medium text-(--st-awas)">{cek.galat}</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={mulai} disabled={tombolMulaiMati} className={TOMBOL_UTAMA}>
              {keadaan.fase === "mengirim" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Mulai sapuan{cek.ok ? ` (${cek.rencana.titik} titik)` : ""}
            </button>
            <button type="button" onClick={stop} disabled={!aktif || keadaan.stopDiminta} className={TOMBOL_BAHAYA}>
              <Square className="size-3.5 fill-current" />
              {keadaan.stopDiminta ? "Stop diminta…" : "Stop"}
            </button>
            {keadaan.arah === "menunggu" && (
              <span className="text-[12px] text-(--ink-3)">Menunggu instrumen selesai berputar ke target.</span>
            )}
          </div>

          {galat && (
            <p role="alert" className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-(--st-awas)">
              <XCircle className="size-3.5" />
              {galat}
            </p>
          )}
        </section>

        {/* ── 3. Progres ── */}
        {keadaan.fase !== "diam" && (
          <section aria-labelledby="us-progres" className="rounded-[12px] border border-(--line) p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h4 id="us-progres" className="text-[13px] font-bold text-(--ink)">
                3 · Progres
              </h4>
              <div className="flex items-center gap-1.5">
                <Chip
                  className={cn(
                    keadaan.fase === "selesai" && "text-(--st-normal)",
                    keadaan.fase === "ditolak" && "text-(--st-awas)"
                  )}
                >
                  {aktif && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                  {LABEL_FASE[keadaan.fase]}
                </Chip>
                {keadaan.mulaiMs !== null && <Chip mono>{formatDurasi(lamaDetik)}</Chip>}
              </div>
            </div>

            {aktif && keadaan.tahap && (
              <p className="mb-2 text-[12.5px] text-(--ink-2)">{LABEL_TAHAP[keadaan.tahap] ?? keadaan.tahap}</p>
            )}

            {keadaan.dari !== null && keadaan.dari > 0 && (
              <div className="mb-3">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={keadaan.dari}
                  aria-valuenow={keadaan.tembakan}
                  aria-label="Titik tersapu"
                  className="h-2 overflow-hidden rounded-full bg-(--paper) ring-1 ring-(--line)"
                >
                  <div className="h-full rounded-full bg-(--navy) transition-[width]" style={{ width: `${persen}%` }} />
                </div>
                <p className="mt-1 font-mono text-[11.5px] tabular-nums text-(--ink-3)">
                  titik {keadaan.tembakan} / {keadaan.dari} · {persen}%
                </p>
              </div>
            )}

            {keadaan.titikTerakhir.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[12px]">
                  <thead>
                    <tr className="text-(--ink-3)">
                      <th className="py-1 pr-3 font-medium">Titik</th>
                      <th className="py-1 pr-3 font-medium">HA</th>
                      <th className="py-1 pr-3 font-medium">VA</th>
                      <th className="py-1 font-medium">Jarak miring</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {[...keadaan.titikTerakhir].reverse().map((t) => (
                      <tr key={t.tembakan} className="border-t border-(--line)">
                        <td className="py-1 pr-3">{t.tembakan}</td>
                        <td className="py-1 pr-3">{t.ha ?? "–"}</td>
                        <td className="py-1 pr-3">{t.va ?? "–"}</td>
                        <td className={cn("py-1", t.kena ? "font-semibold text-(--st-normal)" : "text-(--ink-3)")}>
                          {t.rotateGagal ? "putar gagal" : t.kena ? `${t.SDis} m` : "belum kena"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {keadaan.penutup && keadaan.fase === "berjalan" && (
              <p className="mb-2 text-[12.5px] text-(--ink-2)">
                Sapuan ditutup ({keadaan.penutup.nilai}
                {keadaan.penutup.titikKe ? ` di titik ${keadaan.penutup.titikKe}` : ""}); menunggu hasil akhir…
              </p>
            )}

            {keadaan.fase === "selesai" && keadaan.hasil && (
              <div
                role="status"
                className={cn(
                  "rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                  keadaan.hasil.hasil === "ketemu" && keadaan.penutup?.nilai !== "dibatalkan"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-(--line) bg-(--paper) text-(--ink-2)"
                )}
              >
                {keadaan.penutup?.nilai === "dibatalkan" ? (
                  <p className="font-semibold">Sapuan dibatalkan di titik {keadaan.tembakan} dari {keadaan.dari}.</p>
                ) : keadaan.hasil.hasil === "ketemu" ? (
                  <>
                    <p className="font-semibold">
                      Prisma ketemu{keadaan.penutup?.titikKe ? ` di titik ${keadaan.penutup.titikKe}` : ""}.
                    </p>
                    <p className="mt-0.5 font-mono tabular-nums">
                      Jarak miring {keadaan.hasil.SDis} m · HA {keadaan.hasil.HA} · VA {keadaan.hasil.VA}
                    </p>
                  </>
                ) : (
                  <p className="font-semibold">
                    Prisma tidak ketemu setelah {keadaan.dari ?? "semua"} titik. Coba rentang lebih lebar, atau
                    periksa arah bidik awal.
                  </p>
                )}
              </div>
            )}

            {keadaan.fase === "ditolak" && (
              <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-red-800">
                <p className="font-semibold">{keadaan.pesan}</p>
                {keadaan.keterangan && <p className="mt-0.5">{keadaan.keterangan}</p>}
              </div>
            )}
          </section>
        )}

        {/* ── 4. Riwayat ── */}
        <section aria-labelledby="us-riwayat" className="rounded-[12px] border border-(--line) p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h4 id="us-riwayat" className="text-[13px] font-bold text-(--ink)">
              Riwayat uji <span className="font-normal text-(--ink-3)">sesi halaman ini, hilang saat dimuat ulang</span>
            </h4>
            <button type="button" onClick={salin} disabled={keadaan.riwayat.length === 0} className={cn(TOMBOL_SEKUNDER, "h-7 px-2.5 text-[11.5px]")}>
              <ClipboardCopy className="size-3.5" />
              {tersalin ? "Tersalin" : "Salin tabel"}
            </button>
          </div>
          {keadaan.riwayat.length === 0 ? (
            <p className="text-[12.5px] text-(--ink-3)">Belum ada uji. Hasil tiap sapuan dicatat di sini untuk dibandingkan antar jarak.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12px]">
                <thead>
                  <tr className="text-(--ink-3)">
                    <th className="py-1 pr-3 font-medium">Jam</th>
                    <th className="py-1 pr-3 font-medium">Slot</th>
                    <th className="py-1 pr-3 font-medium">Jarak</th>
                    <th className="py-1 pr-3 font-medium">Parameter</th>
                    <th className="py-1 pr-3 font-medium">Titik</th>
                    <th className="py-1 pr-3 font-medium">Hasil</th>
                    <th className="py-1 font-medium">Lama</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {keadaan.riwayat.map((e) => (
                    <tr key={e.waktuMs} className="border-t border-(--line)">
                      <td className="py-1 pr-3">{new Date(e.waktuMs).toLocaleTimeString("id-ID")}</td>
                      <td className="py-1 pr-3">{e.parameter.slot ? `P${e.parameter.slot}` : "–"}</td>
                      <td className="py-1 pr-3">{e.parameter.jarakM ? `${e.parameter.jarakM} m` : "–"}</td>
                      <td className="py-1 pr-3">{ringkasParameter(e.parameter)}</td>
                      <td className="py-1 pr-3">
                        {e.titikKe ? `${e.titikKe}/` : e.tembakan ? `${e.tembakan}/` : ""}
                        {e.parameter.titik}
                      </td>
                      <td className={cn("py-1 pr-3 font-sans font-semibold", WARNA_HASIL[e.hasil])}>
                        {LABEL_HASIL[e.hasil]}
                        {e.SDis ? ` · ${e.SDis} m` : ""}
                      </td>
                      <td className="py-1">{formatDurasi(e.durasiDetik)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
