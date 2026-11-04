/**
 * Pemeriksaan isi payload data masuk (`/api/datamasuk/adr`).
 *
 * Satu pengirim pernah mengirim tiap sensor sebagai objek yang diubah jadi
 * teks, bukan nilainya: "map[nama:ADR.SD nilai:0 satuan:m]" (format cetak peta
 * Go; kunci terurut abjad). Kolom sensor1–sensor13 bertipe teks sehingga
 * database menerimanya, dan karena `temp_rts` hanya menyimpan baris terakhir
 * per logger, baris itu menimpa data logger asli beberapa detik sesudahnya —
 * kartu menampilkan teks peta dan status RTS berkedip antara menyala dan mati.
 *
 * Payload seperti itu tidak membawa pengukuran apa pun (nilainya nol, sensor14
 * dst. nol semua), jadi ditolak utuh, bukan diperbaiki: menebak `nilai` dari
 * teks peta berarti mengurai format yang tidak dijanjikan siapa pun.
 *
 * Jalankan tes: npx tsx src/lib/payload-sensor.test.ts
 */

/** Awalan teks yang menandakan objek yang tercetak, bukan nilai sensor. */
const AWALAN_TEKS_OBJEK = ["map[", "[object Object]"];

/**
 * Nama kolom sensor pertama yang isinya teks objek, atau null bila bersih.
 * Hanya kunci `sensor<angka>` yang diperiksa; kunci lain (id_alat, tanggal,
 * jam, sn) tidak diurus di sini.
 */
export function sensorBerisiTeksObjek(payload: Record<string, string>): string | null {
  for (const [kunci, nilai] of Object.entries(payload)) {
    if (!/^sensor\d+$/.test(kunci)) continue;
    const teks = nilai.trim();
    if (AWALAN_TEKS_OBJEK.some((a) => teks.startsWith(a))) return kunci;
  }
  return null;
}
