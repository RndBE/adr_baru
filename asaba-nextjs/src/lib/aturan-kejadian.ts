/**
 * Aturan kejadian alarm: kapan dibuka, kapan sirene disenyapkan, kapan boleh
 * diverifikasi, dan isi pesan WhatsApp-nya.
 *
 * Modul ini MURNI — tanpa basis data, tanpa MQTT, tanpa peramban — supaya
 * aturannya bisa dikunci oleh aturan-kejadian.test.ts dan dipakai bersama
 * oleh server (evaluasi-siklus, API) dan banner di peramban.
 *
 * ── Alurnya ─────────────────────────────────────────────────────────────────
 *
 *   1. Tingkat site naik di atas Normal di akhir siklus → kejadian DIBUKA.
 *      Sirene, lampu, suara website, dan WhatsApp berjalan seperti biasa.
 *   2. Operator menekan Konfirmasi → sirene + lampu dikirimi level 0 dan suara
 *      di semua peramban berhenti. Status di website TETAP (mis. Siaga).
 *   3. Operator mengecek lapangan lalu memverifikasi: benar atau palsu, dengan
 *      catatan.
 *   4. Tingkat site kembali Normal → kejadian ditandai pulih. Yang belum
 *      diverifikasi tetap tampil sampai diverifikasi.
 *
 * Senyap hanya berlaku sampai tingkat yang dikonfirmasi. Konfirmasi Siaga
 * TIDAK boleh ikut membungkam Awas: begitu naik melewatinya, sirene berbunyi
 * lagi dan kejadian itu meminta konfirmasi ulang. Begitu juga prisma yang naik
 * sesudah konfirmasi (lihat naikSesudahKonfirmasi): konfirmasi DAN verifikasi
 * diulang.
 */
import { type StatusLabel, asStatusLabel, indeksStatus } from "@/lib/ambang";

// ─── Siklus hidup kejadian ──────────────────────────────────────────────────

/** Yang perlu diketahui tentang kejadian aktif untuk memutuskan langkahnya. */
export interface KejadianAktif {
  tingkatPuncak: StatusLabel;
  /** Prisma dan nilai saat puncak, untuk memutuskan apakah puncaknya diganti. */
  nilaiPuncakMm: number | null;
}

export type LangkahKejadian =
  | { jenis: "diam" }
  | { jenis: "buka" }
  | { jenis: "perbarui"; gantiPuncak: boolean }
  | { jenis: "pulih" };

/**
 * Langkah untuk kejadian site ini setelah satu siklus dinilai.
 *
 * Puncak diganti saat tingkatnya naik, atau tingkatnya sama dengan puncak tapi
 * nilainya lebih besar — riwayat menyebut prisma dan angka TERBURUK, bukan
 * yang kebetulan membukanya.
 */
export function langkahKejadian(
  aktif: KejadianAktif | null,
  tingkat: StatusLabel,
  nilaiMm: number | null
): LangkahKejadian {
  if (!aktif) return tingkat === "Normal" ? { jenis: "diam" } : { jenis: "buka" };
  if (tingkat === "Normal") return { jenis: "pulih" };

  const naik = indeksStatus(tingkat) > indeksStatus(aktif.tingkatPuncak);
  const samaLebihBesar =
    tingkat === aktif.tingkatPuncak &&
    nilaiMm !== null &&
    (aktif.nilaiPuncakMm === null || nilaiMm > aktif.nilaiPuncakMm);
  return { jenis: "perbarui", gantiPuncak: naik || samaLebihBesar };
}

/**
 * Prisma terburuk satu siklus: tingkat tertinggi, lalu nilai terbesar.
 * Null bila daftarnya kosong.
 */
export function prismaPuncak<T extends { idPrisma: string; tingkat: StatusLabel; nilaiMm: number | null }>(
  daftar: readonly T[]
): T | null {
  let hasil: T | null = null;
  for (const p of daftar) {
    if (!hasil) {
      hasil = p;
      continue;
    }
    const beda = indeksStatus(p.tingkat) - indeksStatus(hasil.tingkat);
    if (beda > 0 || (beda === 0 && (p.nilaiMm ?? -1) > (hasil.nilaiMm ?? -1))) hasil = p;
  }
  return hasil;
}

// ─── Senyap dan konfirmasi ──────────────────────────────────────────────────

/**
 * Sirene dan suara website disenyapkan? Ya bila sudah dikonfirmasi dan tingkat
 * sekarang tidak melebihi tingkat yang dikonfirmasi.
 */
export function senyapBerlaku(tingkat: StatusLabel, tingkatDikonfirmasi: StatusLabel | null): boolean {
  return (
    tingkat !== "Normal" &&
    tingkatDikonfirmasi !== null &&
    indeksStatus(tingkat) <= indeksStatus(tingkatDikonfirmasi)
  );
}

/** Kejadian aktif yang sedang membunyikan sirene dan menunggu operator. */
export function perluKonfirmasi(
  k: { aktif: boolean; tingkatTerakhir: StatusLabel; tingkatDikonfirmasi: StatusLabel | null }
): boolean {
  return k.aktif && k.tingkatTerakhir !== "Normal" && !senyapBerlaku(k.tingkatTerakhir, k.tingkatDikonfirmasi);
}

/**
 * Boleh diverifikasi? Setelah dikonfirmasi, atau setelah pulih sendiri.
 *
 * Kejadian aktif yang belum dikonfirmasi harus dikonfirmasi dulu: sirenenya
 * masih berbunyi, dan verifikasi bukan cara mematikannya.
 */
export function bolehVerifikasi(k: { aktif: boolean; dikonfirmasi: boolean }): boolean {
  return !k.aktif || k.dikonfirmasi;
}

// ─── Naik sesudah konfirmasi ────────────────────────────────────────────────
//
// Konfirmasi hanya mencakup yang sudah terjadi saat tombolnya ditekan. Senyap
// per SITE (senyapBerlaku) tidak cukup: P2 Awas dikonfirmasi, lalu P1 menyusul
// ke Awas — tingkat site tetap Awas, dan tanpa aturan ini pergeseran P1
// tenggelam diam-diam (23 Nov 2026 16:59). Setiap siklus, tingkat tiap prisma
// dibandingkan dengan tingkat tertinggi yang dicapainya sampai saat konfirmasi.
// Kalau ada yang melewatinya, konfirmasi dan verifikasi kejadian dibatalkan:
// sirene, suara, banner, dan modal menyala lagi lewat aturan yang sudah ada,
// dan prisma itu harus dicek ke lapangan.

/**
 * Tingkat tertinggi tiap prisma dari riwayat perubahan tingkatnya
 * (log_peringatan) sejak kejadian dibuka sampai jam konfirmasi.
 *
 * `sejak`: waktu acuan baru tiap prisma (acuan_prisma, lihat aturan-acuan.ts).
 * Riwayat prisma itu dari SEBELUM acuan baru tidak dihitung — pergeserannya
 * sudah diterima sebagai posisi baru, jadi naik lagi sesudahnya adalah
 * pergeseran baru yang harus membunyikan alarm. Waktu dalam ms jam dinding,
 * sama sumbernya dengan `waktuMs` riwayat.
 */
export function tingkatTercakup(
  riwayat: ReadonlyArray<{ idPrisma: string; ke: StatusLabel; waktuMs?: number }>,
  sejak?: ReadonlyMap<string, number>
): Map<string, StatusLabel> {
  const hasil = new Map<string, StatusLabel>();
  for (const r of riwayat) {
    const batas = sejak?.get(r.idPrisma);
    if (batas !== undefined && r.waktuMs !== undefined && r.waktuMs < batas) continue;
    const lama = hasil.get(r.idPrisma);
    if (!lama || indeksStatus(r.ke) > indeksStatus(lama)) hasil.set(r.idPrisma, r.ke);
  }
  return hasil;
}

/**
 * Prisma yang sekarang di atas tingkat yang tercakup konfirmasi: prisma lain
 * yang baru bergeser, atau prisma yang sama naik melewati tingkat
 * tertingginya. Prisma yang turun lalu kembali ke tingkat yang pernah
 * dikonfirmasi tidak dihitung — itu bukan kabar baru.
 */
export function naikSesudahKonfirmasi<T extends { idPrisma: string; tingkat: StatusLabel }>(
  sekarang: readonly T[],
  tercakup: ReadonlyMap<string, StatusLabel>
): T[] {
  return sekarang.filter(
    (p) => p.tingkat !== "Normal" && indeksStatus(p.tingkat) > indeksStatus(tercakup.get(p.idPrisma) ?? "Normal")
  );
}

/**
 * Catatan kejadian setelah alarmnya menyala lagi. Konfirmasi dan verifikasi
 * lama dikosongkan supaya diulang, jadi siapa dan kapan dicatat di sini —
 * catatan itu juga yang mengisi kolom catatan dialog verifikasi berikutnya.
 * Terlalu panjang: bagian TERTUA yang dipotong.
 */
export function catatanAlarmUlang(o: {
  catatan: string | null;
  waktu: string;
  naik: ReadonlyArray<{ idPrisma: string; tingkat: StatusLabel }>;
  dikonfirmasi: { oleh: string | null; waktu: string | null; tingkat: StatusLabel | null };
  diverifikasi: { hasil: HasilLapangan | null; oleh: string | null; waktu: string | null } | null;
}): string {
  const prisma = o.naik.map((p) => `${p.idPrisma} naik ke ${p.tingkat}`).join(", ");
  const konf = `dikonfirmasi${o.dikonfirmasi.tingkat ? ` ${o.dikonfirmasi.tingkat}` : ""} oleh ${
    o.dikonfirmasi.oleh ?? "operator"
  }, ${fmtWaktuPendek(o.dikonfirmasi.waktu)}`;
  const ver =
    o.diverifikasi && o.diverifikasi.hasil
      ? `; diverifikasi ${o.diverifikasi.hasil.toUpperCase()} oleh ${o.diverifikasi.oleh ?? "operator"}, ${fmtWaktuPendek(o.diverifikasi.waktu)}`
      : "";
  return tambahCatatan(o.catatan, `[${fmtWaktuPendek(o.waktu)}] Alarm menyala lagi: ${prisma}. Sebelumnya ${konf}${ver}.`);
}

/**
 * Satu baris riwayat di bawah catatan kejadian. Terlalu panjang: bagian TERTUA
 * yang dipotong, supaya tetap muat di batas validasi verifikasi.
 */
export function tambahCatatan(catatan: string | null, baris: string): string {
  const teks = catatan?.trim() ? `${catatan.trim()}\n${baris}` : baris;
  return teks.length > CATATAN_MAKS ? `…${teks.slice(-(CATATAN_MAKS - 1))}` : teks;
}

// ─── Verifikasi ─────────────────────────────────────────────────────────────

export type HasilLapangan = "benar" | "palsu";

export const PENYEBAB_PALSU = [
  "Derau / bacaan meloncat",
  "Prisma terhalang atau kotor",
  "Prisma tersenggol atau bergeser",
  "RTS bergeser atau goyang",
  "Cuaca (hujan, kabut, panas)",
  "Lainnya",
] as const;

export const CATATAN_MIN = 5;
export const CATATAN_MAKS = 1000;

export type HasilValidasiVerifikasi =
  | { ok: true; hasil: HasilLapangan; penyebab: string | null; catatan: string }
  | { ok: false; galat: string };

export function validasiVerifikasi(body: {
  hasil?: unknown;
  penyebab?: unknown;
  catatan?: unknown;
}): HasilValidasiVerifikasi {
  const hasil = body.hasil;
  if (hasil !== "benar" && hasil !== "palsu") {
    return { ok: false, galat: "Pilih hasil verifikasi: benar atau palsu" };
  }

  let penyebab: string | null = null;
  if (hasil === "palsu") {
    const p = typeof body.penyebab === "string" ? body.penyebab.trim() : "";
    if (!(PENYEBAB_PALSU as readonly string[]).includes(p)) {
      return { ok: false, galat: "Pilih penyebab alarm palsu" };
    }
    penyebab = p;
  }

  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  if (catatan.length < CATATAN_MIN) {
    return { ok: false, galat: `Catatan wajib diisi, minimal ${CATATAN_MIN} karakter` };
  }
  if (catatan.length > CATATAN_MAKS) {
    return { ok: false, galat: `Catatan paling banyak ${CATATAN_MAKS} karakter` };
  }

  return { ok: true, hasil, penyebab, catatan };
}

// ─── Bentuk data ke peramban ────────────────────────────────────────────────

/** Satu kejadian seperti yang dikirim API ke banner dan halaman riwayat. */
export interface KejadianRingkas {
  id: number;
  site: string;
  namaSite: string;
  /** Semua waktu "YYYY-MM-DD HH:mm:ss" jam dinding WIB. */
  mulai: string;
  tingkatPuncak: StatusLabel;
  tingkatTerakhir: StatusLabel;
  prismaPuncak: string | null;
  nilaiPuncakMm: number | null;
  pulih: string | null;
  dikonfirmasi: string | null;
  dikonfirmasiOleh: string | null;
  tingkatDikonfirmasi: StatusLabel | null;
  diverifikasi: string | null;
  diverifikasiOleh: string | null;
  hasil: HasilLapangan | null;
  penyebab: string | null;
  catatan: string | null;
  /**
   * Site punya logger EWS (sirene + lampu). Tampilan memakainya untuk tidak
   * menjanjikan "sirene dimatikan" di site yang tidak punya sirene. Kosong
   * (tidak diisi) diperlakukan sebagai ada.
   */
  adaEws?: boolean;
}

export type StatusKejadian = "perlu-konfirmasi" | "disenyapkan" | "perlu-verifikasi" | "selesai";

/**
 * Satu label untuk ditampilkan. Urutannya urutan kepentingan: sirene yang
 * berbunyi lebih dulu dari catatan yang belum diisi.
 */
export function statusKejadian(k: KejadianRingkas): StatusKejadian {
  const aktif = k.pulih === null;
  if (perluKonfirmasi({ aktif, tingkatTerakhir: k.tingkatTerakhir, tingkatDikonfirmasi: k.tingkatDikonfirmasi })) {
    return "perlu-konfirmasi";
  }
  if (k.diverifikasi === null) return aktif ? "disenyapkan" : "perlu-verifikasi";
  return "selesai";
}

/**
 * Kejadian yang masih aktif tapi sudah diverifikasi tidak ditampilkan lagi di
 * banner: operator sudah mengonfirmasi dan sudah mengecek lapangan. Statusnya
 * tetap (mis. Awas) sampai pergeseran turun; pengingatnya pindah ke lencana
 * menu Riwayat Alarm. Begitu tingkatnya naik melewati yang dikonfirmasi,
 * statusnya kembali "perlu-konfirmasi" dan banner muncul lagi.
 */
/** Seberapa jauh ke belakang kejadian selesai masih dihitung "belum dibuka". */
export const JENDELA_LENCANA_MS = 24 * 60 * 60 * 1000;

/**
 * Kejadian yang dihitung lencana menu Riwayat Alarm: yang masih aktif di atas
 * Normal, ditambah kejadian 24 jam terakhir yang belum dilihat di peramban
 * ini (`dibaca` = id terbesar saat halaman Riwayat Alarm terakhir dibuka).
 * Kejadian yang sudah selesai tetap terhitung sampai halamannya dibuka —
 * dua alarm berturut-turut tampil 2, bukan 1 (24 Nov 2026).
 */
export function lencanaRiwayat(
  aktif: readonly KejadianRingkas[],
  terbaru: readonly KejadianRingkas[],
  dibaca: number
): KejadianRingkas[] {
  const hasil = new Map<number, KejadianRingkas>();
  for (const k of aktif) {
    if (k.pulih === null && k.tingkatTerakhir !== "Normal") hasil.set(k.id, k);
  }
  for (const k of terbaru) {
    if (k.id > dibaca && !hasil.has(k.id)) hasil.set(k.id, k);
  }
  return [...hasil.values()].sort((a, b) => b.id - a.id);
}

/** Tingkat yang mewakili kejadian di lencana: sekarang bila aktif, puncaknya bila sudah selesai. */
export function tingkatLencana(k: KejadianRingkas): StatusLabel {
  return k.pulih === null ? k.tingkatTerakhir : k.tingkatPuncak;
}

export function tersembunyiDariBanner(k: KejadianRingkas): boolean {
  return k.pulih === null && statusKejadian(k) === "selesai";
}

// ─── Modal alarm otomatis ───────────────────────────────────────────────────
//
// Modal muncul sendiri di halaman mana pun saat ada kejadian aktif yang belum
// dikonfirmasi dan tingkatnya Siaga atau Awas. Waspada cukup banner dan bunyi:
// modal yang terlalu sering muncul berhenti dibaca.
//
// Modal TIDAK mengunci operator — ada "Nanti". Menutupnya dicatat per peramban
// (id kejadian, tingkat, jam), dan modal muncul lagi hanya bila:
//   - tingkatnya naik melewati yang tercatat (Siaga → Awas), atau
//   - sudah JEDA_PENGINGAT_MS sejak ditutup dan kejadiannya belum dikonfirmasi.
// Alarm yang diabaikan tidak boleh jadi diam selamanya.

export const TINGKAT_MODAL_MIN: StatusLabel = "Siaga";
export const JEDA_PENGINGAT_MS = 2 * 60_000;

/** Kapan dan di tingkat apa modal kejadian ini terakhir ditutup, per id kejadian. */
export type CatatanModal = Record<string, { tingkat: StatusLabel; ms: number }>;

/** Isi localStorage → catatan. Apa pun yang rusak dibuang, bukan dilempar. */
export function uraiCatatanModal(teks: string | null): CatatanModal {
  if (!teks) return {};
  try {
    const mentah: unknown = JSON.parse(teks);
    if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return {};
    const hasil: CatatanModal = {};
    for (const [id, v] of Object.entries(mentah as Record<string, unknown>)) {
      const o = v as { tingkat?: unknown; ms?: unknown } | null;
      const tingkat = asStatusLabel(o?.tingkat);
      if (tingkat && typeof o?.ms === "number" && Number.isFinite(o.ms)) hasil[id] = { tingkat, ms: o.ms };
    }
    return hasil;
  } catch {
    return {};
  }
}

/**
 * Kejadian yang harus dimunculkan sebagai modal sekarang, atau null.
 * Bila lebih dari satu: tingkat terburuk, lalu yang terbaru.
 */
export function kejadianUntukModal(
  kejadian: readonly KejadianRingkas[],
  catatan: CatatanModal,
  sekarangMs: number,
  jedaMs: number = JEDA_PENGINGAT_MS
): KejadianRingkas | null {
  let pilih: KejadianRingkas | null = null;
  for (const k of kejadian) {
    if (k.pulih !== null) continue;
    if (!perluKonfirmasi({ aktif: true, tingkatTerakhir: k.tingkatTerakhir, tingkatDikonfirmasi: k.tingkatDikonfirmasi })) continue;
    if (indeksStatus(k.tingkatTerakhir) < indeksStatus(TINGKAT_MODAL_MIN)) continue;

    const c = catatan[String(k.id)];
    // Jam peramban mundur lebih dari semenit = jamnya diubah; mengingatkan lebih
    // aman daripada diam. Toleransi semenit karena pemanggil membaca jam tiap
    // beberapa detik, bukan tiap render, jadi `sekarangMs` boleh sedikit basi.
    const perlu =
      !c ||
      indeksStatus(k.tingkatTerakhir) > indeksStatus(c.tingkat) ||
      sekarangMs < c.ms - 60_000 ||
      sekarangMs - c.ms >= jedaMs;
    if (!perlu) continue;

    if (
      !pilih ||
      indeksStatus(k.tingkatTerakhir) > indeksStatus(pilih.tingkatTerakhir) ||
      (k.tingkatTerakhir === pilih.tingkatTerakhir && k.mulai > pilih.mulai)
    ) {
      pilih = k;
    }
  }
  return pilih;
}

/**
 * Catatan setelah modal `k` ditutup. Hanya kejadian aktif yang disimpan, supaya
 * catatan tidak menumpuk selamanya di peramban.
 */
export function catatTutupModal(
  catatan: CatatanModal,
  kejadian: readonly KejadianRingkas[],
  k: KejadianRingkas,
  sekarangMs: number
): CatatanModal {
  const hasil: CatatanModal = {};
  for (const x of kejadian) {
    const c = catatan[String(x.id)];
    if (x.pulih === null && c) hasil[String(x.id)] = c;
  }
  hasil[String(k.id)] = { tingkat: k.tingkatTerakhir, ms: sekarangMs };
  return hasil;
}

// ─── Pesan WhatsApp ─────────────────────────────────────────────────────────

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "16 Nov 13:20" dari "YYYY-MM-DD HH:mm:ss". Teks aslinya bila tidak cocok. */
export function fmtWaktuPendek(w: string | null): string {
  const m = w?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return w ?? "—";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[4]}:${m[5]}`;
}

/**
 * "YYYY-MM-DD HH:mm:ss" jam dinding → ms, dibaca seolah UTC. Hanya untuk
 * SELISIH dua waktu dinding yang sama zonanya, bukan untuk dibandingkan dengan
 * Date.now().
 */
export function waktuWib(w: string | null): number | null {
  const m = w?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
}

/** Hasil perintah sirene saat konfirmasi, untuk pesan dan balasan API. */
export type HasilEws = "terkirim" | "sudah" | "gagal" | "tanpa-ews";

export function teksKonfirmasi(o: {
  namaSite: string;
  tingkat: StatusLabel;
  mulai: string;
  oleh: string;
  waktu: string;
  ews: HasilEws;
}): string {
  const sirene: Record<HasilEws, string | null> = {
    terkirim: "Sirene dan lampu EWS dimatikan (level 0).",
    sudah: "Sirene dan lampu EWS sudah dalam keadaan mati.",
    gagal: "Perintah mematikan sirene GAGAL terkirim — diulang di siklus berikutnya.",
    "tanpa-ews": null,
  };
  return [
    `*[Dikonfirmasi] ${o.namaSite}*`,
    `Alarm ${o.tingkat} sejak ${fmtWaktuPendek(o.mulai)} dikonfirmasi oleh ${o.oleh} pukul ${fmtWaktuPendek(o.waktu)}.`,
    sirene[o.ews],
    `Status tetap ${o.tingkat} sampai pergeseran turun atau arah bidik prismanya diperbarui. Sirene berbunyi lagi bila tingkatnya naik atau ada prisma lain yang menyusul naik.`,
    "Menunggu verifikasi lapangan.",
  ]
    .filter((b): b is string => b !== null)
    .join("\n");
}

export function teksVerifikasi(o: {
  namaSite: string;
  tingkatPuncak: StatusLabel;
  mulai: string;
  hasil: HasilLapangan;
  penyebab: string | null;
  catatan: string;
  oleh: string;
  waktu: string;
}): string {
  const putusan =
    o.hasil === "benar"
      ? "BENAR — pergeseran nyata"
      : `PALSU${o.penyebab ? ` — ${o.penyebab}` : ""}`;
  return [
    `*[Diverifikasi] ${o.namaSite}*`,
    `Alarm ${o.tingkatPuncak} sejak ${fmtWaktuPendek(o.mulai)}: ${putusan}.`,
    `Catatan: ${o.catatan}`,
    `Oleh ${o.oleh}, ${fmtWaktuPendek(o.waktu)}.`,
  ].join("\n");
}
