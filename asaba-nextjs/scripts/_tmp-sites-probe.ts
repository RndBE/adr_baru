import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rows: any = await p.$queryRawUnsafe("SELECT * FROM t_site ORDER BY urutan");
  console.log(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2));
  await p.$disconnect();
}
main();
