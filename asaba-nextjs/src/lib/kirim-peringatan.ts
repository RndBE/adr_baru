/**
 * Menyusun dan mengirim pesan peringatan.
 *
 * Dua kanal, keduanya opsional dan berdiri sendiri: Telegram dan email. Telegram
 * lebih dulu ada karena gratis, tanpa proses persetujuan template, dan cukup
 * satu panggilan fetch dari server.
 *
 * Email menyusul karena Telegram mensyaratkan penerimanya memasang Telegram dan
 * bergabung ke grup yang benar — dan di instansi yang memakai alat ini, orang
 * yang harus tahu lebih dulu justru yang paling kecil kemungkinannya melakukan
 * itu. Alamat email mereka sudah ada sebelum sistem ini dipasang. SMTP juga
 * berbagi sifat yang membuat Telegram dipilih duluan: bisa dipakai dengan kotak
 * surat yang sudah dimiliki organisasi, tanpa mendaftar layanan baru dan tanpa
 * persetujuan template — tidak seperti WhatsApp Cloud API, yang dulu disebut di
 * sini sebagai kandidat kanal kedua dan justru gugur karena syarat itu.
 *
 * Keduanya dikirim BERBARENGAN, dan berhasilnya satu kanal sudah cukup untuk
 * menandai peringatan sebagai terkirim. Alasannya sepihak: yang diukur di sini
 * adalah apakah ADA orang yang sempat diberi tahu, bukan apakah semua jalur
 * sehat. Kanal yang gagal tetap ditulis ke `log_peringatan.galat` supaya jalur
 * yang diam-diam rusak tidak bersembunyi di balik jalur yang masih jalan.
 *
 * /api/notifikasi yang sudah ada TIDAK dipakai ulang. Ia menembak
 * fcm.googleapis.com/fcm/send — API FCM lama yang Google matikan pertengahan
 * 2024 — isinya soal "Kontrol Sedang Digunakan" bukan pergeseran, dan tidak ada
 * satu pun pemanggilnya di seluruh src/.
 *
 * Tidak ada fungsi di berkas ini yang boleh melempar. Pemanggilnya ada di jalur
 * ingestion; peringatan yang gagal tidak boleh ikut menjatuhkan penerimaan data.
 */
import { type StatusLabel, statusTerburuk } from "@/lib/ambang";

export interface BarisPerubahan {
  idPrisma: string;
  dari: StatusLabel;
  ke: StatusLabel;
  nilaiMm: number;
}

/** Keadaan satu prisma pada akhir siklus. `nilaiMm` null berarti tidak terbaca. */
export interface BarisPrisma {
  idPrisma: string;
  tingkat: StatusLabel;
  nilaiMm: number | null;
}

export interface RingkasanSiklus {
  namaSite: string;
  waktu: string;
  /** Kenaikan tingkat — inti pesannya. */
  naik: BarisPerubahan[];
  /** Kembali ke Normal dari tingkat yang pernah dikirim. */
  pulih: BarisPerubahan[];
  /** Prisma yang gagal ditembak beberapa siklus beruntun — eskalasi, dilaporkan sekali. */
  hilang: Array<{ idPrisma: string; siklus: number }>;
  /**
   * Keadaan SELURUH prisma terdaftar pada siklus ini — tingkat dan angkanya.
   *
   * Menggantikan hitungan "n prisma lain tidak berubah tingkat" beserta daftar
   * "n prisma tidak terbaca". Keduanya menyatakan sesuatu TIDAK terjadi, dan
   * menyisakan pertanyaan yang sebenarnya dipunyai penerima: prisma mana, sedang
   * di tingkat apa, bergeser berapa. Daftar penuh menjawabnya sekaligus, dan
   * jumlahnya selalu genap dengan prisma terdaftar tanpa perlu dihitung sendiri.
   */
  semua: BarisPrisma[];
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
  const baris: string[] = [`${r.namaSite} — siklus ${r.waktu}`];

  // Baris kosong hanya kalau memang ada daftar di bawahnya. Tanpa penjagaan ini,
  // siklus yang cuma melaporkan prisma hilang memuat dua baris kosong berturut —
  // di WhatsApp itu terbaca seperti ada isi yang gagal termuat.
  if (r.naik.length > 0 || r.pulih.length > 0) {
    baris.push("");
    for (const p of r.naik) {
      baris.push(
        `${p.idPrisma.padEnd(LEBAR_ID)} ${p.dari} → ${p.ke}  ${Math.round(p.nilaiMm)} mm`
      );
    }
    for (const p of r.pulih) {
      baris.push(`${p.idPrisma.padEnd(LEBAR_ID)} ${p.dari} → Normal  ${Math.round(p.nilaiMm)} mm`);
    }
  }

  // Daftar lengkap, bukan hitungan. Penerima yang melihat "P7 naik ke Siaga"
  // langsung bertanya bagaimana yang lain — dan jawabannya harus ada di pesan
  // yang sama, bukan menunggu ia membuka dasbor.
  if (r.semua.length > 0) {
    baris.push("");
    baris.push("Keadaan seluruh prisma:");
    for (const p of r.semua) {
      const angka =
        p.nilaiMm === null
          ? "tidak terbaca"
          : `${String(Math.round(p.nilaiMm)).padStart(4)} mm`;
      baris.push(`${p.idPrisma.padEnd(LEBAR_ID)} ${p.tingkat.padEnd(8)} ${angka}`);
    }
  }

  baris.push("");

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

/**
 * Hasil satu kanal.
 *
 * `mati` memisahkan "kanal ini memang tidak dipasang" dari "kanal ini dipasang
 * tapi gagal". Keduanya sama-sama bukan pengiriman, tapi hanya yang kedua
 * pantas muncul di `log_peringatan.galat` — kalau yang pertama ikut dicatat,
 * pemasangan yang sengaja memakai satu kanal saja akan menghasilkan keluhan di
 * setiap baris, dan kolom itu berhenti dibaca.
 */
export type HasilKirim =
  /** `catatan` untuk keberhasilan yang tidak bulat — mis. 3 dari 4 nomor WhatsApp sampai. */
  | { ok: true; catatan?: string }
  | { ok: false; galat: string; mati?: boolean };

/**
 * Akhiran env per site: huruf besar, selain huruf dan angka jadi garis bawah.
 *
 * Satu fungsi, bukan satu salinan per kanal. Aturan ini menentukan env mana
 * yang terbaca; dua salinan yang lepas sinkron berarti satu kanal diam-diam
 * membaca kunci yang berbeda dari kanal lain untuk site yang sama, dan itu baru
 * ketahuan saat peringatan tidak sampai.
 */
function kunciSite(site: string): string {
  return site.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/**
 * Chat tujuan untuk sebuah site.
 *
 * Per site, bukan satu untuk semua: operator satu bendungan tidak perlu
 * dibangunkan notifikasi tambang di provinsi lain. TELEGRAM_CHAT_ID tanpa
 * akhiran dipakai sebagai cadangan supaya site baru tidak diam-diam kehilangan
 * peringatan sebelum chat-nya dibuat.
 */
export function chatUntukSite(site: string): string | null {
  return process.env[`TELEGRAM_CHAT_ID_${kunciSite(site)}`] || process.env.TELEGRAM_CHAT_ID || null;
}

export async function kirimTelegram(site: string, teks: string): Promise<HasilKirim> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, galat: "TELEGRAM_BOT_TOKEN belum disetel", mati: true };

  const chatId = chatUntukSite(site);
  if (!chatId) {
    return { ok: false, galat: `chat Telegram untuk site "${site}" belum disetel`, mati: true };
  }

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

// ── Email ───────────────────────────────────────────────────────────────────

/**
 * Penerima email untuk sebuah site, sudah dibersihkan dan tanpa kembar.
 *
 * Pola kuncinya sama persis dengan Telegram — ALERT_EMAIL_TO_<SITE> dengan
 * ALERT_EMAIL_TO sebagai cadangan — supaya orang yang sudah memasang satu kanal
 * tidak perlu mempelajari aturan kedua untuk memasang yang lain.
 *
 * Pemisahnya koma, titik koma, atau baris baru sekaligus. Daftar alamat ditulis
 * manusia ke dalam berkas .env, dan menuntut satu pemisah yang tepat hanya
 * menghasilkan alamat yang diam-diam tidak pernah dikirimi.
 *
 * Penyaringnya sengaja longgar — ada "@", ada titik sesudahnya, tidak ada spasi
 * — bukan pemeriksaan RFC. Yang perlu dicegah di sini cuma potongan yang jelas
 * bukan alamat (sisa koma, catatan yang ikut tersalin) supaya seluruh kiriman
 * tidak ditolak server gara-gara satu entri rusak; menghakimi alamat yang
 * bentuknya tidak biasa bukan tugas berkas ini.
 */
export function penerimaEmail(site: string): string[] {
  const mentah = process.env[`ALERT_EMAIL_TO_${kunciSite(site)}`] || process.env.ALERT_EMAIL_TO || "";
  const terlihat = new Set<string>();
  const hasil: string[] = [];
  for (const bagian of mentah.split(/[,;\s]+/)) {
    const alamat = bagian.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alamat)) continue;
    const kunci = alamat.toLowerCase();
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push(alamat);
  }
  return hasil;
}

/**
 * Tingkat paling gawat yang DINAIKI siklus ini. Null bila tidak ada kenaikan.
 *
 * Diambil dari `ke`, bukan `dari`: yang menentukan seberapa mendesak pesan ini
 * adalah keadaan sesudahnya.
 */
export function tingkatTerburuk(r: RingkasanSiklus): StatusLabel | null {
  return statusTerburuk(r.naik.map((p) => p.ke));
}

/**
 * Baris subjek.
 *
 * Ini satu-satunya bagian pesan yang pasti terbaca — di layar kunci, di daftar
 * masuk, di pratinjau notifikasi — jadi tingkat dan nama site harus ada di
 * dalamnya, bukan hanya di badan surat. Tingkat ditaruh paling depan dalam
 * kurung siku supaya bisa dijadikan aturan penyaring di sisi penerima, dan
 * supaya kolom subjek yang terpotong tetap menyisakan bagian yang menentukan.
 */
export function subjekPeringatan(r: RingkasanSiklus): string {
  const terburuk = tingkatTerburuk(r);

  if (terburuk) {
    const n = r.naik.length;
    const apa = n === 1 ? `prisma ${r.naik[0].idPrisma}` : `${n} prisma`;
    return `[${terburuk}] ${r.namaSite} — ${apa} naik ke ${terburuk}`;
  }
  if (r.pulih.length > 0) {
    const n = r.pulih.length;
    const apa = n === 1 ? `prisma ${r.pulih[0].idPrisma}` : `${n} prisma`;
    return `[Pulih] ${r.namaSite} — ${apa} kembali Normal`;
  }
  if (r.hilang.length > 0) {
    const n = r.hilang.length;
    const apa = n === 1 ? `Prisma ${r.hilang[0].idPrisma}` : `${n} prisma`;
    return `[Prisma hilang] ${r.namaSite} — ${apa} gagal ditembak`;
  }
  return `${r.namaSite} — siklus ${r.waktu}`;
}

/**
 * Warna tingkat untuk surat.
 *
 * Nilai harfiah, bukan var(--st-*) seperti di layar: surat tidak membawa
 * globals.css, dan klien email tidak menjalankan custom property. Angkanya
 * disalin dari `.tema-monitoring` di src/app/globals.css dan HARUS ikut berubah
 * kalau yang di sana berubah — kalau tidak, warna yang sama berarti tingkat
 * yang berbeda di dua tempat, yang lebih menyesatkan daripada tanpa warna.
 */
const WARNA_SURAT: Record<StatusLabel, string> = {
  Normal: "#0ca30c",
  Waspada: "#fab219",
  Siaga: "#ec835a",
  Awas: "#d03b3b",
};

/** Teks apa pun yang masuk HTML lewat sini. Nama site dan id prisma berasal dari basis data. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function barisTabel(p: BarisPerubahan, tekan: boolean): string {
  const warna = WARNA_SURAT[p.ke];
  return (
    `<tr>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${esc(p.idPrisma)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${esc(p.dari)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${warna};font-weight:${tekan ? 700 : 400}">${esc(p.ke)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">${Math.round(p.nilaiMm)} mm</td>` +
    `</tr>`
  );
}

/**
 * Badan HTML.
 *
 * Tabel dan gaya sebaris, bukan CSS di <head> maupun flexbox: sebagian klien
 * email membuang <style> dan tidak satu pun bisa diandalkan untuk tata letak
 * modern. Yang dikejar di sini bukan keindahan, cuma supaya tingkat dan
 * angkanya terbaca di layar ponsel tanpa perlu diperbesar.
 */
export function susunHtml(r: RingkasanSiklus): string {
  const terburuk = tingkatTerburuk(r);
  const warnaKepala = terburuk ? WARNA_SURAT[terburuk] : "#6b7280";
  const judul = terburuk
    ? `${terburuk} — ${esc(r.namaSite)}`
    : r.pulih.length > 0
      ? `Pulih — ${esc(r.namaSite)}`
      : esc(r.namaSite);

  const bagian: string[] = [];
  bagian.push(
    `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">`
  );
  bagian.push(
    `<div style="background:${warnaKepala};color:#ffffff;padding:16px 20px;border-radius:6px 6px 0 0">` +
      `<div style="font-size:18px;font-weight:700">${judul}</div>` +
      `<div style="font-size:13px;opacity:.9;margin-top:4px">Siklus ${esc(r.waktu)}</div>` +
      `</div>`
  );
  bagian.push(`<div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 6px 6px;padding:4px 0">`);

  if (r.naik.length > 0 || r.pulih.length > 0) {
    bagian.push(`<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">`);
    bagian.push(
      `<tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">` +
        `<th style="padding:8px 12px;font-weight:600">Prisma</th>` +
        `<th style="padding:8px 12px;font-weight:600">Dari</th>` +
        `<th style="padding:8px 12px;font-weight:600">Jadi</th>` +
        `<th style="padding:8px 12px;font-weight:600;text-align:right">Pergeseran</th>` +
        `</tr>`
    );
    for (const p of r.naik) bagian.push(barisTabel(p, true));
    for (const p of r.pulih) bagian.push(barisTabel({ ...p, ke: "Normal" }, false));
    bagian.push(`</table>`);
  }

  if (r.semua.length > 0) {
    bagian.push(
      `<div style="padding:10px 12px 2px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600">Keadaan seluruh prisma</div>`
    );
    bagian.push(`<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">`);
    for (const p of r.semua) {
      const warna = WARNA_SURAT[p.tingkat];
      const angka = p.nilaiMm === null ? "tidak terbaca" : `${Math.round(p.nilaiMm)} mm`;
      bagian.push(
        `<tr>` +
          `<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace">${esc(p.idPrisma)}</td>` +
          `<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:${warna}">${esc(p.tingkat)}</td>` +
          `<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;` +
          `${p.nilaiMm === null ? "color:#9ca3af;font-style:italic" : ""}">${esc(angka)}</td>` +
          `</tr>`
      );
    }
    bagian.push(`</table>`);
  }

  const catatan: string[] = [];
  for (const h of r.hilang) {
    catatan.push(`Prisma ${esc(h.idPrisma)} gagal ditembak (${h.siklus} siklus beruntun).`);
  }
  // Bukan hiasan: penerima perlu tahu angka itu diukur terhadap apa, terutama
  // kalau acuannya pernah diganti.
  if (r.acuanR0) {
    catatan.push(
      `Acuan R0: sesi ${esc(r.acuanR0)}${r.waktuAcuanR0 ? ` · ${esc(r.waktuAcuanR0)}` : ""}`
    );
  }
  if (catatan.length > 0) {
    bagian.push(
      `<div style="padding:12px 12px 14px;font-size:13px;color:#6b7280;line-height:1.6">` +
        catatan.join("<br>") +
        `</div>`
    );
  }

  bagian.push(`</div></div>`);
  return bagian.join("");
}

interface KonfigSmtp {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

function konfigSmtp(): KonfigSmtp | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    host,
    port,
    // 465 itu SMTPS — TLS dari awal. 587 memakai STARTTLS, yang di nodemailer
    // justru berarti secure:false. Menyetelnya terbalik menggantung koneksi
    // sampai tenggat, bukan menolaknya dengan jelas, jadi bawaannya diturunkan
    // dari port dan hanya bisa ditimpa kalau memang disengaja.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    // Relay internal instansi sering menerima tanpa kredensial.
    auth: user && pass ? { user, pass } : undefined,
  };
}

/** Alamat pengirim. Jatuh ke SMTP_USER karena banyak relay menolak From yang bukan akunnya. */
function alamatPengirim(): string | null {
  return process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || null;
}

type Transporter = { sendMail: (opsi: Record<string, unknown>) => Promise<unknown> };

const globalUntukSmtp = globalThis as unknown as { transporterPeringatan?: Transporter };

/**
 * Transporter dipakai ulang antar panggilan.
 *
 * Membuatnya per pesan berarti jabat tangan TCP dan TLS baru tiap siklus. Lebih
 * penting lagi: di dev, HMR memuat ulang modul ini tiap berkas berubah, dan
 * tanpa cache di globalThis tiap muatan meninggalkan kolam koneksinya sendiri.
 * Pola yang sama dengan src/lib/prisma.ts, dan alasannya sama.
 *
 * Impor nodemailer sengaja DINAMIS. Berkas ini ditarik oleh /api/datamasuk/adr
 * lewat evaluasi-siklus; impor statis membuat kegagalan memuat nodemailer —
 * versi tak cocok, dependensi belum terpasang di suatu penyebaran — menjatuhkan
 * seluruh rute penerimaan data, padahal email cuma kanal pemberitahuan.
 */
async function transporter(): Promise<Transporter | null> {
  if (globalUntukSmtp.transporterPeringatan) return globalUntukSmtp.transporterPeringatan;

  const cfg = konfigSmtp();
  if (!cfg) return null;

  const { default: nodemailer } = await import("nodemailer");
  const t = nodemailer.createTransport({
    ...cfg,
    // Alasan yang sama dengan AbortSignal.timeout pada Telegram: ini berjalan di
    // dalam after(), dan soket yang menggantung menahan konteks request sampai
    // batas durasi route. Bawaan nodemailer jauh lebih longgar dari itu.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    maxConnections: 1,
  }) as unknown as Transporter;

  globalUntukSmtp.transporterPeringatan = t;
  return t;
}

export async function kirimEmail(site: string, r: RingkasanSiklus): Promise<HasilKirim> {
  const penerima = penerimaEmail(site);
  if (penerima.length === 0) {
    return { ok: false, galat: `email untuk site "${site}" belum disetel`, mati: true };
  }

  const dari = alamatPengirim();
  if (!dari) return { ok: false, galat: "SMTP_HOST/ALERT_EMAIL_FROM belum disetel", mati: true };

  try {
    const t = await transporter();
    if (!t) return { ok: false, galat: "SMTP_HOST belum disetel", mati: true };

    await t.sendMail({
      from: dari,
      // bcc, bukan to: daftar penerima peringatan adalah siapa yang dianggap
      // bertanggung jawab atas sebuah site, dan itu tidak perlu ikut terkirim ke
      // semua orang di daftar yang sama.
      to: dari,
      bcc: penerima,
      subject: subjekPeringatan(r),
      // Teks yang sama dengan Telegram sebagai bagian alternatif, supaya isi
      // pesannya tetap sama di kanal mana pun ia dibaca.
      text: susunTeks(r),
      html: susunHtml(r),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : String(e) };
  }
}

// ── WhatsApp ────────────────────────────────────────────────────────────────
//
// Lewat wwebjs-api di Server 3 — pembungkus REST untuk whatsapp-web.js.
// Dokumentasinya di be-server/docs/servers/server-3-wwebjs-api.md.
//
// Ini klien TIDAK RESMI: WhatsApp tidak mengizinkannya, dan penulis pustakanya
// sendiri tidak menjamin akun bebas dari pemblokiran. Konsekuensinya untuk
// berkas ini bukan teoretis — kanal ini bisa mati tanpa pemberitahuan, entah
// karena akunnya diblokir, sesinya keluar sendiri, atau WhatsApp Web berubah
// bentuk. Per 15 September 2026 sebagian endpoint pembaca chat di server itu
// memang sudah rusak (`error: "r"`) karena ketidakcocokan dengan hulu, dan
// belum ada perbaikannya.
//
// Karena itu WhatsApp ditaruh sebagai kanal TAMBAHAN, tidak pernah satu-satunya
// yang diandalkan. `sendMessage` kebetulan termasuk yang masih jalan, tapi
// "kebetulan masih jalan" bukan dasar yang pantas untuk peringatan keselamatan
// berdiri sendirian di atasnya.

const WA_SESI_BAWAAN = "beacon";

/**
 * Nomor telepon Indonesia menjadi chatId WhatsApp.
 *
 * Yang ditulis orang di .env tidak seragam: "0812-8888-8888", "+62 812 8888
 * 8888", "62812 8888888" semuanya nomor yang sama. Yang diminta API cuma satu
 * bentuk — `6281288888888@c.us`, tanpa plus, tanpa nol depan, tanpa pemisah.
 *
 * Id grup (`@g.us`) dan chatId yang sudah lengkap dilewatkan apa adanya: grup
 * justru bentuk yang paling masuk akal untuk peringatan, karena satu panggilan
 * API menjangkau seluruh piket tanpa perlu daftar nomor yang harus diurus tiap
 * kali orangnya berganti.
 *
 * Null bila tidak bisa ditafsirkan sebagai nomor Indonesia. Menebak di sini
 * berbahaya: nomor yang salah tafsir bukan berarti gagal kirim, melainkan
 * peringatan yang sampai ke ORANG LAIN.
 */
export function chatIdWhatsapp(mentah: string): string | null {
  const bersih = mentah.trim();
  if (!bersih) return null;

  // Sudah berbentuk chatId — grup atau perorangan.
  if (/^\d+@(c\.us|g\.us)$/.test(bersih)) return bersih;
  // Id grup tanpa akhiran: grup WhatsApp memakai belasan digit. Yang diawali "0"
  // atau "62" DIKECUALIKAN — keduanya jelas percobaan menulis nomor telepon, dan
  // sebelum pengecualian ini nomor kepanjangan seperti "0812888888888888" lolos
  // sebagai id grup, yang berarti peringatan berangkat ke percakapan yang sama
  // sekali bukan tujuannya. Ditangkap oleh uji "terlalu panjang ditolak".
  if (/^\d{15,}$/.test(bersih) && !bersih.startsWith("62") && !bersih.startsWith("0")) {
    return `${bersih}@g.us`;
  }

  const digit = bersih.replace(/[\s\-().+]/g, "");
  if (!/^\d+$/.test(digit)) return null;

  let nasional: string;
  if (digit.startsWith("62")) nasional = digit.slice(2);
  else if (digit.startsWith("0")) nasional = digit.slice(1);
  else return null; // Bukan format yang dikenal — lebih baik diam daripada salah orang.

  // Nomor seluler Indonesia: 9–13 digit sesudah kode negara, selalu mulai 8.
  if (!nasional.startsWith("8") || nasional.length < 9 || nasional.length > 13) return null;

  return `62${nasional}@c.us`;
}

/** Tujuan WhatsApp untuk sebuah site. Aturan kuncinya sama dengan kanal lain. */
export function tujuanWhatsapp(site: string): string[] {
  const mentah = process.env[`WHATSAPP_TO_${kunciSite(site)}`] || process.env.WHATSAPP_TO || "";
  const terlihat = new Set<string>();
  const hasil: string[] = [];
  for (const bagian of mentah.split(/[,;\s]+/)) {
    const chatId = chatIdWhatsapp(bagian);
    if (!chatId || terlihat.has(chatId)) continue;
    terlihat.add(chatId);
    hasil.push(chatId);
  }
  return hasil;
}

/**
 * Teks untuk WhatsApp: sama dengan kanal lain, dengan baris pertama ditebalkan
 * dan diberi tanda tingkat.
 *
 * Isi yang sama persis di tiap kanal itu disengaja — penerima yang membaca dari
 * dua tempat tidak boleh mendapat dua cerita. Yang ditambahkan cuma penanda
 * tingkat di depan, karena di daftar chat WhatsApp yang terlihat hanya potongan
 * awal pesan, sama seperti baris subjek pada email.
 */
export function susunTeksWa(r: RingkasanSiklus): string {
  const terburuk = tingkatTerburuk(r);
  const tanda = terburuk ?? (r.pulih.length > 0 ? "Pulih" : null);
  const isi = susunTeks(r);
  const [pertama, ...sisa] = isi.split("\n");
  return [`*${tanda ? `[${tanda}] ` : ""}${pertama}*`, ...sisa].join("\n");
}

async function kirimSatuWa(
  url: string,
  key: string,
  sesi: string,
  chatId: string,
  teks: string
): Promise<{ chatId: string; ok: boolean; galat?: string }> {
  try {
    const res = await fetch(`${url}/client/sendMessage/${encodeURIComponent(sesi)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ chatId, contentType: "string", content: teks }),
      // Alasan yang sama dengan Telegram dan SMTP: ini berjalan di dalam after().
      signal: AbortSignal.timeout(15_000),
    });

    const isi = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: string; message?: unknown }
      | null;

    if (!res.ok) {
      // 403 = x-api-key salah, 404 = sesi tidak ada, 422 = body ditolak.
      const sebab = isi?.error ?? `HTTP ${res.status}`;
      return { chatId, ok: false, galat: `${res.status} ${sebab}`.slice(0, 120) };
    }
    // Jebakan pertama: API ini bisa menjawab 200 dengan success:false.
    if (isi?.success !== true) {
      return { chatId, ok: false, galat: (isi?.error ?? "success:false").slice(0, 120) };
    }
    // JANGAN tambahkan syarat `isi.message` harus ada. Pernah ditambahkan
    // 17 September 2026 dengan alasan yang terdengar masuk akal — controller
    // wwebjs-api menutup dengan `res.json({ success: true, message: messageOut })`
    // tanpa memeriksa messageOut, jadi kunci `message` yang hilang tampak seperti
    // pesan yang tidak pernah terbentuk.
    //
    // Itu keliru, dan dibuktikan keliru oleh tangkapan layar grup tujuan: SELURUH
    // kiriman yang dijawab tanpa `message` tetap sampai, termasuk peringatan Awas
    // pukul 07.24 untuk P4 dan P5. Yang gagal cuma pencarian nilai kembalinya —
    // Utils.js menutup dengan `Msg.get(newMsgKey._serialized)`, dan koleksi Msg
    // di WhatsApp Web sekarang tidak lagi berbentuk seperti yang dibacanya.
    // Pengirimannya sendiri sudah tuntas satu baris sebelumnya, di
    // `addAndSendMsgToChat`, yang di-await karena controller menyetel
    // `waitUntilMsgSent: true`.
    //
    // Jadi `success: true` DI SINI memang berarti terkirim. Menuntut `message`
    // membuat peringatan yang benar-benar sampai tercatat gagal — persis
    // kekeliruan yang berlawanan arah, dan sama merusaknya bagi riwayat.
    return { chatId, ok: true };
  } catch (e) {
    return { chatId, ok: false, galat: e instanceof Error ? e.message : String(e) };
  }
}

export async function kirimWhatsapp(site: string, r: RingkasanSiklus): Promise<HasilKirim> {
  const url = (process.env.WHATSAPP_API_URL || "").replace(/\/+$/, "");
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) {
    return { ok: false, galat: "WHATSAPP_API_URL/WHATSAPP_API_KEY belum disetel", mati: true };
  }

  const tujuan = tujuanWhatsapp(site);
  if (tujuan.length === 0) {
    return { ok: false, galat: `WhatsApp untuk site "${site}" belum disetel`, mati: true };
  }

  const sesi = process.env.WHATSAPP_SESSION || WA_SESI_BAWAAN;
  const teks = susunTeksWa(r);

  // Berbarengan, bukan berurutan: tiap tujuan satu panggilan API, dan menunggu
  // giliran membuat tenggat 15 detik terkalikan jumlah penerima di dalam
  // after(). Jumlahnya segelintir — ini daftar piket, bukan pengiriman massal
  // yang diperingatkan dokumentasi servernya.
  const hasil = await Promise.all(tujuan.map((c) => kirimSatuWa(url, key, sesi, c, teks)));

  const gagal = hasil.filter((h) => !h.ok);
  if (gagal.length === 0) return { ok: true };

  // Sebagian sampai tetap dihitung sampai — sama dengan aturan antar kanal —
  // tapi yang gagal disebut nomornya, karena satu nomor yang diam-diam tidak
  // pernah menerima apa pun tidak akan ketahuan dengan cara lain.
  const rincian = gagal.map((h) => `${h.chatId.replace(/@.*/, "")}: ${h.galat}`).join(", ");
  if (gagal.length < hasil.length) {
    return { ok: true, catatan: `${gagal.length} dari ${hasil.length} tujuan gagal — ${rincian}`.slice(0, 200) };
  }
  return { ok: false, galat: `WhatsApp ${rincian}`.slice(0, 200) };
}

// ── Fan-out ─────────────────────────────────────────────────────────────────

export type NamaKanal = "telegram" | "email" | "whatsapp";

export interface HasilPeringatan {
  /** Benar bila SETIDAKNYA SATU kanal berhasil. Lihat catatan di kepala berkas. */
  ok: boolean;
  /** Kanal yang gagal padahal dipasang, plus keberhasilan yang tidak bulat. Null bila tidak ada. */
  galat: string | null;
  kanal: Array<{ nama: NamaKanal; hasil: HasilKirim }>;
}

/**
 * Kirim satu ringkasan siklus ke seluruh kanal yang dipasang.
 *
 * Berbarengan, bukan berurutan: ketiganya berjalan di dalam after() dengan
 * anggaran waktu yang sama, dan menunggu satu selesai sebelum memulai yang
 * berikutnya menjumlahkan tenggatnya. Ketiganya juga tidak saling bergantung —
 * WhatsApp tetap harus berangkat walau token Telegram kedaluwarsa, dan email
 * tetap berangkat walau sesi WhatsApp-nya keluar sendiri.
 */
export async function kirimPeringatan(
  site: string,
  r: RingkasanSiklus
): Promise<HasilPeringatan> {
  const [telegram, email, whatsapp] = await Promise.all([
    kirimTelegram(site, susunTeks(r)),
    kirimEmail(site, r),
    kirimWhatsapp(site, r),
  ]);

  const kanal = [
    { nama: "telegram" as const, hasil: telegram },
    { nama: "email" as const, hasil: email },
    { nama: "whatsapp" as const, hasil: whatsapp },
  ];

  const ok = kanal.some((k) => k.hasil.ok);
  const terpasang = kanal.filter((k) => k.hasil.ok || !("mati" in k.hasil && k.hasil.mati));

  if (terpasang.length === 0) {
    // Tidak satu pun kanal dipasang. Ini BUKAN keadaan diam yang wajar — evaluasi
    // memang memutuskan ada yang perlu dikabarkan, dan tidak ada yang menerimanya.
    return { ok: false, galat: "tidak ada kanal peringatan yang disetel", kanal };
  }

  // Keberhasilan yang tidak bulat ikut dilaporkan: kanal yang "berhasil" padahal
  // separuh tujuannya tidak tersentuh tidak boleh terlihat sama dengan yang mulus.
  const keluhan = terpasang
    .map((k) => {
      if (!k.hasil.ok) return `${k.nama}: ${k.hasil.galat}`;
      return k.hasil.catatan ? `${k.nama}: ${k.hasil.catatan}` : null;
    })
    .filter((x): x is string => x !== null);

  return { ok, galat: keluhan.length > 0 ? keluhan.join(" | ") : null, kanal };
}
