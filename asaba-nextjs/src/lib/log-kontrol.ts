/**
 * Aturan acuan (R0) perhitungan deformasi — satu tempat, dipakai dua sisi.
 *
 * Sebelumnya aturan ini ditulis ulang di /api/deformasi dan di guard penghapusan
 * sesi. Begitu salah satunya berubah, guard berhenti menunjuk sesi yang sama
 * dengan yang benar-benar dipakai menghitung, dan acuan sungguhan bisa terhapus
 * tanpa penolakan apa pun.
 */
import { prisma } from "@/lib/prisma";

/**
 * Sesi yang jadi acuan deformasi untuk satu site.
 *
 * Dua langkah, dan langkah keduanya yang gampang terlupa: kalau tidak ada sesi
 * bertanda `r0 = 1`, yang dipakai adalah sesi TERTUA site itu. Artinya sesi
 * tertua ikut menentukan hasil walau tidak pernah ditandai apa pun.
 */
export async function cariAcuanR0(site: string): Promise<string | null> {
  const bertanda = await prisma.logKontrol.findFirst({ where: { site, r0: 1 } });
  if (bertanda) return bertanda.id_log;

  const tertua = await prisma.logKontrol.findFirst({
    where: { site },
    orderBy: { datetime: "asc" },
  });
  return tertua?.id_log ?? null;
}
