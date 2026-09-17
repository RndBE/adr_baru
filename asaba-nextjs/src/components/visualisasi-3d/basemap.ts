/**
 * Ortofoto sebagai lantai scene Visualisasi 3D.
 *
 * ── Kenapa mesh3d, bukan gambar ──────────────────────────────────────────────
 *
 * Plotly tidak bisa menempelkan tekstur pada scene 3D: `layout.images` hanya
 * berlaku untuk subplot 2D, dan `surface` mewarnai lewat `surfacecolor` yang
 * nilainya DIINTERPOLASI antar titik grid sebelum dipetakan ke colorscale.
 * Kalau nilai itu indeks palet, interpolasinya menyapu seluruh palet di setiap
 * batas warna — perbatasan air gelap dan jalan terang berubah jadi pelangi.
 *
 * Jadi ortofotonya dijadikan jaring segitiga dengan satu warna per titik
 * (`vertexcolor`). Jaringnya ITU teksturnya. Warna antar titik tetap
 * diinterpolasi, tapi sebagai RGB — hasilnya buram di tepi, bukan salah warna.
 *
 * `vertexcolor` diisi triplet angka `[r,g,b]` 0–255, bukan string "rgb(…)".
 * Plotly meneruskannya ke color-normalize, yang mengenali array bilangan bulat
 * dan melewati seluruh parser warna berbasis teks — untuk ratusan ribu titik,
 * itu bedanya antara satu kedipan dan beberapa detik.
 *
 * ── Kenapa topeng nodata ─────────────────────────────────────────────────────
 *
 * Ortofoto drone berbentuk poligon tak beraturan di dalam bingkai persegi.
 * Segitiga hanya dibuat kalau ketiga titiknya bergambar, sehingga base map
 * mengikuti bentuk aslinya dan tidak jadi lempeng yang menutupi apa pun di
 * baliknya saat kamera dimiringkan.
 */

/** Kotak batas ortofoto dalam meter UTM. Sama isinya dengan SiteBasemap. */
export interface KotakUtm {
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
}

/** Hasil pembacaan citra: nx*ny sel, RGBA berurutan baris demi baris. */
export interface PetakCitra {
  nx: number;
  ny: number;
  /** Panjang nx*ny*4. */
  rgba: Uint8ClampedArray;
  /** Panjang nx*ny; 0 = sel kosong (tepi ortofoto). Null = semuanya bergambar. */
  topeng: Uint8Array | null;
}

export interface JaringBasemap {
  x: number[];
  y: number[];
  z: number[];
  i: number[];
  j: number[];
  k: number[];
  vertexcolor: [number, number, number][];
}

/**
 * Ukuran petak yang menutupi `kotak` dengan sel mendekati bujur sangkar.
 *
 * `kerapatan` adalah jumlah sel pada SISI TERPANJANG; sisi pendeknya mengikuti
 * rasio kotak. Dipisah begini supaya satu angka di UI berarti hal yang sama
 * untuk ortofoto memanjang maupun yang hampir persegi.
 */
export function ukuranPetak(kotak: KotakUtm, kerapatan: number) {
  const lebar = Math.abs(kotak.maxE - kotak.minE);
  const tinggi = Math.abs(kotak.maxN - kotak.minN);
  const n = Math.max(2, Math.round(kerapatan));
  if (lebar <= 0 || tinggi <= 0) return { nx: n, ny: n };
  return lebar >= tinggi
    ? { nx: n, ny: Math.max(2, Math.round((n * tinggi) / lebar)) }
    : { nx: Math.max(2, Math.round((n * lebar) / tinggi)), ny: n };
}

/**
 * Susun jaring segitiga dari petak citra.
 *
 * Titik jaring duduk di TENGAH selnya, bukan di tepi kotak: warna tiap sel
 * adalah rata-rata piksel di dalamnya, dan menaruh rata-rata itu di tengahnya
 * adalah satu-satunya penempatan yang jujur. Akibatnya jaring menyisakan
 * setengah sel di keempat sisi — pada kerapatan yang dipakai halaman ini
 * beberapa meter, jauh lebih kecil daripada selnya sendiri.
 *
 * Titik yang tidak terpakai segitiga mana pun TIDAK ikut dikirim. Bukan demi
 * hemat memori saja: gl-mesh3d menghitung batas scene dari seluruh titik, jadi
 * titik kosong di pojok akan memaksa scene selebar bingkai penuh ortofoto
 * walaupun bagian itu tidak tergambar.
 */
export function bangunJaring(petak: PetakCitra, kotak: KotakUtm, z: number): JaringBasemap {
  const { nx, ny, rgba, topeng } = petak;
  const lebar = kotak.maxE - kotak.minE;
  const tinggi = kotak.maxN - kotak.minN;

  const x: number[] = [];
  const y: number[] = [];
  const zz: number[] = [];
  const vertexcolor: [number, number, number][] = [];
  const iArr: number[] = [];
  const jArr: number[] = [];
  const kArr: number[] = [];

  // -1 = titik ini belum pernah dipakai segitiga.
  const indeks = new Int32Array(nx * ny).fill(-1);

  const bergambar = (sel: number) => (topeng ? topeng[sel] !== 0 : true);

  const titik = (col: number, row: number): number => {
    const sel = row * nx + col;
    const sudah = indeks[sel];
    if (sudah !== -1) return sudah;
    const baru = x.length;
    indeks[sel] = baru;
    // Baris 0 citra = tepi UTARA ortofoto, jadi N menurun seiring row.
    x.push(kotak.minE + (lebar * (col + 0.5)) / nx);
    y.push(kotak.maxN - (tinggi * (row + 0.5)) / ny);
    zz.push(z);
    const p = sel * 4;
    vertexcolor.push([rgba[p], rgba[p + 1], rgba[p + 2]]);
    return baru;
  };

  const segitiga = (a: [number, number], b: [number, number], c: [number, number]) => {
    if (!bergambar(a[1] * nx + a[0])) return;
    if (!bergambar(b[1] * nx + b[0])) return;
    if (!bergambar(c[1] * nx + c[0])) return;
    iArr.push(titik(a[0], a[1]));
    jArr.push(titik(b[0], b[1]));
    kArr.push(titik(c[0], c[1]));
  };

  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      segitiga([col, row], [col + 1, row], [col, row + 1]);
      segitiga([col + 1, row], [col + 1, row + 1], [col, row + 1]);
    }
  }

  return { x, y, z: zz, i: iArr, j: jArr, k: kArr, vertexcolor };
}

/** Trace Plotly untuk jaring yang sudah jadi. */
export function traceBasemap(jaring: JaringBasemap, opasitas: number) {
  return {
    type: "mesh3d",
    name: "Base map",
    x: jaring.x,
    y: jaring.y,
    z: jaring.z,
    i: jaring.i,
    j: jaring.j,
    k: jaring.k,
    vertexcolor: jaring.vertexcolor,
    opacity: opasitas,
    // Pencahayaan dimatikan: ini foto, bukan permukaan. Dengan diffuse/specular
    // menyala, warna tanah yang sama tampil berbeda tergantung sudut kamera —
    // dan bidangnya datar, jadi bayangannya pun tidak mengandung informasi.
    lighting: { ambient: 1, diffuse: 0, specular: 0, roughness: 1, fresnel: 0 },
    flatshading: true,
    // Hover DIMATIKAN. Lantai ini menutupi hampir seluruh bidang pandang; kalau
    // ikut menangkap hover, tooltip prisma nyaris tidak pernah bisa muncul.
    hoverinfo: "skip",
    showlegend: true,
  } as Record<string, unknown>;
}

// ─── Bagian yang menyentuh DOM ──────────────────────────────────────────────

function muatCitra(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gambar tidak bisa dimuat: ${url}`));
    img.src = url;
  });
}

function kePetak(img: HTMLImageElement, nx: number, ny: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = nx;
  c.height = ny;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  // Penghalusan SENGAJA dinyalakan: mengecilkan lewat drawImage berarti tiap sel
  // jadi rata-rata piksel di bawahnya. Mencuplik satu piksel per sel akan
  // membuat jalan selebar satu meter kadang muncul kadang hilang tergantung
  // kerapatan yang dipilih.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, nx, ny);
  return ctx.getImageData(0, 0, nx, ny).data;
}

/**
 * Muat ortofoto (dan topengnya) lalu ubah jadi jaring siap gambar.
 *
 * Topeng boleh gagal dimuat tanpa menggagalkan base map-nya: ortofoto tanpa
 * topeng tetap berguna, cuma bingkainya ikut tergambar.
 */
export async function muatJaringBasemap(
  sumber: { url: string; nodataUrl: string | null } & KotakUtm,
  kerapatan: number,
  z: number
): Promise<JaringBasemap> {
  const { nx, ny } = ukuranPetak(sumber, kerapatan);
  const img = await muatCitra(sumber.url);
  const rgba = kePetak(img, nx, ny);

  let topeng: Uint8Array | null = null;
  if (sumber.nodataUrl) {
    try {
      const m = kePetak(await muatCitra(sumber.nodataUrl), nx, ny);
      topeng = new Uint8Array(nx * ny);
      // Topeng 1-bit ikut terhaluskan saat dikecilkan, jadi tepinya bernilai
      // antara. Ambang di tengah berarti "sel ini lebih banyak bergambar
      // daripada kosong" — pergeseran tepinya paling jauh setengah sel.
      for (let s = 0; s < topeng.length; s++) topeng[s] = m[s * 4] >= 128 ? 1 : 0;
    } catch {
      topeng = null;
    }
  }

  return bangunJaring({ nx, ny, rgba, topeng }, sumber, z);
}
