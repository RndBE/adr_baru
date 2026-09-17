# Dekode ECW → aset base map

Alat sekali-pakai untuk mengubah ortofoto `.ecw` jadi dua berkas yang dipakai
halaman Visualisasi 3D: satu JPEG berwarna dan satu PNG 1-bit penanda bagian
bergambar. Bukan bagian aplikasi — tidak pernah dipanggil saat runtime, dan
tidak ikut `npm run build`.

## Kenapa perlu alat sendiri

ECW (Enhanced Compression Wavelet) format tertutup. Tidak ada peramban yang
bisa membacanya, dan GDAL hanya bisa kalau dibangun dengan SDK Hexagon — yang
tidak ada di Homebrew, tidak ada di conda-forge, dan tidak ada di image
`osgeo/gdal`. Jalan yang berhasil (17 September 2026) adalah membangun
`libecwj2-3.3` di dalam container lalu memanggilnya dari program C pendek.

GDAL sendiri **tidak dibangun** di sini. Yang dibutuhkan cuma "buka ECW, baca
pada resolusi turunan, tulis PPM", dan itu langsung tersedia di API SDK-nya —
membangun GDAL menambah 20+ menit untuk kemampuan yang tidak dipakai.

## Dua jebakan yang memakan waktu

1. **Nama fungsinya berawalan `NCScbm`**, bukan `NCS`: `NCScbmOpenFileView`,
   `NCScbmSetFileView`, `NCScbmReadViewLineRGB`. Versi pertama `ecwdump.c`
   memakai nama tanpa awalan itu dan tidak satu pun tertaut.

2. **`NCSecwInit()` WAJIB dipanggil lebih dulu**, walaupun headernya menulis
   "DO NOT call if linking against the DLL". Peringatan itu berlaku untuk DLL
   Windows. Pada `.so` Linux inisialisasi statiknya tidak jalan, mutex global
   di `CNCSJP2FileView` masih NULL, dan panggilan pertama langsung SIGSEGV di
   `NCSMutexBegin (pMutex=0x20)`.

Build-nya menarik `libecwj2-3.3-2006-09-06.zip` dari cermin pihak ketiga di
GitHub. Kode 2006 dengan g++ 11: ratusan peringatan, tidak ada galat.

## Pemakaian

Jalankan di mesin x86_64 — pustakanya kode 2006 dan belum pernah dicoba di
arm64.

```bash
docker build -t ecwdump:1 tools/ecw

# Metadata + georeferensi. Jalankan ini DULU: kotak batas aset diturunkan
# dari sini, bukan dari mengira-ngira di atas peta.
docker run --rm -v "$PWD:/data" ecwdump:1 info /data/ortofoto.ecw

# Dekode seluruh raster pada resolusi turunan.
docker run --rm -v "$PWD:/data" ecwdump:1 dump /data/ortofoto.ecw /data/out.ppm 2000 1124
```

`info` mencetak `width`, `height`, `cell_x`, `cell_y`, `origin_x`, `origin_y`,
`datum`, `projection`. **`origin_x`/`origin_y` adalah sudut kiri-atas dari sel
kiri-atas**, bukan titik tengahnya, jadi kotak batasnya:

```
minE = origin_x                    maxE = origin_x + width  * cell_x
maxN = origin_y                    minN = origin_y - height * |cell_y|
```

Lebar dan tinggi keluaran bebas: seluruh kotak selalu dipetakan ke seluruh
gambar, jadi rasio yang tidak persis hanya membuat pikselnya sedikit tidak
bujur sangkar — bukan georeferensi yang melenceng.

## Dari PPM ke aset

Tepi kosong ortofoto tidak putih bersih — kompresi wavelet-nya menyapu nilai
247–255 di sana, jadi ambang global akan menyisakan rumbai. Yang dipakai
banjir-isi dari tepi, supaya putih terang DI DALAM foto (jalan beton, atap)
tidak ikut hilang:

```bash
PTS=""
for x in 0 500 1000 1500 1999; do for y in 0 1123; do PTS="$PTS -draw \"alpha $x,$y floodfill\""; done; done
for y in 0 300 600 900 1123; do for x in 0 1999; do PTS="$PTS -draw \"alpha $x,$y floodfill\""; done; done
eval magick out.ppm -alpha set -fuzz 5% -fill none $PTS rgba.png

# Warna. Tepi kosong diisi cokelat netral, bukan hitam atau putih: JPEG
# membuang bit paling banyak di batas berkontras tinggi.
magick rgba.png -background "#7a6a55" -alpha remove -alpha off -quality 78 -strip \
  asaba-nextjs/public/basemap/<slug>.jpg

# Topeng. PNG 1-bit, ±8 KB. Menyimpan alfa di dalam PNG berwarna membuat
# berkasnya 4,3 MB — sepuluh kali JPEG-nya.
magick rgba.png -alpha extract -depth 1 -strip \
  PNG8:asaba-nextjs/public/basemap/<slug>-nodata.png
```

Terakhir, daftarkan di basis data — kolomnya ada di migrasi `014`:

```sql
UPDATE t_site SET
  basemap_url        = '/basemap/<slug>.jpg',
  basemap_nodata_url = '/basemap/<slug>-nodata.png',
  basemap_min_e = …, basemap_max_e = …,
  basemap_min_n = …, basemap_max_n = …
WHERE slug = '<slug>';
```

Tidak ada kode yang perlu disentuh. Pastikan `utm_zone`/`utm_north` baris itu
cocok dengan `projection` yang dicetak `info` (mis. `SUTM49` → zone 49,
`utm_north = 0`).
