"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { ModalError, ModalShell, TOMBOL_BAHAYA, TOMBOL_SEKUNDER } from "@/components/monitoring/modal-shell";
import type { PrismaSlot } from "./types";

/**
 * Konfirmasi hapus prisma yang sudah dikonfigurasi.
 *
 * Penghapusannya menyentuh tiga tabel sekaligus (t_prisma, temp_prisma,
 * parameter_prisma) dan tidak bisa dibatalkan, jadi slot + nama + site
 * ditampilkan apa adanya supaya operator bisa mencocokkan sebelum menekan
 * Hapus — di halaman ini "P1" saja tidak cukup untuk mengenali target.
 */
export function HapusPrismaModal({
  slot,
  site,
  namaSite,
  onClose,
  onSuccess,
}: {
  slot: PrismaSlot;
  /** Slug site; slot hanya unik bersama site. */
  site: string;
  /** Nama site yang terbaca manusia, untuk ditampilkan. */
  namaSite: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleHapus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prism-config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.slot, site }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus prisma");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <ModalShell
      judul="Hapus prisma"
      keterangan="Tindakan ini tidak bisa dibatalkan."
      ikon={<Trash2 className="size-4.5" />}
      onClose={onClose}
      bisaDitutup={!loading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className={TOMBOL_SEKUNDER}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleHapus}
            disabled={loading}
            className={TOMBOL_BAHAYA}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Hapus
          </button>
        </>
      }
    >
      {error && <ModalError>{error}</ModalError>}

      <div className="flex items-center gap-3 rounded-[10px] bg-(--paper) px-3.5 py-3">
        <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-[7px] bg-(--navy)/10 px-2 font-mono text-[12px] font-semibold tabular-nums text-(--navy)">
          {slot.slot}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-(--ink)">
            {slot.nama_prisma.replace(/_/g, " ")}
          </p>
          <p className="text-[11.5px] text-(--ink-3)">{namaSite}</p>
        </div>
      </div>

      <p className="mt-3.5 text-[12.5px] leading-relaxed text-(--ink-2)">
        Data prisma ini dihapus dari daftar slot beserta pembacaan sementara dan parameter
        grafiknya.
      </p>

      {/* Perangkat tidak ikut dibersihkan: endpoint DELETE hanya menghapus
          baris di database, tidak mengirim perintah MQTT apa pun. Slot yang
          sama masih tersimpan di RTS sampai ditimpa lewat Isi slot. */}
      <div className="mt-3 flex gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
        <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600" />
        <span>
          Hanya data di aplikasi yang dihapus. Slot {slot.slot} di RTS tidak ikut dikosongkan
          dan masih menyimpan target lama sampai ditimpa lewat Isi slot.
        </span>
      </div>
    </ModalShell>
  );
}
