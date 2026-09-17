# Kontur DXF → DEM untuk relief scene 3D

Mengubah kontur survei `.dxf` jadi raster tinggi yang dipakai halaman
Visualisasi 3D sebagai bentuk tanah, menggantikan bidang datar. Bukan bagian
aplikasi — tidak pernah dipanggil saat runtime dan tidak ikut `npm run build`.

## Pemakaian

```bash
python3 tools/dxf/kontur-ke-dem.py "Situasi_BPP_260731.dxf" \
  asaba-nextjs/public/basemap/<slug>-dem.png \
  --bbox 462357.8434 9748151.5532 464918.6054 9749590.2390 --lebar 800
```

`--bbox` **harus sama persis** dengan `t_site.basemap_min_e/min_n/max_e/max_n`
ortofotonya. Kalau berbeda, reliefnya bergeser terhadap gambarnya dan prisma
akan tampak melayang atau terkubur — kesalahan yang tidak menampakkan diri
sebagai galat, cuma sebagai tanah yang "agak aneh".

Skripnya mencetak `minZ`/`maxZ` yang harus diisikan ke `t_site`:

```sql
UPDATE t_site SET
  basemap_dem_url   = '/basemap/<slug>-dem.png',
  basemap_dem_min_z = …,
  basemap_dem_max_z = …
WHERE slug = '<slug>';
```

Hanya butuh numpy. Kolomnya ada sejak migrasi `017`.

## Yang perlu diketahui sebelum mengubah angkanya

**Interpolasinya relaksasi Laplace, bukan IDW.** Garis kontur dirasterkan
sebagai sel bernilai tetap, lalu sel sisanya direlaksasi berulang ke rata-rata
empat tetangganya — permukaan paling mulus yang tetap melewati setiap garis
kontur. Jarak-terbalik dari simpul kontur menghasilkan "mata sapi" di tiap
simpul dan lereng bertangga; di atas ortofoto tambang itu terlihat seperti
kerusakan data.

**Batas areanya penutupan morfologis, bukan jarak.** Godaannya menandai sel
"berdata" kalau jaraknya dari garis kontur terdekat di bawah sekian meter.
Itu salah: kolam yang datar memang TIDAK punya garis kontur di tengahnya, jadi
ukuran jarak melubangi justru bagian yang paling disurvei. Pada percobaan
pertama BPP 1-4 lubangnya menganga di tengah setiap kolam. Dilatasi-lalu-erosi
(`--jangkauan`, bawaan 250 m) menambal lubang terkurung tanpa memuaikan tepi
luarnya; `--tepi` menambah pemuaian kecil sesudahnya.

Naikkan `--jangkauan` kalau masih ada lubang di tengah area datar yang luas.

**Sel di luar area TIDAK ditambal.** Alfa 0 menandainya, dan penampil tidak
menggambar segitiga di sana. Ortofoto BPP 1-4 lebih luas daripada surveinya —
tepi barat ~160 m dan tepi timur ~40 m tanpa kontur sama sekali — dan permukaan
karangan yang mulus di situ jauh lebih menyesatkan daripada lubang yang jujur.

**Tingkat abu 8-bit cukup.** 0,125 m per tingkat pada rentang 32 m, jauh lebih
halus daripada kontur 1 m yang jadi sumbernya. Grid 800 × 449 muat di 82 KB;
sebagai JSON angka yang sama jadi beberapa megabita yang harus di-parse peramban.

## Pemeriksaan sesudah membuat DEM

Cuplik DEM-nya di posisi prisma dan bandingkan dengan elevasi hasil tembakan.
Untuk BPP 1-4 keenam prisma duduk −0,7 … +1,8 m dari permukaannya, dan RTS
+9,5 m di atasnya — cocok dengan menara sheltenya (`config_adr.ts_high` = 10).
Kalau simpangannya puluhan meter, biasanya `--bbox`-nya tidak sama dengan
kotak ortofoto.
