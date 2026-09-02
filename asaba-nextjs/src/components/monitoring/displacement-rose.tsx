"use client";

import { fmt } from "./format";
import { URUTAN_STATUS, WARNA_STATUS, type AmbangSite, type StatusLabel } from "./status";
import { StatusDot } from "./panel";

export interface RoseVector {
  id: string;
  nama: string;
  dxMm: number;
  dyMm: number;
  status: StatusLabel | null;
}

const UKURAN = 200;
const C = UKURAN / 2;
const R = 74;

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
const FONT_DISPLAY = "var(--font-barlow-sc), var(--font-geist-sans), sans-serif";

/**
 * Mawar arah pergeseran.
 *
 * Setiap prisma digambar sebagai vektor dari pusat (posisi acuan R0-nya) ke arah
 * pergeseran horizontalnya pada sesi ini. Panjang = pergeseran (mm), warna =
 * status. Lingkaran ambang digambar pada skala yang sama, jadi vektor yang
 * menembus lingkaran kuning berarti prisma itu sudah masuk Waspada — tanpa
 * perlu membaca angka.
 */
export function DisplacementRose({
  vektor,
  ambang,
  sesiKey,
  kosong = false,
}: {
  vektor: RoseVector[];
  ambang: AmbangSite | null;
  /** Berganti tiap sesi — memicu animasi gambar ulang. */
  sesiKey: string;
  kosong?: boolean;
}) {
  const maks = vektor.reduce((m, v) => Math.max(m, Math.hypot(v.dxMm, v.dyMm)), 0);
  // Skala sedikitnya sampai ambang Waspada: pergeseran kecil harus terbaca kecil,
  // bukan dibesarkan sampai memenuhi lingkaran.
  const skala = Math.max(maks, ambang?.geser.normalMax ?? 0, 1) * 1.08;
  const rDari = (mm: number) => (mm / skala) * R;

  const cincin: { r: number; label: string; warna: string; ambang: boolean }[] = [];
  if (ambang) {
    const batas: [number, StatusLabel][] = [
      [ambang.geser.normalMax, "Waspada"],
      [ambang.geser.waspadaMax, "Siaga"],
      [ambang.geser.siagaMax, "Awas"],
    ];
    for (const [nilai, label] of batas) {
      if (nilai <= skala) {
        cincin.push({
          r: rDari(nilai),
          label: `${fmt(nilai, 0)} mm · ${label.toLowerCase()}`,
          warna: WARNA_STATUS[label],
          ambang: true,
        });
      }
    }
  }
  // Bila semua vektor jauh di dalam lingkaran ambang, beri satu cincin acuan
  // pada pergeseran terbesar supaya panjangnya tetap bisa dibaca.
  if (maks > 0 && rDari(maks) < R * 0.6) {
    cincin.push({
      r: rDari(maks),
      label: `${fmt(maks, 1)} mm`,
      warna: "var(--console-ink-3)",
      ambang: false,
    });
  }

  const hitung = new Map<StatusLabel, number>();
  for (const v of vektor) if (v.status) hitung.set(v.status, (hitung.get(v.status) ?? 0) + 1);
  const legenda = URUTAN_STATUS.filter((s) => hitung.has(s));

  const kardinal: [string, number, number][] = [
    ["U", C, C - R - 11],
    ["T", C + R + 12, C + 3.5],
    ["S", C, C + R + 17],
    ["B", C - R - 12, C + 3.5],
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${UKURAN} ${UKURAN}`}
        width={UKURAN}
        height={UKURAN}
        role="img"
        aria-label={
          kosong
            ? "Belum ada running"
            : `Arah pergeseran ${vektor.length} prisma, pergeseran terbesar ${fmt(maks, 2)} mm`
        }
        className="max-w-full"
      >
        {/* Lingkar luar + tanda 8 arah */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="oklch(1 0 0 / 14%)" strokeWidth={1} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const panjang = i % 2 === 0 ? 6 : 3.5;
          return (
            <line
              key={i}
              x1={C + Math.sin(a) * (R - panjang)}
              y1={C - Math.cos(a) * (R - panjang)}
              x2={C + Math.sin(a) * R}
              y2={C - Math.cos(a) * R}
              stroke="oklch(1 0 0 / 30%)"
              strokeWidth={1}
            />
          );
        })}
        {kardinal.map(([huruf, x, y]) => (
          <text
            key={huruf}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fontFamily={FONT_DISPLAY}
            fill="var(--console-ink-3)"
          >
            {huruf}
          </text>
        ))}

        {/* Cincin ambang & acuan */}
        {cincin.map((c) => (
          <g key={c.label}>
            <circle
              cx={C}
              cy={C}
              r={c.r}
              fill="none"
              stroke={c.warna}
              strokeOpacity={c.ambang ? 0.55 : 0.6}
              strokeWidth={c.ambang ? 1.25 : 1}
            />
            <text
              x={C}
              y={C - c.r - 3.5}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily={FONT_MONO}
              fill={c.ambang ? c.warna : "var(--console-ink-3)"}
              fillOpacity={0.95}
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* Pusat = posisi acuan R0 */}
        <line x1={C - 5} x2={C + 5} y1={C} y2={C} stroke="var(--console-ink-3)" strokeWidth={1} />
        <line x1={C} x2={C} y1={C - 5} y2={C + 5} stroke="var(--console-ink-3)" strokeWidth={1} />

        {kosong && (
          <text
            x={C}
            y={C + 26}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-geist-sans), sans-serif"
            fill="var(--console-ink-3)"
          >
            Belum ada running
          </text>
        )}

        {/* Vektor per prisma */}
        {vektor.map((v, i) => {
          const mag = Math.hypot(v.dxMm, v.dyMm);
          const x = C + rDari(v.dxMm);
          const y = C - rDari(v.dyMm);
          const warna = v.status ? WARNA_STATUS[v.status] : "var(--console-ink-2)";
          const tunda = `${i * 45}ms`;
          return (
            <g key={`${sesiKey}-${v.id}`}>
              <title>{`${v.nama.replace(/_/g, " ")} · ${fmt(mag, 2)} mm${v.status ? ` · ${v.status}` : ""}`}</title>
              {mag > 0 && (
                <>
                  {/* Jalur sasaran hover yang lebih lebar dari garisnya. */}
                  <line x1={C} y1={C} x2={x} y2={y} stroke="transparent" strokeWidth={12} />
                  <line
                    x1={C}
                    y1={C}
                    x2={x}
                    y2={y}
                    stroke={warna}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    pathLength={1}
                    className="rose-vec"
                    style={{ animationDelay: tunda }}
                  />
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={3.5}
                fill={warna}
                stroke="var(--console)"
                strokeWidth={2}
                className="rose-dot"
                style={{ animationDelay: mag > 0 ? `${i * 45 + 420}ms` : tunda }}
              />
            </g>
          );
        })}
      </svg>

      {legenda.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1" aria-label="Jumlah prisma per status">
          {legenda.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 text-[11.5px] text-(--console-ink-2)">
              <StatusDot status={s} className="size-2" />
              {s}
              <span className="font-mono tabular-nums text-(--console-ink-3)">{hitung.get(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
