# Permintaan firmware: tulis dan baca sudut slot target (`setTarget` / `getTarget`)

Tanggal: 23 November 2026
Perangkat: logger RTS BL1100 `30002` (site `kolam_bpp`), topik perintah `sub_30002`, balasan `pub_30002`
Peminta: aplikasi web ADR (demo-adr.monitoring4system.com)

## Ringkasan

Kami minta dua perintah baru di `set_rts`:

1. **`setTarget`**: menulis sudut HA/VA sebuah slot (1–50) langsung dari angka yang dikirim, **tanpa menggerakkan teleskop**.
2. **`getTarget`**: membaca isi sebuah slot (nama, HA, VA, tinggi target, cara cari) yang sedang tersimpan di firmware.

Keduanya dipakai web untuk memperbarui arah bidik prisma yang terbukti bergeser. Sekarang hal itu hanya bisa dilakukan lewat `recordTarget`, yang merekam ke mana teleskop sedang menghadap. Uji pertama dengan `recordTarget` pada 23 November merusak slot 2 (rincian di bawah).

## Latar belakang

Setiap prisma tersimpan sebagai slot di firmware. Di setiap sesi AutoTracking, teleskop diputar ke sudut slot (`turning_target`), lalu AutoSearch mencari prisma di sekitarnya. Kalau prisma bergeser cukup jauh, misalnya karena longsor, sudut slot yang lama makin jauh dari prisma, dan suatu saat AutoSearch tidak menemukannya lagi.

Web sudah mencatat sudut sebenarnya dari tembakan terakhir yang sah (kolom `sensor5`/`sensor6` data pengukuran). Yang dibutuhkan hanyalah cara menulis angka itu ke slot. Perintah yang tersedia sekarang hanya `recordTarget`, yang merekam arah teleskop **saat itu**. Jadi web terpaksa memutar teleskop, menjalankan AutoSearch, mengukur, lalu merekam: empat perintah gerak, dan kegagalan di langkah mana pun bisa merekam sudut yang salah.

### Kejadian 23 November 2026 (kantor, prisma P2 digeser untuk uji)

Urutan perintah dari log aktivitas web:

```
15:42:51  sub_30002  {"set_30002":{"command":"set_rts","turning_target":2}}
15:43:01  sub_30002  {"set_30002":{"command":"set_rts","auto_search":true}}
15:43:09  sub_30002  {"set_30002":{"command":"set_rts","measure_fs":true}}
15:43:12  sub_30002  {"set_30002":{"command":"set_rts","recordTarget":{"slot":2,"name":"P2","targetHigh":"0"}}}
15:43:27  sub_30002  {"set_30002":{"command":"set_rts","turning_target":2}}
15:43:35  sub_30002  {"set_30002":{"command":"set_rts","auto_search":true}}
```

- **Putar, AutoSearch, dan ukur berhasil.** Hasil ukur cocok dengan tembakan P2 di sesi 15:40 (HA `130,34,79`, VA `099,11,90`, SD 21,7096 m).
- **Balasan `recordTarget` ditolak web sebagai tidak sah.** Isinya galat atau sudut nol (`000,00,00`), dan datang kurang dari 15 detik sesudah perintah. Isi persisnya tidak tercatat, karena balasan hanya diterima peramban operator.
- **Sejak saat itu P2 tidak pernah ditemukan lagi:**
  - AutoSearch dari slot 2 gagal (15:43:35).
  - Sesi AutoTracking 15:45 menembak P1 dengan normal, tapi mengirim P2 sebagai `000,00,00` dengan jarak 0 (15:46:11).
  - Di sesi 15:40, sebelum `recordTarget`, P2 masih tertembak normal.

Dugaan kami: `recordTarget` yang dikirim tepat setelah `measure_fs` merekam sudut yang salah (mungkin nol) ke slot 2. **Mohon dicek di firmware** apa yang dibaca `recordTarget` bila perintah sebelumnya `measure_fs`, dan apa bentuk balasannya saat itu.

Fitur web ini sudah kami matikan sampai `setTarget`/`getTarget` tersedia. Slot P2 akan didaftarkan ulang manual lewat Prism Config.

## Permintaan 1: `setTarget`

### Perintah

```json
{"set_30002":{"command":"set_rts","setTarget":{"slot":2,"HA":"130,34,79","VA":"099,11,90"}}}
```

| Medan | Wajib | Keterangan |
|---|---|---|
| `slot` | ya | 1–50, slot yang sudah terdaftar |
| `HA`, `VA` | ya | Format dan satuan **persis sama** dengan yang dikirim firmware di data pengukuran (`sensor5`/`sensor6`) dan di balasan `recordTarget`. Tidak dikonversi apa pun. |
| `name`, `targetHigh`, `mode` | tidak | Kalau tidak dikirim, nilai yang tersimpan **dipertahankan** |

Format sudut harus sama dengan format yang dilaporkan alat sendiri. Ini penting: bug `jog` (lihat `bug-firmware-jog-sudut-desimal-dibaca-dmmss.md`) terjadi karena satu angka dibaca dengan format yang berbeda dari format penulisnya. Web akan mengirim balik angka dari tembakan alat itu sendiri, jadi format tulis harus sama dengan format baca.

### Perilaku yang diminta

- **Teleskop tidak bergerak.** Hanya isi slot yang berubah, dan disimpan permanen seperti hasil `recordTarget`.
- Ditolak bila instrumen sedang sibuk (AutoTracking, sapuan, putar), supaya slot tidak berubah di tengah siklus.
- Ditolak bila slot belum terdaftar, slot di luar 1–50, atau sudutnya tidak terbaca. Slot tidak diubah sama sekali bila ditolak.

### Balasan

Berhasil: sudut yang **benar-benar tersimpan**, dibaca ulang dari penyimpanan setelah ditulis:

```json
{"setTarget":{"slot":2,"name":"P2","HA":"130,34,79","VA":"099,11,90","targetHigh":"0","mode":"as","value":"done"}}
```

Ditolak:

```json
{"setTarget":{"slot":2,"error":"busy"}}
{"setTarget":{"slot":51,"error":"bad target"}}
{"setTarget":{"slot":7,"error":"empty slot"}}
{"setTarget":{"slot":2,"error":"bad angle"}}
```

Medan `slot` mohon selalu disertakan, juga di balasan galat. Balasan perintah lain di topik yang sama tidak menyebut slot, sehingga web tidak bisa memastikan balasan mana yang milik perintah mana.

## Permintaan 2: `getTarget`

### Perintah

```json
{"set_30002":{"command":"set_rts","getTarget":{"slot":2}}}
```

Tidak menggerakkan apa pun.

### Balasan

```json
{"getTarget":{"slot":2,"name":"P2","HA":"130,34,79","VA":"099,11,90","targetHigh":"0","mode":"as"}}
{"getTarget":{"slot":7,"error":"empty slot"}}
```

Kalau memungkinkan, bentuk daftar juga sangat membantu: `{"getTarget":{"slot":"all"}}` membalas semua slot terdaftar sekaligus. Dengan itu Prism Config bisa membandingkan isi firmware dengan catatan web dalam satu permintaan.

## Cara web memakainya

1. Operator memverifikasi alarm sebagai pergeseran **Benar** dan memilih prisma yang arah bidiknya diperbarui.
2. Web mengirim `getTarget` untuk mencatat isi slot sebelum diubah.
3. Web mengirim `setTarget` dengan HA/VA dari tembakan sah terakhir prisma itu.
4. Balasan `setTarget` harus sama persis dengan angka yang dikirim. Kalau tidak sama, web menampilkan galat dan tidak mencatat apa pun.
5. Web mengirim `getTarget` sekali lagi untuk memastikan isi slot. Baru setelah itu `t_prisma` di web diperbarui.

Teleskop tidak bergerak di langkah mana pun, dan sesi AutoTracking berikutnya langsung memakai sudut baru.

## Uji penerimaan

1. `getTarget` slot 2 → balasan sama dengan sudut yang terakhir direkam lewat Prism Config.
2. `setTarget` slot 2 dengan sudut dari tembakan terakhir P2 → balasan `done` dengan angka yang sama persis, dan teleskop tidak bergerak.
3. `getTarget` slot 2 → mengembalikan angka baru itu, juga setelah logger di-restart.
4. Jalankan satu sesi AutoTracking → P2 ditemukan dari sudut baru.
5. `setTarget` saat AutoTracking berjalan → `error: busy`, slot tidak berubah.
6. `setTarget` slot 51 dan slot kosong → galat masing-masing, tidak ada slot yang berubah.
7. `setTarget` tanpa `mode` → `mode` slot tetap seperti sebelumnya, misalnya `as+ac`.
