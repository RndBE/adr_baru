/**
 * Kunci rekam ulang arah bidik. Jalankan: npx tsx src/lib/rekam-arah.test.ts
 *
 * Angka P1/P2 diambil dari kolam_bpp, 23 Nov 2026: P1 tersimpan di slot
 * 361,96,78 / 099,34,19, tembakan sesi 104018 361,76,05 / 099,34,06 pada
 * 31,955 m — prisma digeser sekitar 10 cm untuk uji kantor.
 */
import assert from "node:assert/strict";
import {
  BATAS_LANGKAH_MS,
  JalurRekamArah,
  alasanRtsSibuk,
  bacaBalasanLangkah,
  cekKecocokan,
  geserSampingM,
  langkahSah,
  perintahLangkah,
  type AlatJalur,
  type HasilKirim,
  type LangkahRekam,
  type SasaranRekam,
  type StatusBaris,
} from "@/lib/rekam-arah";

const GON = 0.9;
const P1_TERSIMPAN = { HA: "361,96,78", VA: "099,34,19" };
const P1_TERAKHIR = { HA: "361,76,05", VA: "099,34,06", SD: 31.955 };
const P2_TERAKHIR = { HA: "262,29,82", VA: "099,09,95", SD: 21.6991 };

// ── perintahLangkah ─────────────────────────────────────────────────────────
const t1 = { slot: 1, nama: "P1", targetHeight: 0, jenis: "fs" as const };
assert.deepEqual(perintahLangkah("putar", t1), { command: "set_rts", turning_target: 1 });
assert.deepEqual(perintahLangkah("cari", t1), { command: "set_rts", auto_search: true });
assert.deepEqual(perintahLangkah("ukur", t1), { command: "set_rts", measure_fs: true });
assert.deepEqual(perintahLangkah("ukur", { ...t1, jenis: "bs" }), { command: "set_rts", measure_bs: true });
assert.deepEqual(
  perintahLangkah("rekam", { ...t1, targetHeight: 1.5 }),
  { command: "set_rts", recordTarget: { slot: 1, name: "P1", targetHigh: "1.5" } },
  "recordTarget tanpa mode: cara cari di firmware dipertahankan"
);
assert.equal(langkahSah("rekam"), true);
assert.equal(langkahSah("simpan"), false, "simpan bukan perintah MQTT");
assert.equal(langkahSah(undefined), false);

// ── geserSampingM ───────────────────────────────────────────────────────────
const geserP1 = geserSampingM(P1_TERSIMPAN, P1_TERAKHIR, P1_TERAKHIR.SD, GON);
assert.ok(geserP1 !== null && geserP1 > 0.09 && geserP1 < 0.12, `P1 bergeser ~10 cm, dapat ${geserP1}`);
assert.equal(geserSampingM(P1_TERAKHIR, P1_TERAKHIR, 31.955, GON), 0);
assert.equal(geserSampingM({ HA: "000,00,00", VA: "099,34,06" }, P1_TERAKHIR, 31.955, GON), null, "sudut kosong");
assert.equal(geserSampingM(P1_TERSIMPAN, P1_TERAKHIR, 0, GON), null, "jarak nol");
// HA 359,99 dan 000,01 bersebelahan, bukan berjauhan.
const lintasNol = geserSampingM({ HA: "399,99,00", VA: "100,00,00" }, { HA: "000,01,00", VA: "100,00,00" }, 100, GON);
assert.ok(lintasNol !== null && lintasNol < 0.04, `lintas nol gon, dapat ${lintasNol}`);

// ── cekKecocokan ────────────────────────────────────────────────────────────
{
  const c = cekKecocokan({ HA: "361,76,07", VA: "099,34,05", SD: "31.957" }, P1_TERAKHIR, GON);
  assert.equal(c.cocok, true);
  assert.ok(c.cocok && c.bedaJarakM < 0.003 && c.bedaSampingM < 0.002);

  const lain = cekKecocokan({ HA: P2_TERAKHIR.HA, VA: P2_TERAKHIR.VA, SD: "21.6991" }, P1_TERAKHIR, GON);
  assert.equal(lain.cocok, false, "AutoSearch mengunci P2 saat mencari P1");
  assert.ok(!lain.cocok && lain.alasan.includes("beda"));

  // Jarak sama, arah meleset 1 gon (~50 cm di 32 m).
  const melenceng = cekKecocokan({ HA: "362,76,05", VA: "099,34,06", SD: "31.955" }, P1_TERAKHIR, GON);
  assert.equal(melenceng.cocok, false);
  assert.ok(!melenceng.cocok && melenceng.alasan.startsWith("Arah terukur meleset"));

  assert.equal(cekKecocokan({ HA: "361,76,05", VA: "099,34,06", SD: "" }, P1_TERAKHIR, GON).cocok, false);
  assert.equal(cekKecocokan({ HA: "", VA: "099,34,06", SD: "31.9" }, P1_TERAKHIR, GON).cocok, false);
  // Firmware yang sudah menulis desimal biasa tetap terbaca.
  assert.equal(cekKecocokan({ HA: "361.7605", VA: "99.3406", SD: "31,955" }, P1_TERAKHIR, GON).cocok, true);
}

// ── bacaBalasanLangkah ──────────────────────────────────────────────────────
{
  const fs1 = { slot: 1, jenis: "fs" as const };
  const b = (l: LangkahRekam, d: Record<string, unknown>) => bacaBalasanLangkah(l, fs1, d).jenis;

  assert.equal(b("putar", { TurningTarget: { value: "start", target: 1 } }), "abaikan");
  assert.equal(b("putar", { TurningTarget: { value: "done" } }), "maju");
  assert.equal(b("putar", { TurningTarget: { value: 1 } }), "maju");
  assert.equal(b("putar", { TurningTarget: { value: "bad target", target: 99 } }), "gagal");
  assert.equal(b("putar", { AutoSearch: 1 }), "abaikan", "balasan langkah lain");

  assert.equal(b("cari", { AutoSearch: 1 }), "maju");
  assert.equal(b("cari", { AutoSearch: { value: 1 } }), "maju");
  assert.equal(b("cari", { AutoSearch: 0 }), "gagal");
  assert.equal(b("cari", { AutoSearch: { value: "search" } }), "abaikan");

  assert.deepEqual(bacaBalasanLangkah("ukur", fs1, { MeasureFS: { HADMS: "361,76,05", VADMS: "099,34,06", SDis: "31.955", HD: "31.6" } }), {
    jenis: "hasil-ukur",
    HA: "361,76,05",
    VA: "099,34,06",
    SD: "31.955",
  });
  assert.equal(b("ukur", { MeasureFS: { HADMS: "", VADMS: "", SDis: "", HD: "" } }), "gagal");
  assert.equal(b("ukur", { MeasureFS: { value: "failed" } }), "gagal");
  assert.equal(b("ukur", { MeasureFS: { value: "done" } }), "maju");
  assert.equal(b("ukur", { MeasureBS: { value: "done" } }), "abaikan", "prisma fs dibalas MeasureFS");

  assert.deepEqual(bacaBalasanLangkah("rekam", fs1, { recordTarget: { TargetName: "P1", HA: "361,76,05", VA: "099,34,06" } }), {
    jenis: "hasil-rekam",
    HA: "361,76,05",
    VA: "099,34,06",
  });
  assert.equal(b("rekam", { recordTarget: { slot: 2, HA: "262,29,82", VA: "099,09,95" } }), "abaikan", "slot lain");
  assert.equal(b("rekam", { recordTarget: { slot: 1, HA: "000,00,00", VA: "000,00,00" } }), "gagal");
  assert.equal(b("rekam", { recordTarget: { error: "slot penuh", slot: 1 } }), "gagal");
  assert.equal(b("rekam", { recordTarget: { value: "start" } }), "abaikan");
  assert.equal(b("rekam", { id_alat: "30002", recordTarget: { HA: "1", VA: "1" } }), "abaikan", "data berkala");
}

// ── alasanRtsSibuk ──────────────────────────────────────────────────────────
{
  const kini = "2026-11-23 14:00:00";
  const bebas = { status: 0, statusManual: 0, mulai: "2026-11-23 10:39:52" };
  assert.equal(alasanRtsSibuk(bebas, { sensor16: 0, waktu: "2026-11-23 13:59:00" }, kini), null);
  assert.ok(alasanRtsSibuk(bebas, { sensor16: 1, waktu: "2026-11-23 13:58:00" }, kini), "sesi berjalan");
  assert.ok(alasanRtsSibuk(bebas, { sensor16: "1", waktu: "2026-11-23 13:58:00" }, kini), "sensor16 string");
  assert.equal(alasanRtsSibuk(bebas, { sensor16: 1, waktu: "2026-11-23 12:00:00" }, kini), null, "logger mati di tengah sesi");
  assert.ok(alasanRtsSibuk({ ...bebas, status: 1, mulai: "2026-11-23 13:59:30" }, null, kini), "Mulai baru dikirim");
  assert.equal(alasanRtsSibuk({ ...bebas, status: 1, mulai: "2026-11-23 09:00:00" }, null, kini), null, "status macet");
  assert.ok(
    alasanRtsSibuk({ ...bebas, statusManual: 1 }, { sensor16: 0, waktu: "2026-11-23 13:59:00" }, kini),
    "status_manual = 1 dan logger masih melapor"
  );
  assert.equal(alasanRtsSibuk({ ...bebas, statusManual: 1 }, { sensor16: 0, waktu: "2026-11-23 11:00:00" }, kini), null);
  assert.equal(alasanRtsSibuk(null, null, kini), null);
}

// ── JalurRekamArah ──────────────────────────────────────────────────────────

type Timer = { ms: number; fn: () => void; batal: boolean };

function buatAlat(opsi: { tolak?: Partial<Record<LangkahRekam, string>>; gagalSimpan?: string } = {}) {
  const terkirim: string[] = [];
  const disimpan: string[] = [];
  const timer: Timer[] = [];
  let status: Record<number, StatusBaris> = {};
  let jalan = false;
  const alat: AlatJalur = {
    kirim: async (l, slot): Promise<HasilKirim> => {
      terkirim.push(`${l}:${slot}`);
      const pesan = opsi.tolak?.[l];
      return pesan ? { ok: false, pesan } : { ok: true };
    },
    simpan: async (slot, HA, VA): Promise<HasilKirim> => {
      disimpan.push(`${slot}:${HA}/${VA}`);
      return opsi.gagalSimpan ? { ok: false, pesan: opsi.gagalSimpan } : { ok: true };
    },
    jadwal: (ms, fn) => {
      const t = { ms, fn, batal: false };
      timer.push(t);
      return () => {
        t.batal = true;
      };
    },
    ubah: (s, j) => {
      status = s;
      jalan = j;
    },
  };
  return {
    alat,
    terkirim,
    disimpan,
    get status() {
      return status;
    },
    get jalan() {
      return jalan;
    },
    /** Jalankan timer terakhir yang masih hidup, seolah waktunya habis. */
    habis() {
      const t = [...timer].reverse().find((x) => !x.batal);
      assert.ok(t, "ada timer hidup");
      t.batal = true;
      t.fn();
    },
    timerHidup() {
      return timer.filter((x) => !x.batal).map((x) => x.ms);
    },
  };
}

const tunggu = () => new Promise((r) => setImmediate(r));

const SAS_P1: SasaranRekam = { slot: 1, nama: "P1", jenis: "fs", terakhir: P1_TERAKHIR };
const SAS_P2: SasaranRekam = { slot: 2, nama: "P2", jenis: "fs", terakhir: P2_TERAKHIR };

const UKUR_P1 = { MeasureFS: { HADMS: "361,76,06", VADMS: "099,34,06", SDis: "31.956", HD: "31.6" } };
const UKUR_P2 = { MeasureFS: { HADMS: "262,29,80", VADMS: "099,09,95", SDis: "21.699", HD: "21.4" } };

async function jalankanSatu(j: JalurRekamArah, ukur: Record<string, unknown>, rekam: Record<string, unknown>) {
  j.terima({ TurningTarget: { value: "start" } });
  j.terima({ TurningTarget: { value: "done" } });
  j.terima({ AutoSearch: { value: 1 } });
  j.terima({ MeasureFS: { value: "measure" } });
  j.terima(ukur);
  j.terima({ MeasureFS: { value: "done" } });
  j.terima({ recordTarget: rekam });
  await tunggu();
}

async function uji() {
  // Jalur lengkap dua prisma.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1, SAS_P2]);
    assert.equal(a.jalan, true);
    assert.deepEqual(a.status[2], { tahap: "antre" });
    await jalankanSatu(j, UKUR_P1, { TargetName: "P1", HA: "361,76,06", VA: "099,34,06" });
    assert.equal(a.status[1].tahap, "selesai");
    assert.deepEqual(a.status[2], { tahap: "jalan", langkah: "putar" });
    await jalankanSatu(j, UKUR_P2, { TargetName: "P2", HA: "262,29,80", VA: "099,09,95" });
    assert.deepEqual(a.terkirim, [
      "putar:1", "cari:1", "ukur:1", "rekam:1",
      "putar:2", "cari:2", "ukur:2", "rekam:2",
    ]);
    assert.deepEqual(a.disimpan, ["1:361,76,06/099,34,06", "2:262,29,80/099,09,95"]);
    assert.equal(a.jalan, false);
    assert.equal(j.sedangJalan, false);
    assert.deepEqual(a.timerHidup(), [], "tidak ada timer tertinggal");
  }

  // AutoSearch gagal di P1: P1 gagal, P2 tetap dikerjakan.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1, SAS_P2]);
    j.terima({ TurningTarget: { value: "done" } });
    j.terima({ AutoSearch: 0 });
    assert.deepEqual(a.status[1], { tahap: "gagal", langkah: "cari", pesan: "AutoSearch tidak menemukan prisma di sekitar sudut lama." });
    await jalankanSatu(j, UKUR_P2, { HA: "262,29,80", VA: "099,09,95" });
    assert.equal(a.status[2].tahap, "selesai");
    assert.ok(!a.terkirim.includes("ukur:1"));
  }

  // AutoSearch mengunci prisma lain: tidak ada recordTarget.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    j.terima({ TurningTarget: { value: "done" } });
    j.terima({ AutoSearch: 1 });
    j.terima(UKUR_P2);
    j.terima({ MeasureFS: { value: "done" } });
    await tunggu();
    assert.equal(a.status[1].tahap, "gagal");
    assert.ok(!a.terkirim.some((x) => x.startsWith("rekam")), "pagar ukur menahan rekam");
    assert.equal(a.jalan, false);
  }

  // "done" ukur tidak datang, hasilnya cocok: rekam tetap jalan setelah batas.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    j.terima({ TurningTarget: { value: "done" } });
    j.terima({ AutoSearch: 1 });
    j.terima(UKUR_P1);
    assert.deepEqual(a.timerHidup(), [BATAS_LANGKAH_MS.ukur]);
    a.habis();
    assert.deepEqual(a.status[1], { tahap: "jalan", langkah: "rekam" });
  }

  // recordTarget tidak dijawab.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    j.terima({ TurningTarget: { value: "done" } });
    j.terima({ AutoSearch: 1 });
    j.terima(UKUR_P1);
    j.terima({ MeasureFS: { value: "done" } });
    a.habis();
    const s = a.status[1];
    assert.ok(s.tahap === "gagal" && s.langkah === "rekam" && s.pesan.includes("mungkin sudah terekam"));
  }

  // Putar tidak dijawab sama sekali.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    assert.deepEqual(a.timerHidup(), [BATAS_LANGKAH_MS.putar]);
    a.habis();
    assert.deepEqual(a.status[1], { tahap: "gagal", langkah: "putar", pesan: "Tidak ada jawaban dalam 35 detik." });
  }

  // Server menolak (RTS sedang sesi): berhenti, sisanya dilewati.
  {
    const a = buatAlat({ tolak: { putar: "RTS sedang menjalankan sesi pengukuran." } });
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1, SAS_P2]);
    await tunggu();
    assert.deepEqual(a.status[1], { tahap: "gagal", langkah: "putar", pesan: "RTS sedang menjalankan sesi pengukuran." });
    assert.equal(a.status[2].tahap, "dilewati");
    assert.equal(a.jalan, false);
    assert.deepEqual(a.terkirim, ["putar:1"]);
    assert.deepEqual(a.timerHidup(), []);
  }

  // Simpan web gagal: pesan menyebut slot RTS sudah terekam.
  {
    const a = buatAlat({ gagalSimpan: "HTTP 500" });
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    await jalankanSatu(j, UKUR_P1, { HA: "361,76,06", VA: "099,34,06" });
    const s = a.status[1];
    assert.ok(s.tahap === "gagal" && s.langkah === "simpan" && s.pesan.includes("sudah terekam"));
  }

  // Balasan ganda recordTarget hanya disimpan sekali.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    j.terima({ TurningTarget: { value: "done" } });
    j.terima({ AutoSearch: 1 });
    j.terima(UKUR_P1);
    j.terima({ MeasureFS: { value: "done" } });
    j.terima({ recordTarget: { HA: "361,76,06", VA: "099,34,06" } });
    j.terima({ recordTarget: { HA: "361,76,06", VA: "099,34,06" } });
    await tunggu();
    assert.equal(a.disimpan.length, 1);
  }

  // Setelah dihentikan (dialog ditutup), balasan yang terlambat diabaikan.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat, GON);
    j.mulai([SAS_P1]);
    j.hentikan();
    j.terima({ TurningTarget: { value: "done" } });
    await tunggu();
    assert.deepEqual(a.terkirim, ["putar:1"]);
  }

  console.log("rekam-arah: semua lulus");
}

uji().catch((e) => {
  console.error(e);
  process.exit(1);
});
