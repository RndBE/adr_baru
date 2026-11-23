/**
 * Rekam ulang arah bidik prisma setelah pergeseran diverifikasi BENAR.
 *
 * Arah bidik tiap prisma tersimpan di DUA tempat:
 *
 *   1. Slot firmware RTS (1–50). Inilah yang dipakai alat di setiap sesi:
 *      `turning_target` memutar ke sudut rekaman, lalu AutoSearch mencari
 *      prisma di sekitarnya.
 *   2. `t_prisma.HA`/`VA` di web — SALINAN dari balasan `recordTarget`, untuk
 *      ditampilkan. Mengubahnya saja tidak menggerakkan apa pun.
 *
 * Firmware tidak punya perintah "isi sudut slot dengan angka X". Satu-satunya
 * cara mengubah sudut slot adalah `recordTarget`, yang merekam ke mana teleskop
 * SEDANG menghadap. Jadi rekam ulang = arahkan teleskop ke prisma di posisi
 * barunya, lalu rekam:
 *
 *   putar   turning_target <slot>    teleskop ke sudut lama
 *   cari    auto_search              mengunci prisma di posisi barunya
 *   ukur    measure_fs / measure_bs  bukti: jarak dan arahnya cocok dengan
 *                                    tembakan terakhir prisma itu
 *   rekam   recordTarget             slot menyimpan arah teleskop sekarang;
 *                                    balasannya membawa HA/VA baru
 *   simpan  t_prisma.HA/VA           salinan web ikut diperbarui
 *
 * Langkah ukur adalah pagar. AutoSearch bisa mengunci prisma LAIN yang
 * kebetulan dekat, dan merekamnya berarti setiap sesi berikutnya menembak
 * target yang salah tanpa satu galat pun. Rekam hanya dikirim bila hasil ukur
 * cocok dengan tembakan terakhir prisma itu.
 *
 * R0 tidak disentuh: pergeseran tetap dihitung dari R0, jadi status alarm
 * tidak berubah karena rekam ulang.
 */
import { bacaSudut, sudutKosong } from "@/lib/koreksi-azimut";
import { balasanGagal, balasanSelesai, nilaiBalasanLogger } from "@/lib/balasan-logger";
import { JENIS_UKUR, bacaBalasanUkur, klasifikasiTurningTarget, type KodeUkur } from "@/lib/protokol-rts";

// ─── Sakelar ────────────────────────────────────────────────────────────────

/**
 * DIMATIKAN 23 Nov 2026. Uji pertama di kantor (kejadian #2, P2): putar,
 * AutoSearch, dan ukur berhasil, tapi balasan logger atas `recordTarget`
 * ditolak sebagai tidak sah dan sejak itu RTS tidak lagi menemukan P2 —
 * termasuk di sesi AutoTracking biasa. `recordTarget` yang dikirim sesudah
 * `measure_fs` tampaknya merekam sudut yang salah ke slot. Hidupkan lagi
 * hanya setelah bentuk balasannya dilihat langsung di MQTT dan urutan
 * langkahnya dibetulkan.
 */
export const REKAM_ARAH_AKTIF: boolean = false;

export const ALASAN_REKAM_ARAH_MATI =
  "Rekam ulang arah bidik dimatikan sementara: uji pertama merusak sudut slot di RTS. Daftarkan ulang prisma lewat Prism Config.";

// ─── Langkah dan perintahnya ────────────────────────────────────────────────

export const LANGKAH_REKAM = ["putar", "cari", "ukur", "rekam"] as const;
export type LangkahRekam = (typeof LANGKAH_REKAM)[number];

export function langkahSah(v: unknown): v is LangkahRekam {
  return typeof v === "string" && (LANGKAH_REKAM as readonly string[]).includes(v);
}

export const LABEL_LANGKAH: Record<LangkahRekam | "simpan", string> = {
  putar: "Memutar ke sudut lama",
  cari: "Mencari prisma",
  ukur: "Mengukur",
  rekam: "Merekam arah baru",
  simpan: "Menyimpan",
};

/**
 * Batas menunggu jawaban per langkah. Putar dan ukur mengikuti Arahkan RTS
 * (35 dan 20 detik). AutoSearch bisa menyapu lama sebelum menyerah, jadi
 * diberi 90 detik.
 */
export const BATAS_LANGKAH_MS: Record<LangkahRekam, number> = {
  putar: 35_000,
  cari: 90_000,
  ukur: 20_000,
  rekam: 20_000,
};

/**
 * Isi `set_<idLogger>` untuk satu langkah.
 *
 * `recordTarget` sengaja TANPA `mode`: tanpa medan itu firmware mempertahankan
 * cara cari yang tersimpan di slot. Nama dan tinggi target dikirim ulang apa
 * adanya dari t_prisma.
 */
export function perintahLangkah(
  langkah: LangkahRekam,
  t: { slot: number; nama: string; targetHeight: number; jenis: KodeUkur }
): Record<string, unknown> {
  switch (langkah) {
    case "putar":
      return { command: "set_rts", turning_target: t.slot };
    case "cari":
      return { command: "set_rts", auto_search: true };
    case "ukur":
      return { command: "set_rts", [JENIS_UKUR[t.jenis].perintah]: true };
    case "rekam":
      return {
        command: "set_rts",
        recordTarget: { slot: t.slot, name: t.nama, targetHigh: String(t.targetHeight) },
      };
  }
}

// ─── Geometri ───────────────────────────────────────────────────────────────

/** Satu tembakan: sudut seperti yang dikirim alat, jarak miring meter. */
export interface Tembakan {
  HA: string;
  VA: string;
  SD: number;
}

function arah(ha: number, va: number, faktorDerajat: number): [number, number, number] {
  const h = (ha * faktorDerajat * Math.PI) / 180;
  const v = (va * faktorDerajat * Math.PI) / 180;
  return [Math.sin(v) * Math.sin(h), Math.sin(v) * Math.cos(h), Math.cos(v)];
}

/**
 * Sudut antara dua arah bidik, radian. Null bila salah satu sudutnya tidak
 * dilaporkan (lihat sudutKosong).
 *
 * `faktorDerajat` dari t_site.ha_faktor_derajat: 0,9 untuk alat yang
 * melaporkan gon, 1 untuk derajat. Berlaku untuk HA maupun VA.
 */
export function sudutAntara(
  a: { HA: unknown; VA: unknown },
  b: { HA: unknown; VA: unknown },
  faktorDerajat: number
): number | null {
  if (sudutKosong(a.HA) || sudutKosong(a.VA) || sudutKosong(b.HA) || sudutKosong(b.VA)) return null;
  const p = arah(bacaSudut(a.HA) as number, bacaSudut(a.VA) as number, faktorDerajat);
  const q = arah(bacaSudut(b.HA) as number, bacaSudut(b.VA) as number, faktorDerajat);
  const silang = Math.hypot(
    p[1] * q[2] - p[2] * q[1],
    p[2] * q[0] - p[0] * q[2],
    p[0] * q[1] - p[1] * q[0]
  );
  const titik = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  return Math.atan2(silang, titik);
}

/** Jarak menyamping di ujung bidikan sejauh `jarakM` antara dua arah, meter. */
export function geserSampingM(
  a: { HA: unknown; VA: unknown },
  b: { HA: unknown; VA: unknown },
  jarakM: number,
  faktorDerajat: number
): number | null {
  const t = sudutAntara(a, b, faktorDerajat);
  if (t === null || !Number.isFinite(jarakM) || jarakM <= 0) return null;
  return 2 * jarakM * Math.sin(t / 2);
}

// ─── Rencana (GET /api/kejadian-alarm/[id]/arah-bidik) ──────────────────────

export interface PrismaArah {
  slot: number;
  idPrisma: string;
  nama: string;
  jenis: KodeUkur;
  /** t_prisma.HA/VA — salinan rekaman slot terakhir. */
  tersimpan: { HA: string | null; VA: string | null };
  /** Tembakan sah terakhir prisma ini di sesi site ini. Null = belum pernah. */
  terakhir: (Tembakan & { waktu: string; idLog: string }) | null;
  /** Jarak menyamping arah tersimpan ke tembakan terakhir, meter. */
  geserM: number | null;
  /** Ikut menaikkan tingkat selama kejadian ini. */
  memicu: boolean;
}

export interface RencanaArah {
  site: string;
  namaSite: string;
  idLogger: string | null;
  hasil: string | null;
  faktorDerajat: number;
  /** Alasan RTS tidak boleh diganggu sekarang, atau null. */
  sibuk: string | null;
  prisma: PrismaArah[];
}

// ─── Pagar ukur ─────────────────────────────────────────────────────────────

/**
 * Batas beda hasil ukur dengan tembakan terakhir prisma yang sama.
 *
 * Keduanya mengukur prisma yang SUDAH bergeser, jadi bedanya seharusnya
 * hanya derau ditambah gerakan sejak sesi terakhir — sentimeter. Prisma lain
 * hampir selalu berbeda jarak atau arahnya jauh lebih dari ini.
 */
export const BATAS_BEDA_JARAK_M = 0.1;
export const BATAS_BEDA_SAMPING_M = 0.25;

export type HasilCek =
  | { cocok: true; bedaJarakM: number; bedaSampingM: number }
  | { cocok: false; alasan: string };

function cm(m: number): string {
  return `${Math.round(m * 100).toLocaleString("id-ID")} cm`;
}

function bacaJarak(v: unknown): number {
  return typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", "."));
}

export function cekKecocokan(
  ukur: { HA: string; VA: string; SD: string },
  terakhir: Tembakan,
  faktorDerajat: number
): HasilCek {
  const sd = bacaJarak(ukur.SD);
  if (!Number.isFinite(sd) || sd <= 0) return { cocok: false, alasan: "Jarak hasil ukur tidak terbaca." };
  const samping = geserSampingM(ukur, terakhir, sd, faktorDerajat);
  if (samping === null) return { cocok: false, alasan: "Sudut hasil ukur tidak terbaca." };

  const bedaJarak = Math.abs(sd - terakhir.SD);
  const sebab =
    "Kemungkinan AutoSearch mengunci prisma lain, atau prisma bergeser lagi sejak sesi terakhir — jalankan satu sesi ukur dulu, lalu ulangi.";
  if (bedaJarak > BATAS_BEDA_JARAK_M) {
    return {
      cocok: false,
      alasan: `Jarak terukur ${sd.toFixed(3)} m, tembakan terakhir ${terakhir.SD.toFixed(3)} m (beda ${cm(bedaJarak)}). ${sebab}`,
    };
  }
  if (samping > BATAS_BEDA_SAMPING_M) {
    return {
      cocok: false,
      alasan: `Arah terukur meleset ${cm(samping)} dari tembakan terakhir. ${sebab}`,
    };
  }
  return { cocok: true, bedaJarakM: bedaJarak, bedaSampingM: samping };
}

// ─── Balasan logger ─────────────────────────────────────────────────────────

export type BacaanLangkah =
  | { jenis: "abaikan" }
  /** Langkah ini tuntas. */
  | { jenis: "maju" }
  | { jenis: "gagal"; pesan: string }
  | { jenis: "hasil-ukur"; HA: string; VA: string; SD: string }
  | { jenis: "hasil-rekam"; HA: string; VA: string };

const ABAIKAN: BacaanLangkah = { jenis: "abaikan" };

function teks(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Artikan satu pesan di `pub_<idLogger>` untuk langkah yang sedang berjalan.
 * Pesan milik perintah lain di topik yang sama dikembalikan "abaikan".
 */
export function bacaBalasanLangkah(
  langkah: LangkahRekam,
  t: { slot: number; jenis: KodeUkur },
  data: Record<string, unknown>
): BacaanLangkah {
  // Data berkala punya topik sendiri; balasan perintah tidak pernah memuat
  // `id_alat` di tingkat teratas.
  if (data.id_alat !== undefined) return ABAIKAN;

  switch (langkah) {
    case "putar": {
      const k = klasifikasiTurningTarget(data.TurningTarget ?? data.turning_target);
      if (k === "selesai") return { jenis: "maju" };
      if (k === "gagal") return { jenis: "gagal", pesan: "Teleskop gagal diputar ke slot ini." };
      return ABAIKAN;
    }
    case "cari": {
      if (data.AutoSearch === undefined) return ABAIKAN;
      const n = nilaiBalasanLogger(data.AutoSearch);
      if (balasanSelesai(n)) return { jenis: "maju" };
      if (balasanGagal(n)) {
        return { jenis: "gagal", pesan: "AutoSearch tidak menemukan prisma di sekitar sudut lama." };
      }
      return ABAIKAN;
    }
    case "ukur": {
      const b = bacaBalasanUkur(data[JENIS_UKUR[t.jenis].balasan]);
      if (b.jenis === "hasil") {
        if (b.kosong) return { jenis: "gagal", pesan: "Pengukuran tidak mendapat pantulan." };
        return { jenis: "hasil-ukur", HA: b.HADMS ?? "", VA: b.VADMS ?? "", SD: b.SDis ?? "" };
      }
      if (b.jenis === "gagal") return { jenis: "gagal", pesan: "Pengukuran gagal." };
      if (b.jenis === "selesai") return { jenis: "maju" };
      return ABAIKAN;
    }
    case "rekam": {
      const r = data.recordTarget;
      if (r === null || typeof r !== "object") return ABAIKAN;
      const o = r as Record<string, unknown>;
      // Balasan rekaman slot lain (halaman Prism Config yang terbuka di
      // tempat lain) bukan milik langkah ini.
      if (o.slot !== undefined && Number(o.slot) !== t.slot) return ABAIKAN;
      if (teks(o.error)) return { jenis: "gagal", pesan: `Logger menolak recordTarget: ${teks(o.error)}` };
      const HA = teks(o.HA);
      const VA = teks(o.VA);
      if (!HA && !VA) return ABAIKAN;
      if (sudutKosong(HA) || sudutKosong(VA)) {
        return { jenis: "gagal", pesan: "Logger membalas recordTarget tanpa sudut yang sah." };
      }
      return { jenis: "hasil-rekam", HA, VA };
    }
  }
}

// ─── Keadaan sibuk RTS ──────────────────────────────────────────────────────

/** Selama ini sebuah tanda "sedang mengukur" dianggap masih berlaku. */
export const UMUR_TANDA_SIBUK_MENIT = 10;

function menit(waktu: string | null): number | null {
  if (!waktu) return null;
  const ms = Date.parse(`${waktu.trim().replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms / 60_000 : null;
}

/**
 * Alasan RTS tidak boleh diganggu, atau null bila bebas.
 *
 * Semua waktu jam dinding zona logger "YYYY-MM-DD HH:mm:ss". Tanda yang lebih
 * tua dari UMUR_TANDA_SIBUK_MENIT diabaikan: logger yang mati di tengah sesi
 * meninggalkan sensor16 = 1 dan status_manual = 1 selamanya, dan fitur ini
 * tidak boleh ikut terkunci selamanya karenanya.
 */
export function alasanRtsSibuk(
  kontrol: { status: unknown; statusManual: unknown; mulai: string | null } | null,
  terakhir: { sensor16: unknown; waktu: string | null } | null,
  sekarang: string
): string | null {
  const kini = menit(sekarang);
  if (kini === null) return null;
  const baru = (w: string | null) => {
    const m = menit(w);
    return m !== null && kini - m <= UMUR_TANDA_SIBUK_MENIT && kini - m >= -UMUR_TANDA_SIBUK_MENIT;
  };
  const satu = (v: unknown) => String(v ?? "").trim() === "1";

  if (terakhir && satu(terakhir.sensor16) && baru(terakhir.waktu)) {
    return "RTS sedang menjalankan sesi pengukuran. Tunggu sampai sesinya selesai.";
  }
  if (kontrol && satu(kontrol.status) && baru(kontrol.mulai)) {
    return "Perintah Mulai baru saja dikirim ke RTS. Tunggu sampai sesinya selesai.";
  }
  if (kontrol && satu(kontrol.statusManual) && terakhir && baru(terakhir.waktu)) {
    return "RTS sedang menjalankan sesi pengukuran. Tunggu sampai sesinya selesai.";
  }
  return null;
}

// ─── Jalur per prisma ───────────────────────────────────────────────────────

export interface SasaranRekam {
  slot: number;
  nama: string;
  jenis: KodeUkur;
  terakhir: Tembakan;
}

export type StatusBaris =
  | { tahap: "antre" }
  | { tahap: "jalan"; langkah: LangkahRekam }
  | { tahap: "selesai"; HA: string; VA: string; bedaJarakM: number; bedaSampingM: number }
  | { tahap: "gagal"; langkah: LangkahRekam | "simpan"; pesan: string }
  | { tahap: "dilewati"; pesan: string };

export type HasilKirim = { ok: true } | { ok: false; pesan: string };

export interface AlatJalur {
  /** Terbitkan perintah satu langkah lewat server. Gagal = seluruh jalur berhenti. */
  kirim(langkah: LangkahRekam, slot: number): Promise<HasilKirim>;
  /** Simpan HA/VA baru ke t_prisma. */
  simpan(slot: number, HA: string, VA: string): Promise<HasilKirim>;
  /** setTimeout yang bisa dibatalkan; disuntikkan supaya bisa diuji tanpa menunggu. */
  jadwal(ms: number, fn: () => void): () => void;
  /** Dipanggil setiap kali keadaan berubah. */
  ubah(status: Record<number, StatusBaris>, jalan: boolean): void;
}

/**
 * Menjalankan putar → cari → ukur → rekam → simpan untuk tiap prisma,
 * berurutan, satu langkah sekali jalan.
 *
 * Satu perintah dikirim, jawabannya ditunggu, baru perintah berikutnya —
 * dokumen protokol melarang mencampur perintah aksi, dan urutan eksekusi
 * firmware bukan urutan penulisan.
 *
 * Gagal di satu prisma tidak menghentikan prisma berikutnya: masing-masing
 * slot berdiri sendiri. Yang menghentikan seluruh jalur hanya penolakan dari
 * server (RTS sedang sesi, kode akses salah, jaringan putus) — mengulang
 * perintah ke prisma lain tidak akan menolong.
 */
export class JalurRekamArah {
  private antrian: SasaranRekam[] = [];
  private indeks = -1;
  private langkah: LangkahRekam | null = null;
  private cek: HasilCek | null = null;
  private batalTimer: (() => void) | null = null;
  private status: Record<number, StatusBaris> = {};
  private jalan = false;
  /** Naik tiap langkah berganti; jawaban async yang basi tidak boleh bertindak. */
  private token = 0;

  constructor(
    private readonly alat: AlatJalur,
    private readonly faktorDerajat: number
  ) {}

  get sedangJalan(): boolean {
    return this.jalan;
  }

  mulai(daftar: SasaranRekam[]): void {
    if (this.jalan || daftar.length === 0) return;
    this.antrian = daftar;
    this.indeks = -1;
    this.status = Object.fromEntries(daftar.map((s) => [s.slot, { tahap: "antre" } as StatusBaris]));
    this.jalan = true;
    this.lanjutPrisma();
  }

  /** Lepas timer dan abaikan jawaban yang masih di jalan. Untuk unmount. */
  hentikan(): void {
    this.batalTimer?.();
    this.batalTimer = null;
    this.token++;
    this.langkah = null;
    this.jalan = false;
  }

  /** Satu pesan dari `pub_<idLogger>`. */
  terima(data: Record<string, unknown>): void {
    if (!this.jalan || this.langkah === null) return;
    const s = this.antrian[this.indeks];
    const langkah = this.langkah;
    const b = bacaBalasanLangkah(langkah, s, data);

    switch (b.jenis) {
      case "abaikan":
        return;
      case "gagal":
        this.gagalkan(b.pesan);
        return;
      case "hasil-ukur":
        this.cek = cekKecocokan(b, s.terakhir, this.faktorDerajat);
        if (!this.cek.cocok) this.gagalkan(this.cek.alasan);
        // Cocok: tunggu "done" sebelum merekam. Hasil datang SEBELUM penutup,
        // dan recordTarget yang menyusul di tengah pengukuran bisa ditolak.
        return;
      case "maju":
        if (langkah === "putar") this.mulaiLangkah("cari");
        else if (langkah === "cari") this.mulaiLangkah("ukur");
        else if (langkah === "ukur") {
          if (this.cek?.cocok) this.mulaiLangkah("rekam");
          else this.gagalkan("Pengukuran selesai tanpa hasil.");
        }
        return;
      case "hasil-rekam":
        void this.simpan(b.HA, b.VA);
        return;
    }
  }

  private terbitkan(): void {
    this.alat.ubah({ ...this.status }, this.jalan);
  }

  private lanjutPrisma(): void {
    this.indeks++;
    this.cek = null;
    if (this.indeks >= this.antrian.length) {
      this.langkah = null;
      this.jalan = false;
      this.terbitkan();
      return;
    }
    this.mulaiLangkah("putar");
  }

  private mulaiLangkah(langkah: LangkahRekam): void {
    const s = this.antrian[this.indeks];
    const token = ++this.token;
    this.langkah = langkah;
    this.status[s.slot] = { tahap: "jalan", langkah };
    this.terbitkan();

    this.batalTimer?.();
    this.batalTimer = this.alat.jadwal(BATAS_LANGKAH_MS[langkah], () => {
      if (token === this.token) this.habisWaktu(langkah);
    });

    // Langkah dipasang SEBELUM perintah dikirim: server menerbitkan sebelum
    // menjawab HTTP, jadi balasan logger bisa tiba lebih dulu.
    void this.alat.kirim(langkah, s.slot).then(
      (r) => {
        if (token === this.token && !r.ok) this.henti(r.pesan);
      },
      () => {
        if (token === this.token) this.henti("Terjadi kesalahan jaringan.");
      }
    );
  }

  private habisWaktu(langkah: LangkahRekam): void {
    // Hasil ukur yang cocok sudah ada, hanya penutupnya yang tidak datang.
    if (langkah === "ukur" && this.cek?.cocok) {
      this.mulaiLangkah("rekam");
      return;
    }
    const detik = BATAS_LANGKAH_MS[langkah] / 1000;
    this.gagalkan(
      langkah === "rekam"
        ? `recordTarget tidak dijawab dalam ${detik} detik. Slot di RTS mungkin sudah terekam — cek sudutnya di Prism Config.`
        : `Tidak ada jawaban dalam ${detik} detik.`
    );
  }

  private async simpan(HA: string, VA: string): Promise<void> {
    const s = this.antrian[this.indeks];
    const token = ++this.token;
    this.batalTimer?.();
    this.batalTimer = null;
    this.langkah = null;
    const cek = this.cek;

    let r: HasilKirim;
    try {
      r = await this.alat.simpan(s.slot, HA, VA);
    } catch {
      r = { ok: false, pesan: "Terjadi kesalahan jaringan." };
    }
    if (token !== this.token) return;

    this.status[s.slot] = r.ok
      ? {
          tahap: "selesai",
          HA,
          VA,
          bedaJarakM: cek?.cocok ? cek.bedaJarakM : 0,
          bedaSampingM: cek?.cocok ? cek.bedaSampingM : 0,
        }
      : {
          tahap: "gagal",
          langkah: "simpan",
          pesan: `Slot di RTS sudah terekam (HA ${HA}, VA ${VA}), tapi gagal disimpan di web: ${r.pesan}`,
        };
    this.lanjutPrisma();
  }

  /** Prisma ini gagal; lanjut ke prisma berikutnya. */
  private gagalkan(pesan: string): void {
    const s = this.antrian[this.indeks];
    this.batalTimer?.();
    this.batalTimer = null;
    this.token++;
    this.status[s.slot] = { tahap: "gagal", langkah: this.langkah ?? "simpan", pesan };
    this.langkah = null;
    this.lanjutPrisma();
  }

  /** Server menolak: prisma ini gagal dan sisanya dilewati. */
  private henti(pesan: string): void {
    const s = this.antrian[this.indeks];
    this.batalTimer?.();
    this.batalTimer = null;
    this.token++;
    this.status[s.slot] = { tahap: "gagal", langkah: this.langkah ?? "simpan", pesan };
    for (const sisa of this.antrian.slice(this.indeks + 1)) {
      this.status[sisa.slot] = { tahap: "dilewati", pesan: "Dihentikan karena langkah sebelumnya ditolak." };
    }
    this.langkah = null;
    this.jalan = false;
    this.terbitkan();
  }
}
