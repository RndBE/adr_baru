"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import {
  AlertTriangle,
  ArrowLeft,
  CalendarIcon,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useDeformasi, useLogKontrol, useRtsConnectionStatus } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { Chip, Eyebrow, Panel, PanelHeader, StatusDot } from "@/components/monitoring/panel";
import { PrismScope } from "@/components/monitoring/prism-scope";
import {
  ambangBerikutnya,
  ambangDariSite,
  asStatusLabel,
  statusPergeseran,
  type StatusLabel,
} from "@/components/monitoring/status";
import {
  bearingDari,
  fmt,
  fmtDate,
  fmtDms,
  fmtSelisih,
  parseArah,
  parseDms,
  parseNum,
} from "@/components/monitoring/format";
import type { LogKontrolRow, PengukuranRow } from "@/components/monitoring/derive";
import {
  batasSkala,
  fmtJamDari,
  fmtTick,
  fmtWaktuPenuh,
  gabungSumbu,
  keMs,
  putar,
  rentangBawaan,
  sudutPutar,
  ymd,
  type AcuanR0,
  type TitikRiwayat,
} from "@/components/monitoring/prism-history";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";

/**
 * Empat cara membaca riwayat yang sama. "Pergeseran" adalah bawaan karena itu
 * satuan yang dibandingkan dengan ambang; tiga sumbu mentah dipertahankan
 * untuk juru ukur yang ingin melihat koordinat apa adanya.
 */
type Tampilan = "geser" | "n" | "e" | "z";

const TAMPILAN: { id: Tampilan; label: string; satuan: string; kunci: keyof TitikRiwayat; desimal: number }[] = [
  { id: "geser", label: "Pergeseran", satuan: "mm dari acuan R0", kunci: "geserMm", desimal: 2 },
  { id: "n", label: "Northing Y", satuan: "meter, koordinat mentah", kunci: "n", desimal: 4 },
  { id: "e", label: "Easting X", satuan: "meter, koordinat mentah", kunci: "e", desimal: 4 },
  { id: "z", label: "Elevasi Z", satuan: "meter", kunci: "z", desimal: 4 },
];

const JAM_DARI = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const JAM_SAMPAI = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:59`);

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
function fmtTanggalPanjang(d: Date): string {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTanggalPendek(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 4 desimal; "—" bila kosong. Sama dengan fval() di EventTable. */
function fval(v: unknown): string {
  const n = parseNum(v);
  return n === null ? "—" : n.toFixed(4);
}

/** Selisih dua sudut DMS dalam detik busur, dinormalkan ke ±180°. */
function selisihDetikBusur(a0: unknown, a1: unknown): number | null {
  const d0 = parseDms(a0);
  const d1 = parseDms(a1);
  if (d0 === null || d1 === null) return null;
  let d = d1 - d0;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d * 3600;
}
function fmtDetikBusur(v: number | null): string {
  if (v === null) return "—";
  const b = Math.round(v);
  return `${b > 0 ? "+" : b < 0 ? "−" : ""}${Math.abs(b)}″`;
}

const tombol =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

// ─── Tooltip grafik ──────────────────────────────────────────────────────────

function TipRiwayat({
  active,
  payload,
  tampilan,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  tampilan: Tampilan;
}) {
  const p = payload?.[0]?.payload as (TitikRiwayat & { celah?: boolean }) | undefined;
  // Titik celah (pemutus garis antar sesi) bukan pembacaan — jangan ditampilkan.
  if (!active || !p || p.celah) return null;
  const utama = TAMPILAN.find((t) => t.id === tampilan)!;
  const nilaiUtama = p[utama.kunci] as number;
  return (
    <div className="rounded-[10px] bg-(--ink) px-3 py-2.5 text-[12px] text-white shadow-lg">
      <p className="font-mono tabular-nums text-white/65">{fmtWaktuPenuh(p.ts, { detik: false })}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[15px] font-bold tabular-nums">
          {nilaiUtama.toFixed(utama.desimal)}
        </span>
        <span className="text-white/65">{utama.id === "geser" ? "mm" : "m"}</span>
      </p>
      {tampilan !== "geser" && (
        <p className="mt-1 text-white/75">
          pergeseran <span className="font-mono tabular-nums text-white">{fmt(p.geserMm)}</span> mm
        </p>
      )}
      <p className="mt-0.5 text-white/75">
        ΔZ <span className="font-mono tabular-nums text-white">{fmtSelisih(p.dzMm)}</span> mm
      </p>
    </div>
  );
}

// ─── Halaman ─────────────────────────────────────────────────────────────────

function DetailPrismaContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected, lastUpdate } = useRtsConnectionStatus();
  const { bySlug, namaPos, badge: siteBadge } = useSites(false, true);

  const namaPrisma = decodeURIComponent(String(params.prisma ?? ""));
  const idLog = searchParams.get("log") ?? "";

  const { deformasi, isLoading: defLoading, isError: defError } = useDeformasi(idLog || null);
  const baris = useMemo(
    () => (deformasi?.data_pengukuran ?? []) as PengukuranRow[],
    [deformasi]
  );
  const row = useMemo(
    () => baris.find((p) => p.nama_prisma === namaPrisma) ?? null,
    [baris, namaPrisma]
  );

  const siteSlug: string | null = deformasi?.site?.slug ?? null;
  const site = bySlug(siteSlug);
  const ambang = useMemo(() => ambangDariSite(site), [site]);
  const peringatan: string[] = deformasi?.peringatan ?? [];

  // Daftar sesi site ini — hanya untuk menemukan tanggal acuan R0.
  const { logs, isLoading: logsLoading } = useLogKontrol(siteSlug ?? undefined, 200, {
    withPrisma: false,
  });
  const r0Log = useMemo(
    () => (logs as LogKontrolRow[]).find((l) => Number(l.r0) === 1 && l.site === siteSlug) ?? null,
    [logs, siteSlug]
  );

  // ── Turunan sesi ini ──
  const t = row?.temp_tembak;
  const dxMm = t ? (parseNum(t.DE) ?? 0) * 1000 : null;
  const dyMm = t ? (parseNum(t.DN) ?? 0) * 1000 : null;
  const dzMm = t ? (parseNum(t.DZ) ?? 0) * 1000 : null;
  const geserMm = dxMm !== null && dyMm !== null ? Math.hypot(dxMm, dyMm) : null;
  const arah = parseArah(t?.arah_pergeseran);
  const bearing =
    arah?.bearing ??
    (geserMm !== null && geserMm > 0 && dxMm !== null && dyMm !== null
      ? bearingDari(dxMm, dyMm)
      : null);
  const status: StatusLabel | null =
    ambang && geserMm !== null ? statusPergeseran(geserMm, ambang) : null;
  const berikut = status && ambang ? ambangBerikutnya(status, ambang) : null;

  const harian = row?.daily;
  const adaHarian = (harian?.count ?? 0) > 0;
  const lajuMmd = parseNum(harian?.kecepatan_mmd);
  const statusLaju = asStatusLabel(harian?.status_kecepatan?.label);

  const acuanR0: AcuanR0 | null =
    t && t.raw_E0 != null && t.raw_N0 != null && t.Z0 != null
      ? { e: t.raw_E0, n: t.raw_N0, z: t.Z0 }
      : null;

  // ── Riwayat pada rentang ──
  const [tampilan, setTampilan] = useState<Tampilan>("geser");
  const [dari, setDari] = useState<Date>(() => new Date());
  const [sampai, setSampai] = useState<Date>(() => new Date());
  const [jamDari, setJamDari] = useState("00:00");
  const [jamSampai, setJamSampai] = useState("23:59");
  const [rentangOpen, setRentangOpen] = useState(false);
  const [tDari, setTDari] = useState<Date>(dari);
  const [tSampai, setTSampai] = useState<Date>(sampai);
  const [tJamDari, setTJamDari] = useState(jamDari);
  const [tJamSampai, setTJamSampai] = useState(jamSampai);

  const [riwayat, setRiwayat] = useState<TitikRiwayat[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [rentangDimuat, setRentangDimuat] = useState<{ dari: Date; sampai: Date } | null>(null);
  const [sebelumR0, setSebelumR0] = useState(0);

  const muatRiwayat = useCallback(
    async (d: Date, s: Date, j1: string, j2: string) => {
      if (!row || !acuanR0) return;
      const r0Ms = keMs(r0Log?.datetime ?? null);
      const id = encodeURIComponent(String(row.id_prisma));
      const qDari = encodeURIComponent(`${ymd(d)} ${j1}:00`);
      const qSampai = encodeURIComponent(`${ymd(s)} ${j2}:59`);
      const url = (kolom: string) =>
        `/api/analisa?type=range&id_prisma=${id}&kolom=${kolom}&dari=${qDari}&sampai=${qSampai}`;
      setMemuat(true);
      setGalat("");
      try {
        const [n, e, z] = await Promise.all(
          ["sensor8", "sensor9", "sensor10"].map((k) => fetch(url(k)).then((r) => r.json()))
        );
        if (!n.success || !e.success || !z.success) {
          throw new Error(n.error || e.error || z.error || "respons tidak sukses");
        }
        const hasil = gabungSumbu(
          n.data.chart_data,
          e.data.chart_data,
          z.data.chart_data,
          acuanR0,
          r0Ms
        );
        setRiwayat(hasil.titik);
        setSebelumR0(hasil.sebelumR0);
        setRentangDimuat({ dari: d, sampai: s });
      } catch (err) {
        console.error("[riwayat prisma]", err);
        setGalat("Riwayat tidak bisa dimuat. Periksa koneksi lalu coba Tampilkan lagi.");
      } finally {
        setMemuat(false);
      }
    },
    // acuanR0 dibangun ulang tiap render; yang menentukan isinya hanya row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, r0Log?.datetime]
  );

  // Muat otomatis sekali per prisma+sesi, setelah tanggal R0 diketahui
  // (atau dipastikan tidak ada) supaya rentang bawaannya benar.
  const kunciOtomatis = useRef("");
  useEffect(() => {
    if (!row || !deformasi?.tanggal) return;
    if (logsLoading) return;
    const kunci = `${idLog}|${row.id_prisma}`;
    if (kunciOtomatis.current === kunci) return;
    kunciOtomatis.current = kunci;
    const r = rentangBawaan(r0Log?.datetime ? String(r0Log.datetime) : null, deformasi.tanggal);
    setDari(r.dari);
    setSampai(r.sampai);
    setJamDari("00:00");
    setJamSampai("23:59");
    void muatRiwayat(r.dari, r.sampai, "00:00", "23:59");
  }, [row, deformasi?.tanggal, idLog, logsLoading, r0Log?.datetime, muatRiwayat]);

  // Jejak untuk teropong: riwayat ada di bingkai mentah, vektor sesi di
  // bingkai site — diputar dengan sudut yang dibaca dari vektor sesi ini.
  const jejak = useMemo(() => {
    if (!t || dxMm === null || dyMm === null || riwayat.length === 0) return [];
    const mentah =
      t.raw_E1 != null && t.raw_E0 != null && t.raw_N1 != null && t.raw_N0 != null
        ? { dx: (t.raw_E1 - t.raw_E0) * 1000, dy: (t.raw_N1 - t.raw_N0) * 1000 }
        : null;
    if (!mentah) return [];
    const rad = sudutPutar(mentah, { dx: dxMm, dy: dyMm });
    if (rad === null) return [];
    return riwayat.map((p) => {
      const q = putar(p.dxMm, p.dyMm, rad);
      return { dxMm: q.dx, dyMm: q.dy };
    });
  }, [riwayat, t, dxMm, dyMm]);

  const tampilanAktif = TAMPILAN.find((x) => x.id === tampilan)!;
  // Jeda > 3 jam antar pembacaan diputus dengan titik null: antar sesi tidak
  // ada data, dan garis yang menyambungnya akan mengarang lintasan yang tak
  // pernah diukur.
  const seri = useMemo(() => {
    const hasil: (TitikRiwayat & { nilai: number | null; celah?: boolean })[] = [];
    for (let i = 0; i < riwayat.length; i++) {
      const p = riwayat[i];
      if (i > 0 && p.ts - riwayat[i - 1].ts > 3 * 3600 * 1000) {
        hasil.push({ ...p, ts: (p.ts + riwayat[i - 1].ts) / 2, nilai: null, celah: true });
      }
      hasil.push({ ...p, nilai: p[tampilanAktif.kunci] as number });
    }
    return hasil;
  }, [riwayat, tampilanAktif.kunci]);
  const nilaiSeri = seri.flatMap((p) => (p.nilai === null ? [] : [p.nilai]));
  // Label sumbu X memuat tanggal begitu seri melewati pergantian hari — bukan
  // hanya bila lebih dari 24 jam; "17:44" lalu "11:15" tanpa tanggal terbaca
  // seperti mundur.
  const multiHari =
    seri.length > 1 &&
    fmtWaktuPenuh(seri[0].ts).slice(0, 10) !==
      fmtWaktuPenuh(seri[seri.length - 1].ts).slice(0, 10);
  // Skala Y tahan tembakan liar (lihat batasSkala) — hanya untuk tampilan
  // pergeseran; koordinat mentah dibiarkan apa adanya.
  const skalaY = tampilan === "geser" ? batasSkala(nilaiSeri) : { maks: 0, terpotong: 0 };
  const desimalY =
    tampilan !== "geser" ? 4 : skalaY.maks >= 100 ? 0 : skalaY.maks >= 10 ? 1 : 2;
  // Garis ambang hanya bila cukup dekat dengan data — kalau tidak, grafiknya
  // terjepit di dasar dan tidak lagi memperlihatkan perubahan.
  const garisAmbang =
    tampilan === "geser" && ambang && ambang.geser.normalMax <= skalaY.maks * 1.6
      ? { nilai: ambang.geser.normalMax, label: "Waspada" }
      : null;
  // Domain eksplisit bila ada garis ambang atau pemotongan — domain "auto"
  // hanya melihat data, sehingga garis ambang bisa tergambar di luar bidang.
  const domainY: [number | string, number | string] =
    tampilan !== "geser"
      ? ["auto", "auto"]
      : garisAmbang || skalaY.terpotong > 0
        ? [0, Math.ceil(Math.max(skalaY.maks * 1.08, (garisAmbang?.nilai ?? 0) * 1.06))]
        : [0, "auto"];

  const gantiPrisma = (nama: string) => {
    kunciOtomatis.current = "";
    setRiwayat([]);
    router.replace(`/hasil-pengukuran/${encodeURIComponent(nama)}?log=${idLog}`, { scroll: false });
  };

  const bukaRentang = (open: boolean) => {
    setRentangOpen(open);
    if (open) {
      setTDari(dari);
      setTSampai(sampai);
      setTJamDari(jamDari);
      setTJamSampai(jamSampai);
    }
  };
  const terapkanRentang = () => {
    setDari(tDari);
    setSampai(tSampai);
    setJamDari(tJamDari);
    setJamSampai(tJamSampai);
    setRentangOpen(false);
    void muatRiwayat(tDari, tSampai, tJamDari, tJamSampai);
  };

  const [mengunduh, setMengunduh] = useState(false);
  const unduhExcel = async () => {
    if (riwayat.length === 0 || !row) return;
    setMengunduh(true);
    try {
      const ExcelJS = await import("exceljs").then((m) => m.default || m);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Prisma ${namaPrisma}`.slice(0, 31));
      ws.columns = [
        { key: "waktu", width: 22 },
        { key: "geser", width: 18 },
        { key: "dz", width: 14 },
        { key: "n", width: 16 },
        { key: "e", width: 16 },
        { key: "z", width: 12 },
      ];
      const judul = ws.addRow([
        `Prisma ${namaPrisma} — ${site?.nama ?? siteSlug ?? ""} — ${fmtTanggalPendek(dari)} ${jamDari} s.d. ${fmtTanggalPendek(sampai)} ${jamSampai}`,
      ]);
      ws.mergeCells("A1:F1");
      judul.getCell(1).font = { size: 13, bold: true };
      ws.addRow([`Acuan R0: ${r0Log ? fmtDate(r0Log.datetime) : "—"}. Pergeseran = jarak horizontal dari R0.`]);
      ws.mergeCells("A2:F2");
      ws.addRow([]);
      const hdr = ws.addRow(["Waktu", "Pergeseran (mm)", "ΔZ (mm)", "Northing Y (m)", "Easting X (m)", "Elevasi Z (m)"]);
      hdr.eachCell((c) => {
        c.font = { bold: true };
        c.border = { bottom: { style: "thin" } };
      });
      for (const p of riwayat) {
        ws.addRow([
          fmtWaktuPenuh(p.ts),
          Number(p.geserMm.toFixed(2)),
          Number(p.dzMm.toFixed(2)),
          Number(p.n.toFixed(4)),
          Number(p.e.toFixed(4)),
          Number(p.z.toFixed(4)),
        ]);
      }
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Riwayat_${namaPrisma}_${ymd(dari)}_${ymd(sampai)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[unduh Excel]", e);
      setGalat("Berkas Excel gagal dibuat. Coba lagi.");
    } finally {
      setMengunduh(false);
    }
  };

  // ── Keadaan halaman ──
  const menunggu = defLoading && !row;
  const tidakDitemukan = !defLoading && !defError && !!deformasi && !row;
  const tanpaLog = !idLog;
  const sesiTanggal = deformasi?.tanggal ? fmtDate(deformasi.tanggal) : null;

  return (
    // Gutter dilepas lewat RUTE_FULL_BLEED di (dashboard)/layout.tsx.
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {/* ── Bar atas: kembali · pindah prisma · koneksi ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link
            href={idLog ? `/hasil-pengukuran?log=${idLog}` : "/hasil-pengukuran"}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-semibold text-(--ink-2) outline-none transition-colors hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
          >
            <ArrowLeft className="size-4" />
            Hasil Pengukuran
          </Link>

          <div className="ml-auto flex items-center gap-2.5">
            {baris.length > 0 && (
              <Select value={namaPrisma} onValueChange={(v) => v && v !== namaPrisma && gantiPrisma(v)}>
                <SelectTrigger
                  aria-label="Pindah ke prisma lain pada running ini"
                  className="h-9 min-w-[150px] cursor-pointer rounded-[9px] border-0 bg-white px-3 text-[13px] font-semibold text-(--ink) shadow-none ring-1 ring-(--line) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/50"
                >
                  <span className="text-(--ink-3)">Prisma</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  side="bottom"
                  sideOffset={6}
                  className="max-h-[320px] rounded-[12px] border-(--line) p-1 shadow-lg"
                >
                  {baris.map((p) => (
                    <SelectItem
                      key={String(p.id_prisma)}
                      value={p.nama_prisma ?? ""}
                      className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px]"
                    >
                      <span className="font-semibold">{(p.nama_prisma ?? "").replace(/_/g, " ")}</span>
                      <span className="ml-2 font-mono text-[11px] text-(--ink-3)">{String(p.id_prisma)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-medium text-(--ink-2) ring-1 ring-(--line)"
              title={
                lastUpdate ? `Data terakhir ${fmtDate(lastUpdate, { detik: true })}` : "Belum ada data masuk"
              }
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: isConnected ? "var(--st-normal)" : "var(--st-awas)" }}
              />
              RTS {isConnected ? "terhubung" : "terputus"}
            </span>
          </div>
        </div>

        {peringatan.map((p) => (
          <div
            key={p}
            role="status"
            className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>{p}</p>
          </div>
        ))}

        {tanpaLog ? (
          <Panel className="items-center px-6 py-14 text-center">
            <p className="font-display text-[20px] font-bold text-(--ink)">
              Running belum dipilih
            </p>
            <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">
              Halaman ini membaca satu prisma pada satu running. Buka dari tabel Hasil Pengukuran
              supaya running-nya ikut terbawa.
            </p>
            <Link
              href="/hasil-pengukuran"
              className={cn(tombol, "mt-5 bg-(--navy) text-white hover:bg-(--navy-deep)")}
            >
              Ke Hasil Pengukuran
            </Link>
          </Panel>
        ) : defError ? (
          <Panel className="items-center px-6 py-14 text-center">
            <p className="font-display text-[20px] font-bold text-(--ink)">
              Data running tidak bisa dimuat
            </p>
            <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">
              Periksa koneksi database, lalu muat ulang halaman ini.
            </p>
          </Panel>
        ) : (
          <>
            {/* ══ Kartu prisma ══
                Satu kartu putih rendah: teropong, identitas, putusan — tiga
                zona dipisah garis tipis, dibaca satu baris di layar lebar.
                Teropong ditaruh paling kiri: bentuknya yang pertama ditangkap
                mata, angkanya menyusul di kanannya.
                Tinggi kartu ditentukan teropong (120px); teks di kirinya
                dirapatkan ke baris-baris pendek supaya tidak lebih tinggi dari
                itu. Halaman daftar memakai konsol gelap untuk sesinya; di sini
                sengaja tidak, supaya dua halaman bersaudara tidak serupa. */}
            <Panel
              aria-label="Panel prisma terpilih"
              className="@container rise-in"
            >
              <div className="grid gap-x-5 gap-y-3 p-3 @3xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] @5xl:grid-cols-[auto_minmax(0,19rem)_minmax(0,1fr)] @5xl:items-center md:px-4">
                {/* Zona A — prisma mana */}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="font-display text-[28px] font-bold leading-none tracking-[-0.02em] text-(--ink)">
                      {namaPrisma.replace(/_/g, " ") || "—"}
                    </span>
                    {row && (
                      <span className="font-mono text-[12.5px] tabular-nums text-(--ink-3)">
                        slot {String(row.id_prisma)}
                      </span>
                    )}
                  </p>
                  {tidakDitemukan ? (
                    <p className="mt-2 max-w-xs text-[12.5px] leading-relaxed text-(--ink-2)">
                      Prisma ini tidak ditembak pada running {sesiTanggal ?? "ini"}. Pilih prisma
                      lain lewat pengalih di kanan atas.
                    </p>
                  ) : (
                    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-px text-[12px] leading-[1.45] text-(--ink-3)">
                      <dt>Site</dt>
                      <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-(--ink)">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span
                            aria-hidden="true"
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{ background: site?.badge_color ?? siteBadge(siteSlug).color }}
                          />
                          {menunggu ? "…" : site?.nama ?? siteBadge(siteSlug).nama}
                        </span>
                        <span className="truncate text-(--ink-2)">{menunggu ? "" : namaPos(siteSlug)}</span>
                      </dd>
                      <dt>Running</dt>
                      <dd className="font-mono tabular-nums text-(--ink)">{sesiTanggal ?? "…"}</dd>
                      <dt>Acuan R0</dt>
                      <dd className="font-mono tabular-nums text-(--ink)">
                        {logsLoading ? "…" : r0Log ? fmtDate(r0Log.datetime) : "belum ditetapkan"}
                      </dd>
                    </dl>
                  )}
                </div>

                {/* Zona B — putusan */}
                <div className="min-w-0 border-t border-(--line) pt-3 @3xl:border-t-0 @3xl:border-l @3xl:pt-0 @3xl:pl-4">
                  <Eyebrow>Pergeseran dari acuan R0</Eyebrow>
                  {menunggu ? (
                    <div className="mt-1.5 space-y-2" aria-busy="true" aria-label="Memuat pergeseran">
                      <div className="h-7 w-40 rounded bg-(--line)" />
                      <div className="h-3 w-56 rounded bg-(--line)" />
                      <div className="h-3 w-48 rounded bg-(--line)" />
                    </div>
                  ) : !row ? (
                    <p className="mt-2 text-[12.5px] text-(--ink-3)">—</p>
                  ) : (
                    <>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="text-[28px] font-bold leading-none tracking-[-0.03em] text-(--ink)">
                          {fmt(geserMm, 2)}
                        </span>
                        <span className="text-[12px] font-medium text-(--ink-3)">mm</span>
                        <span className="ml-1 inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-(--ink)">
                          <StatusDot status={status} />
                          {status ?? "Ambang belum diatur"}
                        </span>
                        {berikut && (
                          <span className="text-[11.5px] text-(--ink-3)">
                            ambang {berikut.label.toLowerCase()} {fmt(berikut.nilai, 0)} mm
                          </span>
                        )}
                      </p>

                      <dl className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-(--ink-3)">
                        {bearing !== null && (
                          <div className="inline-flex items-center gap-1.5 text-(--ink-2)">
                            <dt className="sr-only">Arah</dt>
                            <dd className="inline-flex items-center gap-1.5">
                              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
                                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity="0.3" />
                                <path
                                  d="M8 2.6 L10.6 9.4 L8 8.1 L5.4 9.4 Z"
                                  fill="currentColor"
                                  transform={`rotate(${bearing.toFixed(1)} 8 8)`}
                                />
                              </svg>
                              <span className="font-mono tabular-nums text-(--ink)">{bearing.toFixed(1)}°</span>
                              {arah?.teks && <span className="text-(--ink)">{arah.teks}</span>}
                            </dd>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <dt>ΔX</dt>
                          <dd className="font-mono tabular-nums text-(--ink)">{fmtSelisih(dxMm)}</dd>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <dt>ΔY</dt>
                          <dd className="font-mono tabular-nums text-(--ink)">{fmtSelisih(dyMm)}</dd>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <dt>ΔZ</dt>
                          <dd className="font-mono tabular-nums text-(--ink)">{fmtSelisih(dzMm)}</dd>
                        </div>
                        <div>mm</div>
                      </dl>

                      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-(--ink-3)">
                        <span>Hari itu</span>
                        {adaHarian ? (
                          <>
                            <span className="text-[15px] font-semibold leading-none text-(--ink)">
                              {fmt(lajuMmd, 2)}
                            </span>
                            <span>mm/hari</span>
                            {statusLaju && (
                              <span className="inline-flex items-center gap-1.5 text-(--ink-2)">
                                <StatusDot status={statusLaju} className="size-2" />
                                {statusLaju}
                              </span>
                            )}
                            <span className="@3xl:ml-auto">
                              <span className="font-mono tabular-nums">{harian?.count}</span> pembacaan,{" "}
                              <span className="font-mono tabular-nums">
                                {fmtJamDari(harian?.first_time)}–{fmtJamDari(harian?.last_time)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <span>belum ada pembacaan lain pada tanggal ini</span>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {/* Zona C — teropong */}
                <div className="flex min-w-0 flex-col items-center border-t border-(--line) pt-3 @3xl:col-span-2 @5xl:order-first @5xl:col-span-1 @5xl:border-t-0 @5xl:border-r @5xl:pt-0 @5xl:pr-4">
                  <Eyebrow className="mb-1 self-start">Teropong arah pergeseran</Eyebrow>
                  <PrismScope
                    dxMm={dxMm}
                    dyMm={dyMm}
                    status={status}
                    arahTeks={arah?.teks ?? null}
                    ambang={ambang}
                    jejak={jejak}
                    sesiKey={`${idLog}-${row?.id_prisma ?? ""}`}
                    kosong={!row}
                    tone="paper"
                    ukuran={120}
                  />
                  {/* Teropong 120px tidak memuat label di dalam SVG, jadi arti
                      tiap bentuk dijelaskan di sini — dipisah titik tengah
                      supaya muat dua baris. */}
                  <p className="mt-1 max-w-[262px] text-center text-[10px] leading-snug text-(--ink-3)">
                    Pusat R0 · panah sesi ini
                    {ambang && (
                      <>
                        {" "}· cincin waspada{" "}
                        <span className="font-mono tabular-nums">{fmt(ambang.geser.normalMax, 0)}</span> mm
                      </>
                    )}
                    {jejak.length > 0 && (
                      <>
                        {" "}· <span className="font-mono tabular-nums">{jejak.length}</span> titik pembacaan
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Panel>

            {/* ══ Riwayat + pembacaan ══ */}
            <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
              <Panel className="rise-in min-w-0" style={{ animationDelay: "120ms" }}>
                <PanelHeader
                  title="Riwayat pergeseran"
                  actions={
                    <>
                      <Popover open={rentangOpen} onOpenChange={bukaRentang}>
                        <PopoverTrigger
                          className={cn(
                            tombol,
                            "bg-white font-mono text-[12.5px] font-medium tabular-nums text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                          )}
                          aria-label="Ubah rentang waktu"
                        >
                          <CalendarIcon className="size-4 text-(--ink-3)" />
                          {fmtTanggalPendek(dari)} {jamDari} – {fmtTanggalPendek(sampai)} {jamSampai}
                          <ChevronDown className="size-3.5 text-(--ink-3)" />
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          sideOffset={8}
                          className="tema-monitoring w-auto max-w-[calc(100vw-2rem)] rounded-[14px] border-(--line) bg-white p-4 shadow-xl"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                            <span className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-(--paper) px-3 font-medium text-(--ink) ring-1 ring-(--line)">
                              <CalendarIcon className="size-4 text-(--ink-3)" />
                              {fmtTanggalPanjang(tDari)}
                            </span>
                            <Select value={tJamDari} onValueChange={(v) => v && setTJamDari(v)}>
                              <SelectTrigger className="h-9 w-[92px] cursor-pointer rounded-[9px] border-0 bg-(--paper) px-3 font-mono text-[12.5px] tabular-nums text-(--ink) shadow-none ring-1 ring-(--line)">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[240px] rounded-[10px] p-1">
                                {JAM_DARI.map((h) => (
                                  <SelectItem key={h} value={h} className="cursor-pointer justify-center rounded-md py-1.5 font-mono text-[12px]">
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="px-1 text-(--ink-3)">sampai</span>
                            <span className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-(--paper) px-3 font-medium text-(--ink) ring-1 ring-(--line)">
                              <CalendarIcon className="size-4 text-(--ink-3)" />
                              {fmtTanggalPanjang(tSampai)}
                            </span>
                            <Select value={tJamSampai} onValueChange={(v) => v && setTJamSampai(v)}>
                              <SelectTrigger className="h-9 w-[92px] cursor-pointer rounded-[9px] border-0 bg-(--paper) px-3 font-mono text-[12.5px] tabular-nums text-(--ink) shadow-none ring-1 ring-(--line)">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="max-h-[240px] rounded-[10px] p-1">
                                {JAM_SAMPAI.map((h) => (
                                  <SelectItem key={h} value={h} className="cursor-pointer justify-center rounded-md py-1.5 font-mono text-[12px]">
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div
                            className="mt-3 rounded-[12px] ring-1 ring-(--line)"
                            style={{ "--primary": "var(--navy)", "--muted": "#e8e8f0" } as React.CSSProperties}
                          >
                            <Calendar
                              mode="range"
                              numberOfMonths={2}
                              defaultMonth={tDari}
                              selected={{ from: tDari, to: tSampai }}
                              onSelect={(r) => {
                                if (!r?.from) return;
                                setTDari(r.from);
                                setTSampai(r.to ?? r.from);
                              }}
                              className="p-3"
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[12px] text-(--ink-3)">
                              <span className="font-mono tabular-nums">
                                {Math.max(1, Math.round((tSampai.getTime() - tDari.getTime()) / 86400000) + 1)}
                              </span>{" "}
                              hari. Lebih dari 2 hari dirata-rata per jam.
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setRentangOpen(false)}
                                className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={terapkanRentang}
                                className={cn(tombol, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
                              >
                                Tampilkan
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        onClick={() => void muatRiwayat(dari, sampai, jamDari, jamSampai)}
                        disabled={memuat || !row}
                        className={cn(tombol, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
                      >
                        {memuat && <Loader2 className="size-4 animate-spin" />}
                        Tampilkan
                      </button>
                    </>
                  }
                >
                  <Chip>{tampilanAktif.satuan}</Chip>
                  {rentangDimuat && (
                    <Chip mono>
                      {riwayat.length} pembacaan
                    </Chip>
                  )}
                  {tampilan === "geser" && ambang && !garisAmbang && (
                    <span>ambang waspada {fmt(ambang.geser.normalMax, 0)} mm, di luar skala grafik</span>
                  )}
                  {sebelumR0 > 0 && (
                    <span title="Tembakan sebelum sesi acuan R0 tidak bisa dibandingkan dengan R0">
                      <span className="font-mono tabular-nums">{sebelumR0}</span> pembacaan sebelum
                      acuan R0 tidak dihitung
                    </span>
                  )}
                  {skalaY.terpotong > 0 && (
                    <span title="Pembacaan yang melenceng jauh tetap ada di tabel di bawah">
                      <span className="font-mono tabular-nums">{skalaY.terpotong}</span> pembacaan di
                      luar skala grafik
                    </span>
                  )}
                </PanelHeader>

                <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
                  <div
                    role="tablist"
                    aria-label="Nilai yang digambar"
                    className="inline-flex gap-1 rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line)"
                  >
                    {TAMPILAN.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        role="tab"
                        aria-selected={tampilan === x.id}
                        onClick={() => setTampilan(x.id)}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                          tampilan === x.id
                            ? "bg-white text-(--ink) shadow-sm"
                            : "text-(--ink-3) hover:text-(--ink-2)"
                        )}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>

                {galat && (
                  <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <p>{galat}</p>
                  </div>
                )}

                <div className="min-w-0 overflow-hidden border-t border-(--line) px-2 pt-4 pb-3">
                  {memuat && riwayat.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center" aria-busy="true">
                      <Loader2 className="size-5 animate-spin text-(--navy)" aria-label="Memuat riwayat" />
                    </div>
                  ) : !row ? (
                    <div className="flex h-[300px] items-center justify-center px-6 text-center text-[13px] text-(--ink-3)">
                      Pilih prisma yang ditembak pada running ini.
                    </div>
                  ) : seri.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center px-6 text-center text-[13px] text-(--ink-3)">
                      Tidak ada pembacaan pada rentang ini. Ubah rentang lalu Tampilkan.
                    </div>
                  ) : (
                    <div className={cn("transition-opacity duration-300", memuat && "opacity-50")}>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={seri} margin={{ top: 14, right: 40, left: 0, bottom: 4 }}>
                          <CartesianGrid stroke="var(--line)" vertical={false} />
                          <XAxis
                            dataKey="ts"
                            type="number"
                            scale="time"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(v: number) => fmtTick(v, { tanggal: multiHari })}
                            tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: FONT_MONO }}
                            axisLine={false}
                            tickLine={false}
                            tickCount={6}
                            interval="preserveStartEnd"
                            padding={{ left: 6, right: 6 }}
                            minTickGap={multiHari ? 56 : 32}
                          />
                          <YAxis
                            dataKey="nilai"
                            domain={domainY}
                            allowDataOverflow={skalaY.terpotong > 0}
                            tickFormatter={(v: number) => v.toFixed(desimalY)}
                            tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: FONT_MONO }}
                            axisLine={false}
                            tickLine={false}
                            width={tampilan === "geser" ? 56 : 92}
                          />
                          <Tooltip
                            content={<TipRiwayat tampilan={tampilan} />}
                            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
                            isAnimationActive={false}
                          />
                          {garisAmbang && (
                            <ReferenceLine
                              y={garisAmbang.nilai}
                              stroke="var(--st-waspada)"
                              strokeDasharray="4 4"
                              label={{
                                value: `${garisAmbang.label} ${fmt(garisAmbang.nilai, 0)} mm`,
                                position: "insideTopRight",
                                fill: "var(--st-waspada)",
                                fontSize: 11,
                                fontFamily: FONT_MONO,
                              }}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="nilai"
                            stroke="var(--navy)"
                            strokeWidth={2}
                            dot={
                              seri.length <= 60
                                ? { r: 3, fill: "#fff", stroke: "var(--navy)", strokeWidth: 1.5 }
                                : false
                            }
                            activeDot={{ r: 5, fill: "var(--navy)", stroke: "#fff", strokeWidth: 2 }}
                            isAnimationActive={false}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Pembacaan instrumen: R0 vs sesi ini */}
              <Panel className="rise-in min-w-0" style={{ animationDelay: "180ms" }}>
                <PanelHeader title="Pembacaan instrumen">
                  {row && <Chip mono>{fmtDate(row.waktu)}</Chip>}
                  <span>koordinat meter, sudut derajat-menit-detik</span>
                </PanelHeader>
                <div className="overflow-x-auto border-t border-(--line)">
                  <table className="w-full min-w-[360px] border-separate border-spacing-0 text-left">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                        <th scope="col" className="border-b border-(--line) py-2.5 pl-5 pr-3 font-semibold">
                          <span className="sr-only">Besaran</span>
                        </th>
                        <th scope="col" className="border-b border-(--line) px-3 py-2.5 text-right font-semibold">
                          Acuan R0
                        </th>
                        <th scope="col" className="border-b border-(--line) px-3 py-2.5 text-right font-semibold">
                          Sesi ini
                        </th>
                        <th scope="col" className="border-b border-(--line) py-2.5 pr-5 pl-3 text-right font-semibold">
                          Selisih
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[12.5px]">
                      {(
                        [
                          ["Easting X", fval(t?.E0), fval(t?.E1), t ? `${fmtSelisih(dxMm)} mm` : "—"],
                          ["Northing Y", fval(t?.N0), fval(t?.N1), t ? `${fmtSelisih(dyMm)} mm` : "—"],
                          ["Elevasi Z", fval(t?.Z0), fval(t?.Z1), t ? `${fmtSelisih(dzMm)} mm` : "—"],
                          ["Sudut horizontal", fmtDms(t?.HA0), fmtDms(t?.HA1), fmtDetikBusur(selisihDetikBusur(t?.HA0, t?.HA1))],
                          ["Sudut vertikal", fmtDms(t?.VA0), fmtDms(t?.VA1), fmtDetikBusur(selisihDetikBusur(t?.VA0, t?.VA1))],
                          [
                            "Jarak miring",
                            fval(t?.SD0),
                            fval(t?.SD1),
                            (() => {
                              const a = parseNum(t?.SD0);
                              const b = parseNum(t?.SD1);
                              return a !== null && b !== null ? `${fmtSelisih((b - a) * 1000, 1)} mm` : "—";
                            })(),
                          ],
                        ] as [string, string, string, string][]
                      ).map(([label, r0, kini, selisih], i) => (
                        <tr key={label} className={cn(i === 3 && "[&>td]:border-t [&>td]:border-t-(--line)")}>
                          <td className="border-b border-(--line) py-2.5 pl-5 pr-2.5 text-[12px] whitespace-nowrap text-(--ink-2)">
                            {label}
                          </td>
                          <td className="border-b border-(--line) px-2.5 py-2.5 text-right font-mono text-[12px] tabular-nums whitespace-nowrap text-(--ink-2)">
                            {menunggu ? "…" : r0}
                          </td>
                          <td className="border-b border-(--line) px-2.5 py-2.5 text-right font-mono text-[12px] font-semibold tabular-nums whitespace-nowrap text-(--ink)">
                            {menunggu ? "…" : kini}
                          </td>
                          <td className="border-b border-(--line) py-2.5 pr-5 pl-2.5 text-right font-mono text-[12px] tabular-nums whitespace-nowrap text-(--ink)">
                            {menunggu ? "…" : selisih}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-5 py-3 text-[11.5px] leading-relaxed text-(--ink-3)">
                  {site?.rotasi_deg != null
                    ? `Koordinat sudah dikoreksi rotasi site ${fmt(site.rotasi_deg, 0)}°; sudut dan jarak apa adanya dari instrumen.`
                    : "Sudut dan jarak apa adanya dari instrumen."}
                </p>
              </Panel>
            </div>

            {/* ══ Tabel rentang ══ */}
            <Panel className="rise-in min-w-0" style={{ animationDelay: "240ms" }}>
              <PanelHeader
                title="Data pada rentang"
                actions={
                  <button
                    type="button"
                    onClick={unduhExcel}
                    disabled={riwayat.length === 0 || mengunduh}
                    title={riwayat.length === 0 ? "Tidak ada data untuk diunduh" : "Unduh tabel ini sebagai Excel"}
                    className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
                  >
                    {mengunduh ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Unduh Excel
                  </button>
                }
              >
                {rentangDimuat && (
                  <Chip mono>
                    {fmtTanggalPendek(rentangDimuat.dari)} – {fmtTanggalPendek(rentangDimuat.sampai)}
                  </Chip>
                )}
                <span>terbaru di atas</span>
              </PanelHeader>
              <div className="max-h-[440px] overflow-auto border-t border-(--line)">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {[
                        ["Waktu", "pl-5"],
                        ["Pergeseran mm", "text-right"],
                        ["ΔZ mm", "text-right"],
                        ["Northing Y m", "text-right"],
                        ["Easting X m", "text-right"],
                        ["Elevasi Z m", "pr-5 text-right"],
                      ].map(([h, k]) => (
                        <th
                          key={h}
                          scope="col"
                          className={cn(
                            "sticky top-0 z-10 border-b border-(--line) bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)",
                            k
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memuat && riwayat.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <Loader2 className="mx-auto size-5 animate-spin text-(--navy)" aria-label="Memuat tabel" />
                        </td>
                      </tr>
                    ) : riwayat.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 px-6 text-center text-[13px] text-(--ink-3)">
                          Tidak ada pembacaan pada rentang ini.
                        </td>
                      </tr>
                    ) : (
                      [...riwayat].reverse().map((p) => (
                        <tr key={p.ts} className={cn("transition-colors hover:bg-(--paper)", memuat && "opacity-50")}>
                          <td className="border-b border-(--line) py-2.5 pl-5 pr-3 font-mono text-[12.5px] tabular-nums text-(--ink-2) whitespace-nowrap">
                            {fmtWaktuPenuh(p.ts)}
                          </td>
                          <td className="border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] font-semibold tabular-nums text-(--ink)">
                            {fmt(p.geserMm)}
                          </td>
                          <td className="border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-(--ink)">
                            {fmtSelisih(p.dzMm)}
                          </td>
                          <td className="border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-(--ink-2)">
                            {p.n.toFixed(4)}
                          </td>
                          <td className="border-b border-(--line) px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-(--ink-2)">
                            {p.e.toFixed(4)}
                          </td>
                          <td className="border-b border-(--line) py-2.5 pr-5 pl-3 text-right font-mono text-[12.5px] tabular-nums text-(--ink-2)">
                            {p.z.toFixed(4)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams() memaksa halaman jadi dinamis; Suspense boundary menjaga
// shell-nya tetap bisa di-prerender.
export default function DetailPrismaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-10">
          <Loader2 className="size-8 animate-spin text-[#303481]" />
        </div>
      }
    >
      <DetailPrismaContent />
    </Suspense>
  );
}
