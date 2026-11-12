"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import useSWR from "swr";
import { BellOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WARNA_STATUS } from "@/components/monitoring/status";
import { indeksStatus } from "@/lib/ambang";
import {
  TINGKAT_ALARM,
  akuiSemua,
  belumDiakui,
  rapikanDiakui,
  samaDiakui,
  terburuk,
  uraiDiakui,
  type PrismaAlarm,
  type TingkatAlarm,
} from "@/lib/alarm-ambang";
import {
  bukaKunciSuara,
  hentikanBunyi,
  pantauSuara,
  setelBunyi,
  suaraBerjalan,
} from "@/lib/suara-alarm";

/**
 * Alarm suara ambang batas untuk seluruh dasbor.
 *
 * Berbunyi selama ada prisma yang naik ke Waspada, Siaga, atau Awas dan belum
 * "didengar" operator. Tombol Matikan bunyi hanya membungkam tingkat yang
 * sedang tampil: kenaikan berikutnya — prisma yang sama naik lagi, atau prisma
 * lain menyusul — berbunyi lagi. Aturannya di lib/alarm-ambang.ts.
 *
 * Setelan dan catatan "sudah didengar" disimpan per peramban (localStorage),
 * bukan per akun: yang perlu dibungkam adalah speaker di ruangan itu, dan
 * mematikan bunyi di laptop seseorang tidak boleh ikut membungkam layar ruang
 * kontrol.
 */

const KUNCI_SUARA = "adr-alarm-suara";
const KUNCI_DIAKUI = "adr-alarm-diakui";
const LAMA_TES_MS = 3000;
const TANYA_TIAP_MS = 30_000;

// ─── localStorage sebagai external store ────────────────────────────────────
//
// Event `storage` hanya datang dari TAB LAIN, jadi tulisan di tab ini memberi
// tahu pelanggannya sendiri. Dengan itu Matikan bunyi di satu tab ikut
// membungkam tab dasbor lain di peramban yang sama.

const pelanggan = new Set<() => void>();

function langganan(f: () => void) {
  pelanggan.add(f);
  window.addEventListener("storage", f);
  return () => {
    pelanggan.delete(f);
    window.removeEventListener("storage", f);
  };
}

function baca(kunci: string): string | null {
  try {
    return window.localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

function tulis(kunci: string, nilai: string) {
  try {
    window.localStorage.setItem(kunci, nilai);
  } catch {
    // Mode privat / penyimpanan diblokir: setelan berlaku sampai halaman ditutup saja.
  }
  for (const f of pelanggan) f();
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NilaiAlarm {
  daftar: PrismaAlarm[];
  /** Prisma yang membuat bunyi sekarang (belum didengar). */
  baru: PrismaAlarm[];
  suaraAktif: boolean;
  aturSuaraAktif: (aktif: boolean) => void;
  /** Tingkat yang sedang dibunyikan, termasuk saat tes. */
  bunyi: TingkatAlarm | null;
  /** Ada yang harus berbunyi, tapi peramban masih menahan suara. */
  terblokir: boolean;
  matikanBunyi: () => void;
  nyalakanSuara: () => void;
  tes: TingkatAlarm | null;
  tesBunyi: (t: TingkatAlarm) => void;
}

const KonteksAlarm = createContext<NilaiAlarm | null>(null);

export function AlarmAmbangProvider({ children }: { children: React.ReactNode }) {
  const { data } = useSWR<{ success: boolean; data?: PrismaAlarm[] }>(
    "/api/alarm-ambang",
    fetcher,
    { refreshInterval: TANYA_TIAP_MS, refreshWhenHidden: true }
  );
  const sahih = data?.success === true && Array.isArray(data.data);
  const daftar = useMemo(() => (sahih ? data!.data! : []), [sahih, data]);

  const suaraAktif = useSyncExternalStore(
    langganan,
    () => baca(KUNCI_SUARA) !== "0",
    () => true
  );
  const teksDiakui = useSyncExternalStore(
    langganan,
    () => baca(KUNCI_DIAKUI),
    () => null
  );
  const diakui = useMemo(() => uraiDiakui(teksDiakui), [teksDiakui]);
  const jalan = useSyncExternalStore(pantauSuara, suaraBerjalan, () => false);

  const [tes, setTes] = useState<TingkatAlarm | null>(null);
  const timerTes = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Catatan "sudah didengar" diselaraskan hanya dengan jawaban yang SAH. Kalau
  // permintaan gagal, daftar kosong bukan berarti semua kembali Normal.
  useEffect(() => {
    if (!sahih) return;
    const rapi = rapikanDiakui(diakui, daftar);
    if (!samaDiakui(rapi, diakui)) tulis(KUNCI_DIAKUI, JSON.stringify(rapi));
  }, [sahih, daftar, diakui]);

  const baru = useMemo(() => belumDiakui(daftar, diakui), [daftar, diakui]);
  const bunyi = tes ?? (suaraAktif ? terburuk(baru) : null);

  useEffect(() => {
    setelBunyi(bunyi);
  }, [bunyi]);

  useEffect(
    () => () => {
      hentikanBunyi();
      if (timerTes.current) clearTimeout(timerTes.current);
    },
    []
  );

  // Klik atau ketikan apa pun di halaman membuka kunci suara peramban, supaya
  // alarm yang datang belakangan langsung terdengar tanpa menunggu tombol.
  useEffect(() => {
    const buka = () => void bukaKunciSuara();
    window.addEventListener("pointerdown", buka);
    window.addEventListener("keydown", buka);
    return () => {
      window.removeEventListener("pointerdown", buka);
      window.removeEventListener("keydown", buka);
    };
  }, []);

  const matikanBunyi = useCallback(() => {
    tulis(KUNCI_DIAKUI, JSON.stringify(akuiSemua(daftar, diakui)));
    if (timerTes.current) clearTimeout(timerTes.current);
    setTes(null);
  }, [daftar, diakui]);

  const aturSuaraAktif = useCallback((aktif: boolean) => {
    tulis(KUNCI_SUARA, aktif ? "1" : "0");
    if (aktif) void bukaKunciSuara();
  }, []);

  const nyalakanSuara = useCallback(() => void bukaKunciSuara(), []);

  const tesBunyi = useCallback((t: TingkatAlarm) => {
    void bukaKunciSuara();
    setTes(t);
    if (timerTes.current) clearTimeout(timerTes.current);
    timerTes.current = setTimeout(() => setTes(null), LAMA_TES_MS);
  }, []);

  const nilai: NilaiAlarm = {
    daftar,
    baru,
    suaraAktif,
    aturSuaraAktif,
    bunyi,
    terblokir: bunyi !== null && !jalan,
    matikanBunyi,
    nyalakanSuara,
    tes,
    tesBunyi,
  };

  return <KonteksAlarm.Provider value={nilai}>{children}</KonteksAlarm.Provider>;
}

function useAlarm(): NilaiAlarm {
  const n = useContext(KonteksAlarm);
  if (!n) throw new Error("useAlarm dipakai di luar AlarmAmbangProvider");
  return n;
}

// ─── Tampilan ───────────────────────────────────────────────────────────────

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtWaktu(w: string | null): string | null {
  const m = w?.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[4]}:${m[5]}`;
}

function fmtMm(v: number | null): string {
  return v == null ? "tak terbaca" : `${Math.round(v).toLocaleString("id-ID")} mm`;
}

/** Teks di atas warna status. Kuning dan jingga terlalu terang untuk teks putih. */
function tintaDi(t: TingkatAlarm): string {
  return t === "Awas" ? "#ffffff" : "#14173a";
}

function Lencana({ tingkat, className }: { tingkat: TingkatAlarm; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        className
      )}
      style={{ background: WARNA_STATUS[tingkat], color: tintaDi(tingkat) }}
    >
      {tingkat}
    </span>
  );
}

/** Tombol speaker di header: status suara, aktif/nonaktif, dan tes bunyi. */
export function TombolAlarm() {
  const { suaraAktif, aturSuaraAktif, bunyi, tes, tesBunyi, terblokir } = useAlarm();
  const berbunyi = bunyi !== null && tes === null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Setelan alarm suara ambang"
        title={suaraAktif ? "Alarm suara ambang: aktif" : "Alarm suara ambang: nonaktif"}
        className={cn(
          "relative inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-[#F4F6F9] hover:text-foreground",
          !suaraAktif && "text-[#d03b3b]"
        )}
      >
        {suaraAktif ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        {berbunyi && (
          <span
            className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full"
            style={{ background: WARNA_STATUS[bunyi] }}
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="tema-monitoring w-80 gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-[#14173a]">Alarm suara ambang batas</p>
          <p className="mt-1 text-xs leading-relaxed text-[#4f5374]">
            Berbunyi saat prisma naik ke Waspada, Siaga, atau Awas — tingkat yang sama dengan
            peringatan WhatsApp, dicek tiap 30 detik. Setelan ini hanya untuk peramban ini.
          </p>
        </div>

        <button
          type="button"
          onClick={() => aturSuaraAktif(!suaraAktif)}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm",
            suaraAktif
              ? "border-[#303481]/30 bg-[#303481]/5 text-[#14173a]"
              : "border-[#d03b3b]/40 bg-[#d03b3b]/5 text-[#d03b3b]"
          )}
        >
          <span className="flex items-center gap-2">
            {suaraAktif ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Suara {suaraAktif ? "aktif" : "nonaktif"}
          </span>
          <span className="text-xs text-[#6b6f8e]">{suaraAktif ? "Matikan" : "Nyalakan"}</span>
        </button>

        <div>
          <p className="mb-1.5 text-xs font-medium text-[#4f5374]">Tes bunyi (3 detik)</p>
          <div className="grid grid-cols-3 gap-1.5">
            {TINGKAT_ALARM.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => tesBunyi(t)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1.5 text-xs font-semibold",
                  tes === t ? "border-transparent" : "border-[#14173a]/10 bg-white hover:bg-[#f3f4f8]"
                )}
                style={tes === t ? { background: WARNA_STATUS[t], color: tintaDi(t) } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[#6b6f8e]">
            Waspada: satu bip tiap 4 detik · Siaga: dua bip tiap 2 detik · Awas: sirene terus-menerus
          </p>
        </div>

        {terblokir && (
          <p className="rounded-md bg-[#fab219]/15 px-2.5 py-2 text-xs text-[#14173a]">
            Peramban menahan suara sampai halaman diklik sekali.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Pita di bawah header selama ada prisma di atas Normal. */
export function BannerAlarm() {
  const { daftar, baru, suaraAktif, bunyi, tes, terblokir, matikanBunyi, nyalakanSuara } =
    useAlarm();

  const perSite = useMemo(() => {
    const peta = new Map<string, { nama: string; prisma: PrismaAlarm[] }>();
    for (const p of daftar) {
      const g = peta.get(p.site) ?? { nama: p.namaSite, prisma: [] };
      g.prisma.push(p);
      peta.set(p.site, g);
    }
    for (const g of peta.values()) {
      g.prisma.sort((a, b) => indeksStatus(b.tingkat) - indeksStatus(a.tingkat));
    }
    return [...peta.entries()];
  }, [daftar]);

  const puncak = terburuk(daftar);
  if (!puncak) return null;

  const berbunyi = bunyi !== null && tes === null;
  const waktu = fmtWaktu(
    daftar.reduce<string | null>((maks, p) => (p.waktu && (!maks || p.waktu > maks) ? p.waktu : maks), null)
  );

  return (
    <div
      role="status"
      className="tema-monitoring sticky top-16 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 text-sm md:px-5"
      style={{
        background: `color-mix(in srgb, ${WARNA_STATUS[puncak]} 14%, white)`,
        borderColor: WARNA_STATUS[puncak],
      }}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {perSite.map(([slug, g]) => (
          <div key={slug} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-[#14173a]">{g.nama}</span>
            {g.prisma.slice(0, 4).map((p) => (
              <span key={p.idPrisma} className="inline-flex items-center gap-1 text-[#14173a]">
                <Lencana tingkat={p.tingkat} className={cn(baru.includes(p) && berbunyi && "animate-pulse")} />
                <span className="font-medium">{p.idPrisma}</span>
                <span className="tabular-nums text-[#4f5374]">{fmtMm(p.nilaiMm)}</span>
              </span>
            ))}
            {g.prisma.length > 4 && (
              <span className="text-xs text-[#4f5374]">+{g.prisma.length - 4} prisma lain</span>
            )}
            <Link
              href={`/beranda?site=${encodeURIComponent(slug)}`}
              className="text-xs font-medium text-[#303481] underline underline-offset-2"
            >
              Lihat
            </Link>
          </div>
        ))}
        {waktu && <span className="text-xs text-[#4f5374]">Siklus {waktu}</span>}
      </div>

      <div className="flex items-center gap-2">
        {terblokir ? (
          <button
            type="button"
            onClick={nyalakanSuara}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#303481] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252865]"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Nyalakan suara alarm
          </button>
        ) : berbunyi ? (
          <button
            type="button"
            onClick={matikanBunyi}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#14173a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            <BellOff className="h-3.5 w-3.5" />
            Matikan bunyi
          </button>
        ) : (
          <span className="text-xs text-[#4f5374]">
            {suaraAktif
              ? "Bunyi dimatikan — berbunyi lagi bila tingkatnya naik"
              : "Suara alarm nonaktif di peramban ini"}
          </span>
        )}
      </div>
    </div>
  );
}
