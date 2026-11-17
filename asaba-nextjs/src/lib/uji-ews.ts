/**
 * Uji EWS dari website — sisi basis data, MQTT, dan timer mati otomatis.
 * Aturannya di aturan-uji-ews.ts (murni, teruji).
 *
 * Yang dijaga di sini:
 *   - Site yang sedang punya kejadian alarm sungguhan ditolak. Uji tidak boleh
 *     menimpa sirene yang bunyi karena bahaya, dan tombol "matikan" uji tidak
 *     boleh jadi jalan pintas membungkam alarm tanpa konfirmasi.
 *   - Level uji dicatat di status_ews SEBELUM diterbitkan. Dengan begitu,
 *     seandainya proses mati sebelum timernya jalan, siklus RTS berikutnya
 *     melihat status_ews (level uji) berbeda dari tingkat site (Normal) dan
 *     mengirim level 0 sendiri. Terbit yang gagal mengembalikan catatannya.
 *   - Timer mati otomatis hanya menyentuh perangkat bila ia MASIH di level uji
 *     itu dan tidak ada alarm sungguhan (perluMatikanUji).
 */
import { prisma } from "@/lib/prisma";
import { type StatusLabel, asStatusLabel } from "@/lib/ambang";
import { type HasilUji, perluMatikanUji } from "@/lib/aturan-uji-ews";
import { kejadianAktif, sekarangDb } from "@/lib/kejadian-alarm";
import { sendEwsLevel } from "@/lib/mqtt";

const tag = "[ews-uji]";

// Satu timer per site, di globalThis: modul ini bisa dimuat ulang oleh bundel
// route yang berbeda, dan uji baru atau "matikan" harus membatalkan timer lama.
const g = globalThis as typeof globalThis & { __ujiEwsTimer?: Map<string, ReturnType<typeof setTimeout>> };
const timer = (g.__ujiEwsTimer ??= new Map());

function batalkanTimer(site: string): void {
  const t = timer.get(site);
  if (t) clearTimeout(t);
  timer.delete(site);
}

async function catatStatus(site: string, idLoggerEws: string, tingkat: StatusLabel): Promise<void> {
  const dikirim = sekarangDb();
  await prisma.statusEws.upsert({
    where: { site },
    create: { site, id_logger_ews: idLoggerEws, tingkat, dikirim },
    update: { id_logger_ews: idLoggerEws, tingkat, dikirim },
  });
}

/**
 * Kirim level uji (atau Normal = matikan) ke logger EWS site ini.
 * Melempar bila basis data gagal SEBELUM apa pun terkirim; terbit yang gagal
 * mengembalikan "gagal". Untuk tingkat selain Normal, server mematikan sendiri
 * setelah `detik`.
 */
export async function jalankanUji(opsi: {
  site: string;
  idLoggerEws: string;
  tingkat: StatusLabel;
  detik: number;
}): Promise<HasilUji> {
  const { site, idLoggerEws, tingkat, detik } = opsi;
  if (await kejadianAktif(site)) return "alarm-aktif";

  const sebelumnya = await prisma.statusEws.findUnique({ where: { site } });
  await catatStatus(site, idLoggerEws, tingkat);

  const ok = await sendEwsLevel(idLoggerEws, tingkat);
  if (!ok) {
    try {
      if (sebelumnya) await catatStatus(site, sebelumnya.id_logger_ews, asStatusLabel(sebelumnya.tingkat) ?? "Normal");
      else await prisma.statusEws.delete({ where: { site } });
    } catch (e) {
      // Catatan menyimpang: siklus berikutnya mengirim level 0, tidak berbahaya.
      console.error(`${tag} ${site}: gagal mengembalikan status_ews:`, e instanceof Error ? e.message : e);
    }
    return "gagal";
  }

  batalkanTimer(site);
  if (tingkat !== "Normal") jadwalkanMati(site, idLoggerEws, tingkat, detik);
  return "terkirim";
}

function jadwalkanMati(site: string, idLoggerEws: string, levelUji: StatusLabel, detik: number): void {
  const t = setTimeout(() => {
    timer.delete(site);
    matikanSetelahUji(site, idLoggerEws, levelUji).catch((e) =>
      console.error(`${tag} ${site}: mati otomatis gagal:`, e instanceof Error ? e.message : e)
    );
  }, detik * 1000);
  timer.set(site, t);
}

async function matikanSetelahUji(site: string, idLoggerEws: string, levelUji: StatusLabel): Promise<void> {
  const [baris, aktif] = await Promise.all([prisma.statusEws.findUnique({ where: { site } }), kejadianAktif(site)]);
  if (!perluMatikanUji({ tingkatTerkirim: baris?.tingkat, levelUji, adaKejadianAktif: Boolean(aktif) })) {
    console.log(`${tag} ${site}: uji ${levelUji} selesai, tidak dimatikan (sudah berubah atau ada alarm sungguhan)`);
    return;
  }
  // Dua percobaan: kalau keduanya gagal, status_ews masih mencatat level uji,
  // jadi siklus RTS berikutnya yang mengirim level 0.
  for (let ke = 1; ke <= 2; ke++) {
    if (await sendEwsLevel(idLoggerEws, "Normal")) {
      await catatStatus(site, idLoggerEws, "Normal");
      console.log(`${tag} ${site}: uji ${levelUji} selesai, level 0 terkirim ke sub_${idLoggerEws}`);
      return;
    }
    if (ke === 1) await new Promise((r) => setTimeout(r, 5000));
  }
  console.error(`${tag} ${site}: level 0 GAGAL terbit setelah uji — dikirim ulang oleh siklus RTS berikutnya`);
}
