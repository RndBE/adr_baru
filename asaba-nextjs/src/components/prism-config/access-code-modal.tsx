"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INPUT,
  LABEL,
  ModalError,
  ModalShell,
  TOMBOL_SEKUNDER,
  TOMBOL_UTAMA,
} from "@/components/monitoring/modal-shell";

/**
 * Kode akses untuk membuka kunci konfigurasi.
 *
 * Kodenya diverifikasi di server (/api/kontrol/verify-access) — masa berlakunya
 * ditegakkan di sana dan hash-nya tidak pernah dikirim ke klien.
 */
export function AccessCodeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [lihat, setLihat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kontrol/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Kode akses salah");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      judul="Buka kunci konfigurasi"
      keterangan="Kode akses dikelola di Master Data dan punya masa berlaku."
      ikon={<KeyRound className="size-4.5" />}
      lebar="max-w-[400px]"
      onClose={onClose}
      bisaDitutup={!loading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className={TOMBOL_SEKUNDER}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className={TOMBOL_UTAMA}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Buka kunci
          </button>
        </>
      }
    >
      {error && <ModalError>{error}</ModalError>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && code.trim()) handleSubmit();
        }}
      >
        <label htmlFor="kode-akses" className={LABEL}>
          Kode akses
        </label>
        <div className="relative">
          <input
            id="kode-akses"
            type={lihat ? "text" : "password"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoFocus
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
        {/* Tombol tersembunyi supaya Enter mengirim formulir; tombol aslinya
            ada di footer ModalShell, di luar <form> ini. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>

      <p className="mt-3 text-[12px] leading-relaxed text-(--ink-3)">
        Setelah terbuka, tombol Isi slot, Ubah, dan Hapus aktif sampai kamu menekan Selesai
        konfigurasi.
      </p>
    </ModalShell>
  );
}
