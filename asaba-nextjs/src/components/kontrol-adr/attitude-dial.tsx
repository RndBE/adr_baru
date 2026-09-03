"use client";

import { cn } from "@/lib/utils";
import { fmtDms, parseDms } from "@/components/monitoring/format";

/**
 * Batas kerja teropong dalam sudut zenit.
 *
 * Di luar 30°–150° instrumen menolak DIAM-DIAM: tidak ada balasan penolakan,
 * dan satu-satunya jejaknya adalah `Rotate` gagal dengan alasan `no_response`
 * setelah menunggu. Sebelumnya batas ini hanya ada sebagai satu kalimat di
 * dalam modal Arahkan, jadi operator baru tahu setelah membuka modal itu.
 */
export const ZA_MIN = 30;
export const ZA_MAKS = 150;

const W = 300;
// Tinggi viewBox harus memuat elemen TERBAWAH beserta descender-nya, bukan
// cuma baseline-nya: label tik "180" ber-baseline di y=146 (titikZenit(180,
// ZR+15).y + 3), jadi pada H=148 huruf-hurufnya menjulur ~1px keluar kotak SVG
// dan menempel ke label HTML di bawahnya.
const H = 154;

const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
const FONT_DISPLAY = "var(--font-barlow-sc), var(--font-geist-sans), sans-serif";

/** Kompas: pusat kiri, jarum menunjuk bearing HA. */
const CX = 74;
const CY = 74;
const R = 54;

/** Busur zenit: setengah lingkaran di kanan, 0° di atas → 180° di bawah. */
const ZX = 214;
const ZY = 74;
const ZR = 54;

/**
 * Bulatkan koordinat hasil trigonometri ke 3 desimal.
 *
 * WAJIB: tanpa ini Math.cos/sin menghasilkan double yang serialisasinya bisa
 * berbeda di digit terakhir antara render server dan klien
 * (30.698729810778083 vs …076), dan React melaporkannya sebagai hydration
 * mismatch pada seluruh SVG. Tiga desimal jauh melampaui presisi yang terlihat
 * pada gambar seukuran ini.
 */
const b = (n: number) => Number(n.toFixed(3));

function titikZenit(za: number, r: number) {
  // 0° zenit = lurus ke atas, 180° = lurus ke bawah. Busurnya digambar di
  // sisi kanan, jadi sudut layar = za diukur dari atas, searah jarum jam.
  const rad = ((za - 90) * Math.PI) / 180;
  return { x: b(ZX + Math.cos(rad) * r), y: b(ZY + Math.sin(rad) * r) };
}

function busurZenit(dari: number, ke: number, r: number) {
  // Nama `awal`/`akhir`, bukan a/b: `b` di sini akan menutupi helper pembulatan
  // bernama sama di atas — bekerja hari ini karena fungsinya tidak memakainya,
  // tapi bom waktu untuk perubahan berikutnya.
  const awal = titikZenit(dari, r);
  const akhir = titikZenit(ke, r);
  const besar = Math.abs(ke - dari) > 180 ? 1 : 0;
  return `M ${awal.x} ${awal.y} A ${r} ${r} 0 ${besar} 1 ${akhir.x} ${akhir.y}`;
}

/**
 * Sikap teleskop: ke mana ia menghadap sekarang.
 *
 * Sebuah total station pada dasarnya didefinisikan oleh arah bidiknya, tapi
 * sebelumnya HA dan VA cuma dua dari lima kartu seragam yang menampilkan string
 * "000,00,00" — angkanya ada, arahnya tidak terbaca sama sekali. Di sini
 * keduanya digambar sebagai instrumen: kompas untuk HA, busur zenit untuk VA,
 * lengkap dengan pita rentang kerja teropong.
 *
 * Warna status TIDAK dipakai untuk pita rentang kerja — itu bukan status
 * pengukuran. Warna status hanya muncul bila VA benar-benar keluar dari batas,
 * dan selalu disertai teks.
 */
export function AttitudeDial({
  ha,
  va,
  /** Data telemetri sudah kedaluwarsa — angkanya ditampilkan tapi diredupkan. */
  basi = false,
}: {
  ha: unknown;
  va: unknown;
  basi?: boolean;
}) {
  const haDeg = parseDms(ha);
  const vaDeg = parseDms(va);

  // Kedua sudut nol bersamaan adalah penanda "instrumen tidak menjawab" pada
  // protokol ini, bukan arah nol yang sah — lihat catatan pada balasan
  // ManualHAVA. Menggambarnya sebagai jarum di 0° akan berbohong.
  const takMenjawab = haDeg === 0 && vaDeg === 0;
  const adaData = haDeg !== null && vaDeg !== null && !takMenjawab;

  const diLuarBatas = adaData && vaDeg !== null && (vaDeg < ZA_MIN || vaDeg > ZA_MAKS);
  const jarumHa = ((haDeg ?? 0) - 90) * (Math.PI / 180);
  const ujungHa = {
    x: b(CX + Math.cos(jarumHa) * (R - 9)),
    y: b(CY + Math.sin(jarumHa) * (R - 9)),
  };
  const penunjukZa = titikZenit(vaDeg ?? 90, ZR);

  const kardinal: [string, number][] = [
    ["U", 0],
    ["T", 90],
    ["S", 180],
    ["B", 270],
  ];

  return (
    // Lebarnya DIBATASI, bukan mengikuti lebar panel. SVG dengan `w-full`
    // tingginya ikut menskala: di layar 1920 panel ini ~500px, dial jadi ~256px
    // tinggi (vs ~157px di 1366) dan memaksa dua kartu di sebelahnya meregang
    // mengikuti — persis rongga kosong yang terlihat di sana. Pada 340px
    // gambarnya sudah terbaca jelas; lebih besar tidak menambah informasi.
    <div
      className={cn(
        "mx-auto w-full max-w-[340px]",
        basi ? "opacity-55 transition-opacity" : "transition-opacity"
      )}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          adaData
            ? `Teleskop menghadap azimut ${fmtDms(ha)}, sudut zenit ${fmtDms(va)}`
            : "Sudut teleskop belum terbaca"
        }
      >
        {/* ── Kompas (HA) ── */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line)" strokeWidth={1} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const panjang = i % 3 === 0 ? 7 : 4;
          return (
            <line
              key={i}
              x1={b(CX + Math.cos(a) * (R - panjang))}
              y1={b(CY + Math.sin(a) * (R - panjang))}
              x2={b(CX + Math.cos(a) * R)}
              y2={b(CY + Math.sin(a) * R)}
              stroke="var(--ink-3)"
              strokeOpacity={i % 3 === 0 ? 0.75 : 0.35}
              strokeWidth={1}
            />
          );
        })}
        {kardinal.map(([huruf, deg]) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return (
            <text
              key={huruf}
              x={b(CX + Math.cos(a) * (R + 11))}
              y={b(CY + Math.sin(a) * (R + 11) + 3.5)}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fontFamily={FONT_DISPLAY}
              fill="var(--ink-3)"
            >
              {huruf}
            </text>
          );
        })}

        {adaData ? (
          <>
            <line
              x1={CX}
              y1={CY}
              x2={ujungHa.x}
              y2={ujungHa.y}
              stroke="var(--navy)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx={ujungHa.x} cy={ujungHa.y} r={3.5} fill="var(--navy)" />
          </>
        ) : (
          <line
            x1={CX - 8}
            y1={CY}
            x2={CX + 8}
            y2={CY}
            stroke="var(--ink-3)"
            strokeWidth={1.5}
          />
        )}
        <circle cx={CX} cy={CY} r={2.5} fill="var(--ink-2)" />

        {/* ── Busur zenit (VA) ── */}
        {/* Pita rentang kerja: warna tinta, bukan warna status — ini batas
            kemampuan alat, bukan penilaian atas hasil ukur. */}
        <path
          d={busurZenit(0, 180, ZR)}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
        <path
          d={busurZenit(ZA_MIN, ZA_MAKS, ZR)}
          fill="none"
          stroke="var(--navy)"
          strokeOpacity={0.28}
          strokeWidth={7}
          strokeLinecap="butt"
        />
        {[0, ZA_MIN, 90, ZA_MAKS, 180].map((za) => {
          const luar = titikZenit(za, ZR + 4);
          const dalam = titikZenit(za, ZR - 4);
          const label = titikZenit(za, ZR + 15);
          const batas = za === ZA_MIN || za === ZA_MAKS;
          return (
            <g key={za}>
              <line
                x1={dalam.x}
                y1={dalam.y}
                x2={luar.x}
                y2={luar.y}
                stroke="var(--ink-3)"
                strokeOpacity={batas ? 0.85 : 0.4}
                strokeWidth={1}
              />
              <text
                x={label.x}
                y={label.y + 3}
                textAnchor="middle"
                fontSize={8.5}
                fontFamily={FONT_MONO}
                fill="var(--ink-3)"
              >
                {za}
              </text>
            </g>
          );
        })}

        {adaData && (
          <>
            <line
              x1={ZX}
              y1={ZY}
              x2={penunjukZa.x}
              y2={penunjukZa.y}
              stroke={diLuarBatas ? "var(--st-awas)" : "var(--navy)"}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle
              cx={penunjukZa.x}
              cy={penunjukZa.y}
              r={3.5}
              fill={diLuarBatas ? "var(--st-awas)" : "var(--navy)"}
            />
          </>
        )}
        <circle cx={ZX} cy={ZY} r={2.5} fill="var(--ink-2)" />
      </svg>

      {/* Nama instrumen ada DI SINI, bukan di dalam SVG: di sana ia bertabrakan
          dengan label mata angin "S" (y≈139) dan label tik "180" (y≈146) yang
          sudah menempati baris paling bawah gambar. Sebagai teks HTML ia juga
          bisa dibungkus tanpa perhitungan koordinat. */}
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4">
        <div className="text-center">
          <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">
            HA · azimut
          </dt>
          <dd className="mt-0.5 font-mono text-[13.5px] tabular-nums text-(--ink)">
            {takMenjawab ? "—" : fmtDms(ha)}
          </dd>
        </div>
        <div className="text-center">
          <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">
            VA · zenit
          </dt>
          <dd className="mt-0.5 font-mono text-[13.5px] tabular-nums text-(--ink)">
            {takMenjawab ? "—" : fmtDms(va)}
          </dd>
        </div>
      </dl>

      {takMenjawab && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-3)">
          Kedua sudut terbaca nol — pada protokol ini itu penanda instrumen tidak menjawab,
          bukan arah nol yang sah.
        </p>
      )}

      {diLuarBatas && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-(--ink-2)">
          <span
            aria-hidden="true"
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ background: "var(--st-awas)" }}
          />
          <span>
            Sudut zenit di luar {ZA_MIN}°–{ZA_MAKS}°. Perintah rotasi akan ditolak tanpa
            pesan — jejaknya hanya <span className="font-mono">Rotate</span> gagal setelah
            menunggu.
          </span>
        </p>
      )}
    </div>
  );
}
