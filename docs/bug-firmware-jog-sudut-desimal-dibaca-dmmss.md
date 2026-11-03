# Bug firmware: perintah `jog` membaca sudut desimal sebagai d.mmss, target meleset hingga 0,6°

Tanggal temuan: 3 November 2026
Perangkat: logger `30002` (ADR/RTS, site `kolam_bpp`), topik `sub_30002` / `pub_30002`
Ditemukan lewat: aplikasi web ADR (demo-adr.monitoring4system.com) dan pemantauan langsung topik MQTT

## Ringkasan

Pada perintah `jog`, balasan tahap `target` menunjukkan tujuan putar (`ke_HA`, `ke_VA`) yang jauh dari posisi sekarang (`dari_HA`, `dari_VA`), meskipun selisih yang diminta kecil atau nol. Pada VA selisihnya konsisten sekitar **+0,63°** (teropong menunduk), pada HA sekitar **+0,16° sampai +0,24°**.

Seluruh nilai `ke_*` dari enam jog bisa diprediksi persis dengan satu dugaan: firmware membaca angka mentah `dari_*` (yang berupa **derajat desimal**) seolah berformat **d.mmss** (derajat, lalu dua digit menit, lalu detik), menambahkan selisih ke angka yang salah tafsir itu, lalu menuliskannya sebagai d,m,s.

Di lapangan operator melaporkan teropong "agak turun dari prisma" setelah jog dicoba.

## Pembaruan setelah firmware baru (3 November 2026, sore)

Firmware diperbarui di antara pengujian jam 12:12 dan 13:15 hari yang sama (waktu pastinya tidak tercatat). Perhitungan target jog sudah diperbaiki, tetapi teropong sekarang bergerak ke arah yang berlawanan dengan sebelumnya. Tahap `rotate` tampaknya masih bermasalah.

### Yang sudah benar

Jog 13:15:06 dan 13:17:43 meminta `ha` = 0,000278° dan `va` = 0,000556° (1″ dan 2″). Balasan `target`-nya:

```
sub_30002  {"set_30002":{"command":"set_rts","jog":{"ha":0.0002777777777777778,"va":0.0005555555555555556}}}
pub_30002  {"Jog":{"value":"start","ha":0.000278,"va":0.000556}}
pub_30002  {"Jog":{"value":"target","dari_HA":"208.33154","dari_VA":"098.92792","ke_HA":"208,19,55","ke_VA":"098,55,43"}}
```

Hitungan benar:

- HA: 208,33154° + 1″ = 208,331818° = 208° 19′ 54,5″, tertulis `208,19,55`.
- VA: 98,92792° + 2″ = 98,928476° = 98° 55′ 42,5″, tertulis `098,55,43`.

Nilai `ke_VA` itu sama dengan yang dokumen ini tulis sebagai "perilaku yang diharapkan" di bawah. Jadi tahap `read` dan perhitungan `target` sudah diperbaiki.

### Yang masih salah

Operator melaporkan, sesudah update, teropong **naik jauh** dari prisma setelah jog (sebelum update: turun). Untuk selisih 1″ dan 2″ dan target yang hampir sama dengan posisi sekarang, teropong seharusnya praktis tidak bergerak.

Dugaan (belum terkonfirmasi): tahap `rotate` membaca string `ke_HA` / `ke_VA` seperti format bacaan `manual_hava`, yaitu `ddd,mm,ss` sebagai angka desimal derajat (`098,55,43` dibaca 98,5543°), bukan sebagai derajat-menit-detik asli. Bila dugaan benar:

| | Posisi sebenarnya | Dibaca rotate | Gerak | Arah |
|---|---|---|---|---|
| VA sebelum update (`099,33,25`) | 98,9285° | 99,3325° | +0,40° | turun |
| VA sesudah update (`098,55,43`) | 98,9279° | 98,5543° | −0,37° | **naik** |
| HA sesudah update (`208,19,55`) | 208,3315° | 208,1955° | −0,14° | geser ke kiri |

Besar dan arahnya cocok dengan laporan operator di kedua kondisi, yaitu turun sebelum update dan naik sesudahnya, dengan besar gerak yang hampir sama. Kalau `rotate` membaca DMS asli, sesudah update seharusnya hampir tidak bergerak dan sebelum update turun 0,63°, dan itu tidak cocok dengan "naik jauh". Karena penyebabnya salah baca format dan bukan selisih, besar lonjakan tidak bergantung pada nilai `ha`/`va` yang diminta; jog dengan selisih 0 pun seharusnya ikut melompat.

### Sapuan custom (`autosearch custom`) mengalami hal yang sama

Pada 14:52, 14:53, dan 15:15 sapuan dijalankan dengan `step 0,0,1`, `Hlebar 0,0,2`, `Vlebar 0,0,2`, `rehat 5000` (25 titik, selisih terjauh dari titik tengah hanya 2″). Perintah yang masuk ke `sub_30002` hanya `manual_hava` lalu `autosearch`, tidak ada jog atau perintah sudut absolut, jadi titik tengah dan titik awal dihitung firmware sendiri. Operator melaporkan teropong **naik dari prisma** begitu sapuan mulai. Ini tidak mungkin terjadi dari sapuan ±2″ bila titik awalnya benar.

Sebelum update, balasan sapuan melaporkan `va` `099,33,26` sampai `099,33,28` padahal `manual_hava` membaca `098,93,xx`. Kemungkinan sapuan memakai jalur baca dan putar yang sama dengan jog.

### Yang perlu dicek tim

1. Cara `rotate` membaca string `ddd,mm,ss`: apakah sebagai DMS asli atau sebagai desimal yang dipotong? Format di `ke_*`, di perintah putar, dan di `manual_hava` harus satu makna.
2. Bila hanya `parseAndFormat()` yang diperbaiki, string `manual_hava` ikut berubah makna menjadi DMS sungguhan (sudah dicatat di dokumen protokol).
3. Jalur sapuan custom: periksa titik tengah dan titik pertama yang diputar.
4. Setelah perbaikan, jog dengan `ha = 0, va = 0` seharusnya tidak menggerakkan teropong sama sekali.

### Cara memastikan dugaan (tanpa perubahan kode)

1. Baca `manual_hava` (catat `HA`/`VA`).
2. Jog kecil, misalnya `{"ha":0,"va":0.0003}`. Catat balasan `target`.
3. Baca `manual_hava` lagi. Bila dugaan benar, VA terbaca mendekati nilai `ke_VA` (mis. `098,55,4x`) dan bukan `098,92,xx`. Bila VA tidak berubah tetapi teropong terlihat bergerak, masalahnya di tempat lain.
4. Untuk sapuan: jalankan sapuan kecil, lalu bandingkan `ha`/`va` pada pesan `{"autosearch":{"tembakan":1,...}}` pertama dengan `manual_hava` sebelum sapuan. Titik pertama seharusnya berselisih paling banyak beberapa detik busur dari bacaan awal.

### Belum dikonfirmasi

- Bacaan `manual_hava` sesudah jog (setelah update) belum diambil, jadi pergerakan fisik ke 98,55° belum terbukti dari data. Yang ada baru laporan visual operator.
- Isi pesan sapuan (titik pertama) setelah update belum dilampirkan.

## Data

Bagian Data, Analisis, dan seterusnya di bawah ini adalah temuan **sebelum update firmware** (12:03–12:12). Setiap baris adalah satu jog, dicuplik dari topik `pub_30002` dan `sub_30002`. Waktu dalam WIB.

| Waktu | Diminta (`ha`, `va`, derajat) | `dari_HA` | `dari_VA` | `ke_HA` | `ke_VA` |
|---|---|---|---|---|---|
| 12:03:12 | 0,000278 ; 0 | 208.24058 | 098.92848 | 208,24,07 | 099,33,25 |
| 12:04:12 | 0,000278 ; 0 | 208.24052 | 098.93496 | 208,24,06 | 099,33,50 |
| 12:05:55 | 0 ; −0,01 | 208.34100 | 098.93146 | 208,34,10 | 099,32,39 |
| 12:06:55 | 0,000278 ; 0 | 208.35338 | 098.92994 | 208,35,35 | 099,33,39 |
| 12:08:06 | 0,1 ; 0 | 208.35336 | 098.92914 | 208,41,34 | 099,33,31 |
| sekitar 12:12 | tidak tercatat | 208.33598 | 098.93452 | 208,34,01 | 099,33,45 |

Contoh urutan balasan lengkap (12:03:12):

```
sub_30002  {"set_30002":{"command":"set_rts","jog":{"ha":0.0002777777777777778,"va":0}}}
pub_30002  {"Jog":{"value":"start","ha":0.000278,"va":0}}
pub_30002  {"Jog":{"value":"check"}}
pub_30002  {"Jog":{"value":"read"}}
pub_30002  {"Jog":{"value":"target","dari_HA":"208.24058","dari_VA":"098.92848","ke_HA":"208,24,07","ke_VA":"099,33,25"}}
pub_30002  {"Jog":{"value":"rotate"}}
pub_30002  {"Rotate":{"value":"ok","ms":1965}}
pub_30002  {"Jog":{"value":"done"}}
```

Jog ini meminta selisih VA = 0, tetapi `ke_VA` (99,5569°) berbeda +0,6285° dari `dari_VA` (98,92848°).

## Analisis

Dugaan: `dari_*` adalah derajat desimal (sesuai dokumen protokol, "angka mentah instrumen"). Firmware memecah string itu menjadi `d`, `mm`, `ss.s`, tanpa memeriksa bahwa angka di belakang titik adalah pecahan desimal, bukan menit.

Contoh VA pada baris pertama:

- `dari_VA = 098.92848` dibaca sebagai 98° 92′ 84,8″
- Menit 92 meluap: 98° + 92′ = 99° 32′, ditambah 84,8″ jadi 99° 33′ 24,8″
- Ditulis sebagai `099,33,25`. Cocok dengan `ke_VA` yang diterima.

Contoh HA pada baris pertama:

- `dari_HA = 208.24058` dibaca sebagai 208° 24′ 05,8″ (yang sebenarnya 208° 14′ 26″)
- Ditambah 1″ jadi 208° 24′ 06,8″, ditulis `208,24,07`. Cocok.

Pembacaan itu meleset dari posisi sebenarnya:

- HA: +0,16° (baris 1 dan 2) sampai +0,24° (baris 3 sampai 6)
- VA: +0,63° pada keenam baris

Prediksi dengan rumus ini cocok dengan semua `ke_*` yang tercatat (lima baris yang selisihnya diketahui cocok persis sampai detik; baris keenam cocok pada selisih dari posisi). Pada VA meluapnya menit terlihat jelas, pada HA kesalahannya tersamar karena menit masih di bawah 60.

Pada baris kelima (selisih 0,1°), prediksinya juga tepat: 208° 35′ 33,6″ ditambah 6′ jadi 208° 41′ 33,6″, tertulis `208,41,34`.

## Perilaku yang diharapkan

Nilai `ke_*` seharusnya sama dengan posisi sekarang ditambah selisih, dalam sistem satuan yang sama:

- `dari_VA = 98.92848` dan `va = 0` seharusnya menghasilkan `ke_VA = 098,55,43` (98°55′42,5″).
- `dari_HA = 208.24058` dan `ha = +1″` seharusnya menghasilkan `ke_HA = 208,14,27`.

## Perbaikan yang disarankan

1. Pada tahap `read`, simpan angka mentah sebagai derajat desimal (float), bukan string yang dipecah.
2. Tambahkan selisih (derajat desimal) langsung ke float itu.
3. Baru terakhir ubah hasilnya ke d,m,s: `d = floor(x)`, `m = floor((x − d) × 60)`, `s = round(((x − d) × 60 − m) × 60)`, dengan penanganan s = 60 dan m = 60.
4. Terapkan pembulatan itu sekali, di tahap akhir saja.
5. Tolak (`bad base`) bila sudut dasar di luar rentang wajar, seperti yang sudah direncanakan di dokumen.

Cek cepat sesudah perbaikan: jog dengan `ha = 0`, `va = 0.0003` seharusnya menghasilkan `ke_*` yang berselisih paling banyak beberapa detik busur dari `dari_*` setelah dikonversi ke satuan yang sama.

## Hal yang mungkin terkait di firmware yang sama

- **`manual_hava`.** Balasannya (`"HA":"208,21,20","VA":"098,93,37"`) bukan d,m,s sungguhan: menit 93 tidak mungkin. Itu string `098.9337` yang dipotong. Dokumen protokol sudah mencatat ini sebagai bug `parseAndFormat()`.
- **Sapuan custom (`autosearch`).** Titik sapuan melaporkan `va` `099,33,26` sampai `099,33,28`, sedangkan `manual_hava` pada waktu yang sama membaca VA `098,93,xx`. Selisih 0,6° yang sama, jadi bisa jadi titik tengah sapuan dihitung dengan pembacaan yang salah. Mohon dicek apakah sapuan custom mengarahkan instrumen ke titik yang meleset di awal.
- **`turning_target`.** Dokumen menyebut hasilnya bisa berbeda sekitar setengah derajat dari jog ke titik yang sama; ini mungkin akibat bug yang sama.

## Yang belum diketahui

- Apakah instrumen benar-benar berputar ke `ke_*` yang meleset. Bacaan `manual_hava` sesudah jog tetap `098,93,xx`, jadi pergerakan fisiknya belum terkonfirmasi dari data. Operator melihat teropong turun sesudah jog dicoba.
- Tahap `rotate` melaporkan `ok` dengan `ms` 1449 sampai 1993 untuk selisih sekecil 1″, yang terlalu lama untuk gerakan 1″ tapi sesuai gerakan yang lebih besar.
- Pada 12:04:17 sampai 12:05:43 HA naik sekitar 0,10° tanpa ada perintah di topik `sub_30002`. Penyebabnya belum diketahui; mungkin digeser dengan tangan.

## Cara mereproduksi

1. Pastikan instrumen menyala dan tidak sedang sibuk (`manual_hava` dijawab, bukan `sedang sibuk`).
2. Kirim ke `sub_30002`: `{"set_30002":{"command":"set_rts","jog":{"ha":0.000278,"va":0}}}`
3. Perhatikan balasan `Jog` tahap `target`: bandingkan `dari_VA` dengan `ke_VA`.
4. Amati teropong secara fisik, dan baca `manual_hava` sebelum dan sesudahnya.
