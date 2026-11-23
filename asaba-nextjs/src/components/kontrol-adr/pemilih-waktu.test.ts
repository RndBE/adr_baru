/**
 * Letak dropdown waktu Jadwal running. Jalankan:
 *   npx tsx src/components/kontrol-adr/pemilih-waktu.test.ts
 *
 * Dropdown harus tetap di dalam kotak modal: ke bawah bila muat, ke atas bila
 * yang muat ruang atas, dipendekkan ke sisi yang lebih lega bila keduanya
 * tidak muat.
 */
import assert from "node:assert/strict";
import { letakDropdown, pisahWaktu } from "./pemilih-waktu";

const tombol = { top: 300, bottom: 332, left: 508, right: 600 };
const dalam = (p: { top: number; height: number }, b: { top: number; bottom: number }) =>
  p.top >= b.top + 8 && p.top + p.height <= b.bottom - 8;

// Muat di bawah.
{
  const b = { top: 100, bottom: 600, left: 200, right: 700 };
  const p = letakDropdown(tombol, b);
  assert.deepEqual(p, { top: 336, left: 476, height: 168 });
  assert.ok(dalam(p, b));
}

// Bawah sempit (baris terakhir dekat footer), atas lega: dibuka ke atas.
{
  const b = { top: 100, bottom: 420, left: 200, right: 700 };
  const p = letakDropdown(tombol, b);
  assert.equal(p.height, 168);
  assert.equal(p.top, 300 - 4 - 168);
  assert.ok(dalam(p, b));
}

// Dua-duanya sempit: dipendekkan ke sisi yang lebih lega, tetap di dalam modal.
{
  const b = { top: 150, bottom: 470, left: 200, right: 700 };
  const p = letakDropdown(tombol, b); // atas 138, bawah 126
  assert.equal(p.height, 138);
  assert.equal(p.top + p.height, 300 - 4);
  assert.ok(dalam(p, b));
}
{
  const b = { top: 180, bottom: 490, left: 200, right: 700 };
  const p = letakDropdown(tombol, b); // atas 108, bawah 146
  assert.equal(p.top, 336);
  assert.equal(p.height, 146);
  assert.ok(dalam(p, b));
}

// Tombol di dekat tepi kiri modal: dropdown tidak keluar ke kiri.
{
  const b = { top: 100, bottom: 600, left: 200, right: 700 };
  const p = letakDropdown({ top: 300, bottom: 332, left: 210, right: 260 }, b);
  assert.equal(p.left, 208);
}

assert.deepEqual(pisahWaktu("20:25"), ["20", "25"]);
assert.deepEqual(pisahWaktu("7:5"), ["07", "05"]);
assert.deepEqual(pisahWaktu(""), ["00", "00"]);
assert.deepEqual(pisahWaktu("25:61"), ["00", "00"]);

console.log("pemilih-waktu: semua lulus");
