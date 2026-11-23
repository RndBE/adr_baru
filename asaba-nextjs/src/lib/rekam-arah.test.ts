/**
 * Kunci perbarui arah bidik. Jalankan: npx tsx src/lib/rekam-arah.test.ts
 *
 * Balasan getTarget/setTarget di bawah disalin dari MQTT logger 30002 dengan
 * firmware BL1100-v2.2.3, 23 Nov 2026 16:17–16:19 — termasuk slot 2 yang
 * dirusak versi recordTarget fitur ini (HA/VA ",,").
 */
import assert from "node:assert/strict";
import {
  BATAS_LANGKAH_MS,
  JalurRekamArah,
  alasanRtsSibuk,
  bacaBalasanLangkah,
  geserSampingM,
  langkahSah,
  perintahLangkah,
  sudutFirmwareSah,
  type AlatJalur,
  type HasilKirim,
  type LangkahRekam,
  type StatusBaris,
} from "@/lib/rekam-arah";

const GON = 0.9;

// ── perintahLangkah ─────────────────────────────────────────────────────────
assert.deepEqual(perintahLangkah("baca", { slot: 2 }), { command: "set_rts", getTarget: { slot: 2 } });
assert.deepEqual(perintahLangkah("pastikan", { slot: 2 }), { command: "set_rts", getTarget: { slot: 2 } });
assert.deepEqual(
  perintahLangkah("tulis", { slot: 2, HA: "130,34,79", VA: "099,11,90" }),
  { command: "set_rts", setTarget: { slot: 2, HA: "130,34,79", VA: "099,11,90" } },
  "tanpa name/targetHigh/mode: firmware mempertahankannya"
);
assert.equal(langkahSah("tulis"), true);
assert.equal(langkahSah("putar"), false, "langkah versi recordTarget tidak berlaku lagi");
assert.equal(langkahSah("simpan"), false, "simpan bukan perintah MQTT");

// ── sudutFirmwareSah ────────────────────────────────────────────────────────
assert.equal(sudutFirmwareSah("130,34,79"), true);
assert.equal(sudutFirmwareSah("099,11,90"), true);
assert.equal(sudutFirmwareSah("361,76,05"), true, "gon di atas 360 tetap sah");
assert.equal(sudutFirmwareSah("130,3,14"), false, "firmware menolak ini dengan bad angle");
assert.equal(sudutFirmwareSah(",,"), false, "isi slot yang dirusak recordTarget");
assert.equal(sudutFirmwareSah("000,00,00"), false, "tembakan gagal");
assert.equal(sudutFirmwareSah("130.3479"), false);
assert.equal(sudutFirmwareSah(undefined), false);

// ── geserSampingM ───────────────────────────────────────────────────────────
const g = geserSampingM({ HA: "361,96,78", VA: "099,34,19" }, { HA: "361,76,05", VA: "099,34,06" }, 31.955, GON);
assert.ok(g !== null && g > 0.09 && g < 0.12, `P1 kantor ~10 cm, dapat ${g}`);
assert.equal(geserSampingM({ HA: ",,", VA: ",," }, { HA: "130,34,79", VA: "099,11,90" }, 21.7, GON), null);

// ── bacaBalasanLangkah (balasan asli firmware) ──────────────────────────────
{
  const s2 = { slot: 2 };
  const b = (l: LangkahRekam, d: Record<string, unknown>) => bacaBalasanLangkah(l, s2, d);

  assert.deepEqual(
    b("baca", { getTarget: { slot: 2, name: "P2", HA: "130,34,14", VA: "099,11,97", targetHigh: "0", mode: "as" } }),
    { jenis: "isi-slot", HA: "130,34,14", VA: "099,11,97" }
  );
  assert.deepEqual(
    b("baca", { getTarget: { slot: "all", targets: [{ slot: 2, HA: ",,", VA: ",," }], bagian: 1, lanjut: false } }),
    { jenis: "abaikan" },
    "bentuk daftar bukan milik langkah ini"
  );
  assert.deepEqual(
    b("baca", { getTarget: { slot: 2, name: "P2", HA: ",,", VA: ",,", targetHigh: "0", mode: "as" } }),
    { jenis: "isi-slot", HA: ",,", VA: ",," },
    "slot rusak boleh dibaca sebelum ditulis ulang"
  );
  assert.equal(
    b("pastikan", { getTarget: { slot: 2, name: "P2", HA: ",,", VA: ",," } }).jenis,
    "gagal",
    "sesudah ditulis, slot rusak = gagal"
  );
  assert.equal(b("baca", { getTarget: { slot: 7, error: "empty slot" } }).jenis, "abaikan", "slot lain");
  assert.deepEqual(b("baca", { getTarget: { slot: 2, error: "empty slot" } }), {
    jenis: "gagal",
    pesan: "Ditolak RTS: Slot ini kosong di RTS.",
  });
  assert.deepEqual(
    b("tulis", { setTarget: { slot: 2, name: "P2", HA: "130,34,14", VA: "099,11,97", targetHigh: "0", mode: "as", value: "done" } }),
    { jenis: "isi-slot", HA: "130,34,14", VA: "099,11,97" }
  );
  assert.deepEqual(b("tulis", { setTarget: { slot: 2, error: "bad angle" } }), {
    jenis: "gagal",
    pesan: "Ditolak RTS: Format sudut ditolak firmware.",
  });
  assert.equal(b("tulis", { setTarget: { slot: 2, error: "busy" } }).jenis, "gagal");
  assert.equal(b("tulis", { getTarget: { slot: 2, HA: "130,34,14", VA: "099,11,97" } }).jenis, "abaikan", "langkah tulis menunggu setTarget");
  assert.equal(b("pastikan", { setTarget: { slot: 2, HA: "1", VA: "1", value: "done" } }).jenis, "abaikan");
  assert.equal(b("baca", { id_alat: "30002", getTarget: { slot: 2 } }).jenis, "abaikan", "data berkala");
}

// ── alasanRtsSibuk ──────────────────────────────────────────────────────────
{
  const kini = "2026-11-23 14:00:00";
  const bebas = { status: 0, statusManual: 0, mulai: "2026-11-23 10:39:52" };
  assert.equal(alasanRtsSibuk(bebas, { sensor16: 0, waktu: "2026-11-23 13:59:00" }, kini), null);
  assert.ok(alasanRtsSibuk(bebas, { sensor16: 1, waktu: "2026-11-23 13:58:00" }, kini), "sesi berjalan");
  assert.equal(alasanRtsSibuk(bebas, { sensor16: 1, waktu: "2026-11-23 12:00:00" }, kini), null, "logger mati di tengah sesi");
  assert.ok(alasanRtsSibuk({ ...bebas, status: 1, mulai: "2026-11-23 13:59:30" }, null, kini), "Mulai baru dikirim");
  assert.equal(alasanRtsSibuk({ ...bebas, status: 1, mulai: "2026-11-23 09:00:00" }, null, kini), null, "status macet");
  assert.equal(alasanRtsSibuk(null, null, kini), null);
}

// ── JalurRekamArah ──────────────────────────────────────────────────────────

type Timer = { ms: number; fn: () => void; batal: boolean };

/** Logger palsu: slot disimpan di sini, balasannya disuapkan ke jalur. */
function buatAlat(opsi: {
  tujuan?: Record<number, { HA: string; VA: string }>;
  tolak?: Partial<Record<LangkahRekam, string>>;
  gagalSimpan?: string;
} = {}) {
  const terkirim: string[] = [];
  const disimpan: string[] = [];
  const timer: Timer[] = [];
  let status: Record<number, StatusBaris> = {};
  let jalan = false;
  const alat: AlatJalur = {
    kirim: async (l, slot): Promise<HasilKirim> => {
      terkirim.push(`${l}:${slot}`);
      const pesan = opsi.tolak?.[l];
      if (pesan) return { ok: false, pesan };
      return l === "tulis" ? { ok: true, tujuan: opsi.tujuan?.[slot] ?? { HA: "130,34,79", VA: "099,11,90" } } : { ok: true };
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
const isi = (slot: number, HA: string, VA: string) => ({ slot, name: `P${slot}`, HA, VA, targetHigh: "0", mode: "as" });

async function uji() {
  // Jalur lengkap dua prisma; slot 2 rusak (",,") lalu diperbaiki.
  {
    const a = buatAlat({ tujuan: { 1: { HA: "229,49,82", VA: "099,27,79" }, 2: { HA: "130,34,79", VA: "099,11,90" } } });
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 1, nama: "P1" }, { slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(1, "229,50,20", "099,27,81") });
    await tunggu(); // jawaban HTTP langkah tulis (membawa tujuan)
    j.terima({ setTarget: { ...isi(1, "229,49,82", "099,27,79"), value: "done" } });
    j.terima({ getTarget: isi(1, "229,49,82", "099,27,79") });
    await tunggu();
    assert.deepEqual(a.status[1], {
      tahap: "selesai",
      HA: "229,49,82",
      VA: "099,27,79",
      sebelum: { HA: "229,50,20", VA: "099,27,81" },
    });
    j.terima({ getTarget: isi(2, ",,", ",,") });
    await tunggu();
    j.terima({ setTarget: { ...isi(2, "130,34,79", "099,11,90"), value: "done" } });
    j.terima({ getTarget: isi(2, "130,34,79", "099,11,90") });
    await tunggu();
    assert.equal(a.status[2].tahap, "selesai");
    assert.deepEqual(a.terkirim, ["baca:1", "tulis:1", "pastikan:1", "baca:2", "tulis:2", "pastikan:2"]);
    assert.deepEqual(a.disimpan, ["1:229,49,82/099,27,79", "2:130,34,79/099,11,90"]);
    assert.equal(a.jalan, false);
    assert.deepEqual(a.timerHidup(), [], "tidak ada timer tertinggal");
  }

  // Balasan setTarget tiba SEBELUM jawaban HTTP langkah tulis.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    j.terima({ setTarget: { ...isi(2, "130,34,79", "099,11,90"), value: "done" } }); // belum ada tujuan
    await tunggu();
    assert.deepEqual(a.status[2], { tahap: "jalan", langkah: "pastikan" }, "balasan tertunda dicocokkan");
    j.terima({ getTarget: isi(2, "130,34,79", "099,11,90") });
    await tunggu();
    assert.equal(a.status[2].tahap, "selesai");
  }

  // Firmware menyimpan angka lain: tidak disimpan di web.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    await tunggu();
    j.terima({ setTarget: { ...isi(2, "130,34,80", "099,11,90"), value: "done" } });
    await tunggu();
    const s = a.status[2];
    assert.ok(s.tahap === "gagal" && s.langkah === "tulis" && s.pesan.includes("berbeda"));
    assert.deepEqual(a.disimpan, []);
    assert.ok(!a.terkirim.includes("pastikan:2"));
  }

  // Dibaca ulang berbeda (mis. slot ditimpa Prism Config di antaranya).
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    await tunggu();
    j.terima({ setTarget: { ...isi(2, "130,34,79", "099,11,90"), value: "done" } });
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    await tunggu();
    const s = a.status[2];
    assert.ok(s.tahap === "gagal" && s.langkah === "pastikan");
    assert.deepEqual(a.disimpan, []);
  }

  // Firmware menolak (busy): prisma gagal, prisma berikutnya tetap jalan.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 1, nama: "P1" }, { slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(1, "229,50,20", "099,27,81") });
    await tunggu();
    j.terima({ setTarget: { slot: 1, error: "busy" } });
    assert.ok(a.status[1].tahap === "gagal");
    assert.deepEqual(a.status[2], { tahap: "jalan", langkah: "baca" });
  }

  // Server menolak (RTS sedang sesi): berhenti, sisanya dilewati.
  {
    const a = buatAlat({ tolak: { baca: "RTS sedang menjalankan sesi pengukuran." } });
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 1, nama: "P1" }, { slot: 2, nama: "P2" }]);
    await tunggu();
    assert.deepEqual(a.status[1], { tahap: "gagal", langkah: "baca", pesan: "RTS sedang menjalankan sesi pengukuran." });
    assert.equal(a.status[2].tahap, "dilewati");
    assert.equal(a.jalan, false);
    assert.deepEqual(a.timerHidup(), []);
  }

  // Tidak dijawab.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    assert.deepEqual(a.timerHidup(), [BATAS_LANGKAH_MS.baca]);
    a.habis();
    assert.deepEqual(a.status[2], { tahap: "gagal", langkah: "baca", pesan: "getTarget tidak dijawab dalam 15 detik." });
  }

  // Simpan web gagal: pesan menyebut slot RTS sudah berisi sudut baru.
  {
    const a = buatAlat({ gagalSimpan: "HTTP 500" });
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    await tunggu();
    j.terima({ setTarget: { ...isi(2, "130,34,79", "099,11,90"), value: "done" } });
    j.terima({ getTarget: isi(2, "130,34,79", "099,11,90") });
    await tunggu();
    const s = a.status[2];
    assert.ok(s.tahap === "gagal" && s.langkah === "simpan" && s.pesan.includes("sudah berisi"));
  }

  // Setelah dihentikan (dialog ditutup), balasan yang terlambat diabaikan.
  {
    const a = buatAlat();
    const j = new JalurRekamArah(a.alat);
    j.mulai([{ slot: 2, nama: "P2" }]);
    j.hentikan();
    j.terima({ getTarget: isi(2, "130,08,63", "099,00,66") });
    await tunggu();
    assert.deepEqual(a.terkirim, ["baca:2"]);
  }

  console.log("rekam-arah: semua lulus");
}

uji().catch((e) => {
  console.error(e);
  process.exit(1);
});
