import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const data = await prisma.$queryRawUnsafe(`
      SELECT waktu, sensor20, sensor21, sensor22, sensor23
      FROM rts
      WHERE code_logger = '30002'
      ORDER BY waktu DESC
      LIMIT 5
    `);
    console.log("RTS Data:", data);
  } catch (e) {
    console.error("Error querying RTS:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
