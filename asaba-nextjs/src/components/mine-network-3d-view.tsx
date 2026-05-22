"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Battery,
  Box,
  Eye,
  Layers,
  Loader2,
  Map,
  RadioTower,
  Signal,
  Thermometer,
  TriangleAlert,
} from "lucide-react";

import {
  formatMineSensorValue,
  getMineSensorGeoPoints,
  getMineSensorStatusSummary,
  mineNetworkSensors,
  mineSensorTypeLabels,
  type MineSensorStatus,
} from "@/lib/mine-network";
import { cn } from "@/lib/utils";

const MineNetwork3DDeck = dynamic(
  () => import("@/components/mine-network-3d-deck").then((m) => ({ default: m.MineNetwork3DDeck })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm font-semibold">Memuat Deck.gl viewer...</p>
      </div>
    ),
  }
);

const statusStyles = {
  normal: { label: "Normal", dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
  caution: { label: "Waspada", dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
  danger: { label: "Bahaya", dot: "bg-red-500", text: "text-red-700", border: "border-red-200", bg: "bg-red-50" },
} satisfies Record<MineSensorStatus, { label: string; dot: string; text: string; border: string; bg: string }>;

function StatusPill({ status }: { status: MineSensorStatus }) {
  const style = statusStyles[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold", style.bg, style.border, style.text)}>
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

export function MineNetwork3DView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [topView, setTopView] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const geoPoints = useMemo(() => getMineSensorGeoPoints(mineNetworkSensors), []);
  const statusSummary = getMineSensorStatusSummary(mineNetworkSensors);

  const selectedSensor = selectedId ? mineNetworkSensors.find((sensor) => sensor.id === selectedId) ?? null : null;
  const selectedGeo = selectedId ? geoPoints.find((point) => point.id === selectedId) : null;

  const prioritySensors = mineNetworkSensors
    .filter((sensor) => sensor.status !== "normal")
    .sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1));

  return (
    <section className="relative h-[calc(100vh-5rem)] min-h-[720px] overflow-hidden rounded-lg border bg-slate-950">
      <MineNetwork3DDeck selectedId={selectedId} onSelect={setSelectedId} showHeatmap={showHeatmap} topView={topView} />

      <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-lg border border-white/15 bg-black/65 px-3 py-2 shadow backdrop-blur">
          <p className="text-xs font-bold text-white">{topView ? "Tampilan Dari Atas" : "3D Perspektif"} - Deck.gl</p>
          <p className="mt-0.5 text-[11px] text-white/60">
            {topView ? "Scroll zoom - klik marker" : "Drag orbit - scroll zoom - klik marker"}
          </p>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center xl:flex">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/15 bg-black/65 p-2 shadow backdrop-blur">
            <div className="flex min-w-30 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2">
              <RadioTower className="h-4 w-4 text-sky-200" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-white/50">Total</p>
                <p className="text-sm font-bold text-white">{statusSummary.total} Sensor</p>
              </div>
            </div>
            <div className="flex min-w-24 items-center gap-2 rounded-md border border-red-300/30 bg-red-500/15 px-3 py-2">
              <TriangleAlert className="h-4 w-4 text-red-200" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-red-100">Bahaya</p>
                <p className="text-sm font-bold text-red-100">{statusSummary.danger}</p>
              </div>
            </div>
            <div className="flex min-w-24 items-center gap-2 rounded-md border border-amber-300/30 bg-amber-500/15 px-3 py-2">
              <Thermometer className="h-4 w-4 text-amber-200" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-amber-100">Waspada</p>
                <p className="text-sm font-bold text-amber-100">{statusSummary.caution}</p>
              </div>
            </div>
            <div className="flex min-w-24 items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-500/15 px-3 py-2">
              <Signal className="h-4 w-4 text-emerald-200" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-emerald-100">Normal</p>
                <p className="text-sm font-bold text-emerald-100">{statusSummary.normal}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => setLayersOpen((open) => !open)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-black/65 px-3 text-sm font-semibold text-white shadow backdrop-blur transition hover:bg-white/10"
          >
            <Layers className="h-4 w-4" />
            Layer
          </button>
          <button
            type="button"
            onClick={() => setPriorityOpen((open) => !open)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-black/65 px-3 text-sm font-semibold text-white shadow backdrop-blur transition hover:bg-white/10"
          >
            <TriangleAlert className="h-4 w-4" />
            Prioritas
          </button>
          <Link
            href="/peta-jaringan-tambang"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-white/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Peta 2D
          </Link>
        </div>
      </div>

      <div className="absolute right-4 top-20 z-30 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setTopView((value) => !value)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow backdrop-blur transition",
            topView
              ? "border-sky-300/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
              : "border-white/20 bg-black/60 text-white/70 hover:bg-white/10"
          )}
        >
          {topView ? <Box className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {topView ? "Tampilan 3D" : "Dari Atas"}
        </button>
        <button
          type="button"
          onClick={() => setShowHeatmap((value) => !value)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow backdrop-blur transition",
            showHeatmap
              ? "border-amber-300/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              : "border-white/20 bg-black/60 text-white/70 hover:bg-white/10"
          )}
        >
          <Thermometer className="h-3.5 w-3.5" />
          Heatmap
        </button>
      </div>

      {layersOpen && (
        <div className="absolute left-4 top-24 z-30 w-[280px] rounded-lg border border-white/15 bg-black/70 p-4 text-white shadow backdrop-blur">
          <h3 className="text-sm font-bold">Layer Aktif</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/65">
                <Map className="h-4 w-4" />
                Basemap
              </span>
              <span className="font-bold">ESRI Satellite</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/65">
                <Thermometer className="h-4 w-4" />
                Heatmap
              </span>
              <span className={cn("font-bold", showHeatmap ? "text-amber-200" : "text-white/50")}>
                {showHeatmap ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/65">
                <Layers className="h-4 w-4" />
                Sensor overlay
              </span>
              <span className="font-bold">{statusSummary.total} titik</span>
            </div>
          </div>
        </div>
      )}

      {priorityOpen && (
        <div className="absolute left-4 top-24 z-30 max-h-[calc(100%-7rem)] w-[300px] overflow-auto rounded-lg border border-white/15 bg-black/70 p-4 text-white shadow backdrop-blur">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-red-300" />
            <h3 className="text-sm font-bold">Prioritas Inspeksi</h3>
          </div>
          <div className="mt-3 space-y-2">
            {prioritySensors.slice(0, 6).map((sensor) => (
              <button
                key={sensor.id}
                type="button"
                onClick={() => setSelectedId(sensor.id)}
                className={cn(
                  "w-full rounded-md border border-white/15 bg-white/10 p-3 text-left transition hover:bg-white/15",
                  sensor.id === selectedId && "border-sky-300/40 bg-sky-500/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold">{sensor.id}</p>
                    <p className="mt-1 text-xs text-white/55">{sensor.criticalPoint}</p>
                  </div>
                  <StatusPill status={sensor.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white/70">{mineSensorTypeLabels[sensor.type]}</span>
                  <span className="font-bold">{formatMineSensorValue(sensor)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-wrap gap-2 rounded-lg border border-white/15 bg-black/60 p-3 shadow backdrop-blur">
        {(["normal", "caution", "danger"] as MineSensorStatus[]).map((status) => (
          <StatusPill key={status} status={status} />
        ))}
      </div>

      {selectedSensor && selectedGeo && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 w-[280px] rounded-lg border border-white/15 bg-black/70 p-4 shadow backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{selectedSensor.id}</p>
          <p className="mt-0.5 text-base font-bold leading-tight text-white">{selectedSensor.name}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-semibold uppercase text-white/45">Nilai</p>
              <p className="mt-1 text-sm font-bold text-white">{formatMineSensorValue(selectedSensor)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-semibold uppercase text-white/45">Status</p>
              <div className="mt-1">
                <StatusPill status={selectedSensor.status} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/50">
            {selectedGeo.latitude.toFixed(5)}, {selectedGeo.longitude.toFixed(5)}
          </p>
          <div className="mt-3 space-y-2 text-xs text-white/65">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Battery className="h-3.5 w-3.5" />
                Battery rata-rata
              </span>
              <span className="font-bold text-white">84%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" />
                Signal rata-rata
              </span>
              <span className="font-bold text-white">85%</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
