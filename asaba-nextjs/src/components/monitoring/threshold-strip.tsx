"use client";

import { fmt } from "./format";
import { URUTAN_STATUS, WARNA_STATUS, type AmbangSite, type StatusLabel } from "./status";

export interface TitikAmbang {
  id: string;
  nama: string;
  /** Pergeseran horizontal terhadap acuan R0, dalam mm. */
  geserMm: number;
  status: StatusLabel | null;
}

const W = 560;
const H = 118;
const KIRI = 10;
const KANAN = 14;
const BASELINE = 74;
const TINGGI_BAND = 9;

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
const FONT_DISPLAY = "var(--font-barlow-sc), var(--font-geist-sans), sans-serif";

/** Sebaran titik yang bertumpuk digeser ke atas berlapis supaya tidak saling menimpa. */
function tataLapis(titik: { x: number }[], jarakMin: number): number[] {
  const urut = titik.map((t, i) => ({ i, x: t.x })).sort((a, b) => a.x - b.x);
  const lapis = new Array<number>(titik.length).fill(0);
  const xTerakhirPerLapis: number[] = [];
  for (const { i, x } of urut) {
    let l = 0;
    while (xTerakhirPerLapis[l] !== undefined && x - xTerakhirPerLapis[l] < jarakMin) l++;
    xTerakhirPerLapis[l] = x;
    lapis[i] = l;
  }
  return lapis;
}

/**
 * Sisa jarak ke ambang bahaya.
 *
 * Satu sumbu mendatar dalam mm. Pita di bawahnya diwarnai menurut ambang site
 * (Normal → Waspada → Siaga → Awas), dan setiap prisma sesi ini ditaruh sebagai
 * titik pada sumbu yang sama. Yang dibaca operator bukan angka satu per satu,
 * melainkan seberapa jauh gerombolan titik itu dari batas berikutnya.
 *
 * Berbeda dari mawar arah di Dashboard: di sana arah, di sini besaran terhadap
 * ambang.
 */
export function ThresholdStrip({
  titik,
  ambang,
  kosong = false,
}: {
  titik: TitikAmbang[];
  ambang: AmbangSite | null;
  kosong?: boolean;
}) {
  const maksData = titik.reduce((m, t) => Math.max(m, t.geserMm), 0);

  // Skala selalu memuat ambang Waspada supaya pergeseran kecil terbaca kecil,
  // dan melebar bila ada prisma yang sudah melewatinya.
  const batasWaspada = ambang?.geser.normalMax ?? 0;
  const maksSkala = Math.max(maksData * 1.12, batasWaspada * 1.25, 1);
  const lebarPlot = W - KIRI - KANAN;
  const X = (mm: number) => KIRI + (Math.min(mm, maksSkala) / maksSkala) * lebarPlot;

  // Pita ambang. Tanpa ambang site, satu pita netral — jangan mengarang batas.
  const pita: { dari: number; ke: number; label: StatusLabel }[] = [];
  if (ambang) {
    const { normalMax, waspadaMax, siagaMax } = ambang.geser;
    const tepi: [number, number, StatusLabel][] = [
      [0, normalMax, "Normal"],
      [normalMax, waspadaMax, "Waspada"],
      [waspadaMax, siagaMax, "Siaga"],
      [siagaMax, Number.POSITIVE_INFINITY, "Awas"],
    ];
    for (const [dari, ke, label] of tepi) {
      if (dari >= maksSkala) break;
      pita.push({ dari, ke: Math.min(ke, maksSkala), label });
    }
  }

  const titikPx = titik.map((t) => ({ ...t, x: X(t.geserMm) }));
  const lapis = tataLapis(titikPx, 11);
  const terburuk = titikPx.reduce<(typeof titikPx)[number] | null>(
    (a, b) => (a === null || b.geserMm > a.geserMm ? b : a),
    null
  );

  const hitung = new Map<StatusLabel, number>();
  for (const t of titik) if (t.status) hitung.set(t.status, (hitung.get(t.status) ?? 0) + 1);
  const legenda = URUTAN_STATUS.filter((s) => hitung.has(s));

  // Tanda skala: 0, tiap batas ambang yang muat, dan ujung skala.
  const tanda: { mm: number; utama: boolean }[] = [{ mm: 0, utama: false }];
  if (ambang) {
    for (const v of [ambang.geser.normalMax, ambang.geser.waspadaMax, ambang.geser.siagaMax]) {
      if (v < maksSkala) tanda.push({ mm: v, utama: true });
    }
  }
  tanda.push({ mm: maksSkala, utama: false });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          kosong
            ? "Belum ada prisma terukur"
            : `Sebaran ${titik.length} prisma terhadap ambang bahaya, pergeseran terbesar ${fmt(maksData, 2)} milimeter`
        }
      >
        {/* Pita ambang — celah 2px antar pita supaya batasnya terbaca sebagai batas */}
        {pita.length > 0 ? (
          pita.map((p) => {
            const x0 = X(p.dari);
            const x1 = X(p.ke);
            const w = Math.max(x1 - x0 - 2, 1);
            return (
              <g key={p.label}>
                <rect
                  x={x0}
                  y={BASELINE}
                  width={w}
                  height={TINGGI_BAND}
                  rx={2}
                  fill={WARNA_STATUS[p.label]}
                  fillOpacity={0.45}
                />
                {w > 44 && (
                  <text
                    x={x0 + 4}
                    y={BASELINE + TINGGI_BAND + 12}
                    fontSize={9}
                    fontWeight={600}
                    fontFamily={FONT_DISPLAY}
                    letterSpacing="0.06em"
                    fill={WARNA_STATUS[p.label]}
                    style={{ textTransform: "uppercase" }}
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })
        ) : (
          <rect
            x={KIRI}
            y={BASELINE}
            width={lebarPlot}
            height={TINGGI_BAND}
            rx={2}
            fill="var(--console-ink-3)"
            fillOpacity={0.3}
          />
        )}

        {/* Tanda skala */}
        {tanda.map((t, i) => (
          <g key={`${t.mm}-${i}`}>
            <line
              x1={X(t.mm)}
              x2={X(t.mm)}
              y1={BASELINE - 4}
              y2={BASELINE + TINGGI_BAND}
              stroke="oklch(1 0 0 / 22%)"
              strokeWidth={1}
            />
            <text
              x={X(t.mm)}
              y={BASELINE - 8}
              textAnchor={i === 0 ? "start" : i === tanda.length - 1 ? "end" : "middle"}
              fontSize={9}
              fontFamily={FONT_MONO}
              fill="var(--console-ink-3)"
            >
              {fmt(t.mm, 0)}
            </text>
          </g>
        ))}
        <text
          x={KIRI}
          y={H - 6}
          fontSize={9}
          fontFamily={FONT_MONO}
          fill="var(--console-ink-3)"
        >
          mm dari acuan R0
        </text>

        {kosong && (
          <text
            x={W / 2}
            y={BASELINE - 26}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-geist-sans), sans-serif"
            fill="var(--console-ink-3)"
          >
            Belum ada prisma terukur
          </text>
        )}

        {/* Prisma */}
        {titikPx.map((t, i) => {
          const cy = BASELINE - 8 - lapis[i] * 11;
          const warna = t.status ? WARNA_STATUS[t.status] : "var(--console-ink-2)";
          return (
            <g key={t.id}>
              <title>{`${t.nama.replace(/_/g, " ")} · ${fmt(t.geserMm, 2)} mm${t.status ? ` · ${t.status}` : ""}`}</title>
              {/* Tangkai ke sumbu supaya titik yang berlapis tetap terbaca posisinya */}
              <line
                x1={t.x}
                x2={t.x}
                y1={cy}
                y2={BASELINE - 2}
                stroke={warna}
                strokeOpacity={0.4}
                strokeWidth={1}
              />
              <circle cx={t.x} cy={cy} r={4} fill={warna} stroke="var(--console)" strokeWidth={1.5} />
              {/* Sasaran hover lebih besar dari titiknya */}
              <circle cx={t.x} cy={cy} r={9} fill="transparent" />
            </g>
          );
        })}

        {/* Hanya yang terburuk diberi label — sisanya lewat hover dan tabel */}
        {terburuk && terburuk.geserMm > 0 && (
          <text
            x={Math.min(terburuk.x + 8, W - KANAN)}
            y={BASELINE - 8 - lapis[titikPx.indexOf(terburuk)] * 11 - 9}
            textAnchor={terburuk.x > W - 120 ? "end" : "start"}
            fontSize={10}
            fontWeight={600}
            fontFamily={FONT_MONO}
            fill="var(--console-ink)"
          >
            {`${terburuk.nama.replace(/_/g, " ")} ${fmt(terburuk.geserMm, 1)}`}
          </text>
        )}
      </svg>

      {legenda.length > 0 && (
        <ul
          className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1"
          aria-label="Jumlah prisma per status"
        >
          {legenda.map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-(--console-ink-2)"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: WARNA_STATUS[s] }}
              />
              {s}
              <span className="font-mono tabular-nums text-(--console-ink-3)">{hitung.get(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
