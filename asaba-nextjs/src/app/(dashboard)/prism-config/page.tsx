"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Move, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fontDisplay } from "@/lib/fonts";
import { useRtsConnectionStatus } from "@/hooks/use-api";
import { useSites } from "@/hooks/use-sites";
import { Chip, Eyebrow, Panel, PanelHeader } from "@/components/monitoring/panel";
import { fmtDate } from "@/components/monitoring/format";
import { ConfigPanel } from "@/components/prism-config/config-panel";
import { SlotTable } from "@/components/prism-config/slot-table";
import { PrismaModal } from "@/components/prism-config/prisma-modal";
import { HapusPrismaModal } from "@/components/prism-config/hapus-modal";
import { AccessCodeModal } from "@/components/prism-config/access-code-modal";
import { ArahkanModal } from "@/components/prism-config/arahkan-modal";
import type { PrismaSlot, PrismConfigResponse } from "@/components/prism-config/types";

export default function PrismConfigPage() {
  const { isConnected, lastUpdate } = useRtsConnectionStatus();
  // withLogger=true supaya `nama_lokasi` ikut terbawa untuk nama pos RTS.
  const { sites, badge: siteBadge, namaPos, isLoading: sitesLoading } = useSites(false, true);

  // Slot prisma (P1, P2, …) dipakai ulang di tiap site dan menunjuk target
  // fisik yang berbeda, jadi halaman ini harus selalu terikat ke satu site.
  // Nilai efektifnya diturunkan, bukan disinkronkan lewat effect: sebelum
  // daftar site termuat, `site` berisi "" dan fetch-nya memang ditunda.
  const [sitePilihan, setSitePilihan] = useState("");
  const site = sitePilihan || sites[0]?.slug || "";

  const [cari, setCari] = useState("");
  const [hanyaTerisi, setHanyaTerisi] = useState(false);
  const [terpilih, setTerpilih] = useState<number | null>(null);

  const [data, setData] = useState<PrismaSlot[]>([]);
  const [idLogger, setIdLogger] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState<{ mode: "set" | "edit"; slot: PrismaSlot } | null>(null);
  const [hapusSlot, setHapusSlot] = useState<PrismaSlot | null>(null);
  const [kodeTerbuka, setKodeTerbuka] = useState(false);
  const [terbuka, setTerbuka] = useState(false);
  // Arahkan RTS sengaja TIDAK di balik kunci kode akses. Kuncinya menjaga
  // perubahan konfigurasi slot; mengarahkan teleskop adalah tindakan operasi,
  // bukan perubahan data, dan sebelum dipindah ke sini pun tidak berkunci.
  const [arahkanTerbuka, setArahkanTerbuka] = useState(false);

  const muat = useCallback(async () => {
    if (!site) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/prism-config?site=${encodeURIComponent(site)}`);
      const json: PrismConfigResponse = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengambil data");
      setData(json.data);
      setIdLogger(json.id_logger ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => {
    muat();
  }, [muat]);

  const gantiSite = (slug: string) => {
    setSitePilihan(slug);
    // Slot terpilih milik site sebelumnya — nomor yang sama di site lain adalah
    // target fisik yang berbeda, jadi pilihannya dilepas, bukan dibawa serta.
    setTerpilih(null);
  };

  const barisTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data.filter((row) => {
      if (hanyaTerisi && !row.registered) return false;
      if (!q) return true;
      return (
        row.id_prisma.toLowerCase().includes(q) ||
        String(row.slot).includes(q) ||
        (row.registered && row.nama_prisma.toLowerCase().includes(q))
      );
    });
  }, [data, cari, hanyaTerisi]);

  const terisi = data.filter((d) => d.registered).length;
  const siteAktif = sites.find((s) => s.slug === site) ?? null;
  const peringatanSite = site ? siteBadge(site).peringatan : null;

  const pilihSlot = (slot: number) => setTerpilih(slot);

  const setelahUbah = () => {
    setModal(null);
    muat();
  };

  const tombol =
    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/50";

  return (
    // Gutter dilepas lewat RUTE_FULL_BLEED_PERSIS di (dashboard)/layout.tsx.
    <div
      className={cn(
        "tema-monitoring min-h-[calc(100vh-4rem)] bg-(--paper) p-3 text-(--ink) sm:p-4 md:p-6",
        fontDisplay.variable
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {/* ── Bar kontrol ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Eyebrow>Site</Eyebrow>
          <div
            role="tablist"
            aria-label="Pilih site"
            className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sites.map((s) => {
              const aktif = s.slug === site;
              const b = siteBadge(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => gantiSite(s.slug)}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                    aktif
                      ? "bg-(--navy) text-white"
                      : "bg-white text-(--ink-2) ring-1 ring-(--line) hover:text-(--ink)"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: s.badge_color }}
                  />
                  {s.nama}
                  {b.peringatan && (
                    <AlertTriangle
                      className={cn("size-3.5", aktif ? "text-amber-300" : "text-amber-600")}
                      aria-label="Data site ini belum bisa dipercaya"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Arahkan RTS — dipindah dari Kontrol ADR.
              Tempatnya di sini karena target pengukurannya adalah slot di
              daftar bawah: `measure_bs`/`measure_fs` tidak punya parameter
              target, jadi teleskop harus diputar ke slot itu lebih dulu. */}
          <button
            type="button"
            onClick={() => setArahkanTerbuka(true)}
            disabled={!site || !idLogger || !isConnected}
            className={cn(
              tombol,
              "ml-auto bg-(--navy) text-white hover:bg-(--navy-deep) disabled:cursor-not-allowed disabled:opacity-50"
            )}
            title={
              !isConnected
                ? "RTS terputus — perintahnya tidak akan sampai"
                : "Geser arah teleskop, lalu ukur backsight/foresight"
            }
          >
            <Move className="size-4" />
            Arahkan RTS
          </button>

          <span
            className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-medium text-(--ink-2) ring-1 ring-(--line)"
            title={
              lastUpdate
                ? `Data terakhir ${fmtDate(lastUpdate, { detik: true })}`
                : "Belum ada data masuk"
            }
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: isConnected ? "var(--st-normal)" : "var(--st-awas)" }}
            />
            RTS {isConnected ? "terhubung" : "terputus"}
          </span>
        </div>

        {peringatanSite && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">{peringatanSite}.</span> Konfigurasi slot di
              halaman ini tetap berlaku, tapi angka pergeserannya belum bisa dipakai mengambil
              keputusan.
            </p>
          </div>
        )}

        {error ? (
          <Panel className="items-center px-6 py-14 text-center">
            <p className="font-display text-[20px] font-bold text-(--ink)">
              Daftar slot tidak bisa dimuat
            </p>
            <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">{error}</p>
            <button
              type="button"
              onClick={muat}
              className={cn(tombol, "mt-4 bg-(--navy) text-white hover:bg-(--navy-deep)")}
            >
              Coba lagi
            </button>
          </Panel>
        ) : sites.length === 0 && !sitesLoading ? (
          <Panel className="items-center px-6 py-14 text-center">
            <p className="font-display text-[20px] font-bold text-(--ink)">
              Belum ada site terdaftar
            </p>
            <p className="mt-1.5 max-w-md text-[13px] text-(--ink-2)">
              Tambahkan site di Master Data sebelum mengonfigurasi slot prisma.
            </p>
          </Panel>
        ) : (
          <>
            <ConfigPanel
              className="rise-in"
              namaPos={namaPos(site)}
              namaSite={siteAktif?.nama ?? "—"}
              siteWarna={siteAktif?.badge_color ?? "var(--ink-3)"}
              idLogger={idLogger}
              slots={data}
              selected={terpilih}
              onSelect={pilihSlot}
              terbuka={terbuka}
              onBuka={() => setKodeTerbuka(true)}
              onTutup={() => setTerbuka(false)}
              loading={loading}
            />

            <Panel className="rise-in xl:h-[560px]" style={{ animationDelay: "120ms" }}>
              <PanelHeader
                title="Daftar slot"
                actions={
                  <>
                    <div
                      role="tablist"
                      aria-label="Saring daftar slot"
                      className="inline-flex gap-1 rounded-[10px] bg-(--paper) p-1 ring-1 ring-(--line)"
                    >
                      {[
                        { id: false, label: "Semua 50" },
                        { id: true, label: `Terisi ${terisi}` },
                      ].map((o) => (
                        <button
                          key={String(o.id)}
                          type="button"
                          role="tab"
                          aria-selected={hanyaTerisi === o.id}
                          onClick={() => setHanyaTerisi(o.id)}
                          className={cn(
                            "inline-flex h-8 cursor-pointer items-center rounded-[7px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--navy)/40",
                            hanyaTerisi === o.id
                              ? "bg-white text-(--ink) shadow-sm"
                              : "text-(--ink-3) hover:text-(--ink-2)"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--ink-3)" />
                      <input
                        type="text"
                        value={cari}
                        onChange={(e) => setCari(e.target.value)}
                        placeholder="Cari nama atau nomor slot"
                        aria-label="Cari slot"
                        autoComplete="off"
                        className="h-9 w-[230px] rounded-[9px] bg-white pr-8 pl-9 text-[13px] text-(--ink) ring-1 ring-(--line) outline-none transition-colors placeholder:text-(--ink-3) focus:ring-2 focus:ring-(--navy)/40"
                      />
                      {cari && (
                        <button
                          type="button"
                          onClick={() => setCari("")}
                          aria-label="Hapus pencarian"
                          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-(--ink-3) outline-none hover:bg-(--paper) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/40"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                }
              >
                <Chip>
                  <span className="font-mono tabular-nums">{barisTampil.length}</span>
                  &nbsp;slot tampil
                </Chip>
                {!terbuka && <span>hanya bisa dibaca — buka kunci untuk mengubah</span>}
              </PanelHeader>

              <div className="flex min-h-0 flex-1 flex-col border-t border-(--line)">
                <SlotTable
                  rows={barisTampil}
                  loading={loading}
                  terbuka={terbuka}
                  selected={terpilih}
                  onSelect={pilihSlot}
                  onSet={(row) => setModal({ mode: "set", slot: row })}
                  onEdit={(row) => setModal({ mode: "edit", slot: row })}
                  onHapus={(row) => setHapusSlot(row)}
                  adaPencarian={cari.trim() !== "" || hanyaTerisi}
                />
              </div>
            </Panel>
          </>
        )}
      </div>

      {modal && (
        <PrismaModal
          mode={modal.mode}
          slot={modal.slot}
          site={site}
          idLogger={idLogger}
          onClose={() => setModal(null)}
          onSuccess={setelahUbah}
        />
      )}

      {hapusSlot && (
        <HapusPrismaModal
          slot={hapusSlot}
          site={site}
          namaSite={siteAktif?.nama ?? site}
          onClose={() => setHapusSlot(null)}
          onSuccess={() => {
            setHapusSlot(null);
            muat();
          }}
        />
      )}

      {arahkanTerbuka && (
        <ArahkanModal
          site={site}
          idLogger={idLogger}
          slots={data}
          slotAwal={terpilih}
          namaPos={namaPos(site)}
          onClose={() => setArahkanTerbuka(false)}
        />
      )}

      {kodeTerbuka && (
        <AccessCodeModal
          onClose={() => setKodeTerbuka(false)}
          onSuccess={() => {
            setKodeTerbuka(false);
            setTerbuka(true);
          }}
        />
      )}
    </div>
  );
}
