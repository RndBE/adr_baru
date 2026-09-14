/**
 * Menyusun dan mengirim pesan peringatan.
 *
 * Telegram jadi kanal pertama karena gratis, tanpa proses persetujuan template,
 * dan cukup satu panggilan fetch dari server. WhatsApp lewat Meta Cloud API
 * realistis sebagai kanal kedua kalau organisasi mensyaratkannya — tapi ia
 * butuh template yang disetujui lebih dulu, dan itu pekerjaan administratif
 * yang tidak perlu menghalangi peringatan pertama berfungsi.
 *
 * /api/notifikasi yang sudah ada TIDAK dipakai ulang. Ia menembak
 * fcm.googleapis.com/fcm/send — API FCM lama yang Google matikan pertengahan
 * 2024 — isinya soal "Kontrol Sedang Digunakan" bukan pergeseran, dan tidak ada
 * satu pun pemanggilnya di seluruh src/.
 *
 * Tidak ada fungsi di berkas ini yang boleh melempar. Pemanggilnya ada di jalur
 * ingestion; peringatan yang gagal tidak boleh ikut menjatuhkan penerimaan data.
 */
import type { StatusLabel } from "@/lib/ambang";

export interface BarisPerubahan {
  idPrisma: string;
  dari: StatusLabel;
  ke: StatusLabel;
  nilaiMm: number;
}

export interface RingkasanSiklus {
  namaSite: string;
  waktu: string;
  /** Kenaikan tingkat — inti pesannya. */
  naik: BarisPerubahan[];
  /** Kembali ke Normal dari tingkat yang pernah dikirim. */
  pulih: BarisPerubahan[];
  /** Prisma yang gagal ditembak beberapa siklus beruntun. */
  hilang: Array<{ idPrisma: string; siklus: number }>;
  /** Prisma yang terbaca sah tapi tingkatnya tidak berubah. */
  tetap: number;
  /** id_log sesi acuan R0, supaya penerima tahu angkanya diukur terhadap apa. */
  acuanR0: string | null;
  waktuAcuanR0: string | null;
}

const LEBAR_ID = 4;

/**
 * Satu pesan untuk satu siklus, bukan satu pesan per prisma.
 *
 * Basis data contoh punya 10 prisma. Satu pesan per prisma berarti sampai
 * sepuluh notifikasi untuk satu putaran yang sama — dan penerima tidak punya
 * cara tahu apakah itu sepuluh kejadian atau satu kejadian yang dilaporkan
 * sepuluh kali.
 */
export function susunTeks(r: RingkasanSiklus): string {
  const baris: string[] = [`${r.namaSite} — siklus ${r.waktu}`, ""];

  for (const p of r.naik) {
    baris.push(
      `${p.idPrisma.padEnd(LEBAR_ID)} ${p.dari} → ${p.ke}  ${Math.round(p.nilaiMm)} mm`
    );
  }
  for (const p of r.pulih) {
    baris.push(`${p.idPrisma.padEnd(LEBAR_ID)} ${p.dari} → Normal  ${Math.round(p.nilaiMm)} mm`);
  }

  baris.push("");

  if (r.tetap > 0) baris.push(`${r.tetap} prisma lain tidak berubah tingkat.`);
  for (const h of r.hilang) {
    baris.push(`Prisma ${h.idPrisma} gagal ditembak (${h.siklus} siklus beruntun).`);
  }

  // Bukan hiasan: penerima perlu tahu angka itu diukur terhadap apa, terutama
  // kalau acuannya pernah diganti.
  if (r.acuanR0) {
    baris.push("");
    baris.push(`Acuan R0: sesi ${r.acuanR0}${r.waktuAcuanR0 ? ` · ${r.waktuAcuanR0}` : ""}`);
  }

  return baris.join("\n").trim();
}

export type HasilKirim = { ok: true } | { ok: false; galat: string };

/**
 * Chat tujuan untuk sebuah site.
 *
 * Per site, bukan satu untuk semua: operator satu bendungan tidak perlu
 * dibangunkan notifikasi tambang di provinsi lain. TELEGRAM_CHAT_ID tanpa
 * akhiran dipakai sebagai cadangan supaya site baru tidak diam-diam kehilangan
 * peringatan sebelum chat-nya dibuat.
 */
export function chatUntukSite(site: string): string | null {
  const kunci = `TELEGRAM_CHAT_ID_${site.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[kunci] || process.env.TELEGRAM_CHAT_ID || null;
}

export async function kirimTelegram(site: string, teks: string): Promise<HasilKirim> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, galat: "TELEGRAM_BOT_TOKEN belum disetel" };

  const chatId = chatUntukSite(site);
  if (!chatId) return { ok: false, galat: `chat Telegram untuk site "${site}" belum disetel` };

  try {
    // Tenggat wajib: panggilan ini berjalan di dalam after(), dan fetch yang
    // menggantung akan menahan konteks request sampai batas durasi route.
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: teks, disable_notification: false }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const isi = await res.text().catch(() => "");
      return { ok: false, galat: `Telegram ${res.status}: ${isi.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : String(e) };
  }
}
