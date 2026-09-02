"use client";

import { fmt } from "./format";

export interface BatangDz {
  id: string;
  nama: string;
  dzMm: number;
}

const W = 320;
const H = 170;
const PAD_X = 14;
const ATAS = 20;
const BAWAH = 26;
const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";

/**
 * Perubahan elevasi (ΔZ) per prisma sebagai batang dari garis nol: ke atas
 * berarti naik, ke bawah berarti turun. Satu warna — arahnya sudah dibawa oleh
 * posisi batang, bukan oleh warna. Hanya nilai ekstrem yang diberi label;
 * angka lengkapnya ada di tabel.
 */
export function ElevationProfile({ batang }: { batang: BatangDz[] }) {
  if (batang.length === 0) {
    return (
      <div className="flex h-[170px] items-center justify-center px-6 text-center text-[12.5px] text-(--ink-3)">
        Belum ada data elevasi untuk digambar.
      </div>
    );
  }

  const maks = Math.max(...batang.map((b) => Math.abs(b.dzMm)), 0.001);
  const tinggiPlot = H - ATAS - BAWAH;
  const nol = ATAS + tinggiPlot / 2;
  const setengah = tinggiPlot / 2 - 6;
  const slot = (W - PAD_X * 2) / batang.length;
  const lebar = Math.min(18, slot * 0.55);
  const ekstrem = batang.reduce((a, b) => (Math.abs(b.dzMm) > Math.abs(a.dzMm) ? b : a));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Perubahan elevasi ${batang.length} prisma, terbesar ${fmt(ekstrem.dzMm)} mm pada ${ekstrem.nama}`}
    >
      <line x1={PAD_X} x2={W - PAD_X} y1={nol} y2={nol} stroke="var(--line)" strokeWidth={1} />
      <text
        x={W - PAD_X}
        y={nol - 4}
        textAnchor="end"
        fontSize={9}
        fontFamily={FONT_MONO}
        fill="var(--ink-3)"
      >
        0
      </text>

      {batang.map((b, i) => {
        const cx = PAD_X + slot * i + slot / 2;
        const h = (Math.abs(b.dzMm) / maks) * setengah;
        const naik = b.dzMm >= 0;
        const x0 = cx - lebar / 2;
        const x1 = cx + lebar / 2;
        const r = Math.min(4, h / 2);
        // Ujung data membulat, pangkal di garis nol tetap siku.
        const d = naik
          ? `M ${x0} ${nol} V ${nol - h + r} Q ${x0} ${nol - h} ${x0 + r} ${nol - h} H ${x1 - r} Q ${x1} ${nol - h} ${x1} ${nol - h + r} V ${nol} Z`
          : `M ${x0} ${nol} V ${nol + h - r} Q ${x0} ${nol + h} ${x0 + r} ${nol + h} H ${x1 - r} Q ${x1} ${nol + h} ${x1} ${nol + h - r} V ${nol} Z`;
        const label = b.id.length <= 4 ? b.id : b.id.slice(0, 4);
        return (
          <g key={b.id}>
            <title>{`${b.nama.replace(/_/g, " ")} · ΔZ ${fmt(b.dzMm)} mm`}</title>
            {h >= 1 ? (
              <path d={d} fill="var(--navy)" fillOpacity={0.9} />
            ) : (
              <line x1={x0} x2={x1} y1={nol} y2={nol} stroke="var(--navy)" strokeWidth={2} />
            )}
            {/* Sasaran hover setinggi kolom. */}
            <rect x={cx - slot / 2} y={ATAS} width={slot} height={tinggiPlot} fill="transparent" />
            <text
              x={cx}
              y={H - 8}
              textAnchor="middle"
              fontSize={9.5}
              fontFamily={FONT_MONO}
              fill="var(--ink-2)"
            >
              {label}
            </text>
            {b.id === ekstrem.id && (
              <text
                x={cx}
                y={naik ? nol - h - 5 : nol + h + 11}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fontFamily={FONT_MONO}
                fill="var(--ink)"
              >
                {`${b.dzMm > 0 ? "+" : ""}${fmt(b.dzMm, 1)}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
