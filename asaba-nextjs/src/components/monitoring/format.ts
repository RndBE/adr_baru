/**
 * Pembaca & pemformat nilai untuk Beranda.
 *
 * Prisma $queryRaw bisa mengembalikan Date ATAU string "YYYY-MM-DD HH:MM:SS"
 * tergantung driver, jadi semua waktu dinormalkan ke ISO dulu. Nilai DB adalah
 * jam dinding WIB; bagian jamnya ditampilkan apa adanya, tanpa konversi zona.
 */
export function parseWaktuToIso(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString();
    if (typeof d === "string") {
      const normalized = d.trim().replace(" ", "T");
      const dt = new Date(normalized);
      if (isNaN(dt.getTime())) return null;
      return normalized.includes("T") ? normalized : dt.toISOString();
    }
  } catch {
    /* abaikan — jatuh ke null */
  }
  return null;
}

/** "21-11-2025 10:11" (opsional dengan detik). "—" bila kosong. */
export function fmtDate(
  d: string | Date | null | undefined,
  opsi: { detik?: boolean } = {}
): string {
  const iso = parseWaktuToIso(d);
  if (!iso || !iso.includes("T")) return "—";
  const [tgl, jamRaw] = iso.split("T");
  const [y, m, day] = tgl.split("-");
  const [hh, mm, ss] = jamRaw.split(".")[0].split(":");
  if (!y || !m || !day || !hh || !mm) return "—";
  return `${day}-${m}-${y} ${hh}:${mm}${opsi.detik && ss ? `:${ss}` : ""}`;
}

/** Hanya tanggal: "21-11-2025". */
export function fmtTanggal(d: string | Date | null | undefined): string {
  const s = fmtDate(d);
  return s === "—" ? s : s.split(" ")[0];
}

/** Hanya jam: "10:11". */
export function fmtJam(d: string | Date | null | undefined): string {
  const s = fmtDate(d);
  return s === "—" ? s : s.split(" ")[1];
}

/**
 * Epoch ms dengan asumsi nilai DB adalah waktu WIB (UTC+7) — cara yang sama
 * dengan Beranda sebelumnya, supaya status Terhubung/Terputus tidak berubah.
 */
export function waktuMsWib(w: string | Date | null | undefined): number | null {
  const iso = parseWaktuToIso(w);
  if (!iso) return null;
  const tanpaZona = iso.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
  const ms = new Date(tanpaZona + "+07:00").getTime();
  return isNaN(ms) ? null : ms;
}

export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "23.58"; "—" bila kosong. Titik desimal mengikuti halaman lain di aplikasi. */
export function fmt(v: number | null | undefined, desimal = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(desimal);
}

/** "+3.44" / "-3.44" — tanda selalu ditulis supaya kolom selisih mudah dibaca. */
export function fmtSelisih(v: number | null | undefined, desimal = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(desimal)}`;
}

/** "344.19 (Utara)" → { bearing: 344.19, teks: "Utara" }. Null untuk "-" atau kosong. */
export function parseArah(s: unknown): { bearing: number; teks: string } | null {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:\(([^)]*)\))?/);
  if (!m) return null;
  const bearing = Number(m[1]);
  if (!Number.isFinite(bearing)) return null;
  return { bearing, teks: (m[2] ?? "").trim() };
}

/** Bearing 0–360° searah jarum jam dari utara, dari komponen timur (dx) & utara (dy). */
export function bearingDari(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Sudut dari RTS ke derajat desimal.
 *
 * Instrumen mengirim sudut sebagai "derajat,menit,detik" dengan koma sebagai
 * pemisah medan — mis. "331,05,05" berarti 331° 05′ 05″, BUKAN 331,0505.
 * Membacanya dengan Number() menghasilkan NaN, dan mengganti koma jadi titik
 * menghasilkan angka yang salah tapi masuk akal — jenis kekeliruan yang paling
 * sulit terlihat. Bentuk desimal biasa ikut diterima karena beberapa balasan
 * (mis. `dari_ha` pada jog) memang sudah desimal.
 */
export function parseDms(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (s === "") return null;

  const bagian = s.split(",");
  if (bagian.length === 1) {
    const n = Number(bagian[0]);
    return Number.isFinite(n) ? n : null;
  }

  const [d, m, sec] = bagian.map((x) => Number(x.trim()));
  if (!Number.isFinite(d)) return null;
  const menit = Number.isFinite(m) ? m : 0;
  const detik = Number.isFinite(sec) ? sec : 0;
  // Tanda derajat berlaku untuk seluruh sudut: -1,30,00 berarti -1,5°.
  const tanda = d < 0 || s.trimStart().startsWith("-") ? -1 : 1;
  return tanda * (Math.abs(d) + menit / 60 + detik / 3600);
}

/** Sudut sebagai "331°05′05″"; "—" bila tidak terbaca. */
export function fmtDms(v: unknown): string {
  const deg = parseDms(v);
  if (deg === null) return "—";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const sec = Math.round((mFloat - m) * 60);
  // Pembulatan detik bisa mendorongnya ke 60; naikkan ke menit berikutnya.
  const detik = sec === 60 ? 0 : sec;
  const menit = sec === 60 ? m + 1 : m;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${deg < 0 ? "-" : ""}${d}°${pad(menit)}′${pad(detik)}″`;
}
