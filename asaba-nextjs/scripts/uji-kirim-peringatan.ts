/**
 * Jalankan: npx tsx scripts/uji-kirim-peringatan.ts [site]
 *
 * Memeriksa setelan kanal peringatan dengan MENGIRIM pesan contoh sungguhan.
 *
 * Ada karena peringatan yang sebenarnya tidak bisa dipancing untuk diuji: ia
 * baru berangkat kalau sebuah prisma melewati ambang Siaga dan bertahan tiga
 * siklus beruntun. Tanpa skrip ini, satu-satunya cara tahu SMTP-nya benar
 * adalah menunggu tanah bergerak — dan saat itu terjadi, bukan waktu yang tepat
 * untuk menemukan bahwa passwordnya salah ketik.
 *
 * TIDAK menyentuh basis data: tidak membaca pengukuran, tidak menulis
 * log_peringatan, tidak mengubah status_prisma. Ringkasannya dikarang di sini.
 *
 * Tapi pesannya BENAR-BENAR terkirim ke penerima yang disetel untuk site itu.
 * Karena itu subjek dan badannya ditandai UJI COBA dengan tegas — penerima
 * peringatan keselamatan tidak boleh dibuat menebak apakah yang barusan masuk
 * itu sungguhan.
 */
import "dotenv/config";
import {
  kirimPeringatan,
  penerimaEmail,
  chatUntukSite,
  subjekPeringatan,
  tujuanWhatsapp,
  type RingkasanSiklus,
} from "@/lib/kirim-peringatan";

const site = process.argv[2] || "ccp";

/** Angka-angka ini karangan. Tidak ada prisma bernama UJI-1 di site mana pun. */
const contoh: RingkasanSiklus = {
  namaSite: `[UJI COBA] ${site}`,
  waktu: new Date().toISOString().slice(0, 19).replace("T", " "),
  naik: [
    { idPrisma: "UJI-1", dari: "Waspada", ke: "Siaga", nilaiMm: 134.7 },
    { idPrisma: "UJI-2", dari: "Normal", ke: "Awas", nilaiMm: 260.1 },
  ],
  pulih: [],
  hilang: [{ idPrisma: "UJI-3", siklus: 3 }],
  tetap: 6,
  acuanR0: "UJI-COBA",
  waktuAcuanR0: null,
};

/**
 * Keadaan sesi WhatsApp, kalau API-nya bisa dihubungi.
 *
 * Penyebab kegagalan yang paling sering bukan setelan yang salah, melainkan
 * sesi yang keluar sendiri — dan gejalanya di sisi pengirim cuma "gagal kirim"
 * tanpa menyebut sebabnya. Dipisah supaya jelas mana yang perlu diperbaiki:
 * scan QR ulang di server, atau betulkan .env di sini.
 */
async function periksaSesiWa() {
  const url = (process.env.WHATSAPP_API_URL || "").replace(/\/+$/, "");
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) return;

  const sesi = process.env.WHATSAPP_SESSION || "beacon";
  try {
    const res = await fetch(`${url}/session/status/${encodeURIComponent(sesi)}`, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    const isi = (await res.json().catch(() => null)) as
      | { success?: boolean; state?: string; message?: string; error?: string }
      | null;
    const ket = isi?.state || isi?.message || isi?.error || `HTTP ${res.status}`;
    console.log(`  ${"status sesi".padEnd(20)} ${ket}`);
    if (isi?.state !== "CONNECTED") {
      console.log("  ⚠ sesi belum tersambung — scan QR ulang di Server 3 sebelum mengandalkan kanal ini");
    }
  } catch (e) {
    console.log(`  ${"status sesi".padEnd(20)} tak terjangkau — ${e instanceof Error ? e.message : e}`);
  }
}

function tandai(label: string, nilai: string | null | undefined, rahasia = false) {
  const isi = nilai ? (rahasia ? `terisi (${nilai.length} karakter)` : nilai) : "— kosong —";
  console.log(`  ${label.padEnd(20)} ${isi}`);
}

async function main() {
  console.log(`\nSite: ${site}\n`);
  console.log("SMTP");
  tandai("SMTP_HOST", process.env.SMTP_HOST);
  tandai("SMTP_PORT", process.env.SMTP_PORT || "587 (bawaan)");
  tandai("SMTP_USER", process.env.SMTP_USER);
  // Password tidak pernah dicetak: keluaran skrip sering ditempel ke chat
  // saat minta bantuan. Panjangnya saja sudah cukup untuk melihat salah tempel.
  tandai("SMTP_PASS", process.env.SMTP_PASS, true);
  tandai("SMTP_SECURE", process.env.SMTP_SECURE || "ikut port");
  tandai("pengirim", process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER);

  const penerima = penerimaEmail(site);
  console.log(`\nPenerima email (${penerima.length})`);
  if (penerima.length === 0) console.log("  — kosong —");
  for (const p of penerima) console.log(`  ${p}`);

  console.log("\nTelegram");
  tandai("token", process.env.TELEGRAM_BOT_TOKEN, true);
  tandai("chat id", chatUntukSite(site));

  console.log("\nWhatsApp");
  tandai("WHATSAPP_API_URL", process.env.WHATSAPP_API_URL);
  tandai("WHATSAPP_API_KEY", process.env.WHATSAPP_API_KEY, true);
  tandai("sesi", process.env.WHATSAPP_SESSION || "beacon (bawaan)");
  const waTujuan = tujuanWhatsapp(site);
  tandai("tujuan", waTujuan.length > 0 ? waTujuan.join(", ") : null);
  await periksaSesiWa();

  console.log(`\nSubjek: ${subjekPeringatan(contoh)}`);
  console.log("\nMengirim…\n");

  const hasil = await kirimPeringatan(site, contoh);

  for (const k of hasil.kanal) {
    const status = k.hasil.ok
      ? "TERKIRIM"
      : "mati" in k.hasil && k.hasil.mati
        ? "tidak disetel"
        : `GAGAL — ${"galat" in k.hasil ? k.hasil.galat : "?"}`;
    console.log(`  ${k.nama.padEnd(10)} ${status}`);
  }

  console.log(
    hasil.ok
      ? "\nBerhasil. Periksa kotak masuk — cek juga folder spam untuk kiriman pertama.\n"
      : `\nTidak ada yang berangkat: ${hasil.galat}\n`
  );
  // Keluar 0 hanya kalau ada yang benar-benar sampai, supaya bisa dipakai di
  // pemeriksaan otomatis tanpa membaca keluarannya.
  process.exit(hasil.ok ? 0 : 1);
}

main();
