/**
 * Uji regresi refactor multi-site.
 *
 * Membandingkan output /api/deformasi (yang sekarang membaca konfigurasi dari
 * tabel t_site) dengan perhitungan ulang memakai konstanta lama yang dulu
 * di-hardcode. CCP dan Viewpoint harus menghasilkan angka yang sama persis.
 */
import "dotenv/config";

const BASE = process.env.BASE_URL || "http://localhost:3000";

// ─── Konstanta lama, disalin dari kode sebelum refactor ─────────────────────

function lamaRotateEN(E: number, N: number, degree: number): [number, number] {
  const pivotE = 525919.314;
  const pivotN = 401306.514;
  const measE = 525951.9891;
  const measN = 401356.7348;
  const x = E - measE;
  const y = N - measN;
  const t = (degree * Math.PI) / 180;
  return [pivotE + (x * Math.cos(t) - y * Math.sin(t)), pivotN + (x * Math.sin(t) + y * Math.cos(t))];
}

function lamaStatusPergeseran(mm: number, site: string) {
  if (site === "ccp") {
    if (mm < 100) return "Normal";
    if (mm < 200) return "Waspada";
    if (mm < 400) return "Siaga";
    return "Awas";
  }
  if (mm < 50) return "Normal";
  if (mm < 100) return "Waspada";
  if (mm < 200) return "Siaga";
  return "Awas";
}

function lamaStatusKecepatan(mmd: number, site: string) {
  let level = 0;
  if (site === "ccp") {
    if (mmd > 150) level = 3;
    else if (mmd > 100) level = 2;
    else if (mmd > 50) level = 1;
  } else {
    if (mmd > 120) level = 3;
    else if (mmd > 80) level = 2;
    else if (mmd > 40) level = 1;
  }
  return (["Normal", "Waspada", "Siaga", "Awas"] as const)[level];
}

function lamaGetRts(site: string) {
  if (site === "ccp") return { E: 525952.0, N: 401320.988, Z: 62.559 };
  return { E: 526904.411, N: 402826.049, Z: 53.751 };
}

// ─── Pembanding ─────────────────────────────────────────────────────────────

let lolos = 0;
let gagal = 0;

function cek(nama: string, aktual: unknown, harusnya: unknown) {
  const sama = JSON.stringify(aktual) === JSON.stringify(harusnya);
  if (sama) {
    lolos++;
  } else {
    gagal++;
    console.log(`  ✗ ${nama}\n      dapat  : ${JSON.stringify(aktual)}\n      harusnya: ${JSON.stringify(harusnya)}`);
  }
}

async function ujiSite(site: string, idLog: string) {
  console.log(`\n── ${site} (id_log ${idLog}) ─────────────────────────`);
  const res = await fetch(`${BASE}/api/deformasi?id_log=${idLog}`).then((r) => r.json());
  if (!res.success) {
    console.log(`  ✗ API gagal: ${res.error} ${res.detail ?? ""}`);
    gagal++;
    return;
  }

  const d = res.data;
  cek("posisi_rts", d.posisi_rts, lamaGetRts(site));
  cek("site.slug", d.site.slug, site);
  cek("tidak ada peringatan", d.peringatan, []);

  const rows = d.data_pengukuran as Array<Record<string, any>>;
  console.log(`  ${rows.length} prisma diperiksa`);

  for (const row of rows) {
    const t = row.temp_tembak;
    const label = `${site}/${row.id_prisma}`;

    // Rotasi: hasil server harus sama dengan rotasi konstanta lama
    // diterapkan pada koordinat mentah.
    if (site === "ccp") {
      const [eh, nh] = lamaRotateEN(t.raw_E1, t.raw_N1, 114);
      cek(`${label} E1 (rotasi)`, Number(t.E1.toFixed(6)), Number(eh.toFixed(6)));
      cek(`${label} N1 (rotasi)`, Number(t.N1.toFixed(6)), Number(nh.toFixed(6)));
    } else {
      // Viewpoint tidak dirotasi — koordinat olahan harus sama dengan mentahnya.
      cek(`${label} E1 (tanpa rotasi)`, t.E1, t.raw_E1);
      cek(`${label} N1 (tanpa rotasi)`, t.N1, t.raw_N1);
    }

    if (row.daily?.status_pergeseran) {
      cek(
        `${label} status_pergeseran`,
        row.daily.status_pergeseran.label,
        lamaStatusPergeseran(row.daily.pergeseran_mm, site)
      );
      cek(
        `${label} status_kecepatan`,
        row.daily.status_kecepatan.label,
        lamaStatusKecepatan(row.daily.kecepatan_mmd, site)
      );
    }
  }
}

async function ujiSiteBaru() {
  console.log(`\n── politeknik-pu (data contoh) ─────────────────────────`);
  const res = await fetch(`${BASE}/api/sites`).then((r) => r.json());
  const ppu = res.data.find((s: any) => s.slug === "politeknik-pu");

  cek("politeknik-pu ada", !!ppu, true);
  cek("koordinat terisi", ppu?.rts_e !== null, true);
  cek("ditandai terkalibrasi", ppu?.terkalibrasi, true);
  // Yang paling penting: field lengkap TIDAK boleh menghilangkan peringatan,
  // karena isinya nilai karangan.
  cek("tetap ditandai data contoh", ppu?.data_dummy, true);
  cek("zona UTM 49 selatan", [ppu?.utm_zone, ppu?.utm_north], [49, false]);
  cek("ambang ketat", ppu?.geser_normal_max, 50);

  const def = await fetch(`${BASE}/api/deformasi?id_log=PPU00006`).then((r) => r.json());
  cek("deformasi berhasil", def.success, true);
  cek(
    "peringatan data contoh muncul",
    def.data?.peringatan?.[0]?.includes("DATA CONTOH"),
    true
  );
  cek("5 prisma contoh", def.data?.data_pengukuran?.length, 5);

  // Sebaran status: data contoh harus menampilkan lebih dari satu level,
  // kalau semuanya "Awas" berarti angkanya tidak realistis.
  const label = (id: string) =>
    def.data?.data_pengukuran?.find((r: any) => r.id_prisma === id)?.daily
      ?.status_pergeseran?.label;
  cek("P1 Normal", label("P1"), "Normal");
  cek("P2 Waspada", label("P2"), "Waspada");
  cek("P3 Siaga", label("P3"), "Siaga");
  cek("P5 Awas", label("P5"), "Awas");
}

async function ujiFallback() {
  console.log(`\n── site tidak terdaftar (fallback) ─────────────────────`);
  const res = await fetch(`${BASE}/api/test-sites`).then((r) => r.json());
  cek("daftar site dari master data", res.sites?.length >= 3, true);
  cek("tidak ada site yatim", res.belum_terdaftar, []);
}

async function ujiRiwayatPerSite() {
  console.log(`\n── riwayat harus tersaring per site ────────────────────`);

  const semua = await fetch(`${BASE}/api/log-kontrol?limit=100&with_prisma=false`).then((r) =>
    r.json()
  );
  const totalSemua = semua.data.length;

  const perSite: Record<string, number> = {};
  for (const slug of ["ccp", "viewpoint", "politeknik-pu"]) {
    const res = await fetch(
      `${BASE}/api/log-kontrol?site=${slug}&limit=100&with_prisma=false`
    ).then((r) => r.json());
    perSite[slug] = res.data.length;

    // Tiap baris yang kembali harus benar-benar milik site itu.
    const bocor = res.data.filter((row: any) => row.site !== slug);
    cek(`${slug}: tidak ada baris site lain`, bocor.length, 0);
  }

  // Kalau filter tidak bekerja, tiap site akan mengembalikan jumlah yang sama
  // dengan total keseluruhan — inilah bug yang dilaporkan.
  cek(
    "jumlah per site < total keseluruhan",
    Object.values(perSite).every((n) => n < totalSemua),
    true
  );
  cek(
    "jumlah per site berjumlah = total",
    Object.values(perSite).reduce((a, b) => a + b, 0),
    totalSemua
  );

  // Jumlah sesi dari /api/sites harus cocok dengan hasil filter — dipakai
  // dashboard untuk "Total Running", dan tidak boleh terpotong limit.
  const sites = await fetch(`${BASE}/api/sites?with_logger=1`).then((r) => r.json());
  for (const s of sites.data) {
    cek(`${s.slug}: jumlah_sesi cocok`, s.jumlah_sesi, perSite[s.slug]);
  }
  cek("politeknik-pu punya logger sendiri",
    sites.data.find((s: any) => s.slug === "politeknik-pu")?.id_logger, "30003");
}

async function ujiPrismaPerSite() {
  console.log(`\n── prisma harus tersaring per site ─────────────────────`);

  // Slot yang sama ada di beberapa site tapi merujuk target fisik berbeda.
  const perSite: Record<string, string[]> = {};
  for (const slug of ["ccp", "viewpoint", "politeknik-pu"]) {
    const res = await fetch(`${BASE}/api/prisma-data?site=${slug}`).then((r) => r.json());
    cek(`${slug}: prisma-data berhasil`, res.success, true);
    const rows = res.data as Array<{ id_prisma: string; site: string }>;
    perSite[slug] = rows.map((r) => r.id_prisma).sort();
    cek(`${slug}: tidak ada baris site lain`, rows.filter((r) => r.site !== slug).length, 0);
  }

  const semua = await fetch(`${BASE}/api/prisma-data`).then((r) => r.json());
  cek(
    "tanpa filter mengembalikan lebih banyak dari tiap site",
    Object.values(perSite).every((v) => v.length < semua.data.length),
    true
  );

  // Inti bug: "P1" ada di ccp DAN viewpoint, dan keduanya target berbeda.
  cek("P1 ada di ccp", perSite.ccp.includes("P1"), true);
  cek("P1 ada di viewpoint", perSite.viewpoint.includes("P1"), true);
  // Slot P1 ada di KETIGA site sekaligus — justru inti dari scoping ini.
  cek("P1 ada di politeknik-pu juga", perSite["politeknik-pu"].includes("P1"), true);
  cek("politeknik-pu punya 5 slot", perSite["politeknik-pu"].length, 5);

  // Daftar slot di Prism Config juga harus per site.
  for (const slug of ["ccp", "viewpoint"]) {
    const res = await fetch(`${BASE}/api/prism-config?site=${slug}`).then((r) => r.json());
    const terdaftar = (res.data as Array<{ registered: boolean; site?: string }>).filter(
      (s) => s.registered
    );
    cek(`${slug}: prism-config hanya site ini`, terdaftar.every((s) => s.site === slug), true);
  }

  // Prisma yang dipakai perhitungan deformasi harus milik site sesi tersebut.
  const def = await fetch(`${BASE}/api/deformasi?id_log=PPU00006`).then((r) => r.json());
  const namaPrisma = (def.data?.data_pengukuran ?? []).map((r: any) => r.id_prisma);
  cek("deformasi politeknik-pu tepat 5 prisma", namaPrisma.length, 5);
  // Slotnya bernama P1..P5 sama seperti site lain, jadi buktinya ada di nama
  // target: yang terambil harus benar-benar milik site ini.
  const namaTarget = (def.data?.data_pengukuran ?? []).map((r: any) => r.nama_prisma);
  cek(
    "target yang terambil milik site ini",
    namaTarget.every((n: string) => n.startsWith("PPU_")),
    true
  );

  // Endpoint tulis harus menolak permintaan tanpa site — tanpa penjagaan ini
  // satu operasi bisa mengenai slot bernama sama di seluruh site.
  for (const [metode, body] of [
    ["POST", { slot_id: 99, nama_prisma: "uji" }],
    ["PUT", { slot_id: 99, nama_prisma: "uji" }],
    ["DELETE", { slot_id: 99 }],
  ] as const) {
    const res = await fetch(`${BASE}/api/prism-config`, {
      method: metode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    cek(`prism-config ${metode} tanpa site ditolak`, res.success, false);
  }
}

async function ujiConfigAdr() {
  console.log(`
── konfigurasi RTS per site ────────────────────────────`);

  const perSite: Record<string, any> = {};
  for (const slug of ["ccp", "viewpoint", "politeknik-pu"]) {
    const res = await fetch(`${BASE}/api/config-adr?site=${slug}`).then((r) => r.json());
    cek(`${slug}: config ada`, res.success, true);
    perSite[slug] = res.data;
  }

  // Bug awalnya: endpoint mengembalikan baris yang sama untuk semua site.
  const jobs = Object.values(perSite).map((c: any) => c?.job_name);
  cek("job_name berbeda tiap site", new Set(jobs).size, 3);

  // Origin RTS yang dikirim ke perangkat harus sama persis dengan koordinat
  // referensi site yang dipakai menghitung deformasi.
  const sites = await fetch(`${BASE}/api/sites`).then((r) => r.json());
  for (const s of sites.data) {
    const c = perSite[s.slug];
    if (!c || s.rts_n === null) continue;
    cek(`${s.slug}: origin N sama dengan t_site`, c.coor_x, s.rts_n);
    cek(`${s.slug}: origin E sama dengan t_site`, c.coor_y, s.rts_e);
    cek(`${s.slug}: origin Z sama dengan t_site`, c.coor_z, s.rts_z);
  }

  cek(
    "config-adr tanpa site ditolak",
    (await fetch(`${BASE}/api/config-adr`).then((r) => r.json())).success,
    false
  );

  // prisma_count dulu menghitung seluruh baris rts termasuk heartbeat
  // (sensor1=0), sehingga satu sesi CCP terbaca 1193 prisma.
  console.log(`
── jumlah prisma per sesi harus wajar ──────────────────`);
  const jumlahPrisma: Record<string, number> = { ccp: 10, viewpoint: 8, "politeknik-pu": 5 };
  for (const [slug, harus] of Object.entries(jumlahPrisma)) {
    const res = await fetch(`${BASE}/api/log-kontrol?site=${slug}&limit=1`).then((r) => r.json());
    cek(`${slug}: prisma_count = ${harus}`, res.data[0]?.prisma_count, harus);
  }
}

async function ujiTujuanMqtt() {
  console.log(`
── perintah MQTT harus ke logger site yang benar ───────`);

  // Payload MQTT berbentuk { set_<id_logger>: … }. Dengan lebih dari satu unit
  // RTS terdaftar, memilih "logger ADR pertama" bisa mengirim perintah ke
  // perangkat milik site lain.
  const loggerSite: Record<string, string> = {
    ccp: "30002",
    viewpoint: "30002",
    "politeknik-pu": "30003",
  };

  for (const [slug, harus] of Object.entries(loggerSite)) {
    const cfg = await fetch(`${BASE}/api/config-adr?site=${slug}`).then((r) => r.json());
    cek(`${slug}: config menunjuk logger ${harus}`, String(cfg.data?.id_logger), harus);
  }

  // Endpoint yang menggerakkan alat harus menolak permintaan tanpa site.
  const tanpaSite = await fetch(`${BASE}/api/kontrol/go-to-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot_id: 1 }),
  }).then((r) => r.json());
  cek("go-to-target tanpa site ditolak", tanpaSite.success, false);

  const siteAsing = await fetch(`${BASE}/api/kontrol/go-to-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot_id: 1, site: "tidak-ada" }),
  }).then((r) => r.json());
  cek("go-to-target site tak dikenal ditolak", siteAsing.success, false);

  // Semua endpoint yang MENGIRIM perintah ke perangkat harus menolak permintaan
  // tanpa tujuan yang jelas — tidak boleh lagi menebak "logger ADR pertama".
  const perintah: Array<[string, object]> = [
    ["kontrol/power", { action: "on" }],
    ["kontrol/auto-search", { slot_id: 1 }],
    ["kontrol/go-to-target", { slot_id: 1 }],
    ["mqtt", { command: "auto_search" }],
  ];
  for (const [ep, body] of perintah) {
    const res = await fetch(`${BASE}/api/${ep}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    cek(`${ep} tanpa tujuan ditolak`, res.success, false);
  }

  // Daftar slot hanya bermakna dalam konteks satu site.
  const tanpaSiteGet = await fetch(`${BASE}/api/prism-config`).then((r) => r.json());
  cek("prism-config GET tanpa site ditolak", tanpaSiteGet.success, false);
}

async function ujiKontrolStart() {
  console.log(`\n── kontrol/start wajib menerima site ───────────────────`);
  // Tanpa site → harus ditolak, bukan diam-diam tercatat sebagai 'ccp'.
  const tanpaSite = await fetch(`${BASE}/api/kontrol/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kode_akses: "salah" }),
  }).then((r) => r.json());
  cek("tanpa site ditolak", tanpaSite.success, false);
  cek("pesan menyebut site", tanpaSite.error?.toLowerCase().includes("site"), true);

  // Site yang tidak terdaftar → juga ditolak.
  const siteAsing = await fetch(`${BASE}/api/kontrol/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kode_akses: "salah", site: "tidak-ada" }),
  }).then((r) => r.json());
  cek("site tak terdaftar ditolak", siteAsing.success, false);
}

async function main() {
  await ujiSite("ccp", "101109");
  await ujiSite("viewpoint", "134134");
  await ujiSiteBaru();
  await ujiFallback();
  await ujiRiwayatPerSite();
  await ujiPrismaPerSite();
  await ujiConfigAdr();
  await ujiTujuanMqtt();
  await ujiKontrolStart();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`Lolos: ${lolos}   Gagal: ${gagal}`);
  // process.exitCode, bukan process.exit() — keluar paksa saat masih ada
  // koneksi fetch terbuka memicu assertion crash libuv di Windows.
  if (gagal > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Error:", e);
  process.exitCode = 1;
});
