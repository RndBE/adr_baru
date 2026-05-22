"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Battery,
  Box,
  CloudRain,
  Crosshair,
  Gauge,
  Layers3,
  MapPin,
  RadioTower,
  Ruler,
  Search,
  Signal,
  SlidersHorizontal,
  TriangleAlert,
  Waves,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatMineSensorValue,
  getMineSensorPrioritySummary,
  getMineSensorStatusSummary,
  getMineSensorTypeSummary,
  mineNetworkSensors,
  mineSensorTypeLabels,
  type MineNetworkSensor,
  type MineSensorStatus,
  type MineSensorType,
} from "@/lib/mine-network";
import { cn } from "@/lib/utils";

const sensorTypes: MineSensorType[] = [
  "tiltmeter",
  "crack-meter",
  "piezometer",
  "rain-gauge",
  "vibration",
  "gnss",
];

const sensorTypeIcons = {
  tiltmeter: Gauge,
  "crack-meter": Ruler,
  piezometer: Waves,
  "rain-gauge": CloudRain,
  vibration: Activity,
  gnss: Crosshair,
} satisfies Record<MineSensorType, React.ElementType>;

const sensorTypeColors = {
  tiltmeter: { stroke: "#2f6fed", soft: "#e8f0ff" },
  "crack-meter": { stroke: "#c05621", soft: "#fff3e8" },
  piezometer: { stroke: "#0891b2", soft: "#e6f8fc" },
  "rain-gauge": { stroke: "#2563eb", soft: "#eaf2ff" },
  vibration: { stroke: "#7c3aed", soft: "#f2ecff" },
  gnss: { stroke: "#15803d", soft: "#eaf8ee" },
} satisfies Record<MineSensorType, { stroke: string; soft: string }>;

const statusStyles = {
  normal: {
    label: "Normal",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    ring: "ring-emerald-400",
  },
  caution: {
    label: "Waspada",
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    ring: "ring-amber-400",
  },
  danger: {
    label: "Bahaya",
    dot: "bg-red-500",
    text: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
    ring: "ring-red-500",
  },
} satisfies Record<
  MineSensorStatus,
  { label: string; dot: string; text: string; border: string; bg: string; ring: string }
>;

const networkLines = [
  ["TLT-01", "VIB-01"],
  ["VIB-01", "CRK-01"],
  ["CRK-01", "PZO-01"],
  ["PZO-01", "VIB-03"],
  ["VIB-03", "TLT-03"],
  ["TLT-03", "GNS-02"],
  ["PZO-01", "GNS-03"],
  ["GNS-03", "CRK-02"],
  ["CRK-02", "RNG-02"],
  ["GNS-03", "GNS-01"],
  ["GNS-01", "TLT-02"],
  ["TLT-02", "PZO-02"],
  ["PZO-02", "VIB-02"],
  ["VIB-02", "RNG-03"],
  ["TLT-02", "RNG-01"],
] as const;

function getSensorById(id: string) {
  return mineNetworkSensors.find((sensor) => sensor.id === id);
}

function StatusPill({ status }: { status: MineSensorStatus }) {
  const style = statusStyles[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold", style.bg, style.border, style.text)}>
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

function SensorMarker({
  sensor,
  selected,
  onSelect,
}: {
  sensor: MineNetworkSensor;
  selected: boolean;
  onSelect: (sensor: MineNetworkSensor) => void;
}) {
  const Icon = sensorTypeIcons[sensor.type];
  const typeColor = sensorTypeColors[sensor.type];
  const status = statusStyles[sensor.status];

  return (
    <button
      type="button"
      title={`${sensor.id} - ${sensor.name}`}
      onClick={() => onSelect(sensor)}
      className={cn(
        "absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4",
        selected ? "scale-110 ring-4" : "",
        status.ring
      )}
      style={{
        left: `${sensor.x}%`,
        top: `${sensor.y}%`,
        borderColor: typeColor.stroke,
      }}
    >
      <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white", status.dot)} />
      <Icon className="h-4 w-4" style={{ color: typeColor.stroke }} />
    </button>
  );
}

export function MineNetworkMap() {
  const [selectedType, setSelectedType] = useState<MineSensorType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const statusSummary = getMineSensorStatusSummary(mineNetworkSensors);
  const typeSummary = getMineSensorTypeSummary(mineNetworkSensors);
  const prioritySummary = getMineSensorPrioritySummary(mineNetworkSensors);

  const filteredSensors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mineNetworkSensors.filter((sensor) => {
      const matchesType = selectedType === "all" || sensor.type === selectedType;
      const matchesQuery =
        !normalizedQuery ||
        sensor.name.toLowerCase().includes(normalizedQuery) ||
        sensor.id.toLowerCase().includes(normalizedQuery) ||
        sensor.zone.toLowerCase().includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [query, selectedType]);

  const selectedSensor =
    filteredSensors.find((sensor) => sensor.id === selectedId) ??
    mineNetworkSensors.find((sensor) => sensor.id === selectedId) ??
    mineNetworkSensors[0];

  const highPrioritySensors = mineNetworkSensors
    .filter((sensor) => sensor.status !== "normal")
    .sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1));

  return (
    <section className="relative h-[calc(100vh-5rem)] min-h-180 overflow-hidden rounded-lg border bg-[#e8eef0]">
          <div className="absolute inset-0">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <pattern id="mine-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#cbd5e1" strokeWidth="0.18" opacity="0.5" />
                </pattern>
                <linearGradient id="pit-floor" x1="35" y1="28" x2="70" y2="72" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#d7e0e8" />
                  <stop offset="1" stopColor="#b8c6d1" />
                </linearGradient>
                <linearGradient id="waste-fill" x1="0" y1="68" x2="32" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#dbe7dd" />
                  <stop offset="1" stopColor="#c6d7cb" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" fill="#e8eef0" />
              <rect width="100" height="100" fill="url(#mine-grid)" />

              <path d="M0 66 L13 50 L27 48 L37 62 L33 78 L17 91 L0 100 Z" fill="url(#waste-fill)" />
              <path d="M73 0 L100 0 L100 42 L90 47 L81 38 L76 20 Z" fill="#d9e8dc" />
              <path d="M3 92 L16 84 L28 79 L40 78 L52 86" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="1 1.4" />
              <path d="M20 76 L34 70 L45 72 L57 82" fill="none" stroke="#64748b" strokeWidth="0.9" strokeDasharray="1 1.2" opacity="0.75" />

              <path d="M14 31 L31 18 L55 13 L77 18 L90 31 L88 49 L74 64 L50 70 L28 64 L13 50 Z" fill="#f8fafc" stroke="#b8c4cf" strokeWidth="0.9" />
              <path d="M22 36 L37 27 L57 23 L73 28 L81 39 L77 52 L64 61 L45 64 L30 58 L21 48 Z" fill="#e7edf3" stroke="#aebdcc" strokeWidth="0.75" />
              <path d="M31 42 L44 35 L59 33 L70 39 L72 49 L63 56 L48 59 L36 54 L30 48 Z" fill="#d6e0ea" stroke="#9cadbd" strokeWidth="0.7" />
              <path d="M41 46 L51 41 L61 43 L65 49 L59 54 L49 55 L42 52 Z" fill="url(#pit-floor)" stroke="#8294a8" strokeWidth="0.65" />

              <path d="M4 88 C17 78 30 70 43 61 C57 51 68 40 82 28 C88 23 92 18 97 13" fill="none" stroke="#94a3b8" strokeWidth="2.1" strokeLinecap="round" />
              <path d="M5 86 C18 77 31 69 44 59 C58 49 69 38 83 27 C89 22 93 17 98 12" fill="none" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" strokeDasharray="2.3 2.3" />
              <path d="M69 88 C66 77 68 66 76 58 C84 50 94 47 99 34" fill="none" stroke="#0ea5e9" strokeWidth="1.25" strokeLinecap="round" />
              <path d="M73 88 C70 77 72 68 80 61 C88 54 96 50 100 41" fill="none" stroke="#38bdf8" strokeWidth="0.38" strokeLinecap="round" opacity="0.7" />
              <path d="M63 56 C66 57 70 59 74 62 C76 64 78 67 80 70" fill="none" stroke="#0ea5e9" strokeWidth="0.45" strokeDasharray="0.8 1" opacity="0.85" />
              <path d="M18 74 L20 72 L22 74 L20 76 Z M23 71 L25 69 L27 71 L25 73 Z M27 76 L29 74 L31 76 L29 78 Z" fill="#9fb5a6" opacity="0.75" />
              <path d="M81 36 L86 32 L91 31 L94 33 L92 37 L86 39 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.35" />
            </svg>
          </div>

          <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-lg border bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold text-[#303481]">
                <MapPin className="h-4 w-4" />
                Open Pit Geoteknik
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Dummy network, 18 titik kritis</p>
            </div>

            <div className="pointer-events-auto flex gap-2">
              <Button
                variant={filterOpen ? "default" : "outline"}
                size="lg"
                onClick={() => setFilterOpen((open) => !open)}
                className="h-10 bg-white/95 shadow-sm backdrop-blur"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
              </Button>
              <Button
                variant={legendOpen ? "default" : "outline"}
                size="lg"
                onClick={() => setLegendOpen((open) => !open)}
                className="h-10 bg-white/95 shadow-sm backdrop-blur"
              >
                <Layers3 className="h-4 w-4" />
                Legenda
              </Button>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center xl:flex">
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-white/95 p-2 shadow-sm backdrop-blur">
                <div className="flex min-w-30 items-center gap-2 rounded-md border bg-white px-3 py-2">
                  <RadioTower className="h-4 w-4 text-[#303481]" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total</p>
                    <p className="text-sm font-bold">{statusSummary.total} Sensor</p>
                  </div>
                </div>
                <div className="flex min-w-24 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <TriangleAlert className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-red-700">Bahaya</p>
                    <p className="text-sm font-bold text-red-700">{statusSummary.danger}</p>
                  </div>
                </div>
                <div className="flex min-w-24 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <Activity className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-amber-700">Waspada</p>
                    <p className="text-sm font-bold text-amber-700">{statusSummary.caution}</p>
                  </div>
                </div>
                <div className="flex min-w-24 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <Signal className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Normal</p>
                    <p className="text-sm font-bold text-emerald-700">{statusSummary.normal}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen(true);
                    const firstDanger = prioritySummary.topDangerIds[0];
                    if (firstDanger) setSelectedId(firstDanger);
                  }}
                  className="flex min-w-[210px] items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-left transition hover:bg-red-50"
                >
                  <TriangleAlert className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Prioritas</p>
                    <p className="text-xs font-bold">
                      {prioritySummary.dangerCount} bahaya: {prioritySummary.topDangerIds.join(", ")}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <Link
              href="/peta-jaringan-tambang/3d"
              className="pointer-events-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#303481] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#303481]/90"
            >
              <Box className="h-4 w-4" />
              Tampilan Peta 3D
            </Link>
          </div>

          {legendOpen && (
            <div className="absolute left-4 top-20 z-40 w-[280px] rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">Legenda</h3>
                <button
                  type="button"
                  onClick={() => setLegendOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["normal", "caution", "danger"] as MineSensorStatus[]).map((status) => (
                  <StatusPill key={status} status={status} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {sensorTypes.map((type) => {
                  const Icon = sensorTypeIcons[type];
                  const colors = sensorTypeColors[type];
                  return (
                    <Badge
                      key={type}
                      variant="outline"
                      className="h-7 gap-1.5 rounded-md px-2"
                      style={{ backgroundColor: colors.soft, borderColor: colors.stroke, color: colors.stroke }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mineSensorTypeLabels[type]}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {networkLines.map(([fromId, toId]) => {
              const from = getSensorById(fromId);
              const to = getSensorById(toId);
              if (!from || !to) return null;
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#475569"
                  strokeOpacity="0.34"
                  strokeWidth="0.45"
                  strokeDasharray="1.5 1.2"
                />
              );
            })}
          </svg>

          {filteredSensors.map((sensor) => (
            <SensorMarker
              key={sensor.id}
              sensor={sensor}
              selected={sensor.id === selectedSensor?.id}
              onSelect={(nextSensor) => setSelectedId(nextSensor.id)}
            />
          ))}

          {filterOpen && (
          <div className="absolute left-4 top-24 z-30 max-h-[calc(100%-7rem)] w-[276px] space-y-3 overflow-auto pr-1">
            <section className="rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#303481]" />
                  <h3 className="text-sm font-bold">Filter Sensor</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-3 flex h-9 items-center gap-2 rounded-md border bg-background/80 px-3 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari ID, zona, sensor"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </label>

              <div className="mt-3 grid max-h-[210px] gap-2 overflow-auto pr-1">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSelectedType("all")}
                >
                  <Layers3 className="h-4 w-4" />
                  Semua Sensor
                  <span className="ml-auto text-xs">{statusSummary.total}</span>
                </Button>
                {sensorTypes.map((type) => {
                  const Icon = sensorTypeIcons[type];
                  const colors = sensorTypeColors[type];
                  return (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setSelectedType(type)}
                    >
                      <Icon className="h-4 w-4" style={{ color: selectedType === type ? "currentColor" : colors.stroke }} />
                      {mineSensorTypeLabels[type]}
                      <span className="ml-auto text-xs">{typeSummary[type]}</span>
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur">
              <h3 className="text-sm font-bold">Prioritas Inspeksi</h3>
              <div className="mt-2 max-h-[170px] space-y-2 overflow-auto pr-1">
                {highPrioritySensors.slice(0, 5).map((sensor) => (
                  <button
                    key={sensor.id}
                    type="button"
                    onClick={() => setSelectedId(sensor.id)}
                    className="w-full rounded-md border bg-white/80 p-2 text-left transition hover:bg-muted/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{sensor.id}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{sensor.criticalPoint}</p>
                      </div>
                      <StatusPill status={sensor.status} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
          )}

          {selectedSensor && (
          <div className="absolute right-4 top-24 z-30 max-h-[calc(100%-7rem)] w-[320px] space-y-3 overflow-auto pr-1">
          <section className="rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedSensor.id}</p>
                <h3 className="mt-1 text-lg font-bold leading-tight">{selectedSensor.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={selectedSensor.status} />
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nilai</p>
                <p className="mt-1 text-lg font-bold">{formatMineSensorValue(selectedSensor)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trend</p>
                <p className="mt-1 text-lg font-bold capitalize">{selectedSensor.trend}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tipe</dt>
                <dd className="font-semibold">{mineSensorTypeLabels[selectedSensor.type]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Zona</dt>
                <dd className="font-semibold">{selectedSensor.zone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Titik kritis</dt>
                <dd className="font-semibold">{selectedSensor.criticalPoint}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Ambang</dt>
                <dd className="font-semibold">{selectedSensor.threshold}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Update</dt>
                <dd className="font-semibold">{selectedSensor.lastUpdate}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {selectedSensor.note}
            </div>
          </section>

          <section className="rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur">
            <h3 className="text-sm font-bold">Kesehatan Perangkat</h3>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <Battery className="h-3.5 w-3.5" />
                    Battery
                  </span>
                  <span className="font-bold">{selectedSensor.battery}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${selectedSensor.battery}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <Signal className="h-3.5 w-3.5" />
                    Signal
                  </span>
                  <span className="font-bold">{selectedSensor.signal}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-[#303481]" style={{ width: `${selectedSensor.signal}%` }} />
                </div>
              </div>
            </div>
          </section>

          </div>
          )}
    </section>
  );
}
