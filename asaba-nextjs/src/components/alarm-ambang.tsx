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
import { usePathname } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { BellOff, ClipboardCheck, Volume2, VolumeX } from "lucide-react";
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
  catatTutupModal,
  fmtWaktuPendek,
  kejadianUntukModal,
  lencanaRiwayat,
  senyapBerlaku,
  statusKejadian,
  tersembunyiDariBanner,
  tingkatLencana,
  uraiCatatanModal,
  type KejadianRingkas,
} from "@/lib/aturan-kejadian";
import {
  DialogVerifikasi,
  ModalAlarm,
  PemberitahuanEwsGagal,
} from "@/components/kejadian-alarm/dialog-kejadian";
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
 * Konfirmasi (kejadian-alarm) berbeda dari Matikan bunyi: ia tercatat di server,
 * mematikan sirene EWS di lapangan, dan membungkam SEMUA peramban — selama
 * tingkatnya tidak naik melewati yang dikonfirmasi. Matikan bunyi tetap ada
 * untuk yang tidak memegang kode akses dan cuma ingin laptopnya diam.
 *
 * Setelan dan catatan "sudah didengar" disimpan per peramban (localStorage),
 * bukan per akun: yang perlu dibungkam adalah speaker di ruangan itu, dan
 * mematikan bunyi di laptop seseorang tidak boleh ikut membungkam layar ruang
 * kontrol.
 */

const KUNCI_SUARA = "adr-alarm-suara";
const KUNCI_DIAKUI = "adr-alarm-diakui";
/** Kapan modal tiap kejadian terakhir ditutup di peramban ini. Lihat catatTutupModal(). */
const KUNCI_MODAL = "adr-alarm-modal";
/** Id kejadian terbesar saat halaman Riwayat Alarm terakhir dibuka di peramban ini. */
const KUNCI_RIWAYAT_DIBACA = "adr-riwayat-alarm-dibaca";
const LAMA_TES_MS = 3000;
/** Seberapa sering jam dibaca ulang untuk menentukan pengingat modal. */
const TIK_MODAL_MS = 5_000;
/**
 * Seberapa sering status alarm ditanyakan ke server. 10 detik sejak 23 Nov 2026
 * (sebelumnya 30): alarm tampil paling lambat 10 detik setelah sesi dinilai.
 * Kuerinya kecil — status_prisma dan kejadian aktif, tanpa cache.
 */
const TANYA_TIAP_MS = 10_000;

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
  /** Kejadian yang masih butuh operator: aktif, atau pulih tapi belum diverifikasi. */
  kejadian: KejadianRingkas[];
  /** Kejadian 24 jam terakhir, selesai maupun belum — untuk lencana menu Riwayat Alarm. */
  terbaru: KejadianRingkas[];
  muatUlang: () => void;
  /** Buka modal alarm (konfirmasi) / dialog verifikasi untuk satu kejadian. */
  bukaKonfirmasi: (k: KejadianRingkas) => void;
  bukaVerifikasi: (k: KejadianRingkas) => void;
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
  const { data, mutate } = useSWR<{ success: boolean; data?: PrismaAlarm[]; kejadian?: KejadianRingkas[]; terbaru?: KejadianRingkas[] }>(
    "/api/alarm-ambang",
    fetcher,
    { refreshInterval: TANYA_TIAP_MS, refreshWhenHidden: true }
  );
  const sahih = data?.success === true && Array.isArray(data.data);
  const daftar = useMemo(() => (sahih ? data!.data! : []), [sahih, data]);
  const kejadian = useMemo(
    () => (sahih && Array.isArray(data!.kejadian) ? data!.kejadian! : []),
    [sahih, data]
  );
  const terbaru = useMemo(
    () => (sahih && Array.isArray(data!.terbaru) ? data!.terbaru! : []),
    [sahih, data]
  );
  const { mutate: segarkan } = useSWRConfig();
  // Halaman Riwayat Alarm membaca kejadian yang sama; ikut disegarkan.
  const muatUlang = useCallback(() => {
    void mutate();
    void segarkan((k) => typeof k === "string" && k.startsWith("/api/kejadian-alarm"));
  }, [mutate, segarkan]);

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

  // Prisma yang sudah dikonfirmasi operator (di peramban mana pun) tidak lagi
  // berbunyi, selama tingkatnya tidak melebihi yang dikonfirmasi.
  const baru = useMemo(() => {
    const senyap = new Map(
      kejadian.filter((k) => k.pulih === null).map((k) => [k.site, k.tingkatDikonfirmasi])
    );
    return belumDiakui(daftar, diakui).filter(
      (p) => !senyapBerlaku(p.tingkat, senyap.get(p.site) ?? null)
    );
  }, [daftar, diakui, kejadian]);
  const bunyi = tes ?? (suaraAktif ? terburuk(baru) : null);

  useEffect(() => {
    setelBunyi(bunyi);
  }, [bunyi]);

  // ── Modal alarm dan dialog verifikasi ─────────────────────────────────────
  //
  // Dipasang di sini, satu kali, supaya modal otomatis, tombol di banner, dan
  // tombol di Riwayat Alarm memakai satu jendela — dua modal bertumpuk di atas
  // satu alarm tidak boleh terjadi.
  const [dialog, setDialog] = useState<{ jenis: "konfirmasi" | "verifikasi"; k: KejadianRingkas } | null>(null);
  const [ewsGagal, setEwsGagal] = useState(false);

  // Jam dibaca tiap beberapa detik, bukan tiap render: render harus murni, dan
  // pengingat 2 menit tidak butuh ketelitian lebih dari itu. Null sampai tik
  // pertama supaya modal tidak sempat berkedip dengan jam yang belum ada.
  const [sekarang, setSekarang] = useState<number | null>(null);
  useEffect(() => {
    const tik = () => setSekarang(Date.now());
    const awal = setTimeout(tik, 0);
    const t = setInterval(tik, TIK_MODAL_MS);
    return () => {
      clearTimeout(awal);
      clearInterval(t);
    };
  }, []);

  const teksModal = useSyncExternalStore(
    langganan,
    () => baca(KUNCI_MODAL),
    () => null
  );
  const kandidatModal = useMemo(
    () => (sekarang === null ? null : kejadianUntukModal(kejadian, uraiCatatanModal(teksModal), sekarang)),
    [kejadian, teksModal, sekarang]
  );

  // Dialog yang dibuka tangan memakai data terbaru kejadiannya bila masih ada
  // di daftar (tingkat bisa naik saat dialog terbuka). Konfirmasi atas alarm
  // yang sudah pulih tidak ada artinya, jadi dialognya hilang sendiri.
  const kDialog = dialog ? (kejadian.find((x) => x.id === dialog.k.id) ?? dialog.k) : null;
  const dialogHidup = dialog !== null && kDialog !== null && !(dialog.jenis === "konfirmasi" && kDialog.pulih !== null);
  const tampil: { jenis: "konfirmasi" | "verifikasi"; k: KejadianRingkas; otomatis: boolean } | null = dialogHidup
    ? { jenis: dialog!.jenis, k: kDialog!, otomatis: false }
    : kandidatModal
      ? { jenis: "konfirmasi", k: kandidatModal, otomatis: true }
      : null;

  const tutupModal = (k: KejadianRingkas) => {
    const agora = Date.now();
    // Jam diperbarui bersama catatannya: tanpa itu `sekarang` yang basi lebih
    // tua dari jam tutup, dan pengingat dikira "jam mundur".
    setSekarang(agora);
    tulis(KUNCI_MODAL, JSON.stringify(catatTutupModal(uraiCatatanModal(baca(KUNCI_MODAL)), kejadian, k, agora)));
    setDialog(null);
  };
  const bukaKonfirmasi = useCallback((k: KejadianRingkas) => setDialog({ jenis: "konfirmasi", k }), []);
  const bukaVerifikasi = useCallback((k: KejadianRingkas) => setDialog({ jenis: "verifikasi", k }), []);

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
    kejadian,
    terbaru,
    muatUlang,
    bukaKonfirmasi,
    bukaVerifikasi,
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

  return (
    <KonteksAlarm.Provider value={nilai}>
      {children}
      {tampil?.jenis === "konfirmasi" && (
        <ModalAlarm
          key={tampil.k.id}
          kejadian={tampil.k}
          prisma={daftar}
          pengingat={tampil.otomatis}
          onClose={() => tutupModal(tampil.k)}
          onSelesai={(ews) => {
            tutupModal(tampil.k);
            muatUlang();
            if (ews === "gagal") setEwsGagal(true);
          }}
        />
      )}
      {tampil?.jenis === "verifikasi" && (
        <DialogVerifikasi
          key={tampil.k.id}
          kejadian={tampil.k}
          onClose={() => setDialog(null)}
          onSelesai={muatUlang}
        />
      )}
      {ewsGagal && <PemberitahuanEwsGagal onClose={() => setEwsGagal(false)} />}
    </KonteksAlarm.Provider>
  );
}

function useAlarm(): NilaiAlarm {
  const n = useContext(KonteksAlarm);
  if (!n) throw new Error("useAlarm dipakai di luar AlarmAmbangProvider");
  return n;
}

/** Untuk halaman lain (Riwayat Alarm) yang perlu membuka modal konfirmasi atau dialog verifikasi. */
export function useDialogKejadian() {
  const { bukaKonfirmasi, bukaVerifikasi } = useAlarm();
  return { bukaKonfirmasi, bukaVerifikasi };
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
            peringatan WhatsApp, dicek tiap {TANYA_TIAP_MS / 1000} detik. Setelan ini hanya untuk
            peramban ini.
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

/** Tombol dan keterangan kejadian site di banner. */
function AksiKejadian({
  k,
  bukaKonfirmasi,
  bukaVerifikasi,
}: {
  k: KejadianRingkas;
  bukaKonfirmasi: (k: KejadianRingkas) => void;
  bukaVerifikasi: (k: KejadianRingkas) => void;
}) {
  const status = statusKejadian(k);
  if (status === "perlu-konfirmasi") {
    return (
      <button
        type="button"
        onClick={() => bukaKonfirmasi(k)}
        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-[#d03b3b] px-2.5 py-1 text-xs font-semibold text-white hover:brightness-90"
      >
        <BellOff className="h-3.5 w-3.5" />
        Konfirmasi
      </button>
    );
  }
  if (status === "disenyapkan") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-xs text-[#4f5374]">
          Dikonfirmasi {k.dikonfirmasiOleh} {fmtWaktuPendek(k.dikonfirmasi)}
        </span>
        <button
          type="button"
          onClick={() => bukaVerifikasi(k)}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#303481]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[#303481] hover:bg-[#303481]/5"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Verifikasi
        </button>
      </span>
    );
  }
  if (k.hasil) {
    return (
      <span className="whitespace-nowrap text-xs text-[#4f5374]">
        Terverifikasi: <b className="text-[#14173a]">{k.hasil}</b>
      </span>
    );
  }
  return null;
}

/**
 * Lencana di menu Riwayat Alarm (sidebar): jumlah kejadian yang masih aktif,
 * diwarnai tingkat tertinggi. Inilah pengingat untuk kejadian yang sudah
 * diverifikasi — banner tidak lagi menampilkannya, tapi statusnya tetap sampai
 * pergeseran turun. Kejadian yang belum diverifikasi ikut dihitung: semuanya
 * masih berlangsung. Di mode ringkas cukup satu titik.
 *
 * `tema-monitoring` di tiap span: token warna status (--st-*) hanya hidup di
 * kelas itu, dan sidebar tidak berada di dalamnya.
 */
export function LencanaMenuAlarm() {
  const n = useContext(KonteksAlarm);
  const pathname = usePathname();
  const teksDibaca = useSyncExternalStore(
    langganan,
    () => baca(KUNCI_RIWAYAT_DIBACA),
    () => null
  );
  const dibaca = Number(teksDibaca) || 0;
  const terbaru = n?.terbaru;

  // Membuka halaman Riwayat Alarm = semua kejadian yang ada sudah dilihat.
  const diRiwayat = pathname?.startsWith("/riwayat-alarm") ?? false;
  useEffect(() => {
    if (!diRiwayat || !terbaru) return;
    const maks = terbaru.reduce((m, k) => Math.max(m, k.id), 0);
    if (maks > dibaca) tulis(KUNCI_RIWAYAT_DIBACA, String(maks));
  }, [diRiwayat, terbaru, dibaca]);

  const hitung = useMemo(
    () =>
      lencanaRiwayat(
        (n?.kejadian ?? []).filter((k) => (TINGKAT_ALARM as readonly string[]).includes(k.tingkatTerakhir)),
        diRiwayat ? [] : (terbaru ?? []),
        dibaca
      ),
    [n?.kejadian, terbaru, dibaca, diRiwayat]
  );
  if (hitung.length === 0) return null;

  const tingkat = hitung
    .map((k) => tingkatLencana(k))
    .filter((t): t is TingkatAlarm => (TINGKAT_ALARM as readonly string[]).includes(t))
    .reduce<TingkatAlarm>((a, b) => (indeksStatus(b) > indeksStatus(a) ? b : a), "Waspada");
  const rincian = hitung
    .map((k) => {
      const keadaan =
        k.pulih !== null
          ? "selesai, belum dibuka"
          : k.hasil
            ? `terverifikasi ${k.hasil}`
            : k.dikonfirmasi
              ? "menunggu verifikasi"
              : "belum dikonfirmasi";
      return `${k.namaSite}: ${tingkatLencana(k)}${k.prismaPuncak ? ` (${k.prismaPuncak})` : ""}, ${keadaan}`;
    })
    .join("; ");
  const judul = `${hitung.length} alarm — ${rincian}`;

  return (
    <>
      <span
        title={judul}
        className="tema-monitoring ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums group-data-[collapsible=icon]:hidden"
        style={{ background: WARNA_STATUS[tingkat], color: tintaDi(tingkat) }}
      >
        {hitung.length}
      </span>
      <span
        aria-hidden="true"
        className="tema-monitoring absolute right-1.5 top-1.5 hidden size-2 rounded-full ring-2 ring-sidebar group-data-[collapsible=icon]:block"
        style={{ background: WARNA_STATUS[tingkat] }}
      />
      <span className="sr-only">{judul}</span>
    </>
  );
}

/**
 * Pita di bawah header selama ada prisma di atas Normal, atau ada kejadian yang
 * sudah pulih tapi belum diverifikasi. Site yang kejadian aktifnya sudah
 * diverifikasi tidak ikut tampil (lihat tersembunyiDariBanner).
 */
export function BannerAlarm() {
  const {
    daftar,
    baru,
    kejadian,
    bukaKonfirmasi,
    bukaVerifikasi,
    suaraAktif,
    bunyi,
    tes,
    terblokir,
    matikanBunyi,
    nyalakanSuara,
  } = useAlarm();

  // Site yang kejadian aktifnya sudah diverifikasi tidak ditampilkan: operator
  // sudah tahu. Pengingatnya lencana di menu Riwayat Alarm (LencanaMenuAlarm).
  // Naik melewati tingkat yang dikonfirmasi membuatnya tampil lagi.
  const tampilDaftar = useMemo(() => {
    const sembunyi = new Set(kejadian.filter(tersembunyiDariBanner).map((k) => k.site));
    return sembunyi.size === 0 ? daftar : daftar.filter((p) => !sembunyi.has(p.site));
  }, [daftar, kejadian]);

  const perSite = useMemo(() => {
    const peta = new Map<string, { nama: string; prisma: PrismaAlarm[] }>();
    for (const p of tampilDaftar) {
      const g = peta.get(p.site) ?? { nama: p.namaSite, prisma: [] };
      g.prisma.push(p);
      peta.set(p.site, g);
    }
    for (const g of peta.values()) {
      g.prisma.sort((a, b) => indeksStatus(b.tingkat) - indeksStatus(a.tingkat));
    }
    return [...peta.entries()];
  }, [tampilDaftar]);

  const aktifPerSite = useMemo(
    () => new Map(kejadian.filter((k) => k.pulih === null).map((k) => [k.site, k])),
    [kejadian]
  );
  const menunggu = useMemo(
    () => kejadian.filter((k) => k.pulih !== null && k.diverifikasi === null),
    [kejadian]
  );

  const puncak = terburuk(tampilDaftar);
  if (!puncak && menunggu.length === 0) return null;

  const berbunyi = bunyi !== null && tes === null;
  const waktu = fmtWaktu(
    tampilDaftar.reduce<string | null>((maks, p) => (p.waktu && (!maks || p.waktu > maks) ? p.waktu : maks), null)
  );

  return (
    <>
      <div
        role="status"
        className="tema-monitoring sticky top-16 z-20 flex flex-col gap-y-1.5 border-b px-3 py-1.5 text-sm md:px-5"
        style={
          puncak
            ? {
                background: `color-mix(in srgb, ${WARNA_STATUS[puncak]} 14%, white)`,
                borderColor: WARNA_STATUS[puncak],
              }
            : { background: "#f3f4f8", borderColor: "rgba(20, 23, 58, 0.1)" }
        }
      >
        {puncak && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Basis 18rem, bukan flex-1 (basis 0): dengan basis 0 di layar HP bagian
                kanan mengambil seluruh lebarnya sendiri, daftar prisma diperas jadi
                satu kata per baris dan teks keduanya saling menimpa. Dengan basis
                nyata, bagian kanan turun ke baris kedua bila tidak muat. */}
            <div className="flex min-w-0 flex-[1_1_18rem] flex-wrap items-center gap-x-4 gap-y-1">
              {perSite.map(([slug, g]) => {
                const k = aktifPerSite.get(slug);
                const butuhKonfirmasi = k !== undefined && statusKejadian(k) === "perlu-konfirmasi";
                return (
                  <div key={slug} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {butuhKonfirmasi && (
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 animate-pulse rounded-full motion-reduce:animate-none"
                        style={{ background: WARNA_STATUS[g.prisma[0].tingkat] }}
                      />
                    )}
                    <span className="whitespace-nowrap font-semibold text-[#14173a]">{g.nama}</span>
                    {g.prisma.slice(0, 4).map((p) => (
                      <span key={p.idPrisma} className="inline-flex items-center gap-1 whitespace-nowrap text-[#14173a]">
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
                    {k && <AksiKejadian k={k} bukaKonfirmasi={bukaKonfirmasi} bukaVerifikasi={bukaVerifikasi} />}
                  </div>
                );
              })}
              {waktu && <span className="hidden text-xs text-[#4f5374] md:inline">Siklus {waktu}</span>}
            </div>

            <div className="flex min-w-0 items-center gap-2">
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
                  title="Hanya membungkam peramban ini. Sirene di lapangan tetap berbunyi sampai dikonfirmasi."
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#14173a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  Matikan bunyi di sini
                </button>
              ) : (
                <span className="text-xs text-[#4f5374]">
                  {suaraAktif
                    ? "Tidak berbunyi — berbunyi lagi bila tingkatnya naik"
                    : "Suara alarm nonaktif di peramban ini"}
                </span>
              )}
            </div>
          </div>
        )}

        {menunggu.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs font-semibold text-[#4f5374]">Menunggu verifikasi:</span>
            {menunggu.slice(0, 3).map((k) => (
              <span key={k.id} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap font-semibold text-[#14173a]">{k.namaSite}</span>
                {k.tingkatPuncak !== "Normal" && <Lencana tingkat={k.tingkatPuncak} />}
                <span className="whitespace-nowrap text-xs text-[#4f5374]">
                  {fmtWaktuPendek(k.mulai)}, pulih {fmtWaktuPendek(k.pulih)}
                </span>
                <button
                  type="button"
                  onClick={() => bukaVerifikasi(k)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#303481]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[#303481] hover:bg-[#303481]/5"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Verifikasi
                </button>
              </span>
            ))}
            {menunggu.length > 3 && (
              <Link
                href="/riwayat-alarm?status=perlu-verifikasi"
                className="text-xs font-medium text-[#303481] underline underline-offset-2"
              >
                +{menunggu.length - 3} lainnya
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
