"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  Crosshair,
  Loader2,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useSites } from "@/hooks/use-sites";
import { Eyebrow } from "@/components/monitoring/panel";
import { fmtDate } from "@/components/monitoring/format";
import {
  extractPoints,
  gambarScene,
  getRTSFromPayload,
} from "@/components/visualisasi-3d/deformasi-3d";
import type {
  BarisLog,
  CachePayload,
  PayloadDeformasi,
  PlotlyGlobal,
  RingkasRender,
  Titik,
} from "@/components/visualisasi-3d/types";

declare global {
  interface Window {
    Plotly?: PlotlyGlobal;
  }
}

const CACHE_KEY = "vis3d_cache_v1";

function saveCache(data: CachePayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* kuota penuh — cache memang opsional */
  }
}

function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachePayload) : null;
  } catch {
    return null;
  }
}

/** Kelas bersama untuk kartu yang melayang di atas panggung. */
const KACA =
  "rounded-[14px] bg-white/92 shadow-[0_8px_28px_-12px_oklch(0_0_0/0.25)] ring-1 ring-(--line) backdrop-blur-md";

const TOMBOL =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50 disabled:cursor-not-allowed disabled:opacity-50";

const INPUT_ANGKA =
  "h-8 w-full rounded-[8px] border border-(--line) bg-white px-2.5 font-mono text-[12.5px] tabular-nums text-(--ink) outline-none transition-colors focus:border-(--navy) focus:ring-2 focus:ring-(--navy)/25";

export default function Visualisasi3DPage() {
  const { sites, badge: siteBadge } = useSites();

  // ── Parameter render ──
  const [rtsE, setRtsE] = useState("");
  const [rtsN, setRtsN] = useState("");
  const [rtsZ, setRtsZ] = useState("");
  const [coneScale, setConeScale] = useState("0.2");
  const [minLinear, setMinLinear] = useState("0");

  // ── Pemilih sesi ──
  const [logs, setLogs] = useState<BarisLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState("");
  /** "" = semua site. */
  const [siteFilter, setSiteFilter] = useState("");

  // ── Keadaan panggung ──
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelTampil, setPanelTampil] = useState(true);
  /** Plot sudah tergambar. State, bukan turunan dari ref — lihat catatan di bawah. */
  const [sudahRender, setSudahRender] = useState(false);
  const [ringkas, setRingkas] = useState<RingkasRender | null>(null);

  const plotRef = useRef<HTMLDivElement>(null);
  const fsTargetRef = useRef<HTMLDivElement>(null);

  /**
   * Titik hasil parsing terakhir.
   *
   * Disimpan di ref karena hanya dipakai untuk MENGGAMBAR ULANG, bukan untuk
   * dibaca saat render React. Angka yang ditampilkan panel diambil dari
   * `ringkas` — versi sebelumnya membaca `cachedPointsRef.current` langsung di
   * dalam JSX, yang berarti panel bisa menampilkan hitungan lama tanpa memicu
   * render ulang.
   */
  const titikRef = useRef<Titik[] | null>(null);
  const [restoredFromCache, setRestoredFromCache] = useState(false);

  // ── Muat Plotly (berkas lokal, bukan CDN) ──
  useEffect(() => {
    if (window.Plotly) {
      setPlotlyReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "/plotly-2.33.0.min.js";
    s.onload = () => setPlotlyReady(true);
    document.head.appendChild(s);
  }, []);

  // ── Daftar sesi; setelah dapat, cek cache ──
  // `siteFilter` kosong = semua site (perilaku lama). Tiap opsi punya label
  // site-nya, jadi filter ini menambah kemampuan tanpa mengubah bawaan.
  useEffect(() => {
    setLogsLoading(true);
    const params = new URLSearchParams({ limit: "200", with_prisma: "false" });
    if (siteFilter) params.set("site", siteFilter);
    fetch(`/api/log-kontrol?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return;
        const data = json.data as BarisLog[];
        setLogs(data);
        if (data.length === 0) {
          setSelectedLogId("");
          return;
        }
        const cache = loadCache();
        const cachedLog =
          cache && data.find((l) => String(l.id_log) === String(cache.id_log));
        if (cache && cachedLog) {
          setSelectedLogId(cache.id_log);
          setRtsE(cache.rtsE);
          setRtsN(cache.rtsN);
          setRtsZ(cache.rtsZ);
          setConeScale(cache.coneScale);
          setMinLinear(cache.minLinear);
          setRingkas(cache.ringkas);
          titikRef.current = cache.points;
          setRestoredFromCache(true);
        } else {
          setSelectedLogId(data[0].id_log);
        }
      })
      .catch(() => setGalat("Daftar sesi tidak bisa dimuat."))
      .finally(() => setLogsLoading(false));
  }, [siteFilter]);

  // ── Fullscreen ──
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (window.Plotly && plotRef.current) window.Plotly.Plots.resize(plotRef.current);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const render = useCallback(
    (
      points: Titik[],
      o?: { E?: string; N?: string; Z?: string; scale?: string; lin?: string }
    ) => {
      if (!window.Plotly || !plotRef.current) return;
      gambarScene(window.Plotly, plotRef.current, points, {
        E: Number(o?.E ?? rtsE),
        N: Number(o?.N ?? rtsN),
        Z: Number(o?.Z ?? rtsZ),
        scale: parseFloat((o?.scale ?? coneScale).replace(",", ".")) || 0.2,
        minLin: parseFloat((o?.lin ?? minLinear).replace(",", ".")) || 0,
      });
      setSudahRender(true);
    },
    [rtsE, rtsN, rtsZ, coneScale, minLinear]
  );

  const handleLoad = useCallback(async () => {
    if (!selectedLogId || !plotlyReady) return;
    setLoading(true);
    setGalat("");
    // Ringkasan lama dibuang lebih dulu: kalau fetch-nya gagal, angka sesi
    // sebelumnya tidak boleh tertinggal di panel seolah milik sesi ini.
    setRingkas(null);

    try {
      const res = await fetch(`/api/deformasi?id_log=${selectedLogId}`);
      if (!res.ok) throw new Error(`Server menjawab HTTP ${res.status}`);
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error || "Gagal memuat data");

      const data = payload.data as PayloadDeformasi;

      // Koordinat RTS diisi otomatis dari payload bila tersedia.
      const rts = getRTSFromPayload(data);
      let finalE = rtsE,
        finalN = rtsN,
        finalZ = rtsZ;
      if (rts) {
        finalE = String(rts.e);
        finalN = String(rts.n);
        finalZ = Number.isFinite(rts.z) ? String(rts.z) : "0";
        setRtsE(finalE);
        setRtsN(finalN);
        setRtsZ(finalZ);
      }

      const pts = extractPoints(data);
      const hitung: RingkasRender = {
        tanggal: data?.tanggal ?? null,
        prisma: pts.length,
        valid: pts.filter((x) => x.ok).length,
        gagal: pts.filter((x) => !x.ok).length,
      };
      setRingkas(hitung);

      if (pts.length === 0) {
        titikRef.current = null;
        setSudahRender(false);
        setGalat("Tidak ada prisma yang terbaca untuk sesi ini.");
        return;
      }

      titikRef.current = pts;
      saveCache({
        id_log: selectedLogId,
        rtsE: finalE,
        rtsN: finalN,
        rtsZ: finalZ,
        coneScale,
        minLinear,
        points: pts,
        ringkas: hitung,
      });

      render(pts, { E: finalE, N: finalN, Z: finalZ, scale: coneScale, lin: minLinear });
    } catch (e: unknown) {
      // Galat SEKARANG terlihat. Versi sebelumnya mendorongnya ke daftar log
      // yang wadahnya ber-`className="hidden"`, jadi kegagalan fetch berakhir
      // sebagai placeholder "Mempersiapkan tampilan…" yang menggantung selamanya.
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [selectedLogId, plotlyReady, rtsE, rtsN, rtsZ, coneScale, minLinear, render]);

  /**
   * Muat sesi yang terpilih.
   *
   * Versi sebelumnya memuat SEKALI saja (dijaga `hasAutoLoaded`), jadi memilih
   * sesi lain di dropdown tidak mengubah apa pun sampai tombol Load ditekan —
   * dan selama itu panel ringkasan masih memperlihatkan angka sesi yang LAMA di
   * bawah nama sesi yang baru. Untuk sebuah penampil, memilih sesi harus berarti
   * menampilkannya.
   *
   * `idTerakhirRef` mencegah pemuatan berulang: handleLoad menulis rtsE/N/Z, dan
   * kalau effect ini ikut bergantung padanya ia akan memicu dirinya sendiri.
   */
  const idTerakhirRef = useRef<string | null>(null);
  const cacheDipakaiRef = useRef(false);
  useEffect(() => {
    if (!plotlyReady || !selectedLogId) return;
    if (idTerakhirRef.current === selectedLogId) return;

    const pakaiCache = restoredFromCache && !cacheDipakaiRef.current && titikRef.current;
    idTerakhirRef.current = selectedLogId;

    if (pakaiCache && titikRef.current) {
      // Sesi pertama datang dari cache — tidak perlu menembak server lagi.
      cacheDipakaiRef.current = true;
      render(titikRef.current, { E: rtsE, N: rtsN, Z: rtsZ, scale: coneScale, lin: minLinear });
      return;
    }
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotlyReady, selectedLogId, restoredFromCache]);

  const toggleFullscreen = () => {
    if (!fsTargetRef.current) return;
    if (!document.fullscreenElement) fsTargetRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  const sesiAktif = logs.find((l) => l.id_log === selectedLogId) ?? null;

  /** Satu keadaan hamparan; null berarti panggung siap ditonton. */
  const hamparan = (() => {
    if (galat) return { jenis: "galat" as const, teks: galat };
    if (!plotlyReady) return { jenis: "sibuk" as const, teks: "Menyiapkan renderer 3D…" };
    if (loading) return { jenis: "sibuk" as const, teks: "Memuat data pengukuran…" };
    if (!logsLoading && logs.length === 0)
      return { jenis: "kosong" as const, teks: "Belum ada sesi running untuk ditampilkan." };
    if (!sudahRender) return { jenis: "sibuk" as const, teks: "Menyiapkan tampilan…" };
    return null;
  })();

  return (
    // Panggung memiliki halaman: tinggi dipatok setinggi viewport dikurangi
    // header, dan seluruh kontrol MELAYANG di atasnya. Empat halaman lain di
    // aplikasi ini berbentuk "bar kontrol lalu grid panel"; di sini isinya satu
    // kanvas, jadi bentuk itu justru memakan ruang gambar dan membuat kelima
    // halaman terasa seragam tanpa alasan.
    <div
      className={cn(
        "tema-monitoring relative isolate h-[calc(100vh-4rem)] overflow-hidden bg-white text-(--ink)",
        fontDisplay.variable
      )}
    >
      {/* ─── Panggung 3D ─── */}
      <div ref={fsTargetRef} className="absolute inset-0 bg-white">
        {/* Plotly MENGUASAI elemen ini sepenuhnya — tidak boleh ada anak React
            di dalamnya. Versi sebelumnya menaruh placeholder sebagai anaknya,
            lalu Plotly.newPlot() menghapus isi elemen itu; React dan Plotly
            memperebutkan node yang sama. Hamparan sekarang jadi SAUDARA. */}
        <div ref={plotRef} className="size-full" />

        {hamparan && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/88 px-6 backdrop-blur-[1px]">
            <div className="max-w-sm text-center">
              {hamparan.jenis === "sibuk" && (
                <Loader2 className="mx-auto size-8 animate-spin text-(--ink-3)" />
              )}
              {hamparan.jenis === "kosong" && (
                <Boxes className="mx-auto size-9 text-(--ink-3)" strokeWidth={1.5} />
              )}
              {hamparan.jenis === "galat" && (
                <AlertTriangle className="mx-auto size-8 text-amber-600" />
              )}
              <p
                className={cn(
                  "mt-3 text-[13.5px] leading-relaxed",
                  hamparan.jenis === "galat" ? "text-(--ink)" : "text-(--ink-2)"
                )}
              >
                {hamparan.teks}
              </p>
              {hamparan.jenis === "galat" && (
                <p className="mt-1.5 text-[12px] text-(--ink-3)">
                  Pilih sesi lain, atau tekan Render ulang.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bar melayang: sesi & aksi ─── */}
      <div className="absolute inset-x-0 top-0 z-20 p-3 md:p-4">
        <div className={cn(KACA, "flex flex-wrap items-center gap-x-2 gap-y-2 px-2.5 py-2")}>
          <button
            type="button"
            onClick={() => setPanelTampil((v) => !v)}
            aria-label={panelTampil ? "Sembunyikan panel parameter" : "Tampilkan panel parameter"}
            title={panelTampil ? "Sembunyikan panel parameter" : "Tampilkan panel parameter"}
            className={cn(TOMBOL, "w-9 px-0 text-(--ink-2) hover:bg-(--paper) hover:text-(--ink)")}
          >
            {panelTampil ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>

          <span aria-hidden="true" className="h-6 w-px bg-(--line)" />

          <div
            role="tablist"
            aria-label="Saring berdasarkan site"
            className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {[{ slug: "", nama: "Semua site" }, ...sites].map((s) => {
              const aktif = s.slug === siteFilter;
              return (
                <button
                  key={s.slug || "semua"}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => setSiteFilter(s.slug)}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                    aktif
                      ? "bg-(--navy) text-white"
                      : "text-(--ink-2) hover:bg-(--paper) hover:text-(--ink)"
                  )}
                >
                  {s.slug && (
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: siteBadge(s.slug).color }}
                    />
                  )}
                  {s.nama}
                </button>
              );
            })}
          </div>

          <span aria-hidden="true" className="h-6 w-px bg-(--line)" />

          <div className="relative min-w-0 flex-1 sm:max-w-[288px]">
            <label htmlFor="pilih-sesi" className="sr-only">
              Sesi running
            </label>
            <select
              id="pilih-sesi"
              value={selectedLogId}
              onChange={(e) => setSelectedLogId(e.target.value)}
              disabled={logsLoading || logs.length === 0}
              className="h-9 w-full cursor-pointer appearance-none rounded-[9px] bg-(--paper) pr-8 pl-3 font-mono text-[12.5px] tabular-nums text-(--ink) ring-1 ring-(--line) outline-none transition-colors focus:ring-2 focus:ring-(--navy)/40 disabled:cursor-not-allowed disabled:text-(--ink-3)"
            >
              {logsLoading && <option value="">Memuat sesi…</option>}
              {!logsLoading && logs.length === 0 && <option value="">Tidak ada sesi</option>}
              {logs.map((log) => (
                <option key={log.id_log} value={log.id_log}>
                  {fmtDate(log.datetime, { detik: true })} · {siteBadge(log.site).label}
                  {Number(log.r0) === 1 ? " · R0" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-(--ink-3)" />
          </div>

          <button
            type="button"
            onClick={handleLoad}
            disabled={loading || !plotlyReady || !selectedLogId}
            className={cn(TOMBOL, "bg-(--navy) text-white hover:bg-(--navy-deep)")}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            {sudahRender ? "Render ulang" : "Render"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={cn(
              TOMBOL,
              "ml-auto text-(--ink-2) hover:bg-(--paper) hover:text-(--ink)"
            )}
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            {isFullscreen ? "Keluar" : "Layar penuh"}
          </button>
        </div>
      </div>

      {/* ─── Inspektor melayang: parameter & ringkasan ─── */}
      {panelTampil && (
        <div
          className={cn(
            KACA,
            "absolute top-[84px] left-3 z-20 w-[244px] overflow-hidden md:left-4"
          )}
        >
          <div className="border-b border-(--line) px-4 py-3">
            <Eyebrow className="flex items-center gap-1.5">
              <Crosshair className="size-3.5" /> Acuan RTS
            </Eyebrow>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["Easting", rtsE, setRtsE],
                  ["Northing", rtsN, setRtsN],
                  ["Elevasi", rtsZ, setRtsZ],
                ] as const
              ).map(([label, nilai, set]) => (
                <div key={label} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
                  <label
                    htmlFor={`rts-${label}`}
                    className="text-[11.5px] text-(--ink-2)"
                  >
                    {label}
                  </label>
                  <input
                    id={`rts-${label}`}
                    type="number"
                    step="0.001"
                    value={nilai}
                    onChange={(e) => set(e.target.value)}
                    className={INPUT_ANGKA}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-(--ink-3)">
              Terisi otomatis dari data sesi. Satuan meter UTM.
            </p>
          </div>

          <div className="border-b border-(--line) px-4 py-3">
            <Eyebrow className="flex items-center gap-1.5">
              <Sliders className="size-3.5" /> Tampilan
            </Eyebrow>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
                <label htmlFor="cone" className="text-[11.5px] text-(--ink-2)">
                  Panah
                </label>
                <input
                  id="cone"
                  type="number"
                  step="0.1"
                  value={coneScale}
                  onChange={(e) => setConeScale(e.target.value)}
                  className={INPUT_ANGKA}
                />
              </div>
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
                <label htmlFor="ambang" className="text-[11.5px] text-(--ink-2)">
                  Ambang
                </label>
                <input
                  id="ambang"
                  type="number"
                  step="0.0001"
                  value={minLinear}
                  onChange={(e) => setMinLinear(e.target.value)}
                  className={INPUT_ANGKA}
                />
              </div>
            </div>
            {/* Satuan ambang WAJIB disebut: nilai `linear` dari server dalam
                METER, sedangkan seluruh halaman lain di aplikasi ini memakai
                milimeter. Mengetik "1" di sini menyembunyikan semua pergeseran
                di bawah satu meter — praktis seluruhnya. */}
            <p className="mt-2 text-[11px] leading-relaxed text-(--ink-3)">
              Panah = pengali panjang kerucut. Ambang dalam <strong>meter</strong>; pergeseran
              di bawahnya tidak digambar.
            </p>
          </div>

          <dl className="px-4 py-3">
            <Eyebrow>Hasil render</Eyebrow>
            <div className="mt-2 space-y-1.5">
              {(
                [
                  ["Waktu data", ringkas?.tanggal ? fmtDate(ringkas.tanggal) : "—"],
                  ["Prisma terbaca", ringkas ? String(ringkas.prisma) : "—"],
                  [
                    "Tembakan sah",
                    ringkas ? `${ringkas.valid} / ${ringkas.prisma}` : "—",
                  ],
                  ["Gagal", ringkas ? String(ringkas.gagal) : "—"],
                ] as const
              ).map(([label, nilai]) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11.5px] text-(--ink-2)">{label}</dt>
                  <dd className="font-mono text-[12px] tabular-nums text-(--ink)">{nilai}</dd>
                </div>
              ))}
            </div>
            {sesiAktif && (
              <p className="mt-2.5 border-t border-(--line) pt-2 text-[11px] text-(--ink-3)">
                Sesi <span className="font-mono">{sesiAktif.id_log}</span>
                {Number(sesiAktif.r0) === 1 && " · ini sesi acuan R0"}
              </p>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
