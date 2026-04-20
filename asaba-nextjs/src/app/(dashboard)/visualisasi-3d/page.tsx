"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { History, Target, Sliders, Crosshair, Play, ChevronDown, Loader2, Maximize, Database } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Plotly loaded via CDN (same as legacy) ──────────────────────────────────
declare global {
  interface Window { Plotly: any }
}

// ─── Cache key ───────────────────────────────────────────────────────────────
const CACHE_KEY = "vis3d_cache_v1";

interface CachePayload {
  id_log: string;
  rtsE: string;
  rtsN: string;
  rtsZ: string;
  coneScale: string;
  minLinear: string;
  points: any[];
  meta: any;
  logLines: string[];
}

function saveCache(data: CachePayload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Helpers (ported 1:1 from deformasi.php) ────────────────────────────────
function toNum(v: any): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const n = Number(s.replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function isZeroish(a: number) {
  return Number.isFinite(a) && Math.abs(a) < 1e-12;
}

function isTripletAllZero(a: number, b: number, c: number) {
  return isZeroish(a) && isZeroish(b) && isZeroish(c);
}

function getRTSFromPayload(p: any) {
  const r = p?.posisi_rts ?? null;
  if (!r) return null;
  const E = toNum(r.E);
  const N = toNum(r.N);
  const Z = Number.isFinite(toNum(r.Z)) ? toNum(r.Z) : 0;
  if (Number.isFinite(E) && Number.isFinite(N)) return { e: E, n: N, z: Z };
  const n = toNum(r.x), e = toNum(r.y);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
  return { e, n, z: 0 };
}

function extractPoints(p: any) {
  const arr = p?.data_pengukuran ?? [];
  const out: any[] = [];
  for (const row of arr) {
    const t = row?.temp_tembak ?? row;
    if (!t) continue;
    const id = String(row.id_prisma ?? row.nama_prisma ?? "");
    const name = String(row.nama_prisma ?? t.nama_prisma ?? "");

    const e0 = toNum(t.E0), n0 = toNum(t.N0), z0 = toNum(t.Z0);
    if (![e0, n0, z0].every(Number.isFinite)) continue;

    let e1 = toNum(t.E1), n1 = toNum(t.N1), z1 = toNum(t.Z1);
    const has1 = [e1, n1, z1].every(Number.isFinite) && !isTripletAllZero(e1, n1, z1);

    let de = toNum(t.DE), dn = toNum(t.DN), dz = toNum(t.DZ);
    if (has1) {
      if (!Number.isFinite(de)) de = e1 - e0;
      if (!Number.isFinite(dn)) dn = n1 - n0;
      if (!Number.isFinite(dz)) dz = z1 - z0;
    } else {
      e1 = NaN; n1 = NaN; z1 = NaN;
      de = NaN; dn = NaN; dz = NaN;
    }

    let lin = toNum(t.linear);
    if (has1 && !Number.isFinite(lin)) lin = Math.sqrt(de * de + dn * dn + dz * dz);
    else if (!has1) lin = NaN;

    const dirText = t.arah_pergeseran ? String(t.arah_pergeseran) : "";
    out.push({ id, name, e0, n0, z0, e1, n1, z1, de, dn, dz, lin, dirText, ok: has1 });
  }
  return out;
}

function finiteArr(a: number[]) { return a.filter(Number.isFinite); }

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Visualisasi3DPage() {
  // Form state
  const [rtsE, setRtsE] = useState("");
  const [rtsN, setRtsN] = useState("");
  const [rtsZ, setRtsZ] = useState("");
  const [coneScale, setConeScale] = useState("0.2");
  const [minLinear, setMinLinear] = useState("0");

  // Log list
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState("");

  // Render state
  const [loading, setLoading] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const fsTargetRef = useRef<HTMLDivElement>(null);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cache state: menyimpan data yang sudah di-fetch agar bisa re-render tanpa fetch ulang
  const cachedPointsRef = useRef<any[] | null>(null);
  const cachedMetaRef = useRef<any | null>(null);
  const [restoredFromCache, setRestoredFromCache] = useState(false);

  // Load Plotly (Local)
  useEffect(() => {
    if (window.Plotly) { setPlotlyReady(true); return; }
    const s = document.createElement("script");
    s.src = "/plotly-2.33.0.min.js";
    s.onload = () => setPlotlyReady(true);
    document.head.appendChild(s);
  }, []);

  // Fetch log list — setelah dapat, cek cache
  useEffect(() => {
    fetch("/api/log-kontrol?limit=200&with_prisma=false")
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setLogs(json.data);
          if (json.data.length > 0) {
            const cache = loadCache();
            // Cek apakah cache ada dan log-nya masih valid
            const cachedLog = cache && json.data.find((l: any) => String(l.id_log) === String(cache.id_log));
            if (cache && cachedLog) {
              // Restore form state dari cache
              setSelectedLogId(cache.id_log);
              setRtsE(cache.rtsE);
              setRtsN(cache.rtsN);
              setRtsZ(cache.rtsZ);
              setConeScale(cache.coneScale);
              setMinLinear(cache.minLinear);
              setLogLines(cache.logLines);
              // Simpan points & meta ke ref untuk di-render setelah Plotly siap
              cachedPointsRef.current = cache.points;
              cachedMetaRef.current = cache.meta;
              setRestoredFromCache(true);
            } else {
              // Tidak ada cache valid → pakai log pertama seperti biasa
              setSelectedLogId(json.data[0].id_log);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (window.Plotly && plotRef.current) window.Plotly.Plots.resize(plotRef.current);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function addLog(msg: string) {
    setLogLines(prev => [...prev, msg]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  const render = useCallback((points: any[], meta: any, overrideE?: string, overrideN?: string, overrideZ?: string, overrideScale?: string, overrideLin?: string) => {
    if (!window.Plotly || !plotRef.current) return;

    const E = Number(overrideE ?? rtsE);
    const N = Number(overrideN ?? rtsN);
    const Z = Number(overrideZ ?? rtsZ);
    const scale = parseFloat((overrideScale ?? coneScale).replace(",", ".")) || 0.2;
    const minLin = parseFloat((overrideLin ?? minLinear).replace(",", ".")) || 0;

    const baseline = points;
    const moved = points.filter((p: any) => p.ok && Number.isFinite(p.lin) && p.lin >= minLin);

    const x0 = baseline.map((p: any) => p.e0);
    const y0 = baseline.map((p: any) => p.n0);
    const z0 = baseline.map((p: any) => p.z0);

    const x1 = moved.map((p: any) => p.e1);
    const y1 = moved.map((p: any) => p.n1);
    const z1 = moved.map((p: any) => p.z1);

    const u = moved.map((p: any) => p.de);
    const v = moved.map((p: any) => p.dn);
    const w = moved.map((p: any) => p.dz);
    const lin = moved.map((p: any) => p.lin);
    const maxLin = Math.max(...finiteArr(lin), 0);

    const lineX: (number|null)[] = [], lineY: (number|null)[] = [], lineZ: (number|null)[] = [];
    for (const p of moved) { lineX.push(p.e0, p.e1, null); lineY.push(p.n0, p.n1, null); lineZ.push(p.z0, p.z1, null); }

    const hover0 = baseline.map((p: any) =>
      `${p.name}<br>E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>${p.ok ? "Status=OK" : "Status=GAGAL"}`
    );
    const hover1 = moved.map((p: any) =>
      `${p.name}<br>` +
      `E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>` +
      `E1=${p.e1.toFixed(4)} N1=${p.n1.toFixed(4)} Z1=${p.z1.toFixed(4)}<br>` +
      `DE=${p.de.toFixed(6)} DN=${p.dn.toFixed(6)} DZ=${p.dz.toFixed(6)}<br>` +
      `Linear=${p.lin.toFixed(6)}${p.dirText ? `<br>Arah=${p.dirText}` : ""}`
    );

    const traceBaseline = {
      type: "scatter3d", mode: "markers", name: "Baseline",
      x: x0, y: y0, z: z0,
      marker: { size: 4, color: "rgba(15,23,42,.55)" },
      text: hover0, hoverinfo: "text",
    };

    const traces: any[] = [traceBaseline];

    if (moved.length > 0) {
      traces.push(
        { type: "scatter3d", mode: "lines", name: "Displacement",
          x: lineX, y: lineY, z: lineZ,
          line: { width: 3 }, opacity: 0.75, hoverinfo: "skip" },
        { type: "scatter3d", mode: "markers", name: "Hasil",
          x: x1, y: y1, z: z1,
          marker: { size: 6, color: lin, colorscale: "Turbo", colorbar: { title: "Linear" } },
          text: hover1, hoverinfo: "text" },
        { type: "cone", name: "Vector",
          x: moved.map((p: any) => p.e0), y: moved.map((p: any) => p.n0), z: moved.map((p: any) => p.z0),
          u, v, w,
          anchor: "tail", sizemode: "absolute",
          sizeref: Math.max(maxLin * scale, 0.01),
          showscale: false, opacity: 0.85, hoverinfo: "skip" }
      );
    }

    traces.push({
      type: "scatter3d", mode: "markers+text", name: "RTS",
      x: [E], y: [N], z: [Z],
      marker: { size: 9, symbol: "diamond", color: "rgba(239,68,68,.95)" },
      text: ["RTS"], textposition: "top center", hoverinfo: "skip",
    });

    const allX = finiteArr(x0.concat(x1)), allY = finiteArr(y0.concat(y1)), allZ = finiteArr(z0.concat(z1));
    const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
    const cy = (Math.min(...allY) + Math.max(...allY)) / 2;
    const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
    const diag = Math.sqrt((Math.max(...allX) - Math.min(...allX)) ** 2 + (Math.max(...allY) - Math.min(...allY)) ** 2 + (Math.max(...allZ) - Math.min(...allZ)) ** 2);
    const L = Math.max(diag * 0.10, 1.0);

    for (const [dx, dy, col] of [[0, L, "#B30000"], [L, 0, "#000"], [0, -L, "#000"], [-L, 0, "#000"]] as [number,number,string][]) {
      traces.push({ type: "scatter3d", mode: "lines", showlegend: false,
        x: [cx, cx + dx], y: [cy, cy + dy], z: [cz, cz],
        line: { width: 5, color: col }, hoverinfo: "skip" });
    }
    traces.push({
      type: "scatter3d", mode: "text", showlegend: false,
      x: [cx + L * 1.12, cx, cx - L * 1.12, cx],
      y: [cy, cy + L * 1.12, cy, cy - L * 1.12],
      z: [cz, cz, cz, cz],
      text: ["E", "N", "W", "S"],
      textfont: { size: 16, color: "#0f172a" }, hoverinfo: "skip",
    });

    const title = meta?.tanggal ? `RTS Deformasi 3D — ${meta.tanggal}` : "RTS Deformasi 3D";

    window.Plotly.newPlot(plotRef.current, traces, {
      title: { text: title, font: { size: 16, color: "#0f172a" } },
      paper_bgcolor: "rgba(255,255,255,1)",
      plot_bgcolor: "rgba(255,255,255,1)",
      scene: {
        xaxis: { title: "Easting (E)", titlefont: { color: "#0f172a" }, tickfont: { color: "#0f172a" } },
        yaxis: { title: "Northing (N/Y)", titlefont: { color: "#0f172a" }, tickfont: { color: "#0f172a" } },
        zaxis: { title: "Elevation (Z)", titlefont: { color: "#0f172a" }, tickfont: { color: "#0f172a" } },
        aspectmode: "data",
        bgcolor: "rgba(255,255,255,1)",
      },
      margin: { l: 0, r: 0, t: 40, b: 0 },
      legend: { orientation: "h", font: { color: "#0f172a" } },
    }, { responsive: true, displayModeBar: false });

    window.Plotly.Plots.resize(plotRef.current);
  }, [rtsE, rtsN, rtsZ, coneScale, minLinear]);

  // ── Restore dari cache setelah Plotly siap ──────────────────────────────────
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (
      plotlyReady &&
      restoredFromCache &&
      cachedPointsRef.current &&
      cachedMetaRef.current &&
      !hasRestoredRef.current
    ) {
      hasRestoredRef.current = true;
      // Re-render plot dari cache — tidak perlu fetch ulang
      render(
        cachedPointsRef.current,
        cachedMetaRef.current,
        rtsE, rtsN, rtsZ, coneScale, minLinear
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotlyReady, restoredFromCache]);

  // ── Auto-load dari server (jika tidak ada cache yang valid) ─────────────────
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (
      plotlyReady &&
      selectedLogId &&
      logs.length > 0 &&
      !restoredFromCache &&
      !hasAutoLoaded.current
    ) {
      hasAutoLoaded.current = true;
      handleLoad();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotlyReady, selectedLogId, logs.length, restoredFromCache]);

  const handleLoad = useCallback(async () => {
    if (!selectedLogId || !plotlyReady) return;
    setLoading(true);
    setLogLines([]);

    try {
      addLog("Loading...");
      const res = await fetch(`/api/deformasi?id_log=${selectedLogId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error || "Gagal memuat");

      // Auto-fill RTS from posisi_rts
      const rts = getRTSFromPayload(payload.data);
      let finalE = rtsE, finalN = rtsN, finalZ = rtsZ;
      if (rts) {
        finalE = String(rts.e);
        finalN = String(rts.n);
        finalZ = Number.isFinite(rts.z) ? String(rts.z) : "0";
        setRtsE(finalE);
        setRtsN(finalN);
        setRtsZ(finalZ);
      }

      const n = payload.data?.data_pengukuran?.length ?? 0;
      addLog("Loaded JSON from server");
      addLog(`tanggal: ${payload.data?.tanggal ?? "-"}`);
      addLog(`rows: ${n}`);

      const pts = extractPoints(payload.data);
      addLog(`parsed prisms: ${pts.length}`);
      addLog(`valid shots: ${pts.filter((x: any) => x.ok).length}`);
      addLog(`failed shots: ${pts.filter((x: any) => !x.ok).length}`);

      if (pts.length === 0) { addLog("Tidak ada prisma yang kebaca untuk id_log ini."); return; }

      // Simpan ke ref dan cache
      cachedPointsRef.current = pts;
      cachedMetaRef.current = payload.data;

      const logSnapshot = [
        "Loaded JSON from server",
        `tanggal: ${payload.data?.tanggal ?? "-"}`,
        `rows: ${n}`,
        `parsed prisms: ${pts.length}`,
        `valid shots: ${pts.filter((x: any) => x.ok).length}`,
        `failed shots: ${pts.filter((x: any) => !x.ok).length}`,
      ];

      saveCache({
        id_log: selectedLogId,
        rtsE: finalE,
        rtsN: finalN,
        rtsZ: finalZ,
        coneScale,
        minLinear,
        points: pts,
        meta: payload.data,
        logLines: logSnapshot,
      });

      render(pts, payload.data, finalE, finalN, finalZ, coneScale, minLinear);
    } catch (e: any) {
      addLog(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [selectedLogId, plotlyReady, rtsE, rtsN, rtsZ, coneScale, minLinear, render]);

  const toggleFullscreen = () => {
    if (!fsTargetRef.current) return;
    if (!document.fullscreenElement) fsTargetRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  function formatLogDate(d: string) {
    const dt = new Date(d);
    return dt.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const isRendered = cachedPointsRef.current !== null && logLines.length > 0;

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ─── LEFT PANEL ─── */}
        <div className="flex flex-col gap-5">
          
          {/* Main Controls Card */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] p-5 flex flex-col gap-6 shadow-sm">
            
            {/* WAKTU PENGUKURAN */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <History className="w-[14px] h-[14px]" strokeWidth={2.5} />
                <span className="text-[11px] font-bold tracking-[0.5px] uppercase">Waktu Pengukuran</span>
              </div>
              <div className="relative">
                {logsLoading ? (
                  <div className="w-full flex items-center justify-between text-[13px] text-gray-400 py-2.5 px-3 bg-white rounded-md border border-gray-200">
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedLogId}
                      onChange={e => setSelectedLogId(e.target.value)}
                      className="w-full appearance-none bg-white border border-gray-200 text-[#0f172a] text-[13px] rounded-md px-3 py-2.5 font-medium outline-none focus:border-[#303481] cursor-pointer pr-8"
                    >
                      {logs.map(log => (
                        <option key={log.id_log} value={log.id_log}>
                          {formatLogDate(log.datetime)} ({log.site === "ccp" ? "CPP3" : "VP"})
                          {log.r0 === 1 ? " [R0]" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </>
                )}
              </div>
            </div>

            {/* REFERENSI RTS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <Crosshair className="w-[14px] h-[14px]" strokeWidth={2.5} />
                <span className="text-[11px] font-bold tracking-[0.5px] uppercase">Referensi RTS</span>
              </div>
              <div className="flex flex-col gap-3">
                {[["Easting (E)", rtsE, setRtsE], ["Northing (N)", rtsN, setRtsN], ["Elevation (Z)", rtsZ, setRtsZ]].map(([label, val, setter]: any) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-black">{label}</label>
                    <Input type="number" step="0.001" value={val} onChange={e => setter(e.target.value)}
                      className="h-[38px] text-[13px] font-medium border-gray-200 focus:border-[#303481]" />
                  </div>
                ))}
              </div>
            </div>

            {/* PENGATURAN VISUALISASI */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <Sliders className="w-[14px] h-[14px]" strokeWidth={2.5} />
                <span className="text-[11px] font-bold tracking-[0.5px] uppercase">Pengaturan Visualisasi</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-black">Cone Scale</label>
                  <Input type="number" step="0.1" value={coneScale} onChange={e => setConeScale(e.target.value)}
                    className="h-[38px] text-[13px] font-medium border-gray-200 focus:border-[#303481]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-black">Threshold Linear</label>
                  <Input type="number" step="0.0001" value={minLinear} onChange={e => setMinLinear(e.target.value)}
                    className="h-[38px] text-[13px] font-medium border-gray-200 focus:border-[#303481]" />
                </div>
              </div>
            </div>

            {/* Load Button */}
            <button
              onClick={handleLoad}
              disabled={loading || !plotlyReady || !selectedLogId}
              className="mt-1 w-full h-[42px] bg-[#303481] hover:bg-[#1f2259] disabled:opacity-60 text-white font-medium tracking-wide text-[13px] rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : <><Play className="w-3.5 h-3.5 fill-white" /> Load &amp; Render 3D</>}
            </button>
            <div ref={logRef} className="hidden" /> {/* Hidden log ref to prevent errors */}
          </div>

          {/* Status Render Card */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-[#EAEAEA] flex items-center gap-2 text-[#303481]">
              <Crosshair className="w-[14px] h-[14px]" strokeWidth={2.5} />
              <span className="text-[11px] font-bold tracking-[0.5px] uppercase">Status Render</span>
            </div>
            
            {(() => {
              const pts = cachedPointsRef.current || [];
              const nPrisma = pts.length;
              const nValid = pts.filter((x: any) => x.ok).length;
              const nGagal = pts.filter((x: any) => !x.ok).length;
              const meta = cachedMetaRef.current;
              
              const isRenderedNow = isRendered && !loading;
              
              return (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#333]">Waktu Data</span>
                    <span className="font-medium text-[#222]">{isRenderedNow && meta?.tanggal ? meta.tanggal : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#333]">Prisma Terbaca</span>
                    <span className="font-medium text-[#222]">{isRenderedNow ? nPrisma : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#333]">Shot Valid</span>
                    <span className="font-medium text-[#222]">
                      {isRenderedNow ? <><span className="text-green-500 font-bold">{nValid}</span> / {nPrisma}</> : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#333]">Shot Gagal</span>
                    <span className="font-medium text-[#222]">{isRenderedNow ? nGagal : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] mt-1 pt-4 border-t border-[#EAEAEA]">
                    <span className="text-[#333]">Status Render</span>
                    {loading ? (
                      <span className="font-semibold text-gray-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menunggu...</span>
                    ) : isRenderedNow ? (
                      <span className="font-semibold text-green-500 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Berhasil</span>
                    ) : (
                      <span className="font-semibold text-gray-400">-</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ─── RIGHT PANEL: 3D Plot ─── */}
        <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm overflow-hidden">
          <div ref={fsTargetRef} className="relative bg-white" style={{ minHeight: 560 }}>
            {/* Fullscreen button */}
            <div className="absolute top-3 left-3 z-10">
              <button
                onClick={toggleFullscreen}
                className="bg-white/90 backdrop-blur-sm border border-gray-200 text-[#0f172a] text-[12px] font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Maximize className="w-3.5 h-3.5" />
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>

            {/* Plot container */}
            <div
              ref={plotRef}
              style={{ width: "100%", height: isFullscreen ? "100vh" : "78vh", minHeight: 520 }}
            >
              {/* Placeholder: sedang loading */}
              {!isRendered && loading && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400" style={{ minHeight: 520 }}>
                  <Loader2 className="w-10 h-10 animate-spin opacity-40" />
                  <p className="font-semibold text-[14px]">Memuat visualisasi 3D...</p>
                </div>
              )}
              {/* Placeholder: Plotly belum siap */}
              {!isRendered && !loading && !plotlyReady && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400" style={{ minHeight: 520 }}>
                  <Loader2 className="w-10 h-10 animate-spin opacity-40" />
                  <p className="font-semibold text-[14px]">Menyiapkan renderer...</p>
                </div>
              )}
              {/* Placeholder: tidak ada data log */}
              {!isRendered && !loading && plotlyReady && logs.length === 0 && !logsLoading && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400" style={{ minHeight: 520 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 opacity-30">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                  <p className="font-semibold text-[14px]">Tidak ada data log tersedia</p>
                </div>
              )}
              {/* Placeholder: menunggu restore cache */}
              {!isRendered && !loading && plotlyReady && logs.length > 0 && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400" style={{ minHeight: 520 }}>
                  <Loader2 className="w-10 h-10 animate-spin opacity-40" />
                  <p className="font-semibold text-[14px]">Mempersiapkan tampilan...</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
