"use client";

import { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, fmtSelisih } from "./format";
import { fmtTick, fmtWaktuPenuh } from "./prism-history";
import { cariSvgRecharts, svgKePng } from "@/lib/grafik-ke-png";
import {
  buatExcelAnalisaGabungan,
  namaBerkasGabungan,
} from "@/lib/excel-analisa-gabungan";
import { StatusDot } from "./panel";
import { WARNA_STATUS, statusTerburuk, type AmbangSite, type StatusLabel } from "./status";
import type { PrismaRingkas } from "./derive";
import {
  gabungkanPrisma,
  olahRentang,
  selisihArah,
  seriGabungan,
  type BasisGabungan,
  type PrismaRentang,
  type RingkasanGabungan,
} from "./gabungan";

/**
 * Analisa gabungan beberapa prisma di satu site, pada satu rentang waktu.
 *
 * Tabel per prisma tidak bisa membedakan dua hal yang penampakannya sama:
 * sekumpulan prisma yang bergeser searah dengan besar mirip (satu massa
 * bergerak utuh) dari satu prisma yang melompat sendirian di antara tetangganya
 * yang diam (lebih sering tiang tersenggol atau bidikan meleset). Bedanya hanya
 * terlihat kalau beberapa prisma dibaca sekaligus.
 *
 * Seluruh hitungannya ada di `gabungan.ts` supaya bisa dikunci tes; berkas ini
 * hanya menampilkan.
 */

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";

/**
 * Warna pembeda seri grafik — sengaja TIDAK memakai WARNA_STATUS.
 *
 * Di seluruh aplikasi ini hijau/kuning/jingga/merah hanya berarti tingkat
 * bahaya. Memakainya untuk membedakan prisma akan membuat prisma yang normal
 * tampil "awas" semata-mata karena kebetulan berada di urutan keempat. Semua
 * warna di bawah dingin atau netral, tidak satu pun bisa tertukar dengan
 * keempat warna status.
 */
const WARNA_SERI = [
  "#303481",
  "#0e7490",
  "#7c3aed",
  "#be185d",
  "#1d4ed8",
  "#57534e",
  "#9333ea",
  "#115e59",
];
const warnaSeri = (i: number) => WARNA_SERI[i % WARNA_SERI.length];

const BASIS: { id: BasisGabungan; label: string; judul: string }[] = [
  {
    id: "akhir",
    label: "Keadaan di akhir rentang",
    judul: "Pembacaan terakhir tiap prisma, diukur dari acuan R0",
  },
  {
    id: "selama",
    label: "Gerak selama rentang",
    judul: "Perubahan posisi antara awal dan akhir rentang",
  },
];


// ─── Denah vektor ────────────────────────────────────────────────────────────

const UKURAN = 232;
const C = UKURAN / 2;
const R = 84;

/**
 * Vektor tiap prisma dari satu titik pusat, ditambah resultan kelompok.
 *
 * Kerabat DisplacementRose di Beranda, tapi menjawab pertanyaan lain: di sana
 * yang dicari prisma mana yang paling jauh, di sini apakah vektor-vektornya
 * berhimpit. Karena itu resultannya digambar tebal beserta kipas simpangan
 * arahnya — bagian yang tidak ada di mawar — dan latarnya kertas, bukan konsol.
 */
function DenahVektor({
  dipakai,
  ringkasan,
  ambang,
  pakaiAmbang,
}: {
  dipakai: PrismaRingkas[];
  ringkasan: RingkasanGabungan;
  ambang: AmbangSite | null;
  /** Cincin ambang hanya sahih bila angkanya diukur dari acuan R0. */
  pakaiAmbang: boolean;
}) {
  const maks = ringkasan.sebaran.maksMm;
  const acuanCincin = pakaiAmbang ? (ambang?.geser.normalMax ?? 0) : 0;
  // Sedikitnya sampai ambang Waspada: pergeseran kecil harus terbaca kecil,
  // bukan dibesarkan sampai memenuhi lingkaran.
  const skala = Math.max(maks, acuanCincin, 1) * 1.1;
  const rDari = (mm: number) => (mm / skala) * R;

  const cincin: { r: number; label: string; warna: string }[] = [];
  if (ambang && pakaiAmbang) {
    const batas: [number, StatusLabel][] = [
      [ambang.geser.normalMax, "Waspada"],
      [ambang.geser.waspadaMax, "Siaga"],
      [ambang.geser.siagaMax, "Awas"],
    ];
    for (const [nilai, label] of batas) {
      if (nilai <= skala) {
        cincin.push({ r: rDari(nilai), label: `${fmt(nilai, 0)} mm`, warna: WARNA_STATUS[label] });
      }
    }
  }

  const v = ringkasan.vektorRata;
  const xRata = C + rDari(v.dxMm);
  const yRata = C - rDari(v.dyMm);

  // Kipas simpangan arah: sebaran arah yang setara dengan angka keseragaman,
  // digambar pada panjang resultan supaya lebarnya bisa dibandingkan langsung
  // dengan panjang panahnya.
  let kipas: string | null = null;
  if (v.bearing !== null && ringkasan.simpangArahDeg !== null && ringkasan.simpangArahDeg > 1) {
    const sp = Math.min(ringkasan.simpangArahDeg, 89) * (Math.PI / 180);
    const arah = Math.atan2(v.dxMm, v.dyMm);
    const panjang = Math.max(rDari(v.besarMm), 16);
    const titik = (a: number) => `${C + Math.sin(a) * panjang},${C - Math.cos(a) * panjang}`;
    kipas = `M ${C},${C} L ${titik(arah - sp)} A ${panjang} ${panjang} 0 0 1 ${titik(arah + sp)} Z`;
  }

  const kardinal: [string, number, number][] = [
    ["U", C, C - R - 10],
    ["T", C + R + 11, C + 3.5],
    ["S", C, C + R + 16],
    ["B", C - R - 11, C + 3.5],
  ];

  return (
    <svg
      viewBox={`0 0 ${UKURAN} ${UKURAN}`}
      width={UKURAN}
      height={UKURAN}
      role="img"
      aria-label={`Arah gerak ${dipakai.length} prisma terpilih, resultan ${fmt(v.besarMm)} mm`}
      className="max-w-full"
    >
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth={1} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const p = i % 2 === 0 ? 6 : 3.5;
        return (
          <line
            key={i}
            x1={C + Math.sin(a) * (R - p)}
            y1={C - Math.cos(a) * (R - p)}
            x2={C + Math.sin(a) * R}
            y2={C - Math.cos(a) * R}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}
      {kardinal.map(([huruf, x, y]) => (
        <text key={huruf} x={x} y={y} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--ink-3)">
          {huruf}
        </text>
      ))}

      {cincin.map((c) => (
        <g key={c.label}>
          <circle cx={C} cy={C} r={c.r} fill="none" stroke={c.warna} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
          <text x={C} y={C - c.r - 3} textAnchor="middle" fontSize={8.5} fontFamily={FONT_MONO} fill={c.warna}>
            {c.label}
          </text>
        </g>
      ))}

      {kipas && <path d={kipas} fill="var(--navy)" fillOpacity={0.09} />}

      {/* Vektor per prisma — tipis, warnanya status, bukan warna seri grafik. */}
      {dipakai.map((p) => {
        const dx = p.dxMm as number;
        const dy = p.dyMm as number;
        const x = C + rDari(dx);
        const y = C - rDari(dy);
        const warna = p.status ? WARNA_STATUS[p.status] : "var(--ink-3)";
        return (
          <g key={p.id}>
            <title>{`${p.nama.replace(/_/g, " ")} · ${fmt(Math.hypot(dx, dy))} mm${p.status ? ` · ${p.status}` : ""}`}</title>
            <line x1={C} y1={C} x2={x} y2={y} stroke={warna} strokeWidth={1.25} strokeOpacity={0.75} />
            <circle cx={x} cy={y} r={2.75} fill={warna} stroke="#fff" strokeWidth={1.25} />
          </g>
        );
      })}

      {v.besarMm > 0 && (
        <g>
          <title>{`Resultan kelompok · ${fmt(v.besarMm)} mm · ${fmt(v.bearing, 1)}°`}</title>
          <line x1={C} y1={C} x2={xRata} y2={yRata} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={xRata} cy={yRata} r={4} fill="var(--ink)" stroke="#fff" strokeWidth={1.5} />
        </g>
      )}

      {/* Pusat = titik nol basis yang sedang dipakai */}
      <line x1={C - 5} x2={C + 5} y1={C} y2={C} stroke="var(--ink-3)" strokeWidth={1} />
      <line x1={C} x2={C} y1={C - 5} y2={C + 5} stroke="var(--ink-3)" strokeWidth={1} />
    </svg>
  );
}

// ─── Tooltip grafik ──────────────────────────────────────────────────────────

function TipGabungan({
  active,
  payload,
  nama,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number; color?: string }>;
  nama: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0] as unknown as { payload?: { ts?: number } };
  const ts = p.payload?.ts;
  const isi = payload.filter((d) => typeof d.value === "number");
  return (
    <div className="max-h-[280px] overflow-hidden rounded-[10px] bg-(--ink) px-3 py-2.5 text-[12px] text-white shadow-lg">
      {ts !== undefined && (
        <p className="font-mono tabular-nums text-white/65">{fmtWaktuPenuh(ts, { detik: false })}</p>
      )}
      <ul className="mt-1.5 space-y-0.5">
        {isi.map((d) => {
          const kunci = String(d.dataKey);
          const rata = kunci === "rata";
          return (
            <li key={kunci} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: rata ? "#fff" : d.color }} />
              <span className={cn("min-w-0 truncate", rata ? "font-semibold" : "text-white/80")}>
                {rata ? "Rata-rata" : (nama.get(kunci) ?? kunci).replace(/_/g, " ")}
              </span>
              <span className="ml-auto font-mono tabular-nums">{fmt(d.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Tampilan ────────────────────────────────────────────────────────────────

const TH =
  "sticky top-0 z-10 border-b border-(--line) bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)";
const TD_ANGKA =
  "border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-(--ink)";

function Angka({
  label,
  nilai,
  satuan,
  sub,
  tebal,
}: {
  label: string;
  nilai: string;
  satuan?: string;
  sub?: string;
  tebal?: boolean;
}) {
  return (
    <div className="min-w-0 py-2.5">
      <p className="text-[11.5px] text-(--ink-2)">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className={cn("font-mono tabular-nums text-(--ink)", tebal ? "text-[20px] font-bold" : "text-[16px] font-semibold")}>
          {nilai}
        </span>
        {satuan && <span className="text-[11.5px] text-(--ink-3)">{satuan}</span>}
      </p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-(--ink-3)">{sub}</p>}
    </div>
  );
}

export function AnalisaGabungan({
  prisma,
  ambang,
  kunci,
  loading,
  kosong,
  perJam,
  namaSite,
  rentangTeks,
  r0Teks,
  onBukaPrisma,
}: {
  prisma: PrismaRentang[];
  ambang: AmbangSite | null;
  /** Berganti saat site berganti — memicu pemilihan ulang seluruh prisma. */
  kunci: string;
  loading: boolean;
  /** Belum ada rentang yang dimuat sama sekali. */
  kosong: boolean;
  perJam: boolean;
  /** Dipakai judul & nama berkas Excel. */
  namaSite: string;
  rentangTeks: string;
  r0Teks: string | null;
  onBukaPrisma?: (nama: string) => void;
}) {
  const refGrafik = useRef<HTMLDivElement>(null);
  const [mengunduh, setMengunduh] = useState(false);
  const [unduhError, setUnduhError] = useState("");
  const [basis, setBasis] = useState<BasisGabungan>("akhir");
  const { ringkas, seri: seriBasis } = useMemo(
    () => olahRentang(prisma, basis, ambang),
    [prisma, basis, ambang]
  );
  const bisa = useMemo(() => ringkas.filter((p) => p.tertembak), [ringkas]);

  const [pilih, setPilih] = useState<ReadonlySet<string>>(() => new Set(bisa.map((p) => p.id)));
  const [kunciTerakhir, setKunciTerakhir] = useState(kunci);

  // Pilihan DITURUNKAN ulang saat SITE-nya berganti, disetel saat render alih-alih
  // lewat effect. Sengaja tidak ikut berganti saat rentangnya diubah: operator
  // yang menggeser jendela waktu sedang memeriksa kelompok yang sama, dan
  // pilihannya hilang tiap geser akan membuat halaman ini tidak bisa dipakai.
  if (kunciTerakhir !== kunci) {
    setKunciTerakhir(kunci);
    setPilih(new Set(bisa.map((p) => p.id)));
  }

  const terpilih = useMemo(() => ringkas.filter((p) => pilih.has(p.id)), [ringkas, pilih]);
  const hasil = useMemo(() => gabungkanPrisma(terpilih), [terpilih]);

  const seri = useMemo(() => {
    const dipakai = hasil?.dipakai ?? [];
    const peta = new Map(seriBasis.map((s) => [s.id, s.seri]));
    return seriGabungan(dipakai.map((p) => ({ id: p.id, nama: p.nama, seri: peta.get(p.id) ?? [] })));
  }, [hasil, seriBasis]);

  const namaSeri = useMemo(() => new Map(seri.prisma.map((p) => [p.kunci, p.nama])), [seri]);

  const semua = () => setPilih(new Set(bisa.map((p) => p.id)));
  const kosongkan = () => setPilih(new Set());
  const alih = (id: string) =>
    setPilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });

  const unduhExcel = async () => {
    if (!hasil) return;
    setMengunduh(true);
    setUnduhError("");
    try {
      // Grafiknya diambil dari SVG yang sedang tampil, jadi gambar di berkas
      // persis sama dengan yang dilihat operator saat menekan Unduh — termasuk
      // prisma mana yang sedang dipilih dan basis mana yang sedang aktif.
      //
      // Kegagalannya SENGAJA tidak membatalkan unduhan. Merasterkan SVG
      // bergantung pada canvas dan pada SVG yang bisa dimuat sebagai gambar —
      // hal yang bisa gagal karena peramban, kebijakan keamanan, atau satu
      // atribut yang tak terduga. Angka di tiga lembar lain tidak ikut
      // bermasalah, dan berkas tanpa gambar jauh lebih berguna daripada tidak
      // ada berkas sama sekali.
      let grafik = null as Awaited<ReturnType<typeof svgKePng>> | null;
      try {
        const svg = cariSvgRecharts(refGrafik.current);
        if (svg) grafik = await svgKePng(svg);
      } catch (e) {
        console.error("[grafik ke PNG]", e);
      }
      const blob = await buatExcelAnalisaGabungan({
        namaSite,
        rentangTeks,
        basis,
        labelBasis: BASIS.find((b) => b.id === basis)?.label ?? basis,
        r0Teks,
        perJam,
        hasil,
        seri,
        grafik,
        waktuBaris: seri.baris.map((b) => fmtWaktuPenuh(b.ts, { detik: false })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaBerkasGabungan(kunci || namaSite, rentangTeks);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[unduh Excel gabungan]", e);
      // Pesannya ikut ditampilkan, bukan diganti kalimat umum: "coba lagi"
      // pada galat yang berulang setiap kali hanya menyuruh operator
      // mengulang hal yang sama, dan tidak menyisakan apa pun untuk dilaporkan.
      const sebab = e instanceof Error ? e.message : String(e);
      setUnduhError(`Berkas Excel gagal dibuat — ${sebab}`);
    } finally {
      setMengunduh(false);
    }
  };

  if (loading && prisma.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-(--navy)" aria-label="Memuat analisa gabungan" />
      </div>
    );
  }

  if (kosong || prisma.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-1 items-center justify-center px-6 py-16 text-center text-[13px] text-(--ink-3)">
        {kosong
          ? "Pilih site dan rentang waktu, lalu tekan Tampilkan."
          : "Tidak ada prisma terdaftar di site ini."}
      </div>
    );
  }

  const akhir = basis === "akhir";
  const kataBesar = akhir ? "Pergeseran" : "Gerak";

  return (
    <div className={cn("flex-1", loading && "opacity-50 transition-opacity")}>
      {/* ── Pemilih prisma ── */}
      <div className="border-b border-(--line) px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[12px] font-semibold text-(--ink-2)">
            Prisma yang digabung
            <span className="ml-1.5 font-mono font-normal tabular-nums text-(--ink-3)">
              {terpilih.length}/{ringkas.length}
            </span>
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={semua}
              className="cursor-pointer rounded-[7px] px-2 py-1 text-[12px] font-semibold text-(--navy) outline-none hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
            >
              Pilih semua
            </button>
            <button
              type="button"
              onClick={kosongkan}
              className="cursor-pointer rounded-[7px] px-2 py-1 text-[12px] font-medium text-(--ink-3) outline-none hover:bg-(--paper) hover:text-(--ink-2) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
            >
              Kosongkan
            </button>
          </div>
        </div>
        <div className="mt-2.5 flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
          {ringkas.map((p) => {
            const aktif = pilih.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={aktif}
                disabled={!p.tertembak}
                onClick={() => alih(p.id)}
                title={
                  p.tertembak
                    ? `${p.nama.replace(/_/g, " ")} · ${fmt(p.geserMm)} mm`
                    : `${p.nama.replace(/_/g, " ")} tidak terbaca pada rentang ini, atau acuan R0-nya tidak sah`
                }
                className={cn(
                  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                  !p.tertembak
                    ? "cursor-not-allowed bg-(--paper) text-(--ink-3) line-through opacity-60"
                    : aktif
                      ? "cursor-pointer bg-(--navy) text-white"
                      : "cursor-pointer bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                )}
              >
                {p.tertembak && p.status && (
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: WARNA_STATUS[p.status] }} />
                )}
                {p.nama.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pengalih basis ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--line) px-5 py-3">
        <div
          role="tablist"
          aria-label="Dasar perhitungan"
          className="inline-flex gap-1 rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line)"
        >
          {BASIS.map(({ id, label, judul }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={basis === id}
              title={judul}
              onClick={() => setBasis(id)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                basis === id ? "bg-white text-(--ink) shadow-sm" : "text-(--ink-3) hover:text-(--ink-2)"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={unduhExcel}
          disabled={!hasil || mengunduh}
          title={
            hasil
              ? "Unduh ringkasan, grafik, dan deret angkanya sebagai Excel"
              : "Tidak ada yang bisa diunduh"
          }
          className="order-last ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] bg-white px-3.5 text-[13px] font-semibold text-(--ink-2) outline-none ring-1 ring-(--line) transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50 sm:order-none"
        >
          {mengunduh ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Unduh Excel
        </button>
        <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-(--ink-3)">
          {akhir
            ? "Diukur dari acuan R0, jadi sebanding dengan ambang bahaya site."
            : "Selisih posisi antara awal dan akhir rentang. Ambang pergeseran TIDAK dipakai di sini — ambang itu untuk jarak total dari R0, bukan untuk gerak dalam satu jendela. Yang dinilai hanya lajunya."}
        </p>
      </div>

      {unduhError && (
        <p className="mx-5 mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
          {unduhError}
        </p>
      )}

      {!hasil ? (
        <p className="px-6 py-16 text-center text-[13px] text-(--ink-3)">
          {terpilih.length === 0
            ? "Pilih sedikitnya satu prisma untuk digabung."
            : "Prisma yang dipilih tidak ada yang terbaca pada rentang ini, jadi tidak ada yang bisa dihitung."}
        </p>
      ) : (
        <>
          {/* ── Bacaan & angka pokok ── */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="min-w-0">
              {/* Kartu bacaan pola dihapus atas permintaan — kalimatnya menerangkan
                  angka yang sudah ada di bawahnya. Peringatan prisma yang tidak ikut
                  dihitung TIDAK ikut dihapus: itu bukan tafsir, melainkan keterangan
                  bahwa angka di halaman ini mewakili sebagian kelompok saja. */}
              {hasil.diabaikan.length > 0 && (
                <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900">
                  {hasil.diabaikan.length} prisma terpilih tidak ikut dihitung karena tidak terbaca
                  pada rentang ini: {hasil.diabaikan.map((n) => n.replace(/_/g, " ")).join(", ")}.
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <Angka
                  label={`${kataBesar} resultan`}
                  nilai={fmt(hasil.vektorRata.besarMm)}
                  satuan="mm"
                  sub={
                    hasil.vektorRata.bearing !== null
                      ? `arah ${fmt(hasil.vektorRata.bearing, 1)}°`
                      : "arah tidak terbaca"
                  }
                  tebal
                />
                <Angka
                  label={`${kataBesar} terbesar`}
                  nilai={fmt(hasil.sebaran.maksMm)}
                  satuan="mm"
                  sub={`median ${fmt(hasil.sebaran.medianMm)} · terkecil ${fmt(hasil.sebaran.minMm)}`}
                  tebal
                />
                <Angka
                  label={akhir ? "Status terburuk" : "Status laju terburuk"}
                  nilai={
                    (akhir
                      ? hasil.status
                      : statusTerburuk(hasil.dipakai.map((p) => p.statusLaju))) ?? "—"
                  }
                  sub={
                    akhir
                      ? Object.entries(hasil.hitunganStatus)
                          .map(([s, n]) => `${n} ${s.toLowerCase()}`)
                          .join(" · ") || undefined
                      : "dari ambang laju site"
                  }
                  tebal
                />
                <Angka
                  label="Keseragaman arah"
                  nilai={hasil.keseragaman === null ? "—" : `${(hasil.keseragaman * 100).toFixed(0)}%`}
                  sub="100% = semua prisma searah; rendah = rata-rata tidak mewakili"
                />
                <Angka
                  label="Beda gerak antar prisma"
                  nilai={fmt(hasil.diferensialMm)}
                  satuan="mm"
                  sub="pasangan prisma yang paling berbeda"
                />
                <Angka
                  label="Simpangan arah"
                  nilai={hasil.simpangArahDeg === null ? "—" : `±${fmt(hasil.simpangArahDeg, 0)}`}
                  satuan={hasil.simpangArahDeg === null ? undefined : "°"}
                  sub={`sebaran besar ±${fmt(hasil.sebaran.sdMm)} mm`}
                />
                <Angka
                  label="Kecepatan rata-rata"
                  nilai={fmt(hasil.lajuRataMmd)}
                  satuan="mm/hari"
                  sub={
                    hasil.lajuMaksMmd !== null
                      ? `tertinggi ${fmt(hasil.lajuMaksMmd)} mm/hari`
                      : "lama rentang tidak terbaca"
                  }
                />
              </div>
            </div>

            <div className="flex flex-col items-center lg:items-start">
              <p className="self-start font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-(--ink-3)">
                Arah gerak kelompok
              </p>
              <div className="mt-1.5">
                <DenahVektor dipakai={hasil.dipakai} ringkasan={hasil} ambang={ambang} pakaiAmbang={akhir} />
              </div>
            </div>
          </div>

          {/* ── Grafik sepanjang rentang ── */}
          <div className="border-t border-(--line) px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-(--ink-3)">
                Sepanjang rentang
              </p>
              <p className="text-[11.5px] text-(--ink-3)">
                {seri.baris.length} titik · {akhir ? "jarak dari acuan R0" : "gerak dari awal rentang"}, mm
                {perJam ? " · dirata-rata per jam" : ""}
              </p>
            </div>
            {seri.baris.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-(--ink-3)">
                Prisma terpilih tidak punya pembacaan pada rentang ini.
              </p>
            ) : (
              <>
                <div className="mt-2" ref={refGrafik}>
                  <ResponsiveContainer width="100%" height={288}>
                    <LineChart data={seri.baris} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="var(--line)" vertical={false} />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v: number) => fmtTick(v, { tanggal: perJam })}
                        tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: FONT_MONO }}
                        axisLine={false}
                        tickLine={false}
                        tickCount={6}
                        interval="preserveStartEnd"
                        padding={{ left: 6, right: 6 }}
                        minTickGap={perJam ? 56 : 32}
                      />
                      <YAxis
                        tickFormatter={(v: number) => v.toFixed(1)}
                        tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: FONT_MONO }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip
                        content={<TipGabungan nama={namaSeri} />}
                        cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
                        isAnimationActive={false}
                      />
                      {/* Garis ambang hanya digambar pada basis yang memang
                          diukur dari R0 — pada basis "selama" ia akan
                          membandingkan gerak sejendela dengan batas jarak total. */}
                      {ambang && akhir && (
                        <ReferenceLine
                          y={ambang.geser.normalMax}
                          stroke="var(--st-waspada)"
                          strokeDasharray="4 4"
                          label={{
                            value: `Waspada ${fmt(ambang.geser.normalMax, 0)} mm`,
                            position: "insideTopRight",
                            fill: "var(--st-waspada)",
                            fontSize: 11,
                            fontFamily: FONT_MONO,
                          }}
                        />
                      )}
                      {seri.prisma.map((p, i) => (
                        <Line
                          key={p.kunci}
                          type="monotone"
                          dataKey={p.kunci}
                          stroke={warnaSeri(i)}
                          strokeWidth={1.25}
                          strokeOpacity={0.85}
                          dot={false}
                          activeDot={{ r: 3.5 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      ))}
                      {/* Rata-rata digambar terakhir supaya berada di atas seri
                          prisma, dan tebal supaya terbaca sebagai ringkasan —
                          bukan sebagai prisma kesekian. */}
                      <Line
                        type="monotone"
                        dataKey="rata"
                        stroke="var(--ink)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4.5 }}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {seri.tidakLengkap > 0 && (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-(--ink-3)">
                    {seri.tidakLengkap} dari {seri.baris.length} titik tidak memuat seluruh prisma
                    terpilih. Garis rata-rata di titik itu dihitung dari prisma yang terbaca saja,
                    jadi lompatannya bisa berasal dari anggotanya yang berubah — bukan dari gerakan.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Sumbangan tiap prisma ── */}
          {/* Gulir mendatarnya milik tabel sendiri, bukan milik seluruh halaman:
              kalau min-w tabel yang memaksa gulir di wadah luar, grafik dan
              pemilih prisma ikut bergeser keluar layar saat tabelnya digeser. */}
          <div className="overflow-x-auto border-t border-(--line)">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "pl-5")}>Prisma</th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    {kataBesar} <span className="font-normal normal-case tracking-normal">mm</span>
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>Arah</th>
                  <th
                    scope="col"
                    className={cn(TH, "text-right")}
                    title="Selisih arah prisma ini terhadap arah resultan kelompok"
                  >
                    Beda arah
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Laju <span className="font-normal normal-case tracking-normal">mm/hari</span>
                  </th>
                  <th
                    scope="col"
                    className={cn(TH, "pr-5")}
                    title={
                      akhir
                        ? "Tingkat pergeseran terhadap ambang site"
                        : "Ambang pergeseran tidak berlaku untuk gerak dalam rentang"
                    }
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasil.dipakai.map((p, i) => {
                  const beda = selisihArah(p, hasil.vektorRata);
                  const mag = Math.hypot(p.dxMm as number, p.dyMm as number);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-(--paper)">
                      <td className="border-b border-(--line) py-2.5 pr-3 pl-5 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {/* Warna seri grafik dipetakan di sini supaya garis di
                              atas selalu bisa dilacak ke nama prismanya. */}
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: warnaSeri(i) }} />
                          {onBukaPrisma ? (
                            <button
                              type="button"
                              onClick={() => onBukaPrisma(p.nama)}
                              className="cursor-pointer rounded text-[13px] font-semibold text-(--navy) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/40"
                              title={`Buka riwayat ${p.nama.replace(/_/g, " ")}`}
                            >
                              {p.nama.replace(/_/g, " ")}
                            </button>
                          ) : (
                            <span className="text-[13px] font-semibold text-(--ink)">
                              {p.nama.replace(/_/g, " ")}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cn(TD_ANGKA, "font-semibold")}>{fmt(mag)}</td>
                      <td className={TD_ANGKA}>{p.bearing === null ? "—" : `${fmt(p.bearing, 1)}°`}</td>
                      <td className={TD_ANGKA}>{beda === null ? "—" : `${fmtSelisih(beda, 0)}°`}</td>
                      <td className={TD_ANGKA}>
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {p.statusLaju && <StatusDot status={p.statusLaju} />}
                          {fmt(p.lajuMmd)}
                        </span>
                      </td>
                      <td className="border-b border-(--line) px-3 py-2.5 pr-5">
                        {p.status ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-(--ink)">
                            <StatusDot status={p.status} />
                            {p.status}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-(--ink-3)">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="px-5 py-3 text-[11.5px] leading-relaxed text-(--ink-3)">
            Angka gabungan di halaman ini alat bantu baca pola, bukan dasar penilaian bahaya.
            Penilaian tetap per prisma terhadap ambang site, dan itulah yang dipakai peringatan.
          </p>
        </>
      )}
    </div>
  );
}
