import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ──────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { username: "demo_asaba" },
    update: {},
    create: {
      nama: "PT MIP",
      username: "demo_asaba",
      // Original MD5: bcd684e70e482a8d6c1885db0217331e
      // We keep the MD5 hash for backward compatibility
      password: "bcd684e70e482a8d6c1885db0217331e",
      level_user: "admin",
      alamat:
        "Kadirojo I, Purwomartani, Kalasan, Sleman Regency, Special Region of Yogyakarta 55571",
      telp: "089",
      instansi: "PT. MIP",
      latitude: "-6.6708022",
      longitude: "106.8812745",
      zoom: 17,
    },
  });

  // ── Lokasi ─────────────────────────────────────────────────
  // Clear and recreate
  await prisma.$executeRaw`DELETE FROM t_lokasi WHERE idlokasi = 1`;
  await prisma.$executeRaw`
    INSERT INTO t_lokasi (idlokasi, nama_lokasi, latitude, longitude)
    VALUES (1, 'Pos RTS Site MIP', '-6.6708022', '106.8812745')
  `;

  // ── Kategori Logger ────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM kategori_logger WHERE id_katlogger = 1`;
  await prisma.$executeRaw`
    INSERT INTO kategori_logger (id_katlogger, nama_kategori, controller, tabel, kepanjangan, temp_data, icon_app, view)
    VALUES (1, 'ADR', 'rts', 'rts', 'Automatic Deformation Recorder', 'temp_rts', 'ADR', 1)
  `;

  // ── Logger ─────────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM t_logger WHERE id_logger = '30002'`;
  await prisma.$executeRaw`
    INSERT INTO t_logger (id, id_logger, nama_logger, lokasi_logger, kategori_log, tabel)
    VALUES (5, '30002', 'Automatic Deformation Recorder', '1', '1', 'rts')
  `;

  // ── Informasi ──────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM t_informasi WHERE logger_id = '30002'`;
  await prisma.$executeRaw`
    INSERT INTO t_informasi (id_inf, logger_id, seri, sensor, serial_number, elevasi, nosell, nama_pic, no_pic, tgl_aktif, garansi, tgl_kontrak, imei, masa_aktif)
    VALUES (33, '30002', 'BL-1100', '', 'BE-1100V22024010216', '', '088289534205', '', '', '2024-08-23', '2025-08-23', '', '', '2025-08-23')
  `;

  // ── Config ADR ─────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM config_adr WHERE id_logger = 30002`;
  await prisma.$executeRaw`
    INSERT INTO config_adr (id, id_logger, job_name, prisma_cons, ts_high, coor_x, coor_y, coor_z, step_record, retries, cycle_time)
    VALUES (1, 30002, 'Demo Tambang MIP', 30, 0, 401321, 525952, 62.559, 2, 1, 1)
  `;

  // ── Prisma (Target Points) ─────────────────────────────────
  await prisma.$executeRaw`DELETE FROM t_prisma WHERE id_logger = 30002`;
  const prismas = [
    { id: 1, id_prisma: "P1", nama: "BS_1", HA: "000,00,02", VA: "087,57,12" },
    { id: 2, id_prisma: "P2", nama: "PC_4", HA: "042,12,01", VA: "086,41,28" },
    { id: 3, id_prisma: "P3", nama: "C1", HA: "070,51,12", VA: "079,26,12" },
    { id: 4, id_prisma: "P4", nama: "C2", HA: "049,37,51", VA: "078,02,40" },
    { id: 5, id_prisma: "P5", nama: "C3", HA: "026,20,40", VA: "078,20,56" },
    { id: 6, id_prisma: "P6", nama: "C4", HA: "007,13,52", VA: "080,00,50" },
    { id: 7, id_prisma: "P7", nama: "C5", HA: "353,57,21", VA: "081,47,24" },
    { id: 8, id_prisma: "P8", nama: "C6", HA: "345,05,38", VA: "083,17,52" },
    { id: 9, id_prisma: "P9", nama: "C7", HA: "339,03,42", VA: "084,22,25" },
    { id: 10, id_prisma: "P10", nama: "C8", HA: "334,20,08", VA: "085,12,20" },
  ];

  for (const p of prismas) {
    await prisma.$executeRaw`
      INSERT INTO t_prisma (id, id_prisma, id_logger, nama_prisma, status_controller, target_height, HA, VA, SlopDis)
      VALUES (${p.id}, ${p.id_prisma}, 30002, ${p.nama}, 'sensor9', 0, ${p.HA}, ${p.VA}, 0)
    `;
  }

  // ── Filter ─────────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM filter`;
  await prisma.$executeRaw`
    INSERT INTO filter (id, id_kategori, nama_filter, icon) VALUES
    (1, 1, 'Koneksi Terputus', 'adr_off'),
    (2, 1, 'Koneksi Terhubung', 'adr_on'),
    (3, 1, 'Perbaikan', 'adr_perbaikan')
  `;

  // ── Kode Akses ─────────────────────────────────────────────
  await prisma.$executeRaw`DELETE FROM kode_akses WHERE id = 2`;
  await prisma.$executeRaw`
    INSERT INTO kode_akses (id, id_user, kode_akses, tanggal_mulai, tanggal_selesai)
    VALUES (2, 2, '6a174e36e951ffc4cc8fa36450316996', '2023-09-25', '2023-11-30')
  `;

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
