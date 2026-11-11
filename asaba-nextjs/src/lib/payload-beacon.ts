/**
 * Payload format Beacon → payload datar yang dipahami pemrosesan ADR.
 *
 * Logger ADR (BL1100, firmware Beacon) mengirim data berkalanya dalam format
 * Beacon. Kalau logger didaftarkan di be-stesy.cloud, Integration di sana
 * meneruskan payload itu APA ADANYA ke `/api/datamasuk/adr-json`:
 *
 *   {
 *     "id_alat": "30002", "hari": "2026-11-11", "jam": "14:26:00",
 *     "reading_at": "2026-11-11T07:26:00Z",
 *     "sensor1":  {"nama": "ADR.ID_Target", "nilai": "0", "satuan": "-"},
 *     "sensor5":  {"nama": "ADR.HA", "nilai": "137,19,72", "satuan": "dms"},
 *     "sensor12": {"nama": "ADR.E0", "nilai": 9749253.947, "satuan": "m"},
 *     "sensor26": {},
 *     "sensor44": {"nama": "Jumlah_Restart", "nilai": 31, "satuan": "-"},
 *     ...
 *   }
 *
 * Pemrosesan ADR memakai bentuk lama: `id_alat`, `tanggal`, `jam`, dan
 * `sensor1`–`sensor25` berisi nilainya langsung. Urutan slot 1–25 format
 * Beacon SAMA dengan format lama (dicocokkan 11 November 2026 dari kedua pesan
 * yang dikirim logger 30002 pada menit yang sama), jadi konversinya per slot —
 * cukup ambil `nilai`. `nama` dan `satuan` tidak dipakai: semua tujuan
 * Integration lain juga membaca per slot, bukan per nama.
 *
 * Slot 26 ke atas diabaikan. 26–43 kosong, 44–50 kesehatan logger yang tidak
 * punya kolom di `rts`.
 *
 * Jalankan tes: npx tsx src/lib/payload-beacon.test.ts
 */

/** Jumlah slot sensor yang punya kolom di `rts` / `temp_rts`. */
export const SLOT_ADR = 25;

export type HasilKonversiBeacon =
  | { ok: true; payload: Record<string, string> }
  | { ok: false; status: 400 | 422; galat: string };

/** Teks dari string atau angka; selain itu kosong. Sama seperti route lama: di-trim. */
function teks(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

type IsiSlot = { nilai?: string; galat?: string };

/**
 * Nilai satu slot sensor.
 *
 * - `{}`, `[]`, `null`, slot tanpa `nilai`, atau `nilai: null` → slot kosong
 *   (tidak diisi; pemrosesan mengisinya "" atau "0" seperti kiriman lama).
 * - `{"nilai": <teks|angka>}` → nilainya.
 * - Teks/angka langsung (bentuk datar) → diterima apa adanya.
 * - `nilai` berupa objek/array/boolean → galat. Diteruskan sebagai teks, ia
 *   akan jadi "[object Object]" di kolom sensor — persis sampah yang dulu
 *   menimpa `temp_rts` (lihat payload-sensor.ts).
 */
function isiSlot(v: unknown): IsiSlot {
  if (v === undefined || v === null) return {};
  if (typeof v === "string" || typeof v === "number") return { nilai: teks(v) };
  if (Array.isArray(v)) return v.length === 0 ? {} : { galat: "bukan objek sensor" };
  if (typeof v !== "object") return { galat: "bukan objek sensor" };

  const o = v as Record<string, unknown>;
  if (!("nilai" in o) || o.nilai === null || o.nilai === undefined) return {};
  if (typeof o.nilai === "string" || typeof o.nilai === "number") return { nilai: teks(o.nilai) };
  return { galat: "nilai bukan angka atau teks" };
}

export function beaconKePayloadAdr(json: unknown): HasilKonversiBeacon {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, status: 400, galat: "Badan request harus objek JSON." };
  }
  const o = json as Record<string, unknown>;

  const idAlat = teks(o.id_alat);
  if (!idAlat) {
    return { ok: false, status: 400, galat: "id_alat is required" };
  }

  const payload: Record<string, string> = { id_alat: idAlat };

  // Format Beacon menyebut tanggalnya `hari`; `tanggal` diterima juga supaya
  // kiriman datar lama tidak kehilangan waktunya. Tanpa keduanya pemrosesan
  // jatuh ke jam server, sama seperti route lama.
  const tanggal = teks(o.hari) || teks(o.tanggal);
  const jam = teks(o.jam);
  if (tanggal) payload.tanggal = tanggal;
  if (jam) payload.jam = jam;

  for (let i = 1; i <= SLOT_ADR; i += 1) {
    const kunci = `sensor${i}`;
    const isi = isiSlot(o[kunci]);
    if (isi.galat) {
      return { ok: false, status: 422, galat: `${kunci}: ${isi.galat}` };
    }
    if (isi.nilai !== undefined) payload[kunci] = isi.nilai;
  }

  return { ok: true, payload };
}
