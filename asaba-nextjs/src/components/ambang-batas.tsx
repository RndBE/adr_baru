"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSites, type SiteRow } from "@/hooks/use-sites";
import { WARNA_STATUS } from "@/components/monitoring/status";
import { ThresholdStrip, type TitikAmbang } from "@/components/monitoring/threshold-strip";
import { JENDELA_SIKLUS, KEBIJAKAN_BAWAAN, UMUR_JENDELA_MS, batasTakWajarMm } from "@/lib/peredam";
import {
  URUTAN_STATUS,
  ambangBerikutnya,
  batasMasuk,
  indeksStatus,
  statusPergeseran,
  type AmbangSite,
  type StatusLabel,
} from "@/lib/ambang";
import { terburuk, type PrismaAlarm, type TingkatAlarm } from "@/lib/alarm-ambang";
import {
  KOLOM_AMBANG,
  bacaAmbang,
  type AmbangPayload,
  type DetailAmbangSite,
  type KanalPeringatan,
  type KolomAmbang,
  type PrismaAmbang,
} from "@/lib/ambang-kolom";

/**
 * Tab Ambang Batas di Master Data (`/master-data?tab=ambang`) — satu site sekali
 * tampil, dan tiap site punya angka ambangnya sendiri.
 *
 * Site dipilih di baris atas (tersimpan di `?site=`, jadi tautannya bisa
 * dibagikan). Untuk site terpilih: posisi tiap prisma terhadap ambang, isian
 * ambang per tingkat, daftar prisma dengan jarak ke tingkat berikutnya, dan ke
 * mana peringatannya dikirim.
 *
 * Selama ambang di form belum disimpan, pita dan daftar prisma sudah memakai
 * angka baru — operator melihat akibatnya ("P2 jadi Siaga") sebelum menyimpan.
 */

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type FormAmbang = Record<KolomAmbang, string>;

function formDari(row: SiteRow): FormAmbang {
  const f = {} as FormAmbang;
  for (const k of KOLOM_AMBANG) f[k] = String(row[k]);
  return f;
}

function payloadDari(row: SiteRow): AmbangPayload {
  const d = {} as AmbangPayload;
  for (const k of KOLOM_AMBANG) d[k] = Number(row[k]);
  return d;
}

function keAmbangSite(d: AmbangPayload): AmbangSite {
  return {
    geser: { normalMax: d.geser_normal_max, waspadaMax: d.geser_waspada_max, siagaMax: d.geser_siaga_max },
    laju: { waspadaMin: d.laju_waspada_min, siagaMin: d.laju_siaga_min, awasMin: d.laju_awas_min },
  };
}

const angka = (n: number, desimal = 2) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: desimal });

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-11-11 14:28:03" → "11 Nov 2026 14:28". Teks apa adanya, tanpa zona. */
function waktuPendek(s: string | null): string | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]} ${m[4]}:${m[5]}`;
}

// ─── Halaman ────────────────────────────────────────────────────────────────

export function TabAmbangBatas() {
  const { sites, isLoading } = useSites(true);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Kunci yang sama dengan AlarmAmbangProvider di layout — satu cache SWR.
  const { data: alarm } = useSWR<{ success: boolean; data?: PrismaAlarm[] }>(
    "/api/alarm-ambang",
    fetcher
  );
  const daftarAlarm = useMemo(
    () => (alarm?.success && Array.isArray(alarm.data) ? alarm.data : []),
    [alarm]
  );

  const terpilih = sites.find((s) => s.slug === params.get("site")) ?? sites[0] ?? null;
  const kotor = useRef(false);

  const pilih = (slug: string) => {
    if (slug === terpilih?.slug) return;
    if (kotor.current && !window.confirm("Perubahan ambang belum disimpan. Tinggalkan site ini?")) return;
    kotor.current = false;
    // Parameter lain (mis. ?tab=ambang milik Master Data) dipertahankan.
    const q = new URLSearchParams(params.toString());
    q.set("site", slug);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  return (
    <div className="tema-monitoring flex flex-col gap-5">
      <p className="max-w-3xl text-[12.5px] leading-relaxed text-gray-500">
        Batas Waspada, Siaga, dan Awas — <b className="font-semibold text-gray-700">tiap site punya
        angkanya sendiri</b>. Pilih site, ubah angkanya, lalu simpan. Pergeseran prisma yang
        melewati batas memicu pesan WhatsApp dan alarm di dasbor.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#303481]" />
        </div>
      ) : !terpilih ? (
        <div className="rounded-xl border border-[#EAEAEA] py-12 text-center text-sm text-gray-400">
          Belum ada site. Tambahkan lewat tab Site.
        </div>
      ) : (
        <>
          <PemilihSite sites={sites} terpilih={terpilih} alarm={daftarAlarm} pilih={pilih} />
          <PanelSite
            key={terpilih.id}
            site={terpilih}
            alarm={daftarAlarm.filter((a) => a.site === terpilih.slug)}
            laporKotor={(v) => {
              kotor.current = v;
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Pemilih site ───────────────────────────────────────────────────────────

function PemilihSite({
  sites,
  terpilih,
  alarm,
  pilih,
}: {
  sites: SiteRow[];
  terpilih: SiteRow;
  alarm: PrismaAlarm[];
  pilih: (slug: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Pilih site" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {sites.map((s) => {
        const aktif = s.id === terpilih.id;
        const puncak = terburuk(alarm.filter((a) => a.site === s.slug));
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={aktif}
            onClick={() => pilih(s.slug)}
            className={`flex flex-shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
              aktif
                ? "border-[#303481] bg-[#303481] text-white shadow-sm"
                : "border-[#E3E5EE] bg-white text-gray-700 hover:border-[#B9BCD9] hover:bg-[#F7F8FC]"
            }`}
          >
            <span
              className="rounded-full px-2 py-[2px] text-[9.5px] font-bold text-white ring-1 ring-white/40"
              style={{ backgroundColor: s.badge_color }}
            >
              {s.badge_label}
            </span>
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold leading-tight">{s.nama}</span>
              <span
                className={`mt-0.5 flex items-center gap-1 text-[10.5px] leading-tight ${
                  aktif ? "text-white/75" : "text-gray-500"
                }`}
              >
                {s.data_dummy ? (
                  "Data contoh"
                ) : !s.aktif ? (
                  "Nonaktif"
                ) : (
                  <>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: WARNA_STATUS[puncak ?? "Normal"] }}
                    />
                    {puncak ?? "Normal"}
                  </>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Panel satu site ────────────────────────────────────────────────────────

function PanelSite({
  site,
  alarm,
  laporKotor,
}: {
  site: SiteRow;
  alarm: PrismaAlarm[];
  laporKotor: (kotor: boolean) => void;
}) {
  const { mutate } = useSWRConfig();
  const kunciDetail = `/api/sites/${site.id}/ambang`;
  const { data: detailRes } = useSWR<{ success: boolean; data?: DetailAmbangSite }>(
    kunciDetail,
    fetcher,
    { refreshInterval: 30000 }
  );
  const detail = detailRes?.success ? detailRes.data ?? null : null;

  const awal = useMemo(() => formDari(site), [site]);
  const [form, setForm] = useState<FormAmbang>(awal);
  const [simpan, setSimpan] = useState<"diam" | "proses">("diam");
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState<Date | null>(null);

  // Dibandingkan sebagai angka: "35.0" yang diketik sama dengan 35 yang tersimpan.
  const berubah = KOLOM_AMBANG.some(
    (k) => form[k].trim() === "" || Number(form[k]) !== Number(site[k])
  );
  useEffect(() => laporKotor(berubah), [berubah, laporKotor]);

  const hasil = bacaAmbang(form);
  const galat = hasil.error ?? galatServer;
  // Pita dan tabel memakai angka form selama sah, supaya akibat perubahan
  // terlihat sebelum disimpan; bila belum sah, kembali ke yang tersimpan.
  const ambang = keAmbangSite(hasil.data ?? payloadDari(site));
  const pratinjau = berubah && hasil.data !== undefined;

  const ubah = (k: KolomAmbang, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setGalatServer(null);
    setTersimpan(null);
  };

  const simpanAmbang = async () => {
    if (hasil.error !== undefined) return;
    setSimpan("proses");
    setGalatServer(null);
    try {
      const res = await fetch(kunciDetail, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasil.data),
      }).then((r) => r.json());
      if (!res.success) {
        setGalatServer(res.error || "Gagal menyimpan");
        return;
      }
      // Semua varian kunci /api/sites (Dashboard, Hasil Pengukuran, dst.) ikut
      // dimuat ulang, supaya pita ambang di halaman lain langsung memakai angka baru.
      await mutate((kunci) => typeof kunci === "string" && kunci.startsWith("/api/sites"));
      setForm(formDari(res.data as SiteRow));
      setTersimpan(new Date());
    } catch {
      setGalatServer("Gagal menghubungi server");
    } finally {
      setSimpan("diam");
    }
  };

  const tanpaR0 = detail !== null && detail.acuanR0 === null;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        {(site.data_dummy || tanpaR0 || !site.aktif) && (
          <div className="flex items-start gap-2.5 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-[12.5px] leading-relaxed text-orange-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
            <div className="flex flex-col gap-0.5">
              {site.data_dummy && (
                <span>
                  <b>Site ini bertanda Data contoh</b> — ambang tetap bisa diatur, tapi tidak ada
                  peringatan yang dinilai atau dikirim sampai tandanya dihapus di Master Data.
                </span>
              )}
              {tanpaR0 && (
                <span>
                  <b>Belum ada sesi acuan R0.</b> Tanpa acuan, pergeseran tidak bisa dihitung dan
                  peringatan tidak dinilai. Tandai satu sesi sebagai R0 di Hasil Pengukuran.
                </span>
              )}
              {!site.aktif && <span><b>Site nonaktif</b> — tidak tampil di dasbor maupun alarm.</span>}
            </div>
          </div>
        )}

        <PanelKondisi
          site={site}
          detail={detail}
          ambang={ambang}
          pratinjau={pratinjau}
          puncak={terburuk(alarm)}
          jumlahAlarm={alarm.length}
        />

        <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-sm">
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#EAEAEA] px-5 py-3.5">
            <h2 className="text-[14.5px] font-bold text-gray-900">Ambang tingkat</h2>
            <p className="text-[11.5px] text-gray-500">
              Pergeseran memicu WhatsApp &amp; alarm. Kecepatan hanya ditampilkan di dasbor.
            </p>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <KartuNormal ambang={ambang} />
            {(["Waspada", "Siaga", "Awas"] as const).map((t) => (
              <KartuTingkat key={t} tingkat={t} form={form} ubah={ubah} ambang={hasil.data ? ambang : null} />
            ))}
          </div>

          <footer
            className={`sticky bottom-0 flex flex-wrap items-center gap-3 border-t px-5 py-3 transition-colors ${
              berubah ? "border-amber-200 bg-amber-50" : "border-[#EAEAEA] bg-[#FAFAFC]"
            }`}
          >
            <div className="min-w-0 flex-1 text-[12px]">
              {galat ? (
                <span className="inline-flex items-start gap-1.5 text-red-700">
                  <AlertTriangle className="mt-[1px] h-3.5 w-3.5 flex-shrink-0" /> {galat}
                </span>
              ) : tersimpan ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tersimpan pukul{" "}
                  {tersimpan.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} —
                  berlaku mulai siklus ukur berikutnya.
                </span>
              ) : berubah ? (
                <span className="text-amber-800">
                  Belum disimpan — pita dan daftar prisma sudah memakai angka baru.
                </span>
              ) : (
                <span className="text-gray-400">Ubah angka di atas untuk melihat akibatnya sebelum menyimpan.</span>
              )}
            </div>
            {berubah && (
              <Button
                variant="outline"
                onClick={() => {
                  setForm(awal);
                  setGalatServer(null);
                }}
                disabled={simpan === "proses"}
                className="h-9 cursor-pointer gap-1.5 bg-white text-[13px]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Batalkan
              </Button>
            )}
            <Button
              onClick={simpanAmbang}
              disabled={!berubah || hasil.error !== undefined || simpan === "proses"}
              className="h-9 cursor-pointer gap-1.5 bg-[#303481] text-[13px] text-white hover:bg-[#1f2259]"
            >
              {simpan === "proses" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Simpan ambang
            </Button>
          </footer>
        </section>

        <TabelPrisma detail={detail} ambang={ambang} pratinjau={pratinjau} />
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-4">
        <KartuKanal kanal={detail?.kanal ?? null} dataContoh={site.data_dummy} />
        <AturanPeringatan ambang={ambang} />
      </aside>
    </div>
  );
}

// ─── Kondisi sekarang (panel gelap) ─────────────────────────────────────────

function PanelKondisi({
  site,
  detail,
  ambang,
  pratinjau,
  puncak,
  jumlahAlarm,
}: {
  site: SiteRow;
  detail: DetailAmbangSite | null;
  ambang: AmbangSite;
  pratinjau: boolean;
  puncak: TingkatAlarm | null;
  jumlahAlarm: number;
}) {
  const titik: TitikAmbang[] = (detail?.prisma ?? [])
    .filter((p): p is PrismaAmbang & { nilaiMm: number } => p.nilaiMm !== null)
    .map((p) => ({
      id: p.idPrisma,
      nama: p.idPrisma,
      geserMm: p.nilaiMm,
      status: statusPergeseran(p.nilaiMm, ambang),
    }));
  const siklus = waktuPendek(detail?.siklusTerakhir ?? null);
  const r0 = waktuPendek(detail?.acuanR0 ?? null);

  return (
    <section
      className="rounded-xl px-5 pb-4 pt-4 shadow-sm"
      style={{ background: "var(--console)", color: "var(--console-ink)" }}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-(--console-ink-3)">
            Kondisi sekarang
          </p>
          <h2 className="mt-0.5 text-[19px] font-bold leading-tight">{site.nama}</h2>
          <p className="mt-1 text-[11.5px] text-(--console-ink-2)">
            {siklus ? `Siklus terakhir dinilai ${siklus}` : "Belum ada siklus yang dinilai"}
            {r0 && <> · Acuan R0 {r0}</>}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
            style={{
              background: puncak ? WARNA_STATUS[puncak] : "oklch(1 0 0 / 10%)",
              color: puncak ? "#14173a" : "var(--console-ink)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: puncak ? "#14173a" : WARNA_STATUS.Normal }}
            />
            {puncak ? `${puncak} · ${jumlahAlarm} prisma` : "Semua Normal"}
          </span>
          {pratinjau && (
            <span className="rounded-full border border-dashed border-(--console-accent) px-2.5 py-0.5 text-[10.5px] font-semibold text-(--console-accent)">
              Pratinjau ambang baru
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ThresholdStrip
          titik={titik}
          ambang={ambang}
          kosong={titik.length === 0}
          skalaMin={ambang.geser.siagaMax * 1.2}
        />
      </div>
    </section>
  );
}

// ─── Kartu tingkat ──────────────────────────────────────────────────────────

const KOLOM_TINGKAT: Record<TingkatAlarm, { geser: KolomAmbang; laju: KolomAmbang }> = {
  Waspada: { geser: "geser_normal_max", laju: "laju_waspada_min" },
  Siaga: { geser: "geser_waspada_max", laju: "laju_siaga_min" },
  Awas: { geser: "geser_siaga_max", laju: "laju_awas_min" },
};

function KartuNormal({ ambang }: { ambang: AmbangSite }) {
  return (
    <div className="flex flex-col rounded-lg border border-[#E6E8F0] bg-[#FAFBFD]">
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: WARNA_STATUS.Normal }} />
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <NamaTingkat tingkat="Normal" />
        <div>
          <p className="text-[11px] text-gray-500">Pergeseran</p>
          <p className="font-mono text-[18px] font-semibold text-gray-800">
            &lt; {angka(ambang.geser.normalMax)} <span className="text-[12px] font-normal text-gray-500">mm</span>
          </p>
        </div>
        <p className="text-[11px] text-gray-500">
          Kecepatan ≤ {angka(ambang.laju.waspadaMin)} mm/hari
        </p>
        <p className="mt-auto text-[11px] leading-snug text-gray-400">
          Keadaan awal. Tidak ada pesan maupun bunyi.
        </p>
      </div>
    </div>
  );
}

function KartuTingkat({
  tingkat,
  form,
  ubah,
  ambang,
}: {
  tingkat: TingkatAlarm;
  form: FormAmbang;
  ubah: (k: KolomAmbang, v: string) => void;
  /** Null bila form belum sah — keterangan turun tingkat disembunyikan. */
  ambang: AmbangSite | null;
}) {
  const k = KOLOM_TINGKAT[tingkat];
  const masuk = ambang ? batasMasuk(tingkat, ambang) : null;
  const turunKe = URUTAN_STATUS[indeksStatus(tingkat) - 1];
  const r = KEBIJAKAN_BAWAAN.histeresisRasio;

  return (
    <div className="flex flex-col rounded-lg border border-[#E6E8F0] bg-white">
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: WARNA_STATUS[tingkat] }} />
      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3.5 pt-3">
        <NamaTingkat tingkat={tingkat} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Mulai dari pergeseran</span>
          <IsianSatuan
            value={form[k.geser]}
            onChange={(v) => ubah(k.geser, v)}
            satuan="mm"
            besar
            label={`${tingkat} mulai dari pergeseran (mm)`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Kecepatan lebih dari</span>
          <IsianSatuan
            value={form[k.laju]}
            onChange={(v) => ubah(k.laju, v)}
            satuan="mm/hari"
            label={`${tingkat} bila kecepatan lebih dari (mm/hari)`}
          />
        </label>
        <p className="mt-auto text-[11px] leading-snug text-gray-400">
          {masuk !== null
            ? `${turunKe === "Normal" ? "Kembali Normal" : `Turun ke ${turunKe}`} bila < ${angka(masuk * (1 - r))} mm`
            : " "}
        </p>
      </div>
    </div>
  );
}

function NamaTingkat({ tingkat }: { tingkat: StatusLabel }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-gray-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WARNA_STATUS[tingkat] }} />
      {tingkat}
    </span>
  );
}

function IsianSatuan({
  value,
  onChange,
  satuan,
  besar = false,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  satuan: string;
  besar?: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center rounded-md border border-gray-200 bg-white transition-colors focus-within:border-[#303481] focus-within:ring-2 focus-within:ring-[#303481]/15 ${
        besar ? "h-11" : "h-8"
      }`}
    >
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-0 bg-transparent px-2.5 font-mono text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          besar ? "text-[18px] font-semibold" : "text-[13px]"
        }`}
      />
      <span className={`flex-shrink-0 pr-2.5 text-gray-400 ${besar ? "text-[12px]" : "text-[11px]"}`}>
        {satuan}
      </span>
    </div>
  );
}

// ─── Tabel prisma ───────────────────────────────────────────────────────────

function TabelPrisma({
  detail,
  ambang,
  pratinjau,
}: {
  detail: DetailAmbangSite | null;
  ambang: AmbangSite;
  pratinjau: boolean;
}) {
  const daftar = [...(detail?.prisma ?? [])].sort((a, b) => {
    if (a.nilaiMm === null)
      return b.nilaiMm === null ? a.idPrisma.localeCompare(b.idPrisma, undefined, { numeric: true }) : 1;
    if (b.nilaiMm === null) return -1;
    return b.nilaiMm - a.nilaiMm;
  });
  const ujung = ambang.geser.siagaMax * 1.2;

  return (
    <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#EAEAEA] px-5 py-3.5">
        <h2 className="text-[14.5px] font-bold text-gray-900">Prisma</h2>
        <p className="text-[11.5px] text-gray-500">
          Nilai pemicu terakhir (median {JENDELA_SIKLUS} siklus) terhadap acuan R0, urut dari yang
          terbesar.
        </p>
      </header>

      {!detail ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#303481]" />
        </div>
      ) : daftar.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-gray-400">
          Belum ada prisma terdaftar. Tambahkan lewat Prism Config.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12.5px]">
            <thead className="bg-[#F5F6FA] text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-2.5">Prisma</th>
                <th className="px-3 py-2.5">Pergeseran</th>
                <th className="px-3 py-2.5">Tingkat</th>
                <th className="px-3 py-2.5">Jarak ke tingkat berikutnya</th>
                <th className="px-5 py-2.5 text-right">Bacaan</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => {
                const menurutForm = p.nilaiMm === null ? null : statusPergeseran(p.nilaiMm, ambang);
                const berikut = menurutForm ? ambangBerikutnya(menurutForm, ambang) : null;
                const beda = pratinjau && menurutForm !== null && menurutForm !== (p.tingkat ?? "Normal");
                const warnaBatang = WARNA_STATUS[menurutForm ?? "Normal"];
                return (
                  <tr key={p.idPrisma} className="border-t border-[#F0F0F4]">
                    <td className="px-5 py-2.5">
                      <span className="font-mono font-semibold text-gray-900">{p.idPrisma}</span>
                      {p.jenis === "bs" && (
                        <span className="ml-1.5 rounded bg-gray-100 px-1 py-[1px] text-[9.5px] font-bold text-gray-500">
                          BS
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.nilaiMm === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="w-[72px] font-mono text-gray-900">{angka(p.nilaiMm)} mm</span>
                          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 sm:block">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (p.nilaiMm / ujung) * 100)}%`,
                                backgroundColor: warnaBatang,
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        {p.tingkat ? <LencanaTingkat tingkat={p.tingkat} /> : <span className="text-gray-400">Belum dinilai</span>}
                        {beda && menurutForm && (
                          <>
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            <LencanaTingkat tingkat={menurutForm} putus />
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.nilaiMm === null || !menurutForm
                        ? "—"
                        : berikut
                          ? (
                            <>
                              <span className="font-mono text-gray-900">{angka(berikut.nilai - p.nilaiMm)} mm</span>{" "}
                              lagi ke {berikut.label}
                            </>
                          )
                          : <span className="font-semibold" style={{ color: WARNA_STATUS.Awas }}>Sudah di tingkat tertinggi</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {p.gagalBeruntun > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-[2px] text-[11px] font-semibold text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> Gagal {p.gagalBeruntun} siklus
                        </span>
                      ) : p.tingkat === null ? (
                        <span className="text-[11px] text-gray-400">Belum ada</span>
                      ) : (
                        <span className="text-[11px] text-emerald-700">Terbaca</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pratinjau && (
        <p className="border-t border-[#F0F0F4] bg-[#FAFAFC] px-5 py-2 text-[11px] text-gray-500">
          Lencana bergaris putus = tingkat menurut ambang yang belum disimpan, tanpa histeresis.
        </p>
      )}
    </section>
  );
}

function LencanaTingkat({ tingkat, putus = false }: { tingkat: StatusLabel; putus?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[10.5px] font-bold text-gray-900"
      style={
        putus
          ? { border: `1.5px dashed ${WARNA_STATUS[tingkat]}`, color: "#14173a" }
          : { backgroundColor: `color-mix(in srgb, ${WARNA_STATUS[tingkat]} 28%, white)` }
      }
    >
      {tingkat}
    </span>
  );
}

// ─── Samping: kanal & aturan ────────────────────────────────────────────────

const IKON_KANAL: Record<KanalPeringatan["nama"], typeof MessageCircle> = {
  WhatsApp: MessageCircle,
  Telegram: Send,
  Email: Mail,
};

function KartuKanal({ kanal, dataContoh }: { kanal: KanalPeringatan[] | null; dataContoh: boolean }) {
  return (
    <section className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-[13px] font-bold text-gray-900">
        <BellRing className="h-4 w-4 text-[#303481]" /> Peringatan dikirim ke
      </h2>
      {dataContoh && (
        <p className="mt-2 rounded-md bg-orange-50 px-2.5 py-1.5 text-[11px] text-orange-800">
          Site Data contoh — tidak ada yang dikirim.
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-2.5">
        {kanal === null ? (
          <li className="text-[12px] text-gray-400">Memuat…</li>
        ) : (
          kanal.map((k) => {
            const Ikon = IKON_KANAL[k.nama];
            return (
              <BarisKanal key={k.nama} ikon={<Ikon className="h-4 w-4" />} nama={k.nama} rincian={k.rincian} aktif={k.aktif} />
            );
          })
        )}
        <BarisKanal
          ikon={<Volume2 className="h-4 w-4" />}
          nama="Alarm dasbor"
          rincian="Banner + bunyi di peramban yang membuka dasbor"
          aktif
        />
      </ul>
    </section>
  );
}

function BarisKanal({
  ikon,
  nama,
  rincian,
  aktif,
}: {
  ikon: React.ReactNode;
  nama: string;
  rincian: string;
  aktif: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-[1px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
          aktif ? "bg-[#EEF0FA] text-[#303481]" : "bg-gray-100 text-gray-400"
        }`}
      >
        {ikon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-800">
          {nama}
          <span className={`h-1.5 w-1.5 rounded-full ${aktif ? "bg-emerald-500" : "bg-gray-300"}`} />
        </span>
        <span className={`text-[11.5px] leading-snug ${aktif ? "text-gray-600" : "text-gray-400"}`}>{rincian}</span>
      </span>
    </li>
  );
}

function AturanPeringatan({ ambang }: { ambang: AmbangSite }) {
  const k = KEBIJAKAN_BAWAAN;
  const persen = Math.round(k.histeresisRasio * 100);
  const menit = Math.round(k.jedaMs / 60000);

  const butir: { judul: string; isi: string }[] = [
    {
      judul: "Dinilai",
      isi: `Di akhir tiap siklus ukur, dari pergeseran tiap prisma terhadap acuan R0. Yang dibandingkan dengan ambang adalah median ${JENDELA_SIKLUS} siklus terakhir (dalam ${Math.round(UMUR_JENDELA_MS / 3_600_000)} jam), bukan satu tembakan.`,
    },
    {
      judul: "Naik",
      isi: `Bila ${JENDELA_SIKLUS - 1} dari ${JENDELA_SIKLUS} siklus terakhir melewati batas. Satu bacaan yang meloncat tidak memicu; pergeseran sungguhan terlambat paling lama satu siklus.`,
    },
    {
      judul: "Bacaan tak wajar",
      isi: `Pergeseran lebih dari ${angka(batasTakWajarMm(ambang) / 1000, 1)} m (10× batas Awas, paling sedikit 1 m) dianggap salah tembak dan dihitung tidak terbaca.`,
    },
    { judul: "Turun", isi: `Setelah ${persen}% di bawah batas, supaya tidak naik-turun di sekitar batas.` },
    {
      judul: "WhatsApp",
      isi: `Mulai ${k.kirimMulaiDari}, dan sekali lagi saat kembali Normal. Kenaikan berikutnya pada prisma yang sama dalam ${menit} menit tidak dikirim ulang.`,
    },
    { judul: "Bunyi", isi: "Berbunyi sampai dimatikan; berbunyi lagi bila tingkatnya naik." },
  ];

  return (
    <section className="rounded-xl border border-[#EAEAEA] bg-[#F5F6FA] px-4 py-4">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Cara kerja</h2>
      <dl className="mt-2.5 flex flex-col gap-2">
        {butir.map((b) => (
          <div key={b.judul} className="text-[11.5px] leading-relaxed">
            <dt className="inline font-semibold text-gray-700">{b.judul}. </dt>
            <dd className="inline text-gray-600">{b.isi}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
