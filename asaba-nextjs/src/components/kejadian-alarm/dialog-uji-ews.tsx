"use client";

import { useEffect, useState } from "react";
import { Loader2, Power, Siren, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSites } from "@/hooks/use-sites";
import { WARNA_STATUS } from "@/components/monitoring/status";
import {
  INPUT,
  LABEL,
  ModalError,
  ModalShell,
  TOMBOL_BAHAYA,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";
import { InputKodeAkses, kirim } from "@/components/kejadian-alarm/dialog-kejadian";
import { DURASI_UJI_BAWAAN, DURASI_UJI_PILIHAN, TINGKAT_UJI } from "@/lib/aturan-uji-ews";
import { type StatusLabel } from "@/lib/ambang";
import { levelEws } from "@/lib/ews";

/**
 * Uji EWS: menyalakan sirene dan lampu putar sebuah site tanpa alarm sungguhan,
 * untuk memeriksa perangkatnya. Server yang mematikan setelah durasi habis dan
 * yang menolak bila site itu sedang punya alarm sungguhan — dialog ini hanya
 * mengumpulkan isian dan menunjukkan hitung mundurnya.
 */

function labelDurasi(detik: number): string {
  return detik >= 60 ? `${detik / 60} mnt` : `${detik} dtk`;
}

interface UjiBerjalan {
  tingkat: StatusLabel;
  namaSite: string;
  mulai: number;
  berakhir: number;
}

export function DialogUjiEws({ onClose }: { onClose: () => void }) {
  const { sites, isLoading: memuat } = useSites();
  const siteEws = sites.filter((s) => Boolean(s.id_logger_ews));

  const [pilihSite, setPilihSite] = useState("");
  const [tingkat, setTingkat] = useState<(typeof TINGKAT_UJI)[number]>("Waspada");
  const [detik, setDetik] = useState<number>(DURASI_UJI_BAWAAN);
  const [kode, setKode] = useState("");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");
  const [berjalan, setBerjalan] = useState<UjiBerjalan | null>(null);
  const [sekarang, setSekarang] = useState(0);
  const [info, setInfo] = useState("");
  const [pernah, setPernah] = useState(false);

  const site = pilihSite || siteEws[0]?.slug || "";
  const namaSite = siteEws.find((s) => s.slug === site)?.nama ?? site;

  // Hitung mundur. Menutup dialog tidak menghentikan uji — timernya di server.
  const berakhir = berjalan?.berakhir ?? 0;
  useEffect(() => {
    if (!berakhir) return;
    const id = setInterval(() => {
      const t = Date.now();
      setSekarang(t);
      if (t >= berakhir) {
        setBerjalan(null);
        setInfo("Uji selesai. Server mengirim level 0 (Aman); kalau sirene masih bunyi, tekan Matikan sekarang.");
      }
    }, 500);
    return () => clearInterval(id);
  }, [berakhir]);

  const kirimUji = async (kirimTingkat: StatusLabel) => {
    if (proses || !site || !kode.trim()) return;
    setProses(true);
    setGalat("");
    setInfo("");
    try {
      await kirim("/api/ews-uji", { site, tingkat: kirimTingkat, detik, kode_akses: kode });
      setPernah(true);
      if (kirimTingkat === "Normal") {
        setBerjalan(null);
        setInfo("Perintah Aman (level 0) terkirim. Sirene dan lampu seharusnya mati.");
      } else {
        const t = Date.now();
        setSekarang(t);
        setBerjalan({ tingkat: kirimTingkat, namaSite, mulai: t, berakhir: t + detik * 1000 });
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setProses(false);
    }
  };

  const sisa = berjalan ? Math.max(0, Math.ceil((berjalan.berakhir - sekarang) / 1000)) : 0;
  const persen = berjalan
    ? Math.max(0, Math.min(100, ((berjalan.berakhir - sekarang) / (berjalan.berakhir - berjalan.mulai)) * 100))
    : 0;
  const siap = Boolean(site) && kode.trim() !== "" && !proses;

  return (
    <ModalShell
      judul="Uji EWS"
      keterangan="Menyalakan sirene dan lampu putar di lapangan tanpa alarm sungguhan. Tidak membuat kejadian alarm dan tidak mengirim WhatsApp."
      ikon={<Siren className="size-4.5" />}
      lebar="max-w-[460px]"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={TOMBOL_SEKUNDER}>
            Tutup
          </button>
          {pernah && (
            <button type="button" onClick={() => kirimUji("Normal")} disabled={!siap} className={TOMBOL_BAHAYA}>
              <Power className="size-4" />
              Matikan sekarang
            </button>
          )}
          <button type="button" onClick={() => kirimUji(tingkat)} disabled={!siap} className={TOMBOL_UTAMA}>
            {proses ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
            Kirim uji
          </button>
        </>
      }
    >
      {galat && <ModalError>{galat}</ModalError>}

      <p className="mb-4 flex gap-2 rounded-[10px] bg-(--st-siaga)/12 px-3 py-2.5 text-[12px] leading-relaxed text-(--ink-2)">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-(--ink)" />
        Sirene dan lampu akan benar-benar menyala di lokasi. Kabari orang di sekitar sebelum menguji.
      </p>

      {berjalan && (
        <div role="status" className="mb-4 rounded-[10px] border border-(--line) bg-(--paper) px-3 py-2.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-(--ink)">
            <Siren className="size-4 animate-pulse" style={{ color: WARNA_STATUS[berjalan.tingkat] }} />
            {berjalan.tingkat} menyala di {berjalan.namaSite}
          </p>
          <p className="mt-0.5 text-[12px] text-(--ink-2)">
            Mati otomatis dalam {sisa} detik. Menutup dialog tidak menghentikan uji.
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--line)">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${persen}%`, background: WARNA_STATUS[berjalan.tingkat] }}
            />
          </div>
        </div>
      )}
      {!berjalan && info && (
        <p role="status" className="mb-4 rounded-[10px] bg-(--paper) px-3 py-2.5 text-[12px] leading-relaxed text-(--ink-2)">
          {info}
        </p>
      )}

      <div className="mb-4">
        <label htmlFor="uji-ews-site" className={LABEL}>
          Site
        </label>
        {memuat ? (
          <p className="rounded-[10px] bg-(--paper) px-3 py-2.5 text-[12px] text-(--ink-3)">Memuat daftar site…</p>
        ) : siteEws.length === 0 ? (
          <p className="rounded-[10px] bg-(--paper) px-3 py-2.5 text-[12px] text-(--ink-2)">
            Belum ada site dengan logger EWS. Isi di Master Data → Site.
          </p>
        ) : (
          <select
            id="uji-ews-site"
            value={site}
            onChange={(e) => setPilihSite(e.target.value)}
            className={cn(INPUT, "cursor-pointer")}
          >
            {siteEws.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nama} · logger {s.id_logger_ews}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className={LABEL}>Tingkat</p>
      <div role="radiogroup" aria-label="Tingkat uji" className="mb-4 grid grid-cols-3 gap-2">
        {TINGKAT_UJI.map((t) => {
          const dipilih = tingkat === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={dipilih}
              onClick={() => setTingkat(t)}
              className={cn(
                "cursor-pointer rounded-[10px] border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                dipilih ? "border-transparent" : "border-(--line) hover:bg-(--paper)"
              )}
              style={dipilih ? { boxShadow: `inset 0 0 0 2px ${WARNA_STATUS[t]}` } : undefined}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-(--ink)">
                <span className="size-2.5 rounded-full" style={{ background: WARNA_STATUS[t] }} />
                {t}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-(--ink-3)">level {levelEws(t)}</span>
            </button>
          );
        })}
      </div>

      <p className={LABEL}>Menyala selama</p>
      <div role="radiogroup" aria-label="Lama menyala" className="mb-4 grid grid-cols-4 gap-2">
        {DURASI_UJI_PILIHAN.map((d) => {
          const dipilih = detik === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dipilih}
              onClick={() => setDetik(d)}
              className={cn(
                "h-9 cursor-pointer rounded-[9px] border text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                dipilih
                  ? "border-(--navy) bg-(--navy) text-white"
                  : "border-(--line) text-(--ink-2) hover:bg-(--paper)"
              )}
            >
              {labelDurasi(d)}
            </button>
          );
        })}
      </div>

      <InputKodeAkses id="kode-akses-uji-ews" nilai={kode} ubah={setKode} onEnter={() => kirimUji(tingkat)} />
    </ModalShell>
  );
}
