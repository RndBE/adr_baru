/**
 * Pembacaan balasan logger RTS yang bentuknya tidak seragam antar-firmware.
 *
 * Balasan untuk perintah yang sama bisa datang pipih maupun bersarang:
 *   {"AutoSearch":1}            ← firmware lama
 *   {"AutoSearch":{"value":1}}  ← terlihat di lapangan 29 Agustus 2026
 *
 * Kode lama membandingkan `String(data.AutoSearch) === "1"`. Untuk bentuk
 * bersarang String() menghasilkan "[object Object]", yang tidak pernah sama
 * dengan "1" — sehingga status di UI menggantung di "waiting" selamanya
 * walaupun logger sudah menjawab, dan tombol Simpan ikut terkunci karena baru
 * aktif setelah Go To Target dan Auto Search dua-duanya selesai.
 */

/**
 * Ambil nilai dari balasan logger, apa pun bentuknya.
 *
 * Mengembalikan null kalau kuncinya memang tidak ada isinya, supaya pemanggil
 * bisa membedakan "tidak ada balasan" dari "balasan bernilai 0".
 */
export function nilaiBalasanLogger(v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "object") {
    // Array tidak punya bentuk balasan yang disepakati; diperlakukan sebagai
    // tidak terbaca, bukan dipaksa jadi string seperti "1,2".
    if (Array.isArray(v)) return null;

    // `value` dipakai firmware baru. `nilai` dan `status` ikut diterima karena
    // dua-duanya sudah muncul di balasan lain pada topic yang sama
    // (mis. {"PowerOn":{"nilai":"Success"}}), jadi tidak ada gunanya menunggu
    // ketiganya bertabrakan di lapangan lebih dulu.
    const o = v as Record<string, unknown>;
    const dalam = o.value ?? o.nilai ?? o.status;
    return dalam === null || dalam === undefined ? null : String(dalam);
  }

  return String(v);
}

/**
 * Apakah balasan itu berarti "perintah tuntas".
 *
 * Sengaja hanya "1"/"true": nilai lain — termasuk 0 dan false — TIDAK boleh
 * terbaca sebagai sukses, karena di sini sukses palsu berarti operator
 * menyimpan prisma yang alatnya sebenarnya gagal membidik.
 */
export function balasanSelesai(nilai: string | null): boolean {
  return nilai === "1" || nilai === "true";
}

/**
 * Apakah balasan itu berarti "perintah gagal".
 *
 * Untuk Auto Search, 0 berarti prisma tidak ketemu — teleskop sudah menyapu
 * dan tidak menemukan target. Itu jawaban akhir, bukan "belum selesai", jadi
 * UI harus berhenti menunggu dan bilang gagal.
 *
 * Sengaja BUKAN sekadar `!balasanSelesai()`: nilai yang tidak dikenali (balasan
 * kosong, bentuk baru yang belum ditangani) harus tetap terbaca sebagai "belum
 * ada jawaban", bukan divonis gagal. Sukses dan gagal dua-duanya perlu bukti.
 */
export function balasanGagal(nilai: string | null): boolean {
  return nilai === "0" || nilai === "false";
}
