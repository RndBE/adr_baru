/**
 * Perbarui arah bidik prisma setelah pergeseran diverifikasi BENAR.
 *
 * Arah bidik tiap prisma tersimpan di DUA tempat:
 *
 *   1. Slot firmware RTS (1–50). Inilah yang dipakai alat di setiap sesi:
 *      teleskop diputar ke sudut slot, lalu AutoSearch mencari prisma di
 *      sekitarnya.
 *   2. `t_prisma.HA`/`VA` di web — salinan untuk ditampilkan.
 *
 * Sejak firmware BL1100-v2.2.3 (23 Nov 2026) sudut slot bisa ditulis dan dibaca
 * langsung, tanpa memutar teleskop (docs/permintaan-firmware-settarget-gettarget.md):
 *
 *   baca      getTarget <slot>          isi slot sebelum diubah
 *   tulis     setTarget <slot> HA VA    sudut dari tembakan sah terakhir prisma
 *                                       itu; balasannya = yang benar-benar
 *                                       tersimpan, harus sama persis
 *   pastikan  getTarget <slot>          dibaca ulang, harus sama persis
 *   simpan    t_prisma.HA/VA            salinan web ikut diperbarui
 *
 * Versi pertama fitur ini memakai `recordTarget` (merekam arah teleskop
 * sekarang) sesudah putar, AutoSearch, dan ukur. Uji di kantor 23 Nov merekam
 * sudut kosong ke slot 2 — `getTarget` kemudian menunjukkan HA/VA ",," — dan
 * P2 tidak ditemukan lagi sampai slotnya ditulis ulang dengan `setTarget`.
 *
 * Sudut yang ditulis diambil server dari tembakan sah terakhir prisma di sesi
 * site ini, bukan dari peramban, dan formatnya persis seperti yang dikirim
 * alat sendiri. R0 tidak disentuh: status alarm tidak berubah karena ini.
 */
import { bacaSudut, sudutKosong } from "@/lib/koreksi-azimut";
import type { KodeUkur } from "@/lib/protokol-rts";

// ─── Sakelar ────────────────────────────────────────────────────────────────

/**
 * Hidup sejak firmware punya `setTarget`/`getTarget`. Versi `recordTarget`
 * dimatikan setelah merusak slot P2 (lihat catatan di atas).
 */
export const REKAM_ARAH_AKTIF: boolean = true;

export const ALASAN_REKAM_ARAH_MATI =
  "Perbarui arah bidik sedang dimatikan. Perbarui slot prisma lewat Prism Config.";

// ─── Langkah dan perintahnya ────────────────────────────────────────────────

export const LANGKAH_REKAM = ["baca", "tulis", "pastikan"] as const;
export type LangkahRekam = (typeof LANGKAH_REKAM)[number];

export function langkahSah(v: unknown): v is LangkahRekam {
  return typeof v === "string" && (LANGKAH_REKAM as readonly string[]).includes(v);
}

export const LABEL_LANGKAH: Record<LangkahRekam | "simpan", string> = {
  baca: "Membaca slot",
  tulis: "Menulis sudut baru",
  pastikan: "Memastikan isi slot",
  simpan: "Menyimpan",
};

/** Perintah baca/tulis slot tidak menggerakkan apa pun; jawabannya cepat. */
export const BATAS_LANGKAH_MS: Record<LangkahRekam, number> = {
  baca: 15_000,
  tulis: 15_000,
  pastikan: 15_000,
};

/**
 * Isi `set_<idLogger>` untuk satu langkah. `setTarget` tanpa `name`,
 * `targetHigh`, dan `mode`: firmware mempertahankan nilai yang tersimpan.
 */
export function perintahLangkah(
  langkah: LangkahRekam,
  t: { slot: number; HA?: string; VA?: string }
): Record<string, unknown> {
  switch (langkah) {
    case "baca":
    case "pastikan":
      return { command: "set_rts", getTarget: { slot: t.slot } };
    case "tulis":
      return { command: "set_rts", setTarget: { slot: t.slot, HA: t.HA, VA: t.VA } };
  }
}

/**
 * Sudut berformat firmware: derajat lalu dua kelompok dua digit,
 * mis. "130,34,79". Firmware menolak bentuk lain dengan `bad angle`
 * ("130,3,14" ditolak), jadi diperiksa lebih dulu di sini.
 */
export function sudutFirmwareSah(v: unknown): v is string {
  return typeof v === "string" && /^\d{1,3},\d{2},\d{2}$/.test(v.trim()) && !sudutKosong(v);
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
  /** t_prisma.HA/VA — salinan web isi slot. */
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

// ─── Balasan logger ─────────────────────────────────────────────────────────

export type BacaanLangkah =
  | { jenis: "abaikan" }
  | { jenis: "gagal"; pesan: string }
  | { jenis: "isi-slot"; HA: string; VA: string };

const ABAIKAN: BacaanLangkah = { jenis: "abaikan" };

function teks(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

const SEBAB_GALAT: Record<string, string> = {
  busy: "RTS sedang sibuk (sesi atau gerakan lain berjalan).",
  "empty slot": "Slot ini kosong di RTS.",
  "bad target": "Nomor slot di luar 1–50.",
  "bad angle": "Format sudut ditolak firmware.",
};

/**
 * Artikan satu pesan di `pub_<idLogger>` untuk langkah yang sedang berjalan.
 *
 *   {"getTarget":{"slot":2,"name":"P2","HA":"130,34,14","VA":"099,11,97",…}}
 *   {"getTarget":{"slot":7,"error":"empty slot"}}
 *   {"setTarget":{"slot":2,…,"HA":…,"VA":…,"value":"done"}}
 *   {"setTarget":{"slot":2,"error":"bad angle"}}
 *
 * Balasan slot lain, atau `getTarget` bentuk daftar ("all"), bukan milik
 * langkah ini.
 */
export function bacaBalasanLangkah(
  langkah: LangkahRekam,
  t: { slot: number },
  data: Record<string, unknown>
): BacaanLangkah {
  if (data.id_alat !== undefined) return ABAIKAN;
  const kunci = langkah === "tulis" ? "setTarget" : "getTarget";
  const paket = data[kunci];
  if (paket === null || typeof paket !== "object") return ABAIKAN;
  const o = paket as Record<string, unknown>;
  if (Number(o.slot) !== t.slot) return ABAIKAN;

  const galat = teks(o.error);
  if (galat) return { jenis: "gagal", pesan: `Ditolak RTS: ${SEBAB_GALAT[galat] ?? galat}` };

  if (langkah === "tulis" && teks(o.value) !== "done") return ABAIKAN;
  const HA = teks(o.HA);
  const VA = teks(o.VA);
  if (!sudutFirmwareSah(HA) || !sudutFirmwareSah(VA)) {
    // Slot yang rusak (HA ",,") masih boleh DIBACA sebelum ditulis ulang —
    // justru itu yang sedang diperbaiki. Sesudah ditulis tidak boleh.
    if (langkah === "baca") return { jenis: "isi-slot", HA, VA };
    return { jenis: "gagal", pesan: `RTS menyimpan sudut yang tidak sah (HA "${HA}", VA "${VA}").` };
  }
  return { jenis: "isi-slot", HA, VA };
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
}

export type StatusBaris =
  | { tahap: "antre" }
  | { tahap: "jalan"; langkah: LangkahRekam }
  | { tahap: "selesai"; HA: string; VA: string; sebelum: { HA: string; VA: string } | null }
  | { tahap: "gagal"; langkah: LangkahRekam | "simpan"; pesan: string }
  | { tahap: "dilewati"; pesan: string };

/** `tujuan` diisi server pada langkah tulis: sudut yang benar-benar dikirim. */
export type HasilKirim =
  | { ok: true; tujuan?: { HA: string; VA: string } }
  | { ok: false; pesan: string };

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
 * Menjalankan baca → tulis → pastikan → simpan untuk tiap prisma, berurutan,
 * satu perintah sekali jalan.
 *
 * Tulis dianggap berhasil hanya bila balasan `setTarget` DAN pembacaan ulang
 * `getTarget` sama persis dengan sudut yang dikirim. Baru setelah itu salinan
 * web diperbarui.
 *
 * Gagal di satu prisma tidak menghentikan prisma berikutnya. Yang menghentikan
 * seluruh jalur hanya penolakan dari server (RTS sedang sesi, kode akses
 * salah, jaringan putus).
 */
export class JalurRekamArah {
  private antrian: SasaranRekam[] = [];
  private indeks = -1;
  private langkah: LangkahRekam | null = null;
  private sebelum: { HA: string; VA: string } | null = null;
  private tujuan: { HA: string; VA: string } | null = null;
  private batalTimer: (() => void) | null = null;
  private status: Record<number, StatusBaris> = {};
  private jalan = false;
  /** Naik tiap langkah berganti; jawaban async yang basi tidak boleh bertindak. */
  private token = 0;

  constructor(private readonly alat: AlatJalur) {}

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
    if (b.jenis === "abaikan") return;
    if (b.jenis === "gagal") {
      this.gagalkan(b.pesan);
      return;
    }

    const isi = { HA: b.HA, VA: b.VA };
    if (langkah === "baca") {
      this.sebelum = isi;
      this.mulaiLangkah("tulis");
      return;
    }

    // tulis / pastikan: harus sama persis dengan yang dikirim.
    const t = this.tujuan;
    if (!t) {
      // Balasan setTarget tiba sebelum server menjawab HTTP (yang membawa
      // sudut tujuannya). Disimpan, dicocokkan begitu tujuannya ada.
      this.tertunda = data;
      return;
    }
    if (isi.HA !== t.HA || isi.VA !== t.VA) {
      this.gagalkan(
        `${langkah === "tulis" ? "Balasan setTarget" : "Isi slot sesudah ditulis"} (HA ${isi.HA}, VA ${isi.VA}) ` +
          `berbeda dari yang dikirim (HA ${t.HA}, VA ${t.VA}).`
      );
      return;
    }
    if (langkah === "tulis") this.mulaiLangkah("pastikan");
    else void this.simpan(t.HA, t.VA);
  }

  private terbitkan(): void {
    this.alat.ubah({ ...this.status }, this.jalan);
  }

  private lanjutPrisma(): void {
    this.indeks++;
    this.sebelum = null;
    this.tujuan = null;
    this.tertunda = null;
    if (this.indeks >= this.antrian.length) {
      this.langkah = null;
      this.jalan = false;
      this.terbitkan();
      return;
    }
    this.mulaiLangkah("baca");
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
    // menjawab HTTP, jadi balasan logger bisa tiba lebih dulu. Untuk "tulis"
    // sudut tujuannya baru diketahui dari jawaban HTTP; balasan yang tiba
    // lebih dulu disimpan dan dicocokkan begitu tujuannya ada.
    void this.alat.kirim(langkah, s.slot).then(
      (r) => {
        if (token !== this.token) return;
        if (!r.ok) {
          this.henti(r.pesan);
          return;
        }
        if (langkah === "tulis") {
          if (!r.tujuan) {
            this.henti("Server tidak menyebut sudut yang ditulis.");
            return;
          }
          this.tujuan = r.tujuan;
          const tertunda = this.tertunda;
          this.tertunda = null;
          if (tertunda) this.terima(tertunda);
        }
      },
      () => {
        if (token === this.token) this.henti("Terjadi kesalahan jaringan.");
      }
    );
  }

  /** Balasan setTarget yang tiba sebelum jawaban HTTP langkah tulis. */
  private tertunda: Record<string, unknown> | null = null;

  private habisWaktu(langkah: LangkahRekam): void {
    const detik = BATAS_LANGKAH_MS[langkah] / 1000;
    this.gagalkan(
      langkah === "tulis"
        ? `setTarget tidak dijawab dalam ${detik} detik. Cek isi slot di Prism Config.`
        : `getTarget tidak dijawab dalam ${detik} detik.`
    );
  }

  private async simpan(HA: string, VA: string): Promise<void> {
    const s = this.antrian[this.indeks];
    const token = ++this.token;
    this.batalTimer?.();
    this.batalTimer = null;
    this.langkah = null;
    const sebelum = this.sebelum;

    let r: HasilKirim;
    try {
      r = await this.alat.simpan(s.slot, HA, VA);
    } catch {
      r = { ok: false, pesan: "Terjadi kesalahan jaringan." };
    }
    if (token !== this.token) return;

    this.status[s.slot] = r.ok
      ? { tahap: "selesai", HA, VA, sebelum }
      : {
          tahap: "gagal",
          langkah: "simpan",
          pesan: `Slot di RTS sudah berisi HA ${HA}, VA ${VA}, tapi gagal disimpan di web: ${r.pesan}`,
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
