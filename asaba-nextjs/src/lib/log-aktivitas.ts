/**
 * Pencatat perintah yang dikirim ke alat.
 *
 * Dipanggil DARI `publishMqtt()`, bukan dari tiap route. Ada enam belas route
 * di `/api/kontrol/*` dan semuanya menerbitkan lewat fungsi itu; menaruh
 * pencatatan di sana berarti tidak ada jalur perintah yang bisa luput, termasuk
 * jalur yang ditambahkan nanti dan lupa ikut mencatat.
 *
 * Kegagalan mencatat TIDAK BOLEH menggagalkan perintahnya. Perintah sudah
 * telanjur terbit ke alat saat fungsi ini berjalan; melempar di sini akan
 * membuat route menjawab galat atas perintah yang sebenarnya sampai, dan
 * operator akan mengirimnya dua kali.
 */
import { prisma } from "@/lib/prisma";
import { waktuDateLokal } from "@/components/monitoring/format";
import { offsetLogger } from "@/lib/sites";

/** `sub_30002` → `30002`. Null kalau topiknya bukan topik perintah. */
export function idAlatDariTopik(topik: string): string | null {
  const cocok = /^sub_(.+)$/.exec(topik.trim());
  return cocok ? cocok[1] : null;
}

/**
 * Nama perintah dari payload `{ set_<id>: { command: "set_rts", <aksi>: ... } }`.
 *
 * Yang dicari adalah kunci SELAIN `command`: `command` selalu "set_rts" untuk
 * hampir semua perintah, jadi memakainya sebagai label membuat seluruh log
 * berbunyi sama. Kunci di sebelahnya justru yang menyebut aksinya
 * (`measure_fs`, `auto_search`, `power_on`).
 */
export function ringkasanPerintah(pesan: object | string): string {
  let obj: unknown = pesan;
  if (typeof pesan === "string") {
    try {
      obj = JSON.parse(pesan);
    } catch {
      return pesan.slice(0, 64);
    }
  }
  if (!obj || typeof obj !== "object") return "tidak dikenal";

  const luar = Object.values(obj as Record<string, unknown>)[0];
  if (!luar || typeof luar !== "object") {
    return Object.keys(obj as Record<string, unknown>)[0] ?? "tidak dikenal";
  }

  const kunci = Object.keys(luar as Record<string, unknown>).filter(
    (k) => k !== "command"
  );
  if (kunci.length) return kunci.join(", ").slice(0, 64);

  const command = (luar as Record<string, unknown>).command;
  return typeof command === "string" ? command.slice(0, 64) : "tidak dikenal";
}

export async function catatAktivitas(
  topik: string,
  pesan: object | string,
  terkirim: boolean
): Promise<void> {
  try {
    const idLogger = idAlatDariTopik(topik);
    if (!idLogger) return; // Bukan topik perintah; tidak ada yang perlu dicatat.

    const payload = typeof pesan === "string" ? pesan : JSON.stringify(pesan);
    await prisma.logAktivitas.create({
      data: {
        id_logger: idLogger,
        perintah: ringkasanPerintah(pesan),
        // Dipotong: kolomnya TEXT, tapi payload firmware tidak pernah sepanjang
        // itu dan baris raksasa hanya menyulitkan dibaca.
        payload: payload.slice(0, 2000),
        terkirim,
        // Jam dinding mengikuti zona alatnya, sebaris dengan log_kontrol.
        // `waktuDateLokal` adalah bentuk Date untuk kolom DateTime lewat client
        // Prisma berjenis; menyerahkan `new Date()` apa adanya akan menyimpan
        // UTC dan meleset tujuh jam dari seluruh kolom waktu lain.
        waktu: waktuDateLokal(Date.now(), await offsetLogger(idLogger)),
      },
    });
  } catch (e) {
    console.error("[log-aktivitas] gagal mencatat:", e);
  }
}
