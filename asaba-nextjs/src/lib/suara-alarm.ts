/**
 * Pemutar bunyi alarm ambang di peramban (Web Audio). Hanya untuk sisi klien.
 *
 * Satu AudioContext dan paling banyak satu bunyi berjalan per tab. Pemanggil
 * cukup menyatakan tingkat yang SEHARUSNYA berbunyi (atau null); pemutar ini
 * yang memutuskan perlu mengganti, membiarkan, atau menghentikan.
 *
 * Peramban menahan suara sampai halaman pernah diklik atau diketik (kebijakan
 * autoplay). AudioContext yang dibuat sebelum itu berstatus "suspended" dan
 * diam — bunyi yang sudah dijadwalkan baru keluar setelah bukaKunciSuara()
 * dipanggil dari dalam klik. Karena itu keadaannya bisa dipantau, supaya layar
 * bisa meminta satu klik alih-alih diam-diam tidak berbunyi.
 */
import { POLA_BUNYI, sintesisPola, type TingkatAlarm } from "@/lib/alarm-ambang";

/** Volume keseluruhan. Pola sudah mencapai ±1, jadi ini batas atas sebenarnya. */
const VOLUME = 0.35;

let ctx: AudioContext | null = null;
let sumber: AudioBufferSourceNode | null = null;
let sedang: TingkatAlarm | null = null;
const simpananBuffer = new Map<TingkatAlarm, AudioBuffer>();
const pemantau = new Set<() => void>();

function beriTahu() {
  for (const f of pemantau) f();
}

function konteks(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    ctx.addEventListener("statechange", beriTahu);
    beriTahu();
  }
  return ctx;
}

/** True bila suara benar-benar bisa keluar sekarang. */
export function suaraBerjalan(): boolean {
  return ctx?.state === "running";
}

/** Daftarkan fungsi yang dipanggil tiap kali keadaan AudioContext berubah. */
export function pantauSuara(f: () => void): () => void {
  pemantau.add(f);
  return () => {
    pemantau.delete(f);
  };
}

/**
 * Panggil dari dalam klik/ketukan pengguna. Di luar itu peramban menolak
 * resume() — tidak melempar, cukup tetap "suspended".
 */
export async function bukaKunciSuara(): Promise<boolean> {
  const c = konteks();
  if (!c) return false;
  if (c.state !== "running") {
    try {
      await c.resume();
    } catch {
      // Ditolak kebijakan autoplay; dicoba lagi pada klik berikutnya.
    }
  }
  return c.state === "running";
}

function bufferUntuk(c: AudioContext, tingkat: TingkatAlarm): AudioBuffer {
  let buf = simpananBuffer.get(tingkat);
  if (!buf) {
    const data = sintesisPola(POLA_BUNYI[tingkat], c.sampleRate);
    buf = c.createBuffer(1, data.length, c.sampleRate);
    buf.getChannelData(0).set(data);
    simpananBuffer.set(tingkat, buf);
  }
  return buf;
}

/** Bunyikan pola tingkat ini berulang sampai diganti atau dihentikan. */
export function setelBunyi(tingkat: TingkatAlarm | null): void {
  if (tingkat === sedang) return;
  hentikanBunyi();
  if (!tingkat) return;

  const c = konteks();
  if (!c) return;
  const s = c.createBufferSource();
  s.buffer = bufferUntuk(c, tingkat);
  s.loop = true;
  const g = c.createGain();
  g.gain.value = VOLUME;
  s.connect(g).connect(c.destination);
  s.start();
  sumber = s;
  sedang = tingkat;
}

export function hentikanBunyi(): void {
  if (sumber) {
    try {
      sumber.stop();
    } catch {
      // Sudah berhenti.
    }
    sumber.disconnect();
  }
  sumber = null;
  sedang = null;
}
