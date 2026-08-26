/**
 * Seed master data site (`t_site`).
 *
 * Nilai untuk `ccp` dan `viewpoint` disalin persis dari konstanta yang dulu
 * di-hardcode, supaya perilaku kedua site itu tidak berubah sedikit pun setelah
 * refactor:
 *   - ambang       : src/lib/deformasi.ts + src/app/api/deformasi/route.ts
 *   - koordinat RTS: getRtsBySite() di src/lib/deformasi.ts
 *   - rotasi       : rotateEN() / rotateCoordinate() di src/lib/coordinates.ts
 *   - center peta  : src/components/PrismaMap.tsx
 *
 * Idempoten: aman dijalankan berulang (upsert berdasarkan slug).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SITES = [
  {
    slug: "ccp",
    nama: "CPP 3",
    badge_label: "CPP 3",
    badge_color: "#5484EE",
    // Ambang khusus CCP — lebih longgar dari site lain.
    geser_normal_max: 100,
    geser_waspada_max: 200,
    geser_siaga_max: 400,
    laju_waspada_min: 50,
    laju_siaga_min: 100,
    laju_awas_min: 150,
    rts_e: 525952.0,
    rts_n: 401320.988,
    rts_z: 62.559,
    utm_zone: 50,
    utm_north: true,
    map_lat: 3.6307977846194737,
    map_lng: 117.23368934932883,
    map_zoom: 18,
    // Koreksi rotasi: BS_1 yang terukur RTS meleset dari posisi GNSS sebenarnya.
    rotasi_deg: 114,
    pivot_e: 525919.314,
    pivot_n: 401306.514,
    ukur_e: 525951.9891,
    ukur_n: 401356.7348,
    pivot_lat: 3.630666916497659,
    pivot_lng: 117.23339499051768,
    ukur_lat: 3.6311211814254656,
    ukur_lng: 117.23368933432215,
    aktif: true,
    urutan: 1,
    catatan: null,
  },
  {
    slug: "viewpoint",
    nama: "Viewpoint",
    badge_label: "VP",
    badge_color: "#F3722C",
    geser_normal_max: 50,
    geser_waspada_max: 100,
    geser_siaga_max: 200,
    laju_waspada_min: 40,
    laju_siaga_min: 80,
    laju_awas_min: 120,
    rts_e: 526904.411,
    rts_n: 402826.049,
    rts_z: 53.751,
    utm_zone: 50,
    utm_north: true,
    map_lat: 3.6444116043375363,
    map_lng: 117.24226908676536,
    map_zoom: 15,
    // Viewpoint tidak memakai koreksi rotasi.
    rotasi_deg: null,
    pivot_e: null,
    pivot_n: null,
    ukur_e: null,
    ukur_n: null,
    pivot_lat: null,
    pivot_lng: null,
    ukur_lat: null,
    ukur_lng: null,
    aktif: true,
    urutan: 2,
    catatan: null,
  },
  {
    slug: "politeknik-pu",
    nama: "Politeknik PU",
    badge_label: "PPU",
    badge_color: "#2A9D8F",
    // Ambang sementara memakai nilai paling ketat (sama seperti Viewpoint)
    // sampai ada penetapan geoteknik khusus untuk site ini.
    geser_normal_max: 50,
    geser_waspada_max: 100,
    geser_siaga_max: 200,
    laju_waspada_min: 40,
    laju_siaga_min: 80,
    laju_awas_min: 120,
    // BELUM DIKALIBRASI — sengaja null, bukan 0. Nilai 0 akan terlihat seperti
    // koordinat sah dan menghasilkan angka deformasi yang salah tanpa peringatan.
    rts_e: null,
    rts_n: null,
    rts_z: null,
    utm_zone: 50,
    utm_north: true,
    map_lat: null,
    map_lng: null,
    map_zoom: 16,
    rotasi_deg: null,
    pivot_e: null,
    pivot_n: null,
    ukur_e: null,
    ukur_n: null,
    pivot_lat: null,
    pivot_lng: null,
    ukur_lat: null,
    ukur_lng: null,
    aktif: true,
    urutan: 3,
    catatan:
      "BELUM DIKALIBRASI. Perlu diisi sebelum dipakai untuk pemantauan: " +
      "koordinat referensi RTS (E/N/Z), zona UTM beserta hemisfer, dan center peta. " +
      "Ambang pergeseran/kecepatan saat ini memakai default ketat milik Viewpoint " +
      "dan belum ditetapkan secara geoteknik untuk site ini.",
  },
] as const;

/** Site terkalibrasi hanya bila koordinat RTS dan center peta lengkap. */
function terkalibrasi(s: (typeof SITES)[number]): boolean {
  return (
    s.rts_e !== null &&
    s.rts_n !== null &&
    s.rts_z !== null &&
    s.map_lat !== null &&
    s.map_lng !== null
  );
}

async function main() {
  console.log("🌱 Seeding t_site...");

  for (const s of SITES) {
    const data = { ...s, terkalibrasi: terkalibrasi(s) };
    await prisma.site.upsert({
      where: { slug: s.slug },
      create: data,
      update: data,
    });
    const tanda = data.terkalibrasi ? "✓" : "⚠ belum dikalibrasi";
    console.log(`  ${s.slug.padEnd(15)} → ${s.nama.padEnd(14)} ${tanda}`);
  }

  // Site yang sudah ada datanya di log_kontrol tapi belum terdaftar di t_site
  // akan jatuh ke fallbackSite() saat runtime — laporkan supaya tidak luput.
  const dipakai = await prisma.$queryRaw<Array<{ site: string | null }>>`
    SELECT DISTINCT site FROM log_kontrol
  `;
  const terdaftar = new Set<string>(SITES.map((s) => s.slug));
  const yatim = dipakai
    .map((r) => r.site)
    .filter((s): s is string => !!s && !terdaftar.has(s));

  if (yatim.length > 0) {
    console.warn(
      `⚠ Site ada di log_kontrol tapi belum terdaftar di t_site: ${yatim.join(", ")}`
    );
  }

  console.log("✅ Seed t_site selesai.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
