"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Compass, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, Panel, PanelHeader } from "@/components/monitoring/panel";
import { INPUT, TOMBOL_SEKUNDER, TOMBOL_UTAMA } from "@/components/monitoring/modal-shell";

/**
 * Koordinat survei backsight dan nol set horizontal RTS.
 *
 * Nol set = azimut RTS->BS dari koordinat survei − HA BS terukur, dirata-rata
 * sirkular untuk semua BS, dihitung SEKALI dari sesi acuan (R0). Panel ini
 * tidak menerapkannya diam-diam: operator melihat hasil hitungan, pemeriksaan
 * jarak dan tinggi tiap BS, lalu pratinjau berapa baris riwayat yang akan
 * dihitung ulang sebelum menerapkan. Lihat src/lib/orientasi-bs.ts.
 */

type Koor = { E: number; N: number; H: number | null };
type DataBs = {
  id_prisma: string;
  nama: string;
  koor: Koor | null;
  bacaan: { ha: number; va: number; sd: number; n: number } | null;
  hasil: { z: number; bedaJarakMm: number; hiMinHt: number | null } | null;
};
type DataOrientasi = {
  stasiun: { E: number; N: number; H: number } | null;
  tinggiAlat: number;
  faktor: number;
  satuan: string;
  lingkaran: number;
  koreksiAktif: boolean;
  nolSetSekarang: number | null;
  /** "YYYY-MM-DDTHH:mm" atau null (semua sesi). */
  pemasanganSejak: string | null;
  sesi: { id_log: string; waktu: string | null; r0: boolean } | null;
  bs: DataBs[];
  riwayatCek: Array<{
    id_log: string;
    waktu: string;
    cek: { perBs: Array<{ id: string; dZMili: number }>; dZMili: number | null; lewat: boolean; sepakat: boolean | null };
  }>;
  ambangCekMili: number;
  hasil: {
    z: number;
    sebaranMili: number;
    jumlahBs: number;
    selisihSekarangMili: number | null;
    selisihSekarang: number | null;
  } | null;
};
type Laporan = {
  tabel: Array<{ tabel: string; baris: number; berubah: number; dilewati: number; rataGeserM: number; maksGeserM: number }>;
  tempPrisma: number;
  diterapkan: boolean;
  sejak: string | null;
  sesiDilewati: number;
};

const fmt = (n: number | null | undefined, d: number) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

/** "464253,194" dan "464253.194" sama-sama diterima. */
const keAngka = (s: string) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};

/** HA "164.2461" gon -> "164,24,61" seperti di daftar slot. */
const sudutAlat = (v: number) => {
  const utuh = Math.floor(v);
  const sisa = Math.round((v - utuh) * 10000);
  return `${String(utuh).padStart(3, "0")},${String(Math.floor(sisa / 100)).padStart(2, "0")},${String(sisa % 100).padStart(2, "0")}`;
};

/** Selisih jarak di atas ini (mm) ditandai: hampir pasti slot dipasangkan ke titik survei yang salah. */
const BATAS_JARAK_MM = 500;

export function OrientasiBsPanel({
  site,
  terbuka,
  className,
  style,
}: {
  site: string;
  terbuka: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [data, setData] = useState<DataOrientasi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [isian, setIsian] = useState<Record<string, { E: string; N: string; H: string }>>({});
  const [simpanKoor, setSimpanKoor] = useState<"idle" | "kirim" | "ok">("idle");
  const [nolSet, setNolSet] = useState("");
  const [tinggiAlat, setTinggiAlat] = useState("");
  const [sejak, setSejak] = useState("");
  const [pratinjau, setPratinjau] = useState<{ kunci: string; laporan: Laporan } | null>(null);
  const [proses, setProses] = useState<"idle" | "pratinjau" | "terapkan">("idle");
  const [hasilTerapkan, setHasilTerapkan] = useState<Laporan | null>(null);

  const muat = useCallback(async () => {
    if (!site) return;
    setMemuat(true);
    setGalat("");
    try {
      const res = await fetch(`/api/prism-config/orientasi-bs?site=${encodeURIComponent(site)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat");
      const d: DataOrientasi = json.data;
      setData(d);
      setIsian(
        Object.fromEntries(
          d.bs.map((b) => [
            b.id_prisma,
            {
              E: b.koor ? String(b.koor.E) : "",
              N: b.koor ? String(b.koor.N) : "",
              H: b.koor?.H !== null && b.koor?.H !== undefined ? String(b.koor.H) : "",
            },
          ])
        )
      );
      setNolSet(d.hasil ? d.hasil.z.toFixed(4) : d.nolSetSekarang !== null ? d.nolSetSekarang.toFixed(4) : "");
      setTinggiAlat(String(d.tinggiAlat));
      setSejak(d.pemasanganSejak ?? "");
      setPratinjau(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setMemuat(false);
    }
  }, [site]);

  useEffect(() => {
    setHasilTerapkan(null);
    muat();
  }, [muat]);

  const koorBerubah = useMemo(() => {
    if (!data) return false;
    return data.bs.some((b) => {
      const i = isian[b.id_prisma];
      if (!i) return false;
      const asli = {
        E: b.koor ? b.koor.E : null,
        N: b.koor ? b.koor.N : null,
        H: b.koor?.H ?? null,
      };
      return keAngka(i.E) !== asli.E || keAngka(i.N) !== asli.N || keAngka(i.H) !== asli.H;
    });
  }, [data, isian]);

  const simpanKoordinat = async () => {
    setSimpanKoor("kirim");
    setGalat("");
    try {
      const res = await fetch("/api/prism-config/orientasi-bs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          koordinat: Object.entries(isian).map(([id_prisma, v]) => ({
            id_prisma,
            E: keAngka(v.E),
            N: keAngka(v.N),
            H: keAngka(v.H),
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      setSimpanKoor("ok");
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
      setSimpanKoor("idle");
    }
  };

  const nilaiNolSet = keAngka(nolSet);
  const nilaiTinggi = keAngka(tinggiAlat);
  const kunciUsulan = `${nilaiNolSet}|${nilaiTinggi}|${sejak}`;
  const usulanSah =
    nilaiNolSet !== null &&
    Number.isFinite(nilaiNolSet) &&
    nilaiTinggi !== null &&
    Number.isFinite(nilaiTinggi) &&
    data !== null &&
    nilaiNolSet >= 0 &&
    nilaiNolSet < data.lingkaran;

  const kirimNolSet = async (terapkan: boolean) => {
    setProses(terapkan ? "terapkan" : "pratinjau");
    setGalat("");
    try {
      const res = await fetch("/api/prism-config/orientasi-bs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, nolSet: nilaiNolSet, tinggiAlat: nilaiTinggi, sejak: sejak || null, terapkan }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      if (terapkan) {
        setHasilTerapkan(json.data.laporan);
        await muat();
      } else {
        setPratinjau({ kunci: kunciUsulan, laporan: json.data.laporan });
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setProses("idle");
    }
  };

  if (!site) return null;
  const satuan = data?.satuan ?? "gon";
  const selisihMili = data?.hasil?.selisihSekarangMili ?? null;
  const pratinjauBerlaku = pratinjau && pratinjau.kunci === kunciUsulan ? pratinjau.laporan : null;
  const rts = pratinjauBerlaku?.tabel.find((t) => t.tabel === "rts");

  return (
    <Panel className={className} style={style} aria-label="Koordinat backsight dan nol set">
      <PanelHeader title="Koordinat Backsight & nol set">
        {data?.stasiun && (
          <Chip mono>
            RTS {fmt(data.stasiun.E, 3)} / {fmt(data.stasiun.N, 3)} / {fmt(data.stasiun.H, 3)} m
          </Chip>
        )}
        {data?.sesi ? (
          <Chip mono>
            bacaan BS: sesi {data.sesi.id_log}
            {data.sesi.r0 ? " (R0)" : ""}
          </Chip>
        ) : (
          data && <span>belum ada tembakan BS sah</span>
        )}
        {!terbuka && <span>hanya bisa dibaca — buka kunci untuk mengubah</span>}
      </PanelHeader>

      <div className="border-t border-(--line)">
        {memuat && !data ? (
          <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-(--ink-3)">
            <Loader2 className="size-4 animate-spin" /> Memuat…
          </div>
        ) : data && data.bs.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-(--ink-2)">
            Belum ada prisma berjenis Backsight di site ini. Tandai slot BS sebagai Backsight lewat Edit di daftar slot.
          </p>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                    <th className="px-5 py-2">Slot</th>
                    <th className="px-2 py-2">Easting (m)</th>
                    <th className="px-2 py-2">Northing (m)</th>
                    <th className="px-2 py-2">Elevasi (m)</th>
                    <th className="px-2 py-2 text-right">HA terukur</th>
                    <th className="px-2 py-2 text-right">Nol set ({satuan})</th>
                    <th className="px-2 py-2 text-right">Selisih jarak</th>
                    <th className="px-5 py-2 text-right">hi − ht</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bs.map((b) => {
                    const i = isian[b.id_prisma] ?? { E: "", N: "", H: "" };
                    const ubah = (k: "E" | "N" | "H", v: string) => {
                      setSimpanKoor("idle");
                      setIsian((s) => ({ ...s, [b.id_prisma]: { ...i, [k]: v } }));
                    };
                    const jarakJauh = b.hasil && Math.abs(b.hasil.bedaJarakMm) > BATAS_JARAK_MM;
                    return (
                      <tr key={b.id_prisma} className="border-t border-(--line) align-middle">
                        <td className="px-5 py-2">
                          <span className="font-mono font-semibold text-(--ink)">{b.id_prisma}</span>
                          <span className="ml-2 text-(--ink-2)">{b.nama}</span>
                        </td>
                        {(["E", "N", "H"] as const).map((k) => (
                          <td key={k} className="px-2 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={i[k]}
                              onChange={(e) => ubah(k, e.target.value)}
                              disabled={!terbuka}
                              aria-label={`${k} survei ${b.id_prisma}`}
                              placeholder={k === "H" ? "opsional" : "belum disurvei"}
                              className={cn(INPUT, "h-8 w-[140px] font-mono tabular-nums disabled:bg-(--paper) disabled:text-(--ink-2)")}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-(--ink-2)">
                          {b.bacaan ? sudutAlat(b.bacaan.ha) : "—"}
                          {b.bacaan && b.bacaan.n > 1 && (
                            <span className="ml-1 text-[11px] text-(--ink-3)">×{b.bacaan.n}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-(--ink)">
                          {b.hasil ? fmt(b.hasil.z, 4) : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-2 text-right font-mono tabular-nums",
                            jarakJauh ? "font-semibold text-(--st-awas)" : "text-(--ink-2)"
                          )}
                          title="Jarak datar terukur dikurangi jarak dari koordinat survei"
                        >
                          {b.hasil ? `${fmt(b.hasil.bedaJarakMm, 0)} mm` : "—"}
                        </td>
                        <td className="px-5 py-2 text-right font-mono tabular-nums text-(--ink-2)">
                          {b.hasil?.hiMinHt !== null && b.hasil?.hiMinHt !== undefined ? `${fmt(b.hasil.hiMinHt, 3)} m` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.bs.some((b) => b.hasil && Math.abs(b.hasil.bedaJarakMm) > BATAS_JARAK_MM) && (
              <p className="mx-5 mt-3 flex items-start gap-2 rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-900 ring-1 ring-red-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Jarak terukur tidak cocok dengan koordinat survei. Periksa apakah koordinat BS tertukar antar-slot.
              </p>
            )}

            {terbuka && (
              <div className="flex justify-end px-5 pt-3">
                <button
                  type="button"
                  onClick={simpanKoordinat}
                  disabled={!koorBerubah || simpanKoor === "kirim"}
                  className={TOMBOL_SEKUNDER}
                >
                  {simpanKoor === "kirim" && <Loader2 className="size-4 animate-spin" />}
                  {simpanKoor === "ok" && !koorBerubah ? "Koordinat tersimpan" : "Simpan koordinat"}
                </button>
              </div>
            )}

            {/* ── Nol set ── */}
            <div className="mt-3 grid gap-4 border-t border-(--line) px-5 py-4 md:grid-cols-[1fr_1fr_1.3fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">Nol set dari BS</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-(--ink)">
                  {data.hasil ? `${fmt(data.hasil.z, 4)} ${satuan}` : "—"}
                </p>
                <p className="mt-0.5 text-[12px] text-(--ink-3)">
                  {data.hasil
                    ? data.hasil.jumlahBs > 1
                      ? `${data.hasil.jumlahBs} BS, sebaran ±${fmt(data.hasil.sebaranMili, 0)} m${satuan}`
                      : "dari 1 BS"
                    : "isi koordinat survei BS dulu"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">Nol set dipakai</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-(--ink)">
                  {data.nolSetSekarang !== null ? `${fmt(data.nolSetSekarang, 4)} ${satuan}` : "—"}
                </p>
                {selisihMili !== null && (
                  <p
                    className={cn(
                      "mt-0.5 text-[12px]",
                      Math.abs(selisihMili) > 10 ? "font-semibold text-amber-700" : "text-(--ink-3)"
                    )}
                  >
                    {Math.abs(selisihMili) > 10
                      ? `hitungan BS ${fmt(data.hasil?.selisihSekarang, 4)} ${satuan} dari angka ini`
                      : "sesuai hitungan BS"}
                  </p>
                )}
              </div>

              {terbuka && data.koreksiAktif ? (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12px] font-semibold text-(--ink-2)">
                      Nol set baru ({satuan})
                      <input
                        type="text"
                        inputMode="decimal"
                        value={nolSet}
                        onChange={(e) => setNolSet(e.target.value)}
                        className={cn(INPUT, "mt-1 font-mono tabular-nums")}
                      />
                    </label>
                    <label className="text-[12px] font-semibold text-(--ink-2)">
                      Tinggi alat (m)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={tinggiAlat}
                        onChange={(e) => setTinggiAlat(e.target.value)}
                        className={cn(INPUT, "mt-1 font-mono tabular-nums")}
                      />
                    </label>
                    {/* Sesi sebelum pemasangan alat punya nol set sendiri —
                        tidak boleh ikut diputar saat hitung ulang. */}
                    <label className="col-span-2 text-[12px] font-semibold text-(--ink-2)">
                      Alat dipasang sejak
                      <input
                        type="datetime-local"
                        value={sejak}
                        onChange={(e) => setSejak(e.target.value)}
                        className={cn(INPUT, "mt-1 font-mono tabular-nums")}
                      />
                      <span className="mt-1 block text-[11.5px] font-normal text-(--ink-3)">
                        Sesi sebelum waktu ini tidak dihitung ulang. Kosong = semua sesi site.
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => kirimNolSet(false)}
                      disabled={!usulanSah || proses !== "idle"}
                      className={TOMBOL_SEKUNDER}
                    >
                      {proses === "pratinjau" ? <Loader2 className="size-4 animate-spin" /> : <Compass className="size-4" />}
                      Pratinjau
                    </button>
                    <button
                      type="button"
                      onClick={() => kirimNolSet(true)}
                      disabled={!usulanSah || !pratinjauBerlaku || proses !== "idle"}
                      className={TOMBOL_UTAMA}
                    >
                      {proses === "terapkan" && <Loader2 className="size-4 animate-spin" />}
                      Terapkan + hitung ulang riwayat
                    </button>
                  </div>
                  <p className="text-[12px] leading-relaxed text-(--ink-3)">
                    {pratinjauBerlaku && rts
                      ? `${rts.berubah.toLocaleString("id-ID")} dari ${rts.baris.toLocaleString("id-ID")} baris tembakan akan dihitung ulang dari HA/VA/SD mentah (geser posisi rata-rata ${fmt(rts.rataGeserM, 1)} m). R0 ikut dihitung ulang, jadi pergeseran tidak melompat.` +
                        (pratinjauBerlaku.sesiDilewati > 0
                          ? ` ${pratinjauBerlaku.sesiDilewati.toLocaleString("id-ID")} sesi sebelum pemasangan tidak diubah.`
                          : "")
                      : "Pratinjau dulu: menerapkan menulis ulang E/N/Z R0 dan riwayat site ini sejak pemasangan alat dengan nol set dan tinggi alat baru."}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-(--ink-3)">
                  {data.koreksiAktif
                    ? "Buka kunci untuk menerapkan nol set baru."
                    : "Site ini belum memakai koreksi azimut (ha_faktor_derajat dan ha_orientasi_deg kosong)."}
                </p>
              )}
            </div>

            {/* ── Cek orientasi tiap siklus ──
                Bacaan BS tiap sesi dibandingkan dengan sesi acuan. Bukan
                koreksi: kalau semua BS bergeser serupa, alatnya yang berputar
                dan pergeseran sesi itu belum bisa dipercaya. */}
            {data.riwayatCek.length > 0 && (
              <div className="border-t border-(--line) px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                  Cek orientasi tiap siklus
                </p>
                <p className="mt-0.5 text-[12px] text-(--ink-3)">
                  Perubahan nol set menurut tiap BS terhadap sesi {data.sesi?.id_log}. Ambang ±{data.ambangCekMili} m{satuan};
                  tidak memicu EWS.
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                        <th className="py-1.5 pr-3">Sesi</th>
                        {data.bs.map((b) => (
                          <th key={b.id_prisma} className="px-2 py-1.5 text-right">
                            {b.nama}
                          </th>
                        ))}
                        <th className="px-2 py-1.5 text-right">Rata-rata</th>
                        <th className="py-1.5 pl-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.riwayatCek.map((r) => (
                        <tr key={r.id_log} className="border-t border-(--line)">
                          <td className="py-1.5 pr-3 font-mono tabular-nums text-(--ink-2)">
                            {r.waktu.slice(5).replace("-", "/")}
                          </td>
                          {data.bs.map((b) => {
                            const v = r.cek.perBs.find((x) => x.id === b.id_prisma)?.dZMili;
                            return (
                              <td
                                key={b.id_prisma}
                                className={cn(
                                  "px-2 py-1.5 text-right font-mono tabular-nums",
                                  v !== undefined && Math.abs(v) > data.ambangCekMili
                                    ? "font-semibold text-amber-700"
                                    : "text-(--ink-2)"
                                )}
                              >
                                {v === undefined ? "—" : fmt(v, 1)}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-(--ink)">
                            {fmt(r.cek.dZMili, 1)}
                          </td>
                          <td className={cn("py-1.5 pl-3", r.cek.lewat ? "font-semibold text-amber-700" : "text-(--ink-3)")}>
                            {!r.cek.lewat ? "normal" : r.cek.sepakat ? "alat berputar?" : "BS bergeser?"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hasilTerapkan && (
              <p className="mx-5 mb-4 rounded-[10px] bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900 ring-1 ring-emerald-200">
                Nol set diterapkan.{" "}
                {hasilTerapkan.tabel
                  .map((t) => `${t.tabel}: ${t.berubah.toLocaleString("id-ID")} baris dihitung ulang`)
                  .join(", ")}
                ; {hasilTerapkan.tempPrisma} posisi terakhir disegarkan.
              </p>
            )}
          </>
        ) : null}

        {galat && (
          <p className="mx-5 mb-4 flex items-start gap-2 rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-900 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {galat}
          </p>
        )}
      </div>
    </Panel>
  );
}
