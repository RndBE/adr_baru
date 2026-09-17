/**
 * Arah pergeseran prisma untuk panah di peta.
 *
 * Dipisah dari PrismaMap.tsx supaya bisa diuji: berkas komponennya meng-import
 * `leaflet/dist/leaflet.css`, yang tidak bisa dibaca skrip uji tsx.
 *
 * ── Kenapa METER, bukan piksel ──────────────────────────────────────────────
 *
 * Versi pertama panah ini menghitung arahnya di ruang piksel: posisi acuan dan
 * posisi sesi ini masing-masing dilewatkan `map.latLngToLayerPoint()`, lalu
 * selisihnya dinormalkan. Fungsi Leaflet itu MEMBULATKAN ke piksel bulat
 * (`this.project(...)._round()` di Map.js), sementara pergeseran di lapangan
 * berukuran 36–390 mm — pada zoom 16 setara 0,015–0,16 piksel. Kedua titik
 * selalu membulat ke piksel yang sama, selisihnya nol, dan panahnya dibuang
 * oleh penjaga `vectorLength <= 0`. Panah itu bukan sulit dilihat: untuk data
 * sungguhan ia tidak pernah sekali pun tergambar.
 *
 * Di sini arahnya diambil langsung dari DE/DN dalam meter, jadi sekecil apa pun
 * pergeserannya arahnya tetap terdefinisi.
 */

export interface ArahGeser {
  /** Vektor satuan ke TIMUR. */
  ux: number;
  /** Vektor satuan ke UTARA. */
  uy: number;
  /** Besar pergeseran mendatar, milimeter. */
  mm: number;
  /**
   * Sudut untuk memutar kepala panah, derajat searah jarum jam dari UTARA,
   * dinormalkan ke [0, 360).
   *
   * Dipakai sebagai `transform: rotate()` pada segitiga yang bentuk dasarnya
   * menunjuk ke atas — dan "atas" di layar adalah utara.
   *
   * Angkanya SENGAJA dihitung dengan rumus yang sama persis dengan
   * `arah8ID()` di `@/lib/coordinates`, yang menghasilkan teks arah di popup
   * dan di tabel. Panah yang menunjuk ke tenggara sementara tulisannya berbunyi
   * "Barat Laut" jauh lebih buruk daripada tidak ada panah sama sekali.
   */
  sudut: number;
}

/**
 * Hitung arah dari komponen pergeseran (meter).
 *
 * Mengembalikan null bila salah satu komponennya bukan angka atau prismanya
 * benar-benar diam. Nol BUKAN arah: menggambar panah untuk pergeseran nol
 * berarti mengarang arah dari pembagian nol.
 */
export function arahGeser(deltaE: number | null, deltaN: number | null): ArahGeser | null {
  if (deltaE === null || deltaN === null) return null;
  if (!Number.isFinite(deltaE) || !Number.isFinite(deltaN)) return null;

  const panjang = Math.hypot(deltaE, deltaN);
  if (panjang <= 1e-9) return null;

  const ux = deltaE / panjang;
  const uy = deltaN / panjang;

  // atan2(timur, utara) — bukan atan2(y, x) yang biasa. Urutan ini yang
  // menghasilkan bearing kompas: 0° utara, 90° timur, memutar searah jarum jam.
  // Sama persis dengan arah8ID(), normalisasinya juga.
  const mentah = (Math.atan2(deltaE, deltaN) * 180) / Math.PI;
  const sudut = ((mentah % 360) + 360) % 360;

  return { ux, uy, mm: panjang * 1000, sudut };
}

/**
 * Geser sebuah titik piksel sejauh `jarak` piksel menuju arah pergeseran.
 *
 * Sumbu y layar tumbuh KE BAWAH sementara `uy` menunjuk ke utara, jadi
 * tandanya dibalik. Pembalikan itu hanya terjadi di sini — kalau tersebar,
 * satu tempat yang terlewat membuat panahnya tercermin utara-selatan dan
 * "pergeseran ke utara" terbaca sebagai ke selatan.
 */
export function geserPiksel(
  x: number,
  y: number,
  arah: ArahGeser,
  jarak: number
): { x: number; y: number } {
  return { x: x + arah.ux * jarak, y: y - arah.uy * jarak };
}
