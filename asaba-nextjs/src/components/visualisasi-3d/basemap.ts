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
 *
 * ── Relief ──────────────────────────────────────────────────────────────────
 *
 * Kalau site punya DEM, tinggi tiap titik jaring diambil dari sana, bukan dari
 * satu angka datar. Sumbernya kontur survei yang sudah diraster
 * (tools/dxf/kontur-ke-dem.py) dan dilayani sebagai PNG abu-abu + alfa.
 *
 * Titik yang DEM-nya tidak berdata tidak dipakai segitiga mana pun — sama
 * perlakuannya dengan tepi kosong ortofoto. Ortofoto BPP 1-4 memang lebih luas
 * daripada surveinya, dan menambal bagian itu dengan tinggi karangan berarti
 * menggambar lereng yang tidak ada.
 */

/** Kotak batas ortofoto dalam meter UTM. Sama isinya dengan SiteBasemap. */
export interface KotakUtm {
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
}

/**
 * DEM yang sudah dibaca dari PNG-nya.
 *
 * `nilai` adalah angka abu mentah 0-255; meternya baru muncul setelah
 * dipetakan ke minZ..maxZ. Disimpan mentah supaya pemetaannya terjadi di satu
 * tempat saja — sampelDem() — dan tidak bisa berbeda antar pemanggil.
 */
export interface PetakDem {
  nx: number;
  ny: number;
  /** Panjang nx*ny, nilai abu 0-255. */
  nilai: Uint8ClampedArray;
  /** Panjang nx*ny; 0 = sel tanpa data tinggi. */
  ada: Uint8Array;
  minZ: number;
  maxZ: number;
  /** Kotak yang ditutupi raster ini. Biasanya sama dengan kotak ortofoto. */
  kotak: KotakUtm;
}

/**
 * Tinggi di satu titik UTM, meter. Null bila titik itu di luar raster atau
 * salah satu dari empat sel tetangganya tidak berdata.
 *
 * Interpolasinya bilinier dan dikerjakan SENDIRI, bukan diserahkan ke
 * penghalusan canvas: canvas akan ikut mencampur sel nodata dengan sel berdata
 * di tepi survei, dan hasilnya lereng palsu yang menjulur ke wilayah yang
 * justru tidak disurvei. Menolak seluruh sampel yang menyentuh nodata membuat
 * tepi itu terpotong tegas.
 */
export function sampelDem(dem: PetakDem, E: number, N: number): number | null {
  const { nx, ny, kotak } = dem;
  const lebar = kotak.maxE - kotak.minE;
  const tinggi = kotak.maxN - kotak.minN;
  if (!(lebar > 0) || !(tinggi > 0)) return null;

  // Titik tengah sel (i,j) ada di (i+0,5)/nx — konvensi yang sama dengan
  // bangunJaring(), supaya keduanya tidak bergeser setengah sel satu sama lain.
  const fx = ((E - kotak.minE) / lebar) * nx - 0.5;
  const fy = ((kotak.maxN - N) / tinggi) * ny - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= nx || y0 + 1 >= ny) return null;

  const idx = [y0 * nx + x0, y0 * nx + x0 + 1, (y0 + 1) * nx + x0, (y0 + 1) * nx + x0 + 1];
  for (const i of idx) if (dem.ada[i] === 0) return null;

  const tx = fx - x0;
  const ty = fy - y0;
  const v =
    dem.nilai[idx[0]] * (1 - tx) * (1 - ty) +
    dem.nilai[idx[1]] * tx * (1 - ty) +
    dem.nilai[idx[2]] * (1 - tx) * ty +
    dem.nilai[idx[3]] * tx * ty;
  return dem.minZ + (v / 255) * (dem.maxZ - dem.minZ);
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
  /**
   * Pergeseran tegak yang SEDANG diterapkan pada `z`, meter.
   *
   * Ada supaya menaikkan lantai tidak perlu menyusun ulang jaringnya — dan,
   * yang jauh lebih penting, supaya tidak ada yang tergoda menimpa `z` dengan
   * satu angka. Itu persis yang dilakukan versi pertama halaman ini
   * (`jaring.z.fill(...)`), yang meratakan seluruh relief setiap kali digambar
   * sementara jaringnya sendiri sudah benar.
   */
  geser: number;
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
export function bangunJaring(
  petak: PetakCitra,
  kotak: KotakUtm,
  z: number,
  dem?: PetakDem | null
): JaringBasemap {
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

  // Tinggi tiap sel dihitung SEKALI di muka, bukan di dalam titik(): sel yang
  // DEM-nya kosong harus menggugurkan segitiganya, dan itu perlu diketahui
  // sebelum titiknya dibuat.
  const tinggiSel = new Float64Array(nx * ny);
  const punyaTinggi = new Uint8Array(nx * ny);
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const sel = row * nx + col;
      if (!dem) {
        tinggiSel[sel] = z;
        punyaTinggi[sel] = 1;
        continue;
      }
      const E = kotak.minE + (lebar * (col + 0.5)) / nx;
      const N = kotak.maxN - (tinggi * (row + 0.5)) / ny;
      const t = sampelDem(dem, E, N);
      if (t === null) continue;
      // `z` jadi PERGESERAN saat relief aktif, bukan tinggi mutlak — supaya
      // kontrol yang sama di panel tetap berguna untuk menaikkan atau
      // menurunkan seluruh lantai tanpa merusak bentuknya. Halaman memanggil
      // dengan 0 dan menggesernya belakangan lewat terapkanGeser().
      tinggiSel[sel] = t + z;
      punyaTinggi[sel] = 1;
    }
  }

  const bergambar = (sel: number) =>
    punyaTinggi[sel] !== 0 && (topeng ? topeng[sel] !== 0 : true);

  const titik = (col: number, row: number): number => {
    const sel = row * nx + col;
    const sudah = indeks[sel];
    if (sudah !== -1) return sudah;
    const baru = x.length;
    indeks[sel] = baru;
    // Baris 0 citra = tepi UTARA ortofoto, jadi N menurun seiring row.
    x.push(kotak.minE + (lebar * (col + 0.5)) / nx);
    y.push(kotak.maxN - (tinggi * (row + 0.5)) / ny);
    zz.push(tinggiSel[sel]);
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

  return { x, y, z: zz, i: iArr, j: jArr, k: kArr, vertexcolor, geser: 0 };
}

/**
 * Naikkan atau turunkan seluruh lantai, tanpa merusak bentuknya.
 *
 * Menggeser SELISIHNYA saja, bukan menulis ulang dari nilai dasar — jadi tidak
 * perlu menyimpan salinan tinggi aslinya untuk ratusan ribu titik. Dipanggil
 * berulang dengan angka yang sama tidak mengubah apa pun.
 */
export function terapkanGeser(jaring: JaringBasemap, geser: number): JaringBasemap {
  if (!Number.isFinite(geser)) return jaring;
  const delta = geser - jaring.geser;
  if (delta === 0) return jaring;
  for (let i = 0; i < jaring.z.length; i++) jaring.z[i] += delta;
  jaring.geser = geser;
  return jaring;
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
 * Baca DEM apa adanya, tanpa penskalaan.
 *
 * Digambar pada ukuran aslinya dengan penghalusan DIMATIKAN. Mengecilkannya
 * lewat canvas akan mencampur sel nodata dengan sel berdata di tepi survei dan
 * menghasilkan tinggi antara yang tidak pernah diukur siapa pun; pengecilan ke
 * kerapatan jaring dilakukan belakangan oleh sampelDem(), yang menolak sampel
 * yang menyentuh nodata.
 */
async function muatDem(
  url: string,
  minZ: number,
  maxZ: number,
  kotak: KotakUtm
): Promise<PetakDem> {
  const img = await muatCitra(url);
  const nx = img.naturalWidth;
  const ny = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = nx;
  c.height = ny;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, nx, ny).data;

  const nilai = new Uint8ClampedArray(nx * ny);
  const ada = new Uint8Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) {
    nilai[i] = d[i * 4];
    // Alfa di sini penanda "ada data", bukan transparansi. Nilainya hanya 0
    // atau 255; ambang di tengah menampung pembulatan peramban.
    ada[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  }
  return { nx, ny, nilai, ada, minZ, maxZ, kotak };
}

/**
 * Muat ortofoto (dan topengnya) lalu ubah jadi jaring siap gambar.
 *
 * Topeng boleh gagal dimuat tanpa menggagalkan base map-nya: ortofoto tanpa
 * topeng tetap berguna, cuma bingkainya ikut tergambar.
 */
export async function muatJaringBasemap(
  sumber: {
    url: string;
    nodataUrl: string | null;
    demUrl?: string | null;
    demMinZ?: number | null;
    demMaxZ?: number | null;
  } & KotakUtm,
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

  // Relief boleh gagal dimuat tanpa menggagalkan base map-nya: ortofoto pada
  // bidang datar tetap berguna, cuma tidak menunjukkan bentuk tanahnya.
  let dem: PetakDem | null = null;
  if (sumber.demUrl && sumber.demMinZ !== null && sumber.demMinZ !== undefined &&
      sumber.demMaxZ !== null && sumber.demMaxZ !== undefined) {
    try {
      dem = await muatDem(sumber.demUrl, sumber.demMinZ, sumber.demMaxZ, sumber);
    } catch {
      dem = null;
    }
  }

  return bangunJaring({ nx, ny, rgba, topeng }, sumber, z, dem);
}
