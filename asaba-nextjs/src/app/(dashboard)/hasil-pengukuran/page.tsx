"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Map as MapIcon,
  Ruler,
  Rows3,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useDeformasi, useLogKontrol, useRtsConnectionStatus } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { Chip, Eyebrow, Panel, PanelHeader } from "@/components/monitoring/panel";
import { SessionConsole } from "@/components/monitoring/session-console";
import { SessionList } from "@/components/monitoring/session-list";
import { EventTable } from "@/components/monitoring/event-table";
import { DailyTable } from "@/components/monitoring/daily-table";
import {
  ColumnFilter,
  KOLOM_LENGKAP,
  type ColumnVisibility,
} from "@/components/monitoring/column-filter";
import { R0Dialog } from "@/components/monitoring/r0-dialog";
import {
  ringkasPrisma,
  type LogKontrolRow,
  type PengukuranRow,
  type PrismaRingkas,
} from "@/components/monitoring/derive";
import {
  ambangBerikutnya,
  ambangDariSite,
  statusTerburuk,
} from "@/components/monitoring/status";
import { fmtDate, fmtJam, fmtTanggal } from "@/components/monitoring/format";
import {
  buatExcelHasilPengukuran,
  namaBerkasExcel,
} from "@/lib/excel-hasil-pengukuran";
import type { PrismaMarkerData } from "@/components/PrismaMap";

const PrismaMap = dynamic(() => import("@/components/PrismaMap"), { ssr: false });

const PER_HALAMAN = 10;
/** Jumlah sesi yang diambil sekali jalan, lalu dipaginasi di klien. */
const BATAS_SESI = 100;

/**
 * Tiga cara melihat SATU sesi yang sama, bukan tiga mode aplikasi.
 *
 * Sebelumnya ini dua kontrol terpisah — tab Event/Harian di satu baris dan
 * pengalih Tabel/Peta di baris lain — sehingga tab "Harian" harus disembunyikan
 * saat mode Peta aktif, dan kombinasi Peta+Harian jadi keadaan yang tidak boleh
 * terjadi tapi tetap harus dijaga di kode. Satu kontrol tiga arah menghapus
 * keadaan itu sepenuhnya.
 */
type Tampilan = "Event" | "Harian" | "Peta";

const TAMPILAN: { id: Tampilan; label: string; Icon: typeof Table2; judul: string }[] = [
  { id: "Event", label: "Catatan ukur", Icon: Table2, judul: "Pembacaan mentah sesi ini" },
  { id: "Harian", label: "Harian", Icon: Rows3, judul: "Pergeseran & laju sepanjang hari" },
  { id: "Peta", label: "Peta", Icon: MapIcon, judul: "Sebaran prisma di peta" },
];

/** `?view=` lama dari Dashboard: "Tabel" → catatan ukur, "Peta" → peta. */
function tampilanDariUrl(v: string | null): Tampilan {
  if (v === "Peta") return "Peta";
  if (v === "Harian") return "Harian";
  return "Event";
}

function HasilPengukuranContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected, lastUpdate } = useRtsConnectionStatus();
  // withLogger=true supaya `jumlah_sesi` ikut terbawa — angka di pil site.
  const { sites, badge: siteBadge, bySlug: siteBySlug, isLoading: sitesLoading } = useSites(
    false,
    true
  );

  // "" = semua site. Diambil dari ?site= supaya tautan dari Dashboard membawa
  // serta site yang sedang dilihat.
  const [siteFilter, setSiteFilter] = useState(searchParams.get("site") ?? "");
  const [tampilan, setTampilan] = useState<Tampilan>(() =>
    tampilanDariUrl(searchParams.get("view"))
  );
  const [kolom, setKolom] = useState<ColumnVisibility>(KOLOM_LENGKAP);
  const [halaman, setHalaman] = useState(1);
  const [r0Open, setR0Open] = useState(false);
  const [pilihan, setPilihan] = useState<string | null>(searchParams.get("log"));
  const [mengunduh, setMengunduh] = useState(false);
  const [unduhError, setUnduhError] = useState("");

  // with_prisma=false: server menjalankan satu query `rts` per sesi, dan pada
  // 100 sesi itu mahal sekali sementara jumlah prismanya tidak dipakai di sini —
  // daftar ini dibedakan oleh tanggal dan site-nya.
  const {
    logs,
    isLoading: logsLoading,
    isError: logsError,
  } = useLogKontrol(siteFilter || undefined, BATAS_SESI, { withPrisma: false });
  const daftar = logs as LogKontrolRow[];

  // Sesi aktif DITURUNKAN, tidak disinkronkan lewat effect. Kalau sesi yang
  // dipilih hilang dari daftar (mis. setelah ganti saringan site), otomatis
  // jatuh ke sesi terbaru tanpa perlu effect yang mengejar perubahan.
  const logAktif = useMemo(
    () => daftar.find((l) => l.id_log === pilihan) ?? daftar[0] ?? null,
    [daftar, pilihan]
  );

  const {
    deformasi,
    isLoading: defLoading,
    isError: defError,
  } = useDeformasi(logAktif?.id_log ?? null, { keepPreviousData: true });

  const baris = useMemo(
    () => (deformasi?.data_pengukuran ?? []) as PengukuranRow[],
    [deformasi]
  );
  // keepPreviousData menahan hasil sesi sebelumnya selama yang baru dimuat,
  // jadi tabel diredupkan alih-alih berkedip ke kerangka lalu melompat.
  const menahan = defLoading && baris.length > 0;

  const siteAktif = siteBySlug(logAktif?.site ?? null);
  const ambang = useMemo(() => ambangDariSite(siteAktif), [siteAktif]);
  const ringkas = useMemo(() => ringkasPrisma(baris, ambang), [baris, ambang]);

  const puncak = useMemo(() => {
    let geser: PrismaRingkas | null = null;
    let laju: PrismaRingkas | null = null;
    for (const p of ringkas) {
      if (p.geserMm !== null && (geser === null || p.geserMm > (geser.geserMm ?? -1))) geser = p;
      if (p.lajuMmd !== null && (laju === null || p.lajuMmd > (laju.lajuMmd ?? -1))) laju = p;
    }
    const status = statusTerburuk(ringkas.map((p) => p.status));
    return {
      geser,
      laju,
      status,
      berikut: status && ambang ? ambangBerikutnya(status, ambang) : null,
    };
  }, [ringkas, ambang]);

  const titikAmbang = useMemo(
    () =>
      ringkas
        .filter((p) => p.geserMm !== null)
        .map((p) => ({
          id: p.id,
          nama: p.nama,
          geserMm: p.geserMm as number,
          status: p.status,
        })),
    [ringkas]
  );

  // Sesi acuan untuk site yang sedang dilihat. Dicari di antara sesi yang sudah
  // dimuat — kalau tidak ada, jangan simpulkan bahwa R0-nya belum ditetapkan.
  const r0Log = useMemo(() => {
    const slug = logAktif?.site ?? null;
    return daftar.find((l) => Number(l.r0) === 1 && l.site === slug) ?? null;
  }, [daftar, logAktif]);

  const totalHalaman = Math.max(1, Math.ceil(daftar.length / PER_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const halamanIsi = daftar.slice(
    (halamanAman - 1) * PER_HALAMAN,
    halamanAman * PER_HALAMAN
  );

  const perbaruiUrl = (ubah: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(searchParams.toString());
    ubah(q);
    // replace, bukan push — mengganti saringan bukan langkah navigasi yang
    // perlu bisa ditekan Back berkali-kali.
    router.replace(`/hasil-pengukuran?${q}`, { scroll: false });
  };

  const gantiSite = (slug: string) => {
    setSiteFilter(slug);
    setHalaman(1);
    setPilihan(null);
    perbaruiUrl((q) => {
      if (slug) q.set("site", slug);
      else q.delete("site");
      q.delete("log");
    });
  };

  const pilihSesi = (id: string) => {
    setPilihan(id);
    perbaruiUrl((q) => q.set("log", id));
  };

  const gantiTampilan = (v: Tampilan) => {
    setTampilan(v);
    perbaruiUrl((q) => q.set("view", v));
  };

  const bukaPrisma = (nama: string) =>
    router.push(
      `/hasil-pengukuran/${encodeURIComponent(nama)}?log=${logAktif?.id_log ?? ""}`
    );

  const unduhExcel = async () => {
    if (baris.length === 0 || !logAktif) return;
    setMengunduh(true);
    setUnduhError("");
    try {
      const tanggal = fmtDate(logAktif.datetime);
      const blob = await buatExcelHasilPengukuran({
        rows: baris,
        namaSite: siteAktif?.nama ?? (logAktif.site?.toUpperCase() || ""),
        tanggal,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaBerkasExcel(tanggal);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[unduh Excel]", e);
      setUnduhError("Berkas Excel gagal dibuat. Coba lagi.");
    } finally {
      setMengunduh(false);
    }
  };

  const peringatanSite = logAktif?.site ? siteBadge(logAktif.site).peringatan : null;
  const belumAdaSesi = !logsLoading && daftar.length === 0;
  const namaSiteAktif =
    siteAktif?.nama ?? (logAktif?.site ? siteBadge(logAktif.site).nama : "Semua site");

  const tombol =
    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    // Gutter dilepas lewat RUTE_FULL_BLEED di (dashboard)/layout.tsx.
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {/* ── Bar kontrol ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Eyebrow>Site</Eyebrow>
          <div
            role="tablist"
            aria-label="Saring berdasarkan site"
            className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={siteFilter === ""}
              onClick={() => gantiSite("")}
              className={cn(
                "inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                siteFilter === ""
                  ? "bg-(--navy) text-white"
                  : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
              )}
            >
              Semua site
            </button>
            {sites.map((s) => {
              const aktif = s.slug === siteFilter;
              const b = siteBadge(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => gantiSite(s.slug)}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                    aktif
                      ? "bg-(--navy) text-white"
                      : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: s.badge_color }}
                  />
                  {s.nama}
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      aktif ? "text-white/70" : "text-(--ink-3)"
                    )}
                  >
                    {s.jumlah_sesi ?? 0}
                  </span>
                  {b.peringatan && (
                    <AlertTriangle
                      className={cn("size-3.5", aktif ? "text-amber-300" : "text-amber-600")}
                      aria-label="Data site ini belum bisa dipercaya"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {/* Status koneksi RTS — satu-satunya angka HIDUP di halaman ini,
                jadi ditaruh di bar kontrol, bukan di panel sesi yang seluruh
                isinya catatan masa lalu. */}
            <span
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-medium text-(--ink-2) ring-1 ring-(--line)"
              title={
                lastUpdate
                  ? `Data terakhir ${fmtDate(lastUpdate, { detik: true })}`
                  : "Belum ada data masuk"
              }
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: isConnected ? "var(--st-normal)" : "var(--st-awas)" }}
              />
              RTS {isConnected ? "terhubung" : "terputus"}
            </span>
            <button
              type="button"
              onClick={() => setR0Open(true)}
              className={cn(tombol, "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)")}
            >
              <Ruler className="size-4" />
              Acuan R0
            </button>
          </div>
        </div>

        {peringatanSite && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">{peringatanSite}.</span> Angka pergeseran di
              halaman ini belum bisa dipakai mengambil keputusan.
            </p>
          </div>
        )}

        {logsError ? (
          <Panel className="items-center px-6 py-14 text-center">
            <p className="font-display text-[20px] font-bold text-(--ink)">
              Riwayat running tidak bisa dimuat
            </p>
            <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">
              Periksa koneksi database, lalu muat ulang halaman ini.
            </p>
          </Panel>
        ) : (
          <>
            <SessionConsole
              className="rise-in"
              tanggal={logAktif ? fmtTanggal(logAktif.datetime) : null}
              jam={logAktif ? fmtJam(logAktif.datetime) : null}
              siteNama={namaSiteAktif}
              siteWarna={siteAktif?.badge_color ?? "var(--ink-3)"}
              r0Tanggal={r0Log ? fmtTanggal(r0Log.datetime) : null}
              terukur={baris.length}
              geser={{
                nilai: puncak.geser?.geserMm ?? null,
                nama: puncak.geser?.nama ?? null,
                status: puncak.status,
              }}
              laju={{
                nilai: puncak.laju?.lajuMmd ?? null,
                nama: puncak.laju?.nama ?? null,
                status: puncak.laju?.statusLaju ?? null,
              }}
              ambangBerikut={puncak.berikut}
              titik={titikAmbang}
              ambang={ambang}
              loading={defLoading || logsLoading}
              belumAdaSesi={belumAdaSesi}
            />

            <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[268px_minmax(0,1fr)]">
              {/* ── Daftar sesi ── */}
              <Panel
                className="rise-in xl:h-[620px]"
                style={{ animationDelay: "120ms" }}
              >
                <PanelHeader title="Tanggal running">
                  <span>
                    <span className="font-mono tabular-nums">{daftar.length}</span> sesi
                    {siteFilter ? " di site ini" : " terbaru"}
                  </span>
                </PanelHeader>
                <div className="max-h-[420px] flex-1 overflow-y-auto border-t border-(--line) xl:max-h-none">
                  <SessionList
                    logs={halamanIsi}
                    activeLog={logAktif?.id_log ?? null}
                    loading={logsLoading}
                    onSelect={pilihSesi}
                    badge={siteBadge}
                  />
                </div>
                {totalHalaman > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t border-(--line) px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setHalaman(Math.max(1, halamanAman - 1))}
                      disabled={halamanAman === 1}
                      aria-label="Halaman sebelumnya"
                      className="flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-(--ink-2) outline-none transition-colors hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="font-mono text-[12px] tabular-nums text-(--ink-3)">
                      {halamanAman} / {totalHalaman}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHalaman(Math.min(totalHalaman, halamanAman + 1))}
                      disabled={halamanAman >= totalHalaman}
                      aria-label="Halaman berikutnya"
                      className="flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-(--ink-2) outline-none transition-colors hover:bg-(--paper) focus-visible:ring-2 focus-visible:ring-(--navy)/40 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </Panel>

              {/* ── Data prisma ── */}
              <Panel
                className="rise-in min-w-0 xl:h-[620px]"
                style={{ animationDelay: "180ms" }}
              >
                <PanelHeader
                  title="Data prisma"
                  actions={
                    <>
                      {tampilan === "Event" && (
                        <ColumnFilter value={kolom} onChange={setKolom} />
                      )}
                      <button
                        type="button"
                        onClick={unduhExcel}
                        disabled={baris.length === 0 || mengunduh}
                        title={
                          baris.length === 0
                            ? "Tidak ada data untuk diunduh"
                            : "Unduh catatan ukur sesi ini sebagai Excel"
                        }
                        className={cn(
                          tombol,
                          "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                        )}
                      >
                        {mengunduh ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        Unduh Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/visualisasi-3d")}
                        className={cn(tombol, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
                      >
                        <Box className="size-4" /> Buka 3D
                      </button>
                    </>
                  }
                >
                  <Chip mono>{logAktif ? fmtDate(logAktif.datetime) : "—"}</Chip>
                  <Chip>
                    <span className="font-mono tabular-nums">{baris.length}</span>
                    &nbsp;prisma
                  </Chip>
                  {tampilan === "Harian" && (
                    <span>dihitung dari seluruh running pada tanggal sesi ini</span>
                  )}
                  {tampilan === "Event" && <span>pembacaan mentah, satuan meter</span>}
                </PanelHeader>

                {/* Pengalih tampilan */}
                <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
                  <div
                    role="tablist"
                    aria-label="Cara melihat data"
                    className="inline-flex gap-1 rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line)"
                  >
                    {TAMPILAN.map(({ id, label, Icon, judul }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tampilan === id}
                        title={judul}
                        onClick={() => gantiTampilan(id)}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                          tampilan === id
                            ? "bg-white text-(--ink) shadow-sm"
                            : "text-(--ink-3) hover:text-(--ink-2)"
                        )}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {(defError || unduhError) && (
                  <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <p>
                      {unduhError ||
                        "Data pengukuran sesi ini tidak bisa dimuat. Pilih sesi lain atau muat ulang halaman."}
                    </p>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col border-t border-(--line)">
                  {tampilan === "Peta" ? (
                    <div className="flex-1 overflow-auto p-4">
                      {!logAktif ? (
                        <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-(--ink-3)">
                          Pilih tanggal running di sebelah kiri.
                        </div>
                      ) : (
                        <div className={cn(menahan && "opacity-50 transition-opacity")}>
                          <PrismaMap
                            site={logAktif.site ?? null}
                            markers={baris.map(
                              (row) =>
                                ({
                                  id_prisma: String(row.id_prisma),
                                  nama_prisma: row.nama_prisma ?? "",
                                  site: logAktif.site ?? null,
                                  lat0: row.temp_tembak?.map_lat0 ?? null,
                                  lon0: row.temp_tembak?.map_lon0 ?? null,
                                  lat1: row.temp_tembak?.map_lat1 ?? null,
                                  lon1: row.temp_tembak?.map_lon1 ?? null,
                                  DN: String(row.temp_tembak?.DN ?? "-"),
                                  DE: String(row.temp_tembak?.DE ?? "-"),
                                  DZ: String(row.temp_tembak?.DZ ?? "-"),
                                  linear: row.temp_tembak?.linear ?? 0,
                                  arah_pergeseran: row.temp_tembak?.arah_pergeseran ?? "-",
                                  SD1: String(row.temp_tembak?.SD1 ?? "-"),
                                  hasData: !!row.temp_tembak?.map_lat1,
                                }) as PrismaMarkerData
                            )}
                          />
                        </div>
                      )}
                    </div>
                  ) : tampilan === "Event" ? (
                    <EventTable
                      rows={baris}
                      colVis={kolom}
                      loading={defLoading}
                      belumAdaSesi={!logAktif}
                      redup={menahan}
                      onBukaPrisma={bukaPrisma}
                    />
                  ) : (
                    <DailyTable
                      rows={baris}
                      loading={defLoading}
                      belumAdaSesi={!logAktif}
                      redup={menahan}
                      onBukaPrisma={bukaPrisma}
                    />
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}

        {sitesLoading && sites.length === 0 && (
          <p className="text-[12.5px] text-(--ink-3)">Memuat daftar site…</p>
        )}
      </div>

      <R0Dialog
        open={r0Open}
        onOpenChange={setR0Open}
        siteNama={namaSiteAktif}
        r0Log={r0Log}
        jumlahSesi={Math.max(0, daftar.filter((l) => l.site === logAktif?.site).length - 1)}
      />
    </div>
  );
}

// useSearchParams() memaksa halaman jadi dinamis; Suspense boundary menjaga
// shell-nya tetap bisa di-prerender.
export default function HasilPengukuranPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-10">
          <Loader2 className="size-8 animate-spin text-[#303481]" />
        </div>
      }
    >
      <HasilPengukuranContent />
    </Suspense>
  );
}
