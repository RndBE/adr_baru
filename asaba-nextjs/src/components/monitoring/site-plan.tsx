"use client";

import { WARNA_STATUS, type StatusLabel } from "./status";

export interface TitikDenah {
  id: string;
  nama: string;
  e: number;
  n: number;
  status: StatusLabel | null;
}

const W = 320;
const H = 190;
const PAD = 28;
const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
const FONT_DISPLAY = "var(--font-barlow-sc), var(--font-geist-sans), sans-serif";

const namaPendek = (s: string) => {
  const bersih = s.replace(/_/g, " ");
  return bersih.length > 9 ? `${bersih.slice(0, 8)}…` : bersih;
};

/**
 * Denah site dari koordinat UTM terkoreksi: prisma sebagai titik berwarna
 * status, RTS sebagai segitiga stasiun, dan garis bidik tipis dari RTS ke tiap
 * prisma — geometri penembakan yang sebenarnya, bukan gambar ilustrasi.
 */
export function SitePlan({
  titik,
  rts,
}: {
  titik: TitikDenah[];
  rts: { e: number; n: number } | null;
}) {
  const semua = [...titik.map((t) => ({ e: t.e, n: t.n })), ...(rts ? [rts] : [])];

  if (semua.length === 0) {
    return (
      <div className="flex h-[190px] items-center justify-center px-6 text-center text-[12.5px] text-(--ink-3)">
        Belum ada koordinat prisma untuk digambar.
      </div>
    );
  }

  const minE = Math.min(...semua.map((p) => p.e));
  const maxE = Math.max(...semua.map((p) => p.e));
  const minN = Math.min(...semua.map((p) => p.n));
  const maxN = Math.max(...semua.map((p) => p.n));
  const spanE = Math.max(maxE - minE, 1);
  const spanN = Math.max(maxN - minN, 1);
  const skala = Math.min((W - PAD * 2) / spanE, (H - PAD * 2) / spanN);
  const offX = (W - spanE * skala) / 2;
  const offY = (H - spanN * skala) / 2;
  const X = (e: number) => offX + (e - minE) * skala;
  const Y = (n: number) => H - (offY + (n - minN) * skala);

  // Semua titik dalam piksel — untuk menentukan sisi label yang tidak bertabrakan.
  const semuaPx = [
    ...titik.map((t) => ({ id: t.id, x: X(t.e), y: Y(t.n) })),
    ...(rts ? [{ id: "__rts", x: X(rts.e), y: Y(rts.n) }] : []),
  ];

  // Batang skala: angka bulat terbesar yang muat di ≤30% lebar.
  const kandidat = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  const maksBarM = (W * 0.3) / skala;
  const barM = [...kandidat].reverse().find((k) => k <= maksBarM) ?? kandidat[0];
  const barPx = barM * skala;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Denah ${titik.length} prisma${rts ? " dan posisi RTS" : ""}`}
    >
      {/* Garis bidik RTS → prisma */}
      {rts &&
        titik.map((t) => (
          <line
            key={`bidik-${t.id}`}
            x1={X(rts.e)}
            y1={Y(rts.n)}
            x2={X(t.e)}
            y2={Y(t.n)}
            stroke="var(--ink)"
            strokeOpacity={0.09}
            strokeWidth={1}
          />
        ))}

      {titik.map((t) => {
        const x = X(t.e);
        const y = Y(t.n);
        // Label ke kiri bila ada titik lain (atau RTS) rapat di sebelah kanannya.
        const kiri = semuaPx.some(
          (u) => u.id !== t.id && u.x - x > 0 && u.x - x < 44 && Math.abs(u.y - y) < 12
        );
        return (
          <g key={t.id}>
            <title>{`${t.nama.replace(/_/g, " ")} · E ${t.e.toFixed(3)} · N ${t.n.toFixed(3)}${t.status ? ` · ${t.status}` : ""}`}</title>
            <circle
              cx={x}
              cy={y}
              r={4.5}
              fill={t.status ? WARNA_STATUS[t.status] : "var(--navy)"}
              stroke="#fff"
              strokeWidth={2}
            />
            <text
              x={kiri ? x - 8 : x + 8}
              y={y + 3.5}
              textAnchor={kiri ? "end" : "start"}
              fontSize={10}
              fontFamily={FONT_MONO}
              fill="var(--ink-2)"
            >
              {namaPendek(t.nama)}
            </text>
          </g>
        );
      })}

      {rts && (
        <g>
          <title>Posisi RTS (acuan site)</title>
          <path
            d={`M ${X(rts.e)} ${Y(rts.n) - 7.5} L ${X(rts.e) + 7} ${Y(rts.n) + 5} L ${X(rts.e) - 7} ${Y(rts.n) + 5} Z`}
            fill="var(--navy)"
            stroke="#fff"
            strokeWidth={1.5}
          />
          <text
            x={X(rts.e)}
            y={Y(rts.n) + 17}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            fontFamily={FONT_DISPLAY}
            fill="var(--navy)"
          >
            RTS
          </text>
        </g>
      )}

      {/* Panah utara */}
      <g transform={`translate(${W - 16} 15)`} aria-hidden="true">
        <path d="M0 -9 L4.5 4 L0 1.5 L-4.5 4 Z" fill="var(--ink-2)" />
        <text
          y={16}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight={600}
          fontFamily={FONT_DISPLAY}
          fill="var(--ink-3)"
        >
          U
        </text>
      </g>

      {/* Batang skala */}
      <g transform={`translate(12 ${H - 10})`} aria-hidden="true">
        <line x1={0} x2={barPx} y1={0} y2={0} stroke="var(--ink-2)" strokeWidth={1.5} />
        <line x1={0} x2={0} y1={-3.5} y2={3.5} stroke="var(--ink-2)" strokeWidth={1.5} />
        <line x1={barPx} x2={barPx} y1={-3.5} y2={3.5} stroke="var(--ink-2)" strokeWidth={1.5} />
        <text
          x={barPx / 2}
          y={-5}
          textAnchor="middle"
          fontSize={9}
          fontFamily={FONT_MONO}
          fill="var(--ink-3)"
        >
          {barM} m
        </text>
      </g>
    </svg>
  );
}
