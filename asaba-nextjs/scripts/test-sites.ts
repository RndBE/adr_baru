import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT site FROM log_kontrol
  `);
  console.log(sites);
  await prisma.$disconnect();
}

main();
