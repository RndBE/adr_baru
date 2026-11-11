/**
 * Konversi payload format Beacon ke payload datar ADR.
 * Jalankan: npx tsx src/lib/payload-beacon.test.ts
 *
 * Yang dijaga:
 *
 *   1. Payload Beacon NYATA dari logger 30002 menghasilkan sensor1–25 yang sama
 *      dengan pesan format lama yang dikirim logger itu pada menit yang sama.
 *   2. Hasilnya lolos filter teks-objek (payload-sensor.ts) — kalau tidak,
 *      seluruh data lewat be-stesy.cloud akan ditolak 422.
 *   3. Slot kosong tetap kosong, slot 26+ diabaikan, nilai objek ditolak.
 */
import { beaconKePayloadAdr, SLOT_ADR } from "./payload-beacon";
import { sensorBerisiTeksObjek } from "./payload-sensor";

let gagal = 0;
function cek(judul: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(
    `${ok ? "ok  " : "GAGAL"} ${judul}${ok ? "" : `\n      dapat ${JSON.stringify(dapat)}\n      harus ${JSON.stringify(harus)}`}`
  );
}

// Ditangkap dari topik MQTT Logger_30002, 11 November 2026 14:26 WIB.
const BEACON = {
  id_alat: "30002",
  jam: "14:26:00",
  hari: "2026-11-11",
  reading_at: "2026-11-11T07:26:00Z",
  sensor1: { nama: "ADR.ID_Target", nilai: "0", satuan: "-" },
  sensor2: { nama: "ADR.IH", nilai: 0, satuan: "m" },
  sensor3: { nama: "ADR.PN", nilai: "0", satuan: "-" },
  sensor4: { nama: "ADR.TH", nilai: 0, satuan: "m" },
  sensor5: { nama: "ADR.HA", nilai: "", satuan: "dms" },
  sensor6: { nama: "ADR.VA", nilai: "", satuan: "dms" },
  sensor7: { nama: "ADR.SD", nilai: 0, satuan: "m" },
  sensor8: { nama: "ADR.N", nilai: 0, satuan: "m" },
  sensor9: { nama: "ADR.E", nilai: 0, satuan: "m" },
  sensor10: { nama: "ADR.Z", nilai: 0, satuan: "m" },
  sensor11: { nama: "ADR.N0", nilai: 464232.796, satuan: "m" },
  sensor12: { nama: "ADR.E0", nilai: 9749253.947, satuan: "m" },
  sensor13: { nama: "ADR.Z0", nilai: 38.813, satuan: "m" },
  sensor14: { nama: "ADR.Daya_RTS", nilai: 0, satuan: "-" },
  sensor15: { nama: "ADR.Status_Putar", nilai: 0, satuan: "-" },
  sensor16: { nama: "ADR.RTS_Jalan", nilai: 0, satuan: "-" },
  sensor17: { nama: "ADR.Status_SD", nilai: 1, satuan: "-" },
  sensor18: { nama: "ADR.Info_FTP", nilai: 0, satuan: "-" },
  sensor19: { nama: "ADR.Jumlah_Restart", nilai: 31, satuan: "-" },
  sensor20: { nama: "ADR.Humi", nilai: 34.59, satuan: "%Rh" },
  sensor21: { nama: "ADR.Batt", nilai: 12.24, satuan: "V" },
  sensor22: { nama: "ADR.Temp", nilai: 36.25, satuan: "C" },
  sensor23: { nama: "ADR.Batt_RTS", nilai: 0, satuan: "V" },
  sensor24: { nama: "ADR.Tilt1", nilai: 0, satuan: "-" },
  sensor25: { nama: "ADR.Tilt2", nilai: 0, satuan: "-" },
  sensor26: {}, sensor27: {}, sensor28: {}, sensor29: {}, sensor30: {},
  sensor31: {}, sensor32: {}, sensor33: {}, sensor34: {}, sensor35: {},
  sensor36: {}, sensor37: {}, sensor38: {}, sensor39: {}, sensor40: {},
  sensor41: {}, sensor42: {}, sensor43: {},
  sensor44: { nama: "Jumlah_Restart", nilai: 31, satuan: "-" },
  sensor45: { nama: "Count_Fail", nilai: 0, satuan: "-" },
  sensor46: { nama: "Count_Terkirim", nilai: 335, satuan: "-" },
  sensor47: { nama: "Status_SD", nilai: 1, satuan: "-" },
  sensor48: { nama: "Humi_Logger", nilai: 34.39, satuan: "%Rh" },
  sensor49: { nama: "Batt_Logger", nilai: 12.24, satuan: "V" },
  sensor50: { nama: "Temp_Logger", nilai: 36.28, satuan: "C" },
};

// Pesan format lama dari logger yang sama, menit yang sama (kolom kredensial
// dan identitas dibuang; yang dibandingkan hanya sensor1–25).
const LAMA: Record<string, string> = {
  sensor1: "0", sensor2: "0", sensor3: "0", sensor4: "0", sensor5: "", sensor6: "",
  sensor7: "0", sensor8: "0", sensor9: "0", sensor10: "0", sensor11: "464232.796",
  sensor12: "9749253.947", sensor13: "38.813", sensor14: "0", sensor15: "0",
  sensor16: "0", sensor17: "1", sensor18: "0", sensor19: "31", sensor20: "34.39",
  sensor21: "12.24", sensor22: "36.28", sensor23: "0.00", sensor24: "0", sensor25: "0",
};

const hasil = beaconKePayloadAdr(BEACON);
cek("payload nyata diterima", hasil.ok, true);
if (hasil.ok) {
  const p = hasil.payload;
  cek("id_alat, tanggal (dari hari), jam", [p.id_alat, p.tanggal, p.jam], ["30002", "2026-11-11", "14:26:00"]);
  cek("tidak ada slot di atas 25", Object.keys(p).filter((k) => /^sensor\d+$/.test(k)).length, SLOT_ADR);
  cek("reading_at tidak ikut", "reading_at" in p, false);

  // Slot 20, 22, 23: pesan lama memakai bacaan internal logger (Humi_Logger,
  // Temp_Logger) dan format "0.00"; pesan Beacon memakai bacaan ADR.* sendiri.
  // Selisih kecil yang wajar, bukan pergeseran slot.
  const BEDA_BACAAN = new Set([20, 22, 23]);
  const tidakCocok: string[] = [];
  for (let i = 1; i <= SLOT_ADR; i += 1) {
    if (BEDA_BACAAN.has(i)) continue;
    if (p[`sensor${i}`] !== LAMA[`sensor${i}`]) tidakCocok.push(`sensor${i}`);
  }
  cek("sensor1–25 sama dengan pesan lama (kecuali 20/22/23)", tidakCocok, []);
  cek("angka besar tidak jadi notasi ilmiah", p.sensor12, "9749253.947");
  cek("HA/VA kosong tetap teks kosong", [p.sensor5, p.sensor6], ["", ""]);
  cek("lolos filter teks objek", sensorBerisiTeksObjek(p), null);
}

// Saat RTS mengukur, HA/VA berupa teks d,m,s dan PN berupa nama prisma.
const UKUR = beaconKePayloadAdr({
  id_alat: "30002", hari: "2026-11-04", jam: "09:37:07",
  sensor1: { nama: "ADR.ID_Target", nilai: 3 },
  sensor3: { nama: "ADR.PN", nilai: " TS_1 " },
  sensor5: { nama: "ADR.HA", nilai: "137,19,72", satuan: "dms" },
  sensor16: { nama: "ADR.RTS_Jalan", nilai: 1 },
});
cek(
  "teks d,m,s dan nama prisma diteruskan (di-trim)",
  UKUR.ok ? [UKUR.payload.sensor1, UKUR.payload.sensor3, UKUR.payload.sensor5, UKUR.payload.sensor16] : null,
  ["3", "TS_1", "137,19,72", "1"]
);
cek("slot yang tidak dikirim tidak diisi", UKUR.ok ? "sensor2" in UKUR.payload : null, false);

const kosong = beaconKePayloadAdr({
  id_alat: 30002, hari: "2026-11-11", jam: "14:27:00",
  sensor1: {}, sensor2: [], sensor3: null, sensor4: { nama: "ADR.TH" }, sensor5: { nama: "ADR.HA", nilai: null },
});
cek("id_alat angka diterima", kosong.ok ? kosong.payload.id_alat : null, "30002");
cek(
  "{} [] null tanpa-nilai nilai-null → kosong",
  kosong.ok ? ["sensor1", "sensor2", "sensor3", "sensor4", "sensor5"].filter((k) => k in kosong.payload) : null,
  []
);

cek("bentuk datar tetap diterima", (() => {
  const r = beaconKePayloadAdr({ id_alat: "30002", tanggal: "2026-11-11", jam: "14:26:00", sensor14: "1", sensor21: 12.5 });
  return r.ok ? [r.payload.tanggal, r.payload.sensor14, r.payload.sensor21] : null;
})(), ["2026-11-11", "1", "12.5"]);

cek("hari menang atas tanggal", (() => {
  const r = beaconKePayloadAdr({ id_alat: "1", hari: "2026-11-11", tanggal: "2000-01-01" });
  return r.ok ? r.payload.tanggal : null;
})(), "2026-11-11");

// Penolakan
cek("tanpa id_alat → 400", beaconKePayloadAdr({ hari: "2026-11-11", jam: "14:26:00" }), {
  ok: false, status: 400, galat: "id_alat is required",
});
cek("id_alat kosong → 400", (beaconKePayloadAdr({ id_alat: "  " }) as { status?: number }).status, 400);
cek("bukan objek → 400", (beaconKePayloadAdr([1, 2]) as { status?: number }).status, 400);
cek("null → 400", (beaconKePayloadAdr(null) as { status?: number }).status, 400);
cek("nilai berupa objek → 422 dengan nama slot", beaconKePayloadAdr({ id_alat: "1", sensor7: { nilai: { a: 1 } } }), {
  ok: false, status: 422, galat: "sensor7: nilai bukan angka atau teks",
});
cek("nilai boolean → 422", (beaconKePayloadAdr({ id_alat: "1", sensor2: { nilai: true } }) as { status?: number }).status, 422);
cek("array berisi → 422", (beaconKePayloadAdr({ id_alat: "1", sensor2: [1] }) as { status?: number }).status, 422);
cek("slot 26+ yang rusak tidak mengganggu", beaconKePayloadAdr({ id_alat: "1", sensor30: { nilai: { a: 1 } } }).ok, true);

if (gagal) {
  console.log(`\n${gagal} GAGAL`);
  process.exit(1);
}
console.log("\nsemua lolos");
