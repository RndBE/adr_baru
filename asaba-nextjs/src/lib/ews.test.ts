/**
 * Kunci tabel level EWS. Jalankan: npx tsx src/lib/ews.test.ts
 */
import assert from "node:assert/strict";
import { levelEws, payloadEws, tingkatSite } from "@/lib/ews";

// Angka level terbalik dari keparahan — sesuai protokol perangkat EWS.
assert.equal(levelEws("Waspada"), 3);
assert.equal(levelEws("Siaga"), 2);
assert.equal(levelEws("Awas"), 1);
assert.equal(levelEws("Normal"), 0);

// Bentuk payload persis seperti yang dibaca firmware: tanpa set_<id>.
assert.deepEqual(payloadEws("Awas"), { EWS: { cmd: "CTRL", level: 1 } });
assert.equal(JSON.stringify(payloadEws("Normal")), '{"EWS":{"cmd":"CTRL","level":0}}');
assert.equal(JSON.stringify(payloadEws("Waspada")), '{"EWS":{"cmd":"CTRL","level":3}}');

// Satu prisma Awas cukup; yang lain normal tidak meredamnya.
assert.equal(tingkatSite(["Normal", "Awas", "Normal", "Siaga"]), "Awas");
assert.equal(tingkatSite(["Normal", "Waspada", "Normal"]), "Waspada");
assert.equal(tingkatSite(["Normal", "Normal"]), "Normal");
// Tanpa data = Aman, bukan galat.
assert.equal(tingkatSite([]), "Normal");
assert.equal(tingkatSite([null, undefined]), "Normal");

console.log("ews.test.ts: semua lolos");
