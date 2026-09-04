"use client";

import { bearingDari, fmt } from "./format";
import { batasSkala } from "./prism-history";
import { WARNA_STATUS, type AmbangSite, type StatusLabel } from "./status";

export interface JejakTitik {
  dxMm: number;
  dyMm: number;
}

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
const FONT_DISPLAY = "var(--font-barlow-sc), var(--font-geist-sans), sans-serif";

/**
 * Warna garis & teks per permukaan. Warna status TIDAK ikut di sini — sama di
 * kedua permukaan, dan hanya untuk status.
 */
const NADA = {
  console: {
    garis: "oklch(1 0 0 / 16%)",
    garisRedup: "oklch(1 0 0 / 9%)",
    tick: "oklch(1 0 0 / 32%)",
    teks: "var(--console-ink)",
    teks2: "var(--console-ink-2)",
    teks3: "var(--console-ink-3)",
    latar: "var(--console)",
  },
  paper: {
    garis: "rgba(20, 23, 58, 0.18)",
    garisRedup: "rgba(20, 23, 58, 0.09)",
    tick: "rgba(20, 23, 58, 0.35)",
    teks: "var(--ink)",
    teks2: "var(--ink-2)",
    teks3: "var(--ink-3)",
    latar: "#ffffff",
  },
} as const;

/**
 * Teropong satu prisma.
 *
 * Pusat = posisi acuan R0. Vektor dari pusat = pergeseran horizontal prisma
 * pada sesi ini: panjang dalam mm, arah sebagai bearing dari utara, warna
 * mengikuti status. Cincin ambang site digambar pada skala yang sama, jadi
 * ujung vektor yang belum menyentuh cincin kuning berarti masih Normal —
 * terbaca tanpa angka. Titik-titik redup adalah pembacaan lain pada rentang
 * yang sedang dibuka: gerombolan rapat berarti getaran pengukuran, barisan
 * yang menjauh berarti pergerakan sungguhan.
 *
 * Kerabat DisplacementRose di Dashboard, tapi untuk SATU prisma: di sana
 * banyak vektor tanpa jejak, di sini satu vektor dengan riwayatnya.
 */
export function PrismScope({
  dxMm,
  dyMm,
  status,
  arahTeks,
  ambang,
  jejak,
  sesiKey,
  kosong = false,
  tone = "paper",
  ukuran = 248,
}: {
  dxMm: number | null;
  dyMm: number | null;
  status: StatusLabel | null;
  arahTeks: string | null;
  ambang: AmbangSite | null;
  jejak: JejakTitik[];
  /** Berganti tiap prisma/sesi — memicu animasi gambar ulang. */
  sesiKey: string;
  kosong?: boolean;
  tone?: keyof typeof NADA;
  /** Sisi SVG dalam px. Huruf tidak ikut diskalakan supaya tetap terbaca. */
  ukuran?: number;
}) {
  const w = NADA[tone];
  const C = ukuran / 2;
  // Di bawah 200px tidak ada label di dalam SVG: label cincin menabrak tick
  // dan huruf mata angin, label ujung vektor menimpa huruf di tepi. Angkanya
  // sudah tertulis di samping teropong, jadi di sini cukup bentuknya.
  const ringkas = ukuran < 200;
  // Tepi: ruang untuk huruf mata angin (dan label cincin di ukuran besar).
  const R = C - (ringkas ? 20 : 28);
  const ada = !kosong && dxMm !== null && dyMm !== null;
  const mag = ada ? Math.hypot(dxMm, dyMm) : 0;
  const jejakMag = jejak.map((j) => Math.hypot(j.dxMm, j.dyMm));
  // Jejak ikut menentukan skala, tapi lewat batasSkala: satu tembakan liar
  // tidak boleh menyusutkan vektor dan cincin ambang jadi setitik di pusat.
  const maksJejak = batasSkala(jejakMag).maks;
  // Skala paling sedikit sampai ambang Waspada supaya pergeseran kecil
  // terbaca kecil, dan melebar bila vektor atau jejaknya sudah melewatinya.
  const skala = Math.max(mag, maksJejak, ambang?.geser.normalMax ?? 0, 1) * 1.1;
  // Dibulatkan 2 desimal: Math.sin/cos di server dan klien bisa berbeda pada
  // digit ke-15, dan React menganggapnya hydration mismatch.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const rDari = (mm: number) => r2((mm / skala) * R);

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
          label: `${fmt(nilai, 0)} mm ${label.toLowerCase()}`,
          warna: WARNA_STATUS[label],
          ambang: true,
        });
      }
    }
  }
  // Vektor yang jauh di dalam cincin ambang diberi cincin acuan pada
  // panjangnya sendiri supaya besarannya tetap bisa dibaca terhadap ambang.
  // Tanpa label — angkanya sudah ada di ujung vektor.
  if (mag > 0 && rDari(mag) < R * 0.6) {
    cincin.push({ r: rDari(mag), label: `acuan ${fmt(mag, 1)} mm`, warna: w.teks3, ambang: false });
  }

  const bearing = ada && mag > 0 ? bearingDari(dxMm, dyMm) : null;
  const ujungX = ada ? C + rDari(dxMm) : C;
  const ujungY = ada ? C - rDari(dyMm) : C;
  const warna = status ? WARNA_STATUS[status] : w.teks2;

  // Label ujung vektor ditaruh sedikit di luar ujungnya, searah vektor.
  const rad = bearing !== null ? (bearing * Math.PI) / 180 : 0;
  const rLabel = rDari(mag) + 24;
  const labelX = r2(C + Math.sin(rad) * rLabel);
  const labelY = r2(C - Math.cos(rad) * rLabel);
  const anchor = labelX < C - 12 ? "end" : labelX > C + 12 ? "start" : "middle";

  const kardinal: [string, number, number][] = [
    ["U", C, C - R - 11],
    ["T", C + R + 12, C + 3.5],
    ["S", C, C + R + 17],
    ["B", C - R - 12, C + 3.5],
  ];

  return (
    <svg
      viewBox={`0 0 ${ukuran} ${ukuran}`}
      width={ukuran}
      height={ukuran}
      role="img"
      aria-label={
        kosong
          ? "Belum ada pembacaan"
          : `Pergeseran ${fmt(mag, 2)} mm ke arah ${bearing !== null ? `${bearing.toFixed(0)} derajat` : "tidak tentu"}${status ? `, status ${status}` : ""}, ${jejak.length} pembacaan lain pada rentang`
      }
      className="max-w-full"
    >
      {/* Sumbu utara-selatan & timur-barat, redup */}
      <line x1={C} x2={C} y1={C - R} y2={C + R} stroke={w.garisRedup} strokeWidth={1} strokeDasharray="2 4" />
      <line x1={C - R} x2={C + R} y1={C} y2={C} stroke={w.garisRedup} strokeWidth={1} strokeDasharray="2 4" />

      {/* Lingkar luar + tanda 16 arah */}
      <circle cx={C} cy={C} r={R} fill="none" stroke={w.garis} strokeWidth={1} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        const panjang = i % 4 === 0 ? 7 : i % 2 === 0 ? 4.5 : 2.5;
        return (
          <line
            key={i}
            x1={r2(C + Math.sin(a) * (R - panjang))}
            y1={r2(C - Math.cos(a) * (R - panjang))}
            x2={r2(C + Math.sin(a) * R)}
            y2={r2(C - Math.cos(a) * R)}
            stroke={w.tick}
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
          fill={w.teks3}
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
            strokeOpacity={c.ambang ? 0.6 : 0.7}
            strokeWidth={c.ambang ? 1.25 : 1}
            strokeDasharray={c.ambang ? undefined : "3 3"}
          />
          {c.ambang && !ringkas && (
            <text
              x={C}
              y={C - c.r - 4}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily={FONT_MONO}
              fill={c.warna}
            >
              {c.label}
            </text>
          )}
        </g>
      ))}

      {/* Jejak pembacaan lain pada rentang — yang di luar skala tidak digambar */}
      {jejak.map((j, i) =>
        jejakMag[i] > skala ? null : (
          <circle
            key={`${sesiKey}-j${i}`}
            cx={C + rDari(j.dxMm)}
            cy={C - rDari(j.dyMm)}
            r={2}
            fill={w.teks2}
            fillOpacity={0.4}
          />
        )
      )}

      {/* Pusat = acuan R0 */}
      <line x1={C - 5} x2={C + 5} y1={C} y2={C} stroke={w.teks2} strokeWidth={1} />
      <line x1={C} x2={C} y1={C - 5} y2={C + 5} stroke={w.teks2} strokeWidth={1} />

      {kosong && (
        <text
          x={C}
          y={C + 28}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-geist-sans), sans-serif"
          fill={w.teks3}
        >
          Belum ada pembacaan
        </text>
      )}

      {/* Vektor sesi ini */}
      {ada && mag > 0 && bearing !== null && (
        <g key={sesiKey}>
          <line
            x1={C}
            y1={C}
            x2={ujungX}
            y2={ujungY}
            stroke={warna}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            className="rose-vec"
          />
          {/* translate/rotate di <g> induk: animasi .rose-dot memasang CSS
              `transform` (scale) yang menimpa atribut transform pada elemen
              yang sama — mata panahnya melompat ke sudut (0,0). */}
          <g transform={`translate(${ujungX} ${ujungY}) rotate(${r2(bearing)})`}>
            <polygon
              points="0,-7.5 4.5,2.5 0,0.5 -4.5,2.5"
              fill={warna}
              className="rose-dot"
              style={{ animationDelay: "480ms" }}
            />
          </g>
          {!ringkas && (
            <>
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontSize={11}
                fontWeight={700}
                fontFamily={FONT_MONO}
                fill={w.teks}
              >
                {fmt(mag, 1)} mm
              </text>
              <text
                x={labelX}
                y={labelY + 12}
                textAnchor={anchor}
                fontSize={9.5}
                fontFamily={FONT_DISPLAY}
                fontWeight={600}
                fill={w.teks2}
              >
                {bearing.toFixed(0)}°{arahTeks ? ` ${arahTeks}` : ""}
              </text>
            </>
          )}
        </g>
      )}
      {ada && mag === 0 && (
        <circle cx={C} cy={C} r={4} fill={warna} stroke={w.latar} strokeWidth={2} />
      )}
    </svg>
  );
}
