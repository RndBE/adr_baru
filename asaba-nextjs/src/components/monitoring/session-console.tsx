"use client";

import { cn } from "@/lib/utils";
import { Eyebrow, StatusDot } from "./panel";
import { ThresholdStrip, type TitikAmbang } from "./threshold-strip";
import { fmt } from "./format";
import type { AmbangSite, StatusLabel } from "./status";

export interface PuncakSesi {
  nilai: number | null;
  nama: string | null;
  status: StatusLabel | null;
}

export interface SessionConsoleProps {
  /** Tanggal sesi terpilih, sudah diformat. Null bila belum ada pilihan. */
  tanggal: string | null;
  jam: string | null;
  siteNama: string;
  siteWarna: string;
  /** Tanggal sesi acuan R0 untuk site ini, sudah diformat. */
  r0Tanggal: string | null;
  /** Jumlah prisma yang punya pembacaan sah pada sesi ini. */
  terukur: number;
  geser: PuncakSesi;
  laju: PuncakSesi;
  ambangBerikut: { label: StatusLabel; nilai: number } | null;
  titik: TitikAmbang[];
  ambang: AmbangSite | null;
  loading: boolean;
  /** Belum ada sesi yang dipilih sama sekali. */
  belumAdaSesi: boolean;
  className?: string;
}

/**
 * Panel sesi: satu bidang gelap yang menjawab "sesi mana yang sedang dilihat,
 * dan apa putusannya" sebelum operator masuk ke tabel di bawahnya.
 *
 * Sengaja TIDAK memuat telemetri hidup (baterai, suhu, status RTS) meski
 * bentuknya menyerupai konsol di Dashboard — halaman ini membaca catatan masa
 * lalu, dan mencampur angka hidup ke dalamnya akan membuat keduanya tertukar.
 * Status koneksi RTS tetap ada, tapi di bar kontrol di atas panel ini.
 */
export function SessionConsole({
  tanggal,
  jam,
  siteNama,
  siteWarna,
  r0Tanggal,
  terukur,
  geser,
  laju,
  ambangBerikut,
  titik,
  ambang,
  loading,
  belumAdaSesi,
  className,
}: SessionConsoleProps) {
  const menunggu = loading && geser.nilai === null && !belumAdaSesi;
  const tanpaHasil = !loading && !belumAdaSesi && terukur === 0;

  return (
    <section
      aria-label="Panel running terpilih"
      className={cn(
        "@container relative isolate overflow-hidden rounded-[18px] bg-(--console) text-(--console-ink) ring-1 ring-white/8",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(720px 320px at 4% 58%, oklch(0.37 0.11 278 / 0.6), transparent 70%), radial-gradient(600px 300px at 98% 6%, oklch(0.33 0.09 250 / 0.42), transparent 70%)",
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

      <div className="grid gap-5 p-5 @6xl:gap-6 @6xl:p-6 @3xl:grid-cols-2 @5xl:grid-cols-[minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(340px,1.4fr)]">
        {/* ── Zona A: sesi mana ── */}
        <div className="rise-in min-w-0">
          <Eyebrow tone="console">Running terpilih</Eyebrow>
          {belumAdaSesi ? (
            <>
              <p className="mt-1.5 font-display text-[24px] font-bold leading-tight text-(--console-ink)">
                Belum ada running
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--console-ink-2)">
                Pilih tanggal running di daftar sebelah kiri, atau ganti saringan site di atas.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
                <span className="font-display text-[30px] font-bold leading-none tracking-[-0.015em] text-(--console-ink)">
                  {tanggal ?? "—"}
                </span>
                <span className="font-mono text-[15px] tabular-nums text-(--console-ink-2)">
                  {jam ?? ""}
                </span>
              </p>
              <dl className="mt-3 space-y-1 text-[12.5px] text-(--console-ink-2)">
                <div className="flex items-baseline gap-2">
                  <dt className="sr-only">Site</dt>
                  <dd className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      aria-hidden="true"
                      className="mb-px inline-block size-2 shrink-0 rounded-full"
                      style={{ background: siteWarna }}
                    />
                    <span className="truncate font-medium text-(--console-ink)">{siteNama}</span>
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt>Acuan R0</dt>
                  <dd className="font-mono tabular-nums text-(--console-ink)">
                    {r0Tanggal ?? "belum ditetapkan"}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt>Prisma terukur</dt>
                  <dd className="font-mono tabular-nums text-(--console-ink)">
                    {loading && geser.nilai === null ? "…" : terukur}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>

        {/* ── Zona B: putusan sesi ── */}
        <div
          className={cn(
            "rise-in min-w-0 @3xl:border-l @3xl:border-(--console-line) @3xl:pl-5",
            "transition-opacity duration-300",
            loading && !menunggu && "opacity-60"
          )}
          style={{ animationDelay: "70ms" }}
        >
          <Eyebrow tone="console">Pergeseran maksimum</Eyebrow>
          {belumAdaSesi ? (
            <p className="mt-2 text-[12.5px] text-(--console-ink-3)">—</p>
          ) : menunggu ? (
            <div className="mt-2 space-y-3" aria-busy="true" aria-label="Memuat putusan sesi">
              <div className="h-11 w-36 rounded bg-white/10" />
              <div className="h-3 w-40 rounded bg-white/10" />
              <div className="h-4 w-28 rounded bg-white/10" />
            </div>
          ) : tanpaHasil ? (
            <>
              <p className="mt-2 font-display text-[21px] font-bold leading-tight text-(--console-ink)">
                Tidak ada prisma terukur
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--console-ink-2)">
                Running ini tidak menghasilkan pembacaan yang bisa dibandingkan dengan acuan R0.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 flex items-baseline gap-1.5 text-(--console-ink)">
                <span className="text-[46px] font-bold leading-[0.9] tracking-[-0.035em]">
                  {fmt(geser.nilai, 2)}
                </span>
                <span className="text-[13px] font-medium text-(--console-ink-3)">mm</span>
              </p>
              {geser.nama && (
                <p className="mt-1.5 text-[12px] text-(--console-ink-2)">
                  pada{" "}
                  <span className="font-medium text-(--console-ink)">
                    {geser.nama.replace(/_/g, " ")}
                  </span>
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 font-display text-[16px] font-bold text-(--console-ink)">
                  <StatusDot status={geser.status} />
                  {geser.status ?? "Ambang belum diatur"}
                </span>
                {ambangBerikut && (
                  <span className="text-[11.5px] text-(--console-ink-3)">
                    ambang {ambangBerikut.label.toLowerCase()} {fmt(ambangBerikut.nilai, 0)} mm
                  </span>
                )}
              </div>
              <div className="mt-3.5 border-t border-(--console-line) pt-3">
                <Eyebrow tone="console">Kecepatan maksimum</Eyebrow>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[19px] font-semibold leading-none text-(--console-ink)">
                    {fmt(laju.nilai, 2)}
                  </span>
                  <span className="text-[11.5px] text-(--console-ink-3)">mm/hari</span>
                  {laju.status && (
                    <span className="ml-1 inline-flex items-center gap-1.5 text-[11.5px] text-(--console-ink-2)">
                      <StatusDot status={laju.status} className="size-2" />
                      {laju.status}
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Zona C: sisa jarak ke ambang ── */}
        <div
          className={cn(
            "rise-in min-w-0 @3xl:col-span-2 @3xl:border-t @3xl:border-(--console-line) @3xl:pt-5 @5xl:col-span-1 @5xl:border-t-0 @5xl:border-l @5xl:pt-0 @5xl:pl-5",
            "transition-opacity duration-300",
            loading && !menunggu && "opacity-60"
          )}
          style={{ animationDelay: "140ms" }}
        >
          <Eyebrow tone="console">Sisa jarak ke ambang</Eyebrow>
          <div className="mt-2">
            <ThresholdStrip
              titik={titik}
              ambang={ambang}
              kosong={belumAdaSesi || titik.length === 0}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
