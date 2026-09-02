"use client";

import { WARNA_STATUS, type StatusLabel } from "./status";
import { fmt } from "./format";

export interface TitikSeri {
  /** Timestamp mentah dari server. */
  t: string;
  /** Pergeseran pada saat itu, mm. */
  mm: number;
}

const W = 132;
const H = 34;
const PAD_Y = 5;
const PAD_X = 3;

/**
 * Pergeseran satu prisma sepanjang hari, sebagai garis kecil di dalam sel tabel.
 *
 * Titik terakhir diberi penekanan karena itulah angka yang dipakai di kolom
 * "Pergeseran" di sebelahnya; warnanya mengikuti status prisma, bukan warna
 * hias, jadi garis ini tidak memperkenalkan makna warna baru. Tanpa sumbu dan
 * tanpa label — bentuknya cukup untuk tahu naik, turun, atau datar, dan angka
 * pastinya sudah ada di kolom sebelahnya.
 */
export function Sparkline({
  data,
  status,
}: {
  data: TitikSeri[];
  status?: StatusLabel | null;
}) {
  if (!data || data.length === 0) {
    return <span className="text-[12.5px] text-(--ink-3)">—</span>;
  }

  const nilai = data.map((d) => d.mm);
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const rentang = max - min === 0 ? 1 : max - min;

  const X = (i: number) =>
    data.length === 1 ? W / 2 : PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
  const Y = (v: number) => H - PAD_Y - ((v - min) / rentang) * (H - PAD_Y * 2);

  const garis = data.map((d, i) => `${X(i)},${Y(d.mm)}`).join(" ");
  const warna = status ? WARNA_STATUS[status] : "var(--navy)";
  const akhir = data[data.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="block overflow-visible"
      role="img"
      aria-label={`${data.length} pembacaan, ${fmt(min, 2)} sampai ${fmt(max, 2)} mm, terakhir ${fmt(akhir.mm, 2)} mm`}
    >
      <polyline
        points={garis}
        fill="none"
        stroke={warna}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.75}
      />
      {/* Hanya pembacaan terakhir yang bertitik — sisanya akan jadi kebisingan
          pada seri yang panjang. */}
      <circle
        cx={X(data.length - 1)}
        cy={Y(akhir.mm)}
        r={2.75}
        fill={warna}
        stroke="#fff"
        strokeWidth={1.25}
      />
    </svg>
  );
}
