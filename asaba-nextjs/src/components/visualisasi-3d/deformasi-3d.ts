import { fontSans } from "@/lib/fonts";
import type { PayloadDeformasi, PlotlyGlobal, Titik } from "./types";

/**
 * Pembacaan angka dan penyusunan scene Plotly.
 *
 * Seluruh fungsi di berkas ini dipindahkan APA ADANYA dari berkas halaman —
 * logikanya port 1:1 dari deformasi.php dan sudah terbukti di lapangan. Yang
 * berubah hanya tipenya (dulu `any`) dan tempatnya, supaya berkas halaman
 * tinggal berisi tata letak dan keadaan UI.
 */

export function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const n = Number(s.replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function isZeroish(a: number) {
  return Number.isFinite(a) && Math.abs(a) < 1e-12;
}

function isTripletAllZero(a: number, b: number, c: number) {
  return isZeroish(a) && isZeroish(b) && isZeroish(c);
}

export function finiteArr(a: number[]) {
  return a.filter(Number.isFinite);
}

/**
 * Koordinat RTS dari payload.
 *
 * Bentuk `{E,N,Z}` didahulukan. Bentuk lama `{x,y}` PERLU diperhatikan: di sana
 * x adalah northing dan y easting — kebalikan dari dugaan — jadi urutannya
 * ditukar saat dibaca.
 */
export function getRTSFromPayload(p: PayloadDeformasi | null | undefined) {
  const r = p?.posisi_rts ?? null;
  if (!r) return null;
  const E = toNum(r.E);
  const N = toNum(r.N);
  const Z = Number.isFinite(toNum(r.Z)) ? toNum(r.Z) : 0;
  if (Number.isFinite(E) && Number.isFinite(N)) return { e: E, n: N, z: Z };
  const n = toNum(r.x),
    e = toNum(r.y);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
  return { e, n, z: 0 };
}

export function extractPoints(p: PayloadDeformasi | null | undefined): Titik[] {
  const arr = p?.data_pengukuran ?? [];
  const out: Titik[] = [];
  for (const row of arr) {
    const t = (row?.temp_tembak ?? row) as Record<string, unknown> | undefined;
    if (!t) continue;
    const id = String(row.id_prisma ?? row.nama_prisma ?? "");
    const name = String(row.nama_prisma ?? t.nama_prisma ?? "");

    const e0 = toNum(t.E0),
      n0 = toNum(t.N0),
      z0 = toNum(t.Z0);
    if (![e0, n0, z0].every(Number.isFinite)) continue;

    let e1 = toNum(t.E1),
      n1 = toNum(t.N1),
      z1 = toNum(t.Z1);
    const has1 = [e1, n1, z1].every(Number.isFinite) && !isTripletAllZero(e1, n1, z1);

    let de = toNum(t.DE),
      dn = toNum(t.DN),
      dz = toNum(t.DZ);
    if (has1) {
      if (!Number.isFinite(de)) de = e1 - e0;
      if (!Number.isFinite(dn)) dn = n1 - n0;
      if (!Number.isFinite(dz)) dz = z1 - z0;
    } else {
      e1 = NaN;
      n1 = NaN;
      z1 = NaN;
      de = NaN;
      dn = NaN;
      dz = NaN;
    }

    let lin = toNum(t.linear);
    if (has1 && !Number.isFinite(lin)) lin = Math.sqrt(de * de + dn * dn + dz * dz);
    else if (!has1) lin = NaN;

    const dirText = t.arah_pergeseran ? String(t.arah_pergeseran) : "";
    out.push({ id, name, e0, n0, z0, e1, n1, z1, de, dn, dz, lin, dirText, ok: has1 });
  }
  return out;
}

export interface OpsiRender {
  E: number;
  N: number;
  Z: number;
  /** Pengali panjang kerucut vektor. */
  scale: number;
  /** Prisma dengan resultan di bawah ini tidak digambar sebagai pergeseran. */
  minLin: number;
  /**
   * Trace ortofoto yang sudah jadi, dari components/visualisasi-3d/basemap.ts.
   *
   * Dioper sebagai trace matang, bukan sebagai berkas atau kotak batas: menyusunnya
   * perlu memuat gambar dan membaca canvas — dua hal yang asinkron dan hanya ada di
   * browser — sementara berkas ini murni dan dipakai juga oleh skrip uji.
   */
  basemap?: Record<string, unknown> | null;
  /**
   * Pengali sumbu Z terhadap skala sebenarnya. 1 = apa adanya.
   *
   * Diperlukan sejak lantainya jadi relief: beda tinggi seluruh site cuma 32 m
   * di atas bentangan 2,5 km, jadi pada skala sebenarnya tanahnya terlihat rata
   * dan reliefnya tidak menyampaikan apa pun.
   *
   * Yang diregangkan SELURUH sumbu Z — tanah, prisma, dan vektor pergeseran
   * sekaligus — bukan reliefnya saja. Meregangkan tanahnya saja akan membuat
   * prisma tampak melayang atau terkubur di lereng yang sebenarnya ia duduki.
   */
  lebihTinggi?: number;
}

/**
 * Gambar scene 3D ke elemen yang diberikan.
 *
 * Susunan trace, mawar arah di tengah, dan konfigurasi layout dipertahankan
 * persis seperti versi sebelumnya. Rasio sumbunya kini `aspectmode: "manual"`
 * dengan `aspectratio` yang dihitung dari bentangan data — pada
 * `lebihTinggi = 1` hasilnya sama persis dengan `"data"` yang dipakai dulu,
 * yang menjaga skala ketiga sumbu tetap sebanding; tanpa itu pergeseran
 * milimeter akan terlihat sebesar jarak antar prisma.
 */
export function gambarScene(
  Plotly: PlotlyGlobal,
  el: HTMLElement,
  points: Titik[],
  opsi: OpsiRender
) {
  const { E, N, Z, scale, minLin } = opsi;

  const baseline = points;
  const moved = points.filter((p) => p.ok && Number.isFinite(p.lin) && p.lin >= minLin);

  const x0 = baseline.map((p) => p.e0);
  const y0 = baseline.map((p) => p.n0);
  const z0 = baseline.map((p) => p.z0);

  const x1 = moved.map((p) => p.e1);
  const y1 = moved.map((p) => p.n1);
  const z1 = moved.map((p) => p.z1);

  const u = moved.map((p) => p.de);
  const v = moved.map((p) => p.dn);
  const w = moved.map((p) => p.dz);
  const lin = moved.map((p) => p.lin);
  const maxLin = Math.max(...finiteArr(lin), 0);

  const lineX: (number | null)[] = [],
    lineY: (number | null)[] = [],
    lineZ: (number | null)[] = [];
  for (const p of moved) {
    lineX.push(p.e0, p.e1, null);
    lineY.push(p.n0, p.n1, null);
    lineZ.push(p.z0, p.z1, null);
  }

  const hover0 = baseline.map(
    (p) =>
      `${p.name}<br>E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>${p.ok ? "Status=OK" : "Status=GAGAL"}`
  );
  const hover1 = moved.map(
    (p) =>
      `${p.name}<br>` +
      `E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>` +
      `E1=${p.e1.toFixed(4)} N1=${p.n1.toFixed(4)} Z1=${p.z1.toFixed(4)}<br>` +
      `DE=${p.de.toFixed(6)} DN=${p.dn.toFixed(6)} DZ=${p.dz.toFixed(6)}<br>` +
      `Linear=${p.lin.toFixed(6)}${p.dirText ? `<br>Arah=${p.dirText}` : ""}`
  );

  const traces: Record<string, unknown>[] = [
    {
      type: "scatter3d",
      mode: "markers",
      name: "Acuan R0",
      x: x0,
      y: y0,
      z: z0,
      marker: { size: 4, color: "rgba(15,23,42,.55)" },
      text: hover0,
      hoverinfo: "text",
    },
  ];

  if (moved.length > 0) {
    traces.push(
      {
        type: "scatter3d",
        mode: "lines",
        name: "Pergeseran",
        x: lineX,
        y: lineY,
        z: lineZ,
        line: { width: 3 },
        opacity: 0.75,
        hoverinfo: "skip",
      },
      {
        type: "scatter3d",
        mode: "markers",
        name: "Posisi sesi ini",
        x: x1,
        y: y1,
        z: z1,
        marker: {
          size: 6,
          color: lin,
          colorscale: "Turbo",
          colorbar: { title: "Resultan (m)" },
        },
        text: hover1,
        hoverinfo: "text",
      },
      {
        type: "cone",
        name: "Arah",
        x: moved.map((p) => p.e0),
        y: moved.map((p) => p.n0),
        z: moved.map((p) => p.z0),
        u,
        v,
        w,
        anchor: "tail",
        sizemode: "absolute",
        sizeref: Math.max(maxLin * scale, 0.01),
        showscale: false,
        opacity: 0.85,
        hoverinfo: "skip",
      }
    );
  }

  traces.push({
    type: "scatter3d",
    mode: "markers+text",
    name: "RTS",
    x: [E],
    y: [N],
    z: [Z],
    marker: { size: 9, symbol: "diamond", color: "rgba(239,68,68,.95)" },
    text: ["RTS"],
    textposition: "top center",
    hoverinfo: "skip",
  });

  // Base map ikut menentukan batas scene, jadi ia harus ikut diukur di sini —
  // kalau tidak, rasio sumbunya dihitung dari awan prisma saja dan lantainya
  // tergencet begitu ortofotonya jauh lebih luas daripada jaring prismanya.
  const bmX = (opsi.basemap?.x as number[] | undefined) ?? [];
  const bmY = (opsi.basemap?.y as number[] | undefined) ?? [];
  const bmZ = (opsi.basemap?.z as number[] | undefined) ?? [];

  const allX = finiteArr(x0.concat(x1)),
    allY = finiteArr(y0.concat(y1)),
    allZ = finiteArr(z0.concat(z1));
  const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
  const cy = (Math.min(...allY) + Math.max(...allY)) / 2;
  const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
  const diag = Math.sqrt(
    (Math.max(...allX) - Math.min(...allX)) ** 2 +
      (Math.max(...allY) - Math.min(...allY)) ** 2 +
      (Math.max(...allZ) - Math.min(...allZ)) ** 2
  );
  const L = Math.max(diag * 0.1, 1.0);

  for (const [dx, dy, col] of [
    [0, L, "#B30000"],
    [L, 0, "#000"],
    [0, -L, "#000"],
    [-L, 0, "#000"],
  ] as [number, number, string][]) {
    traces.push({
      type: "scatter3d",
      mode: "lines",
      showlegend: false,
      x: [cx, cx + dx],
      y: [cy, cy + dy],
      z: [cz, cz],
      line: { width: 5, color: col },
      hoverinfo: "skip",
    });
  }
  traces.push({
    type: "scatter3d",
    mode: "text",
    showlegend: false,
    x: [cx + L * 1.12, cx, cx - L * 1.12, cx],
    y: [cy, cy + L * 1.12, cy, cy - L * 1.12],
    z: [cz, cz, cz, cz],
    text: ["E", "N", "W", "S"],
    textfont: { size: 16, color: "#0f172a", family: fontSans.style.fontFamily },
    hoverinfo: "skip",
  });

  // Ditambahkan PALING AKHIR supaya urutan legendanya wajar (lantai disebut
  // setelah isinya). Kedalaman gambarnya diurus depth buffer WebGL, bukan
  // urutan trace, jadi menaruhnya di belakang tidak membuatnya menimpa prisma.
  if (opsi.basemap) traces.push(opsi.basemap);

  /**
   * Jangkauan tiap sumbu DITENTUKAN SENDIRI, tidak diserahkan ke Plotly.
   *
   * `aspectratio` cuma mengatur bentuk kotaknya; jangkauan sumbunya dihitung
   * Plotly dari seluruh data — termasuk kerucut pergeseran, yang `sizeref`-nya
   * ikut membesar bersama pergeseran terbesar. Satu prisma dengan pergeseran
   * palsu 190 m karena itu meregangkan sumbu Z sampai 150 m, padahal tanahnya
   * cuma 29 m. Reliefnya lalu tinggal seperlima tinggi kotak, dan pengali
   * "Tinggi ×" kehilangan artinya tanpa satu pun tanda di layar.
   *
   * Dengan jangkauan yang dipatok, rasio kotak dan isinya bicara tentang angka
   * yang sama: pengali 5 benar-benar berarti lima kali.
   */
  const batas = (a: number[], b: number[]) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (const v of b) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!Number.isFinite(lo) || !(hi > lo)) return { lo: 0, hi: 1, d: 1 };
    // Sedikit kelonggaran supaya titik terluar dan mawar arah tidak terpotong
    // tepat di tepi kotak.
    const pad = (hi - lo) * 0.03;
    return { lo: lo - pad, hi: hi + pad, d: hi - lo + 2 * pad };
  };
  const kZ = Number.isFinite(opsi.lebihTinggi) && (opsi.lebihTinggi as number) > 0
    ? (opsi.lebihTinggi as number) : 1;
  const bx = batas(allX, bmX);
  const by = batas(allY, bmY);
  const bz = batas(allZ, bmZ);
  const dx = bx.d;
  const dy = by.d;
  const dz = bz.d * kZ;
  const terbesar = Math.max(dx, dy, dz);

  Plotly.newPlot(
    el,
    traces,
    {
      // Plotly mengukur teks sendiri, jadi nama family harus berupa string —
      // bukan var(--font-sans). Judul, sumbu, dan legenda mewarisi dari sini,
      // makanya masing-masing hanya perlu menyebut ukuran dan warna.
      // Tanpa ini Plotly memakai default-nya sendiri (Open Sans).
      font: { family: fontSans.style.fontFamily, color: "#0f172a" },
      // Judul DIHAPUS dari dalam plot: tanggalnya sekarang ada di bar melayang
      // di atas panggung, dan judul di dalam kanvas cuma memakan tinggi yang
      // seharusnya jadi ruang gambar.
      paper_bgcolor: "rgba(255,255,255,1)",
      plot_bgcolor: "rgba(255,255,255,1)",
      scene: {
        xaxis: {
          title: "Easting (E)",
          range: [bx.lo, bx.hi],
          titlefont: { color: "#0f172a" },
          tickfont: { color: "#0f172a" },
        },
        yaxis: {
          title: "Northing (N/Y)",
          range: [by.lo, by.hi],
          titlefont: { color: "#0f172a" },
          tickfont: { color: "#0f172a" },
        },
        zaxis: {
          title: "Elevation (Z)",
          range: [bz.lo, bz.hi],
          titlefont: { color: "#0f172a" },
          tickfont: { color: "#0f172a" },
        },
        // "manual", bukan "data": hanya bentuk ini yang menerima pengali Z.
        // Pada lebihTinggi = 1 rasionya persis sebanding dengan bentangan
        // sebenarnya, jadi perilakunya sama dengan "data" seperti sebelumnya.
        aspectmode: "manual",
        aspectratio: { x: dx / terbesar, y: dy / terbesar, z: dz / terbesar },
        bgcolor: "rgba(255,255,255,1)",
      },
      // Margin bawah HARUS disisakan untuk legenda mendatar: dengan b:0 baris
      // legendanya terpotong tepi kanvas. Kanan disisakan untuk colorbar.
      margin: { l: 0, r: 12, t: 8, b: 34 },
      legend: {
        orientation: "h",
        font: { color: "#0f172a", size: 11 },
        y: 0,
        yanchor: "top",
        x: 0.5,
        xanchor: "center",
      },
    },
    { responsive: true, displayModeBar: false }
  );

  Plotly.Plots.resize(el);
}
