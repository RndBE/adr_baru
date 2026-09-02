"use client";

import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, StatusDot } from "./panel";
import { RtsSprite } from "./rts-sprite";
import { TelemetryMeter } from "./telemetry-meter";
import { DisplacementRose, type RoseVector } from "./displacement-rose";
import { fmt } from "./format";
import type { AmbangSite, StatusLabel } from "./status";

export interface SesiKonsol {
  /** Waktu sesi yang sudah diformat. */
  waktu: string | null;
  /** Data sesi sedang dimuat (nilai lama tetap ditampilkan, diredupkan). */
  loading: boolean;
  /** Belum ada satu pun running untuk site ini. */
  kosong: boolean;
  maksMm: number | null;
  maksNama: string | null;
  status: StatusLabel | null;
  ambangBerikut: { label: StatusLabel; nilai: number } | null;
  terukur: number;
  sesiKey: string;
}

export interface RtsConsoleProps {
  namaPos: string;
  idLogger: string;
  sdOk: boolean;
  loggerTerhubung: boolean;
  rtsTerhubung: boolean;
  rtsRunning: boolean;
  /** Waktu data telemetri terakhir, sudah diformat. */
  waktuData: string;
  tiltX: string;
  tiltY: string;
  telemetri: {
    power: number | null;
    humidity: number | null;
    battery: number | null;
    temp: number | null;
  };
  sesi: SesiKonsol;
  vektor: RoseVector[];
  ambang: AmbangSite | null;
  onKontrol: () => void;
  className?: string;
}

/** Nivo bulat: titik gelembung bergeser sesuai tilt (dibesarkan & dibatasi). */
function LevelBubble({ x, y }: { x: number; y: number }) {
  const k = 6;
  const cx = 14 + Math.max(-8, Math.min(8, (Number.isFinite(x) ? x : 0) * k));
  const cy = 14 - Math.max(-8, Math.min(8, (Number.isFinite(y) ? y : 0) * k));
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--console-ink-3)" strokeWidth="1.2" />
      <circle cx="14" cy="14" r="5" fill="none" stroke="var(--console-ink-3)" strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r="3.2" fill="var(--console-accent)" />
    </svg>
  );
}

/**
 * Panel instrumen: satu bidang gelap untuk semua yang HIDUP — unit RTS,
 * koneksi, telemetri logger — plus putusan sesi terpilih dan mawar arah
 * pergeseran. Data hasil ukur yang lebih rinci ada di kartu kertas di bawahnya.
 */
export function RtsConsole({
  namaPos,
  idLogger,
  sdOk,
  loggerTerhubung,
  rtsTerhubung,
  rtsRunning,
  waktuData,
  tiltX,
  tiltY,
  telemetri,
  sesi,
  vektor,
  ambang,
  onKontrol,
  className,
}: RtsConsoleProps) {
  const zona = "min-w-0";
  const menunggu = sesi.loading && sesi.maksMm === null && !sesi.kosong;
  const tanpaHasil = !sesi.loading && !sesi.kosong && sesi.terukur === 0;

  return (
    <section
      aria-label="Panel instrumen RTS"
      className={cn(
        "@container relative isolate overflow-hidden rounded-[18px] bg-(--console) text-(--console-ink) ring-1 ring-white/8",
        className
      )}
    >
      {/* Cahaya & tekstur titik — tipis, memudar ke tepi. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(760px 340px at 6% 62%, oklch(0.37 0.11 278 / 0.62), transparent 70%), radial-gradient(560px 280px at 97% 8%, oklch(0.33 0.09 250 / 0.45), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0 / 0.11) 1px, transparent 1.3px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 75% 95% at 50% 50%, black 25%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 95% at 50% 50%, black 25%, transparent 100%)",
        }}
      />

      <div className="grid gap-5 p-5 @6xl:gap-6 @6xl:p-6 @3xl:grid-cols-2 @5xl:grid-cols-[minmax(0,1.5fr)_minmax(188px,1fr)_minmax(180px,0.9fr)_auto]">
        {/* ── Zona A: unit RTS & identitas pos ── */}
        <div className={cn(zona, "rise-in flex items-center gap-4")}>
          <div className="flex flex-col items-center gap-3">
            <RtsSprite running={rtsTerhubung && rtsRunning} size={116} />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                rtsTerhubung ? "bg-(--st-normal)/15 text-white" : "bg-white/8 text-(--console-ink-2)"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  rtsTerhubung ? "bg-(--st-normal) text-(--st-normal) status-pulse" : "bg-(--st-awas)"
                )}
              />
              {rtsTerhubung ? "RTS terhubung" : "RTS terputus"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <Eyebrow tone="console">Pos RTS</Eyebrow>
            <h2 className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.01em] text-(--console-ink)">
              {namaPos}
            </h2>
            <dl className="mt-2.5 space-y-0.5 text-[12.5px] text-(--console-ink-2)">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <dt className="sr-only">Logger</dt>
                <dd>
                  Logger <span className="font-mono tabular-nums text-(--console-ink)">{idLogger}</span>
                </dd>
                <dd aria-hidden="true">·</dd>
                <dt className="sr-only">Koneksi logger</dt>
                <dd>{loggerTerhubung ? "terhubung" : "terputus"}</dd>
                <dd aria-hidden="true">·</dd>
                <dt className="sr-only">SD card</dt>
                <dd>
                  SD card{" "}
                  {sdOk ? "OK" : <span className="font-semibold text-(--st-siaga)">bermasalah</span>}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <dt className="whitespace-nowrap">Data terakhir</dt>
                <dd className="font-mono tabular-nums whitespace-nowrap text-(--console-ink)">{waktuData}</dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center gap-3">
              <LevelBubble x={Number(tiltX)} y={Number(tiltY)} />
              <div>
                <Eyebrow tone="console">Tilt</Eyebrow>
                <p className="font-mono text-[13px] tabular-nums text-(--console-ink)">
                  <span className="text-(--console-ink-3)">X</span> {tiltX}
                  <span className="ml-3 text-(--console-ink-3)">Y</span> {tiltY}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onKontrol}
              className="mt-4 inline-flex h-10 w-full max-w-[240px] cursor-pointer items-center justify-between rounded-[10px] bg-(--console-ink) pl-3.5 pr-2.5 text-[13px] font-semibold text-(--navy) outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="size-4" />
                Kontrol ADR
              </span>
              <ChevronRight className="size-4 text-(--ink-3)" />
            </button>
          </div>
        </div>

        {/* ── Zona B: telemetri logger ── */}
        <div
          className={cn(zona, "rise-in @3xl:border-l @3xl:border-(--console-line) @3xl:pl-5")}
          style={{ animationDelay: "70ms" }}
        >
          <Eyebrow tone="console">Telemetri logger</Eyebrow>
          <div className="mt-3 space-y-3.5">
            <TelemetryMeter label="Power RTS" value={telemetri.power} unit="V" min={0} max={15} />
            <TelemetryMeter label="Baterai logger" value={telemetri.battery} unit="V" min={10} max={14.5} />
            <TelemetryMeter label="Kelembapan" value={telemetri.humidity} unit="%" min={0} max={100} />
            <TelemetryMeter label="Suhu" value={telemetri.temp} unit="°C" min={0} max={60} />
          </div>
        </div>

        {/* ── Zona C: putusan sesi ── */}
        <div
          className={cn(
            zona,
            "rise-in @3xl:border-t @3xl:border-(--console-line) @3xl:pt-5 @5xl:border-t-0 @5xl:border-l @5xl:pt-0 @5xl:pl-5",
            "transition-opacity duration-300",
            sesi.loading && !menunggu && "opacity-60"
          )}
          style={{ animationDelay: "140ms" }}
        >
          <Eyebrow tone="console">Running terpilih</Eyebrow>
          {sesi.kosong ? (
            <>
              <p className="mt-2 font-display text-[22px] font-bold leading-tight text-(--console-ink)">
                Belum ada running
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--console-ink-2)">
                Mulai pengukuran dari Kontrol ADR — hasilnya akan tampil di sini.
              </p>
            </>
          ) : menunggu ? (
            <div className="mt-2 space-y-3" aria-busy="true" aria-label="Memuat sesi">
              <div className="h-4 w-32 rounded bg-white/10" />
              <div className="h-12 w-40 rounded bg-white/10" />
              <div className="h-3 w-44 rounded bg-white/10" />
              <div className="h-4 w-28 rounded bg-white/10" />
            </div>
          ) : tanpaHasil ? (
            <>
              <p className="mt-1 font-mono text-[13px] font-medium tabular-nums text-(--console-ink-2)">
                {sesi.waktu ?? "—"}
              </p>
              <p className="mt-2 font-display text-[22px] font-bold leading-tight text-(--console-ink)">
                Tidak ada prisma terukur
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--console-ink-2)">
                Running ini tidak menghasilkan pembacaan yang bisa dibandingkan dengan acuan R0.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 font-mono text-[13px] font-medium tabular-nums text-(--console-ink-2)">
                {sesi.waktu ?? "—"}
              </p>
              <p className="mt-3 flex items-baseline gap-1.5 text-(--console-ink)">
                <span className="text-[54px] font-bold leading-[0.9] tracking-[-0.035em]">
                  {fmt(sesi.maksMm, 2)}
                </span>
                <span className="text-[14px] font-medium text-(--console-ink-3)">mm</span>
              </p>
              <p className="mt-2 text-[12px] text-(--console-ink-2)">
                Pergeseran horizontal maks.
                {sesi.maksNama && (
                  <>
                    {" · "}
                    <span className="font-medium text-(--console-ink)">
                      {sesi.maksNama.replace(/_/g, " ")}
                    </span>
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 font-display text-[17px] font-bold text-(--console-ink)">
                  <StatusDot status={sesi.status} />
                  {sesi.status ?? "Ambang belum diatur"}
                </span>
                {sesi.ambangBerikut && (
                  <span className="text-[11.5px] text-(--console-ink-3)">
                    ambang {sesi.ambangBerikut.label.toLowerCase()} {fmt(sesi.ambangBerikut.nilai, 0)} mm
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11.5px] text-(--console-ink-3)">
                {sesi.terukur} prisma terukur
              </p>
            </>
          )}
        </div>

        {/* ── Zona D: mawar arah pergeseran ── */}
        <div
          className={cn(
            zona,
            "rise-in flex flex-col items-center @3xl:items-start @3xl:border-t @3xl:border-l @3xl:border-(--console-line) @3xl:pt-5 @3xl:pl-5 @5xl:border-t-0 @5xl:pt-0",
            "transition-opacity duration-300",
            sesi.loading && !menunggu && "opacity-60"
          )}
          style={{ animationDelay: "210ms" }}
        >
          <Eyebrow tone="console" className="self-start">
            Arah pergeseran
          </Eyebrow>
          <div className="mt-1 -mb-1">
            <DisplacementRose
              vektor={vektor}
              ambang={ambang}
              sesiKey={sesi.sesiKey}
              kosong={sesi.kosong || (menunggu && vektor.length === 0)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
