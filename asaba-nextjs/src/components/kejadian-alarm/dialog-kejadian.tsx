"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, ClipboardCheck, Eye, EyeOff, Loader2, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  CATATAN_MAKS,
  CATATAN_MIN,
  JEDA_PENGINGAT_MS,
  PENYEBAB_PALSU,
  fmtWaktuPendek,
  type HasilEws,
  type HasilLapangan,
  type KejadianRingkas,
} from "@/lib/aturan-kejadian";
import { type StatusLabel, indeksStatus } from "@/lib/ambang";
import type { PrismaAlarm } from "@/lib/alarm-ambang";
import { DialogRekamArah } from "@/components/kejadian-alarm/dialog-rekam-arah";
import { REKAM_ARAH_AKTIF } from "@/lib/rekam-arah";

/**
 * Modal alarm (konfirmasi) dan dialog verifikasi kejadian alarm. Dipasang satu
 * kali oleh AlarmAmbangProvider; banner dan halaman Riwayat Alarm hanya
 * memintanya dibuka. Aturan dan validasinya ada di server — komponen ini
 * hanya mengumpulkan isian dan menampilkan jawabannya.
 */

function tintaDi(t: StatusLabel): string {
  return t === "Awas" || t === "Normal" ? "#ffffff" : "#14173a";
}

export function LencanaTingkat({ tingkat, className }: { tingkat: StatusLabel; className?: string }) {
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

function fmtMm(v: number | null): string {
  return v == null ? "—" : `${Math.round(v).toLocaleString("id-ID")} mm`;
}

/** Ringkasan kejadian di kepala dialog verifikasi. */
function Ringkasan({ k, tingkat }: { k: KejadianRingkas; tingkat: StatusLabel }) {
  return (
    <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-[10px] bg-(--paper) px-3.5 py-3 text-[12.5px]">
      <span className="text-(--ink-3)">Site</span>
      <span className="font-semibold text-(--ink)">{k.namaSite}</span>
      <span className="text-(--ink-3)">Tingkat</span>
      <span>
        <LencanaTingkat tingkat={tingkat} />
        {k.tingkatPuncak !== tingkat && (
          <span className="ml-2 text-(--ink-3)">puncak {k.tingkatPuncak}</span>
        )}
      </span>
      <span className="text-(--ink-3)">Mulai</span>
      <span className="text-(--ink)">{fmtWaktuPendek(k.mulai)}</span>
      {k.prismaPuncak && (
        <>
          <span className="text-(--ink-3)">Prisma</span>
          <span className="text-(--ink)">
            {k.prismaPuncak} · {fmtMm(k.nilaiPuncakMm)}
          </span>
        </>
      )}
      {k.dikonfirmasi && (
        <>
          <span className="text-(--ink-3)">Dikonfirmasi</span>
          <span className="text-(--ink)">
            {k.dikonfirmasiOleh} · {fmtWaktuPendek(k.dikonfirmasi)}
          </span>
        </>
      )}
    </div>
  );
}

export function InputKodeAkses({
  nilai,
  ubah,
  onEnter,
  autoFocus,
  id = "kode-akses-alarm",
}: {
  nilai: string;
  ubah: (v: string) => void;
  onEnter: () => void;
  autoFocus?: boolean;
  /** Berbeda per dialog, supaya dua dialog yang terbuka bersamaan tidak berbagi id. */
  id?: string;
}) {
  const [lihat, setLihat] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEnter();
      }}
    >
      <label htmlFor={id} className={LABEL}>
        Kode akses
      </label>
      <div className="relative">
        <input
          id={id}
          type={lihat ? "text" : "password"}
          value={nilai}
          onChange={(e) => ubah(e.target.value)}
          autoComplete="off"
          autoFocus={autoFocus}
          className={cn(INPUT, "h-11 pr-11 font-mono text-[17px] tracking-[0.25em]")}
        />
        <button
          type="button"
          onClick={() => setLihat((v) => !v)}
          aria-label={lihat ? "Sembunyikan kode" : "Tampilkan kode"}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[7px] text-(--ink-3) outline-none transition-colors hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
        >
          {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
    </form>
  );
}

export async function kirim(url: string, body: unknown): Promise<{ ews?: HasilEws }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; ews?: HasilEws } | null;
  if (!json?.success) throw new Error(json?.error || `Gagal (HTTP ${res.status})`);
  return json;
}

// ─── Modal alarm ────────────────────────────────────────────────────────────

/**
 * Modal alarm: tingkat, site, prisma, dan konfirmasi dalam satu langkah.
 *
 * TIDAK mengunci operator: "Nanti" dan Esc menutupnya, klik di luar tidak —
 * satu klik meleset tidak boleh membuang alarm. Kepala modal berwarna sesuai
 * tingkat dan ikonnya berdenyut, supaya terbaca dari seberang ruangan.
 */
export function ModalAlarm({
  kejadian: k,
  prisma,
  pengingat = false,
  onClose,
  onSelesai,
}: {
  kejadian: KejadianRingkas;
  /** Prisma yang sedang di atas Normal; yang bukan milik site ini disaring di sini. */
  prisma?: PrismaAlarm[];
  /** Tampilkan catatan bahwa modal muncul lagi bila belum dikonfirmasi. */
  pengingat?: boolean;
  onClose: () => void;
  /** Konfirmasi tersimpan. `ews` = nasib perintah ke sirene, bila site punya. */
  onSelesai: (ews: HasilEws | undefined) => void;
}) {
  const [kode, setKode] = useState("");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !proses) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proses, onClose]);

  const tingkat = k.tingkatTerakhir;
  const adaSirene = k.adaEws !== false;
  const baris = (prisma ?? [])
    .filter((p) => p.site === k.site)
    .sort((a, b) => indeksStatus(b.tingkat) - indeksStatus(a.tingkat) || (b.nilaiMm ?? -1) - (a.nilaiMm ?? -1));

  const konfirmasi = async () => {
    if (proses || !kode.trim()) return;
    setProses(true);
    setGalat("");
    try {
      const hasil = await kirim(`/api/kejadian-alarm/${k.id}/konfirmasi`, { kode_akses: kode });
      onSelesai(hasil.ews);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
      setProses(false);
    }
  };

  const mulai = fmtWaktuPendek(k.mulai);

  return (
    <div className="tema-monitoring fixed inset-0 z-50 flex items-center justify-center bg-(--ink)/55 p-4 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="judul-modal-alarm"
        className="flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl ring-1 ring-(--line)"
      >
        <div
          className="flex shrink-0 items-center gap-3.5 px-5 py-4"
          style={{ background: `color-mix(in srgb, ${WARNA_STATUS[tingkat]} 16%, white)` }}
        >
          <span
            className="flex size-11 shrink-0 animate-pulse items-center justify-center rounded-full motion-reduce:animate-none"
            style={{ background: WARNA_STATUS[tingkat], color: tintaDi(tingkat) }}
          >
            <Siren className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold tracking-[0.08em] text-(--ink-2)">
              ALARM {tingkat.toUpperCase()}
            </p>
            <h3 id="judul-modal-alarm" className="font-display text-[19px] leading-tight font-bold text-(--ink)">
              {k.namaSite}
            </h3>
            <p className="mt-0.5 text-[12px] text-(--ink-2)">
              Sejak {mulai}
              {k.tingkatPuncak !== tingkat && ` · puncak ${k.tingkatPuncak}`}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-1">
          <ul className="mb-3">
            {(baris.length > 0
              ? baris.map((p) => ({ id: p.idPrisma, tingkat: p.tingkat as StatusLabel, mm: p.nilaiMm }))
              : k.prismaPuncak
                ? [{ id: k.prismaPuncak, tingkat: k.tingkatPuncak, mm: k.nilaiPuncakMm }]
                : []
            ).map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2.5 border-t border-(--line) py-2 text-[13.5px] first:border-t-0"
              >
                <LencanaTingkat tingkat={p.tingkat} />
                <span className="font-semibold text-(--ink)">{p.id}</span>
                <span className="ml-auto tabular-nums text-(--ink-2)">
                  {p.mm == null ? "tak terbaca" : fmtMm(p.mm)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mb-3 flex gap-2 text-[12.5px] leading-relaxed text-(--ink-2)">
            <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {adaSirene && "Sirene dan lampu rotary menyala di lapangan. "}
              Konfirmasi {adaSirene ? "mematikannya dan " : ""}membungkam suara di semua layar. Status
              tetap {tingkat} dan alarm berbunyi lagi bila tingkatnya naik. Kabar dikirim ke WhatsApp.
            </span>
          </p>

          {galat && <ModalError>{galat}</ModalError>}
          <InputKodeAkses nilai={kode} ubah={setKode} onEnter={konfirmasi} autoFocus />
        </div>

        <div className="flex shrink-0 gap-2 px-5 pt-3 pb-3.5">
          <button
            type="button"
            onClick={konfirmasi}
            disabled={proses || !kode.trim()}
            className={cn(TOMBOL_BAHAYA, "h-10 flex-1")}
          >
            {proses && <Loader2 className="size-4 animate-spin" />}
            {adaSirene ? "Konfirmasi dan matikan sirene" : "Konfirmasi alarm"}
          </button>
          <button type="button" onClick={onClose} disabled={proses} className={cn(TOMBOL_SEKUNDER, "h-10")}>
            Nanti
          </button>
        </div>
        {pengingat && (
          <p className="px-5 pb-3.5 text-center text-[11.5px] text-(--ink-3)">
            Banner tetap tampil. Modal muncul lagi bila belum dikonfirmasi dalam{" "}
            {Math.round(JEDA_PENGINGAT_MS / 60_000)} menit.
          </p>
        )}
      </div>
    </div>
  );
}

/** Konfirmasi tersimpan, tapi perintah ke sirene gagal terkirim. */
export function PemberitahuanEwsGagal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      judul="Alarm dikonfirmasi"
      ikon={<BellOff className="size-4.5" />}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={TOMBOL_UTAMA}>
          Tutup
        </button>
      }
    >
      <ModalError>
        Konfirmasi tersimpan dan suara di website berhenti, tapi perintah ke sirene EWS gagal
        terkirim. Server mengulanginya otomatis di siklus berikutnya.
      </ModalError>
    </ModalShell>
  );
}

// ─── Verifikasi ─────────────────────────────────────────────────────────────

export function DialogVerifikasi({
  kejadian: k,
  onClose,
  onSelesai,
}: {
  kejadian: KejadianRingkas;
  onClose: () => void;
  onSelesai: () => void;
}) {
  const [hasil, setHasil] = useState<HasilLapangan | null>(k.hasil);
  const [penyebab, setPenyebab] = useState(k.penyebab ?? "");
  const [catatan, setCatatan] = useState(k.catatan ?? "");
  const [kode, setKode] = useState("");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");
  // Pergeseran yang benar membuat arah bidik tersimpan meleset dari prisma.
  // Dicentang bawaan; untuk kejadian yang sudah pernah diverifikasi Benar
  // (membuka "Ubah"), rekam ulangnya mungkin sudah dilakukan.
  const [perbaruiArah, setPerbaruiArah] = useState(REKAM_ARAH_AKTIF && k.hasil !== "benar");
  const [tahap, setTahap] = useState<"isi" | "arah">("isi");

  const lengkap =
    hasil !== null &&
    (hasil === "benar" || penyebab !== "") &&
    catatan.trim().length >= CATATAN_MIN &&
    kode.trim() !== "";

  const simpan = async () => {
    if (proses || !lengkap) return;
    setProses(true);
    setGalat("");
    try {
      await kirim(`/api/kejadian-alarm/${k.id}/verifikasi`, {
        kode_akses: kode,
        hasil,
        penyebab: hasil === "palsu" ? penyebab : null,
        catatan,
      });
      onSelesai();
      if (REKAM_ARAH_AKTIF && hasil === "benar" && perbaruiArah) setTahap("arah");
      else onClose();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setProses(false);
    }
  };

  const pilihan: Array<{ nilai: HasilLapangan; judul: string; ket: string; warna: string }> = [
    { nilai: "benar", judul: "Benar", ket: "Pergeseran nyata di lapangan", warna: "var(--st-awas)" },
    { nilai: "palsu", judul: "Palsu", ket: "Bukan pergeseran sungguhan", warna: "var(--st-normal)" },
  ];

  if (tahap === "arah") return <DialogRekamArah kejadian={k} kode={kode} onClose={onClose} />;

  return (
    <ModalShell
      judul={k.diverifikasi ? "Ubah verifikasi" : "Verifikasi alarm"}
      keterangan="Hasil pengecekan lapangan, disimpan di riwayat dan dikabarkan ke WhatsApp."
      ikon={<ClipboardCheck className="size-4.5" />}
      lebar="max-w-[460px]"
      onClose={onClose}
      bisaDitutup={!proses}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={proses} className={TOMBOL_SEKUNDER}>
            Batal
          </button>
          <button type="button" onClick={simpan} disabled={proses || !lengkap} className={TOMBOL_UTAMA}>
            {proses && <Loader2 className="size-4 animate-spin" />}
            Simpan verifikasi
          </button>
        </>
      }
    >
      {galat && <ModalError>{galat}</ModalError>}
      <Ringkasan k={k} tingkat={k.tingkatPuncak} />

      <p className={LABEL}>Hasil pengecekan</p>
      <div role="radiogroup" className="mb-4 grid grid-cols-2 gap-2">
        {pilihan.map((p) => {
          const dipilih = hasil === p.nilai;
          return (
            <button
              key={p.nilai}
              type="button"
              role="radio"
              aria-checked={dipilih}
              onClick={() => setHasil(p.nilai)}
              className={cn(
                "cursor-pointer rounded-[10px] border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                dipilih ? "border-transparent ring-2" : "border-(--line) hover:bg-(--paper)"
              )}
              style={dipilih ? { boxShadow: `inset 0 0 0 2px ${p.warna}` } : undefined}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-(--ink)">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: dipilih ? p.warna : "var(--line)" }}
                />
                {p.judul}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-(--ink-3)">{p.ket}</span>
            </button>
          );
        })}
      </div>

      {hasil === "palsu" && (
        <div className="mb-4">
          <label htmlFor="penyebab-palsu" className={LABEL}>
            Penyebab
          </label>
          <select
            id="penyebab-palsu"
            value={penyebab}
            onChange={(e) => setPenyebab(e.target.value)}
            className={cn(INPUT, "cursor-pointer")}
          >
            <option value="" disabled>
              Pilih penyebab…
            </option>
            {PENYEBAB_PALSU.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasil === "benar" && (
        <div className="mb-4 rounded-[10px] bg-(--st-awas)/8 px-3 py-2.5 text-[12px] leading-relaxed text-(--ink-2)">
          <p>
            Verifikasi tidak mengubah perhitungan. Status kembali Normal setelah R0 diganti (saat
            keadaan sudah aman) atau ambangnya diubah.
          </p>
          {REKAM_ARAH_AKTIF && (
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-(--ink)">
            <input
              type="checkbox"
              checked={perbaruiArah}
              onChange={(e) => setPerbaruiArah(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-(--navy)"
            />
            <span>
              <b className="font-semibold">Perbarui arah bidik prisma setelah disimpan.</b>{" "}
              <span className="text-(--ink-2)">
                RTS merekam ulang sudut HA/VA prisma yang bergeser ke posisi barunya. Prismanya dipilih di
                langkah berikut.
              </span>
            </span>
          </label>
          )}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="catatan-verifikasi" className={LABEL}>
          Catatan
        </label>
        <textarea
          id="catatan-verifikasi"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value.slice(0, CATATAN_MAKS))}
          rows={3}
          placeholder="Apa yang ditemukan di lapangan, tindakan yang diambil"
          className={cn(INPUT, "h-auto resize-y py-2 leading-relaxed")}
        />
        <p className="mt-1 text-right text-[11px] text-(--ink-3)">
          {catatan.trim().length < CATATAN_MIN
            ? `Minimal ${CATATAN_MIN} karakter`
            : `${catatan.length}/${CATATAN_MAKS}`}
        </p>
      </div>

      <InputKodeAkses nilai={kode} ubah={setKode} onEnter={simpan} />
    </ModalShell>
  );
}
