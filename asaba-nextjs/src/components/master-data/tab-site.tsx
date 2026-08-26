"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SiteRow } from "@/hooks/use-sites";

/** Form memakai string untuk semua field angka supaya input bisa dikosongkan.
 *  String kosong dikirim apa adanya dan diterjemahkan jadi null oleh API. */
type FormState = Record<string, string | boolean>;

const KOSONG: FormState = {
  slug: "", nama: "", badge_label: "", badge_color: "#303481",
  geser_normal_max: "50", geser_waspada_max: "100", geser_siaga_max: "200",
  laju_waspada_min: "40", laju_siaga_min: "80", laju_awas_min: "120",
  rts_e: "", rts_n: "", rts_z: "",
  utm_zone: "50", utm_north: true,
  map_lat: "", map_lng: "", map_zoom: "16",
  rotasi_deg: "", pivot_e: "", pivot_n: "", ukur_e: "", ukur_n: "",
  pivot_lat: "", pivot_lng: "", ukur_lat: "", ukur_lng: "",
  aktif: true, data_dummy: false, urutan: "0", catatan: "",
};

function toForm(row: SiteRow): FormState {
  const s = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    slug: row.slug, nama: row.nama, badge_label: row.badge_label, badge_color: row.badge_color,
    geser_normal_max: s(row.geser_normal_max),
    geser_waspada_max: s(row.geser_waspada_max),
    geser_siaga_max: s(row.geser_siaga_max),
    laju_waspada_min: s(row.laju_waspada_min),
    laju_siaga_min: s(row.laju_siaga_min),
    laju_awas_min: s(row.laju_awas_min),
    rts_e: s(row.rts_e), rts_n: s(row.rts_n), rts_z: s(row.rts_z),
    utm_zone: s(row.utm_zone), utm_north: row.utm_north,
    map_lat: s(row.map_lat), map_lng: s(row.map_lng), map_zoom: s(row.map_zoom),
    rotasi_deg: s(row.rotasi_deg),
    pivot_e: s(row.pivot_e), pivot_n: s(row.pivot_n),
    ukur_e: s(row.ukur_e), ukur_n: s(row.ukur_n),
    pivot_lat: s(row.pivot_lat), pivot_lng: s(row.pivot_lng),
    ukur_lat: s(row.ukur_lat), ukur_lng: s(row.ukur_lng),
    aktif: row.aktif, data_dummy: row.data_dummy, urutan: s(row.urutan), catatan: row.catatan ?? "",
  };
}

export function TabSite() {
  const [data, setData] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(KOSONG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sites?all=1").then((r) => r.json());
      if (res.success) setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(KOSONG); setError(null); setOpen(true); };
  const openEdit = (row: SiteRow) => { setEditing(row); setForm(toForm(row)); setError(null); setOpen(true); };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const url = editing ? `/api/sites/${editing.id}` : "/api/sites";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());

      if (res.success) { setOpen(false); load(); }
      else setError(res.error || "Gagal menyimpan");
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SiteRow) => {
    if (!confirm(`Hapus site "${row.nama}"?`)) return;
    const res = await fetch(`/api/sites/${row.id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) load();
    else alert(res.error || "Gagal menghapus");
  };

  const belumKalibrasi = data.filter((s) => !s.terkalibrasi);
  const dataContoh = data.filter((s) => s.terkalibrasi && s.data_dummy);

  return (
    <>
      {belumKalibrasi.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            <span className="font-bold">
              {belumKalibrasi.length} site belum dikalibrasi:{" "}
              {belumKalibrasi.map((s) => s.nama).join(", ")}.
            </span>{" "}
            Koordinat referensi RTS dan/atau center peta belum diisi, jadi nilai
            pergeseran untuk site tersebut belum bisa dianggap sahih.
          </div>
        </div>
      )}

      {dataContoh.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
          <div className="text-[12.5px] leading-relaxed text-orange-900">
            <span className="font-bold">
              {dataContoh.length} site memakai data contoh:{" "}
              {dataContoh.map((s) => s.nama).join(", ")}.
            </span>{" "}
            Koordinat dan ambangnya terisi lengkap tapi bukan hasil survei — cukup
            untuk demo, belum boleh dipakai mengambil keputusan. Hapus centang
            <b> Data contoh</b> setelah angka aslinya dimasukkan.
          </div>
        </div>
      )}

      <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
          <div>
            <h2 className="text-[14.5px] font-bold text-gray-900">Data Site</h2>
            <p className="mt-0.5 text-[11.5px] text-gray-500">
              Ambang bahaya, koordinat referensi, dan tampilan peta per area pemantauan
            </p>
          </div>
          <Button onClick={openAdd} className="bg-[#303481] hover:bg-[#1f2259] text-white h-9 px-4 text-sm rounded-lg cursor-pointer flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#303481]" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-[#F5F6FA]">
                <TableRow>
                  <TableHead className="w-12 text-xs font-bold text-gray-500">#</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">SITE</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">SLUG</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">AMBANG GESER (mm)</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">REFERENSI RTS</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">STATUS</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 text-right">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-400 text-sm">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, i) => (
                    <TableRow key={row.id} className="hover:bg-gray-50 border-b border-[#F0F0F0]">
                      <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-full px-2 py-[2px] text-[9.5px] font-bold text-white"
                            style={{ backgroundColor: row.badge_color }}
                          >
                            {row.badge_label}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{row.nama}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">{row.slug}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {row.geser_normal_max} / {row.geser_waspada_max} / {row.geser_siaga_max}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {row.rts_e === null ? (
                          <span className="text-amber-600">belum diisi</span>
                        ) : (
                          `${row.rts_e}, ${row.rts_n}`
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {!row.terkalibrasi ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-[2px] text-[10px] font-bold text-amber-700">
                              <AlertTriangle className="h-3 w-3" /> Belum dikalibrasi
                            </span>
                          ) : row.data_dummy ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-orange-100 px-2 py-[2px] text-[10px] font-bold text-orange-700">
                              <AlertTriangle className="h-3 w-3" /> Data contoh
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-[2px] text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Terkalibrasi
                            </span>
                          )}
                          {!row.aktif && (
                            <span className="inline-flex w-fit rounded-full bg-gray-200 px-2 py-[2px] text-[10px] font-bold text-gray-600">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 cursor-pointer transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 cursor-pointer transition-colors" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Site — ${editing.nama}` : "Tambah Site"}</DialogTitle>
            <DialogDescription className="text-[12px]">
              Kolom koordinat boleh dikosongkan. Site tanpa koordinat referensi RTS
              atau center peta ditandai <b>belum dikalibrasi</b> dan diberi peringatan
              di seluruh aplikasi.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-5 py-1">
            <Seksi judul="Identitas">
              <div className="grid grid-cols-2 gap-3">
                <F label="Nama Site *">
                  <Input value={form.nama as string} onChange={(e) => set("nama", e.target.value)} placeholder="Politeknik PU" />
                </F>
                <F label="Slug *" hint="Harus sama dengan nilai kolom log_kontrol.site">
                  <Input
                    value={form.slug as string}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="politeknik-pu"
                    className="font-mono"
                    disabled={!!editing}
                  />
                </F>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <F label="Label Badge">
                  <Input value={form.badge_label as string} onChange={(e) => set("badge_label", e.target.value)} placeholder="PPU" maxLength={20} />
                </F>
                <F label="Warna Badge">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.badge_color as string}
                      onChange={(e) => set("badge_color", e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-gray-200"
                    />
                    <Input value={form.badge_color as string} onChange={(e) => set("badge_color", e.target.value)} className="font-mono" />
                  </div>
                </F>
                <F label="Urutan">
                  <Input type="number" value={form.urutan as string} onChange={(e) => set("urutan", e.target.value)} />
                </F>
              </div>
            </Seksi>

            <Seksi judul="Ambang Pergeseran (mm)" hint="Batas atas tiap level — harus menaik">
              <div className="grid grid-cols-3 gap-3">
                <F label="Normal <"><Input type="number" value={form.geser_normal_max as string} onChange={(e) => set("geser_normal_max", e.target.value)} /></F>
                <F label="Waspada <"><Input type="number" value={form.geser_waspada_max as string} onChange={(e) => set("geser_waspada_max", e.target.value)} /></F>
                <F label="Siaga <"><Input type="number" value={form.geser_siaga_max as string} onChange={(e) => set("geser_siaga_max", e.target.value)} /></F>
              </div>
            </Seksi>

            <Seksi judul="Ambang Kecepatan (mm/hari)" hint="Batas bawah tiap level — harus menaik">
              <div className="grid grid-cols-3 gap-3">
                <F label="Waspada >"><Input type="number" value={form.laju_waspada_min as string} onChange={(e) => set("laju_waspada_min", e.target.value)} /></F>
                <F label="Siaga >"><Input type="number" value={form.laju_siaga_min as string} onChange={(e) => set("laju_siaga_min", e.target.value)} /></F>
                <F label="Awas >"><Input type="number" value={form.laju_awas_min as string} onChange={(e) => set("laju_awas_min", e.target.value)} /></F>
              </div>
            </Seksi>

            <Seksi judul="Koordinat Referensi RTS (UTM)" hint="Kosongkan bila belum disurvei">
              <div className="grid grid-cols-3 gap-3">
                <F label="Easting (E)"><Input value={form.rts_e as string} onChange={(e) => set("rts_e", e.target.value)} placeholder="525952.0" className="font-mono" /></F>
                <F label="Northing (N)"><Input value={form.rts_n as string} onChange={(e) => set("rts_n", e.target.value)} placeholder="401320.988" className="font-mono" /></F>
                <F label="Elevasi (Z)"><Input value={form.rts_z as string} onChange={(e) => set("rts_z", e.target.value)} placeholder="62.559" className="font-mono" /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Zona UTM" hint="1–60"><Input type="number" value={form.utm_zone as string} onChange={(e) => set("utm_zone", e.target.value)} /></F>
                <F label="Hemisfer">
                  <div className="flex h-9 items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                      <input type="radio" checked={form.utm_north === true} onChange={() => set("utm_north", true)} /> Utara
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                      <input type="radio" checked={form.utm_north === false} onChange={() => set("utm_north", false)} /> Selatan
                    </label>
                  </div>
                </F>
              </div>
            </Seksi>

            <Seksi judul="Tampilan Peta" hint="Kosongkan bila belum ditentukan">
              <div className="grid grid-cols-3 gap-3">
                <F label="Latitude"><Input value={form.map_lat as string} onChange={(e) => set("map_lat", e.target.value)} placeholder="3.630797" className="font-mono" /></F>
                <F label="Longitude"><Input value={form.map_lng as string} onChange={(e) => set("map_lng", e.target.value)} placeholder="117.233689" className="font-mono" /></F>
                <F label="Zoom"><Input type="number" value={form.map_zoom as string} onChange={(e) => set("map_zoom", e.target.value)} /></F>
              </div>
            </Seksi>

            <Seksi
              judul="Koreksi Rotasi (opsional)"
              hint="Isi semua atau kosongkan semua. Dipakai bila posisi backsight yang terukur RTS meleset dari posisi GNSS sebenarnya."
            >
              <div className="grid grid-cols-5 gap-3">
                <F label="Sudut (°)"><Input value={form.rotasi_deg as string} onChange={(e) => set("rotasi_deg", e.target.value)} className="font-mono" /></F>
                <F label="Pivot E"><Input value={form.pivot_e as string} onChange={(e) => set("pivot_e", e.target.value)} className="font-mono" /></F>
                <F label="Pivot N"><Input value={form.pivot_n as string} onChange={(e) => set("pivot_n", e.target.value)} className="font-mono" /></F>
                <F label="Ukur E"><Input value={form.ukur_e as string} onChange={(e) => set("ukur_e", e.target.value)} className="font-mono" /></F>
                <F label="Ukur N"><Input value={form.ukur_n as string} onChange={(e) => set("ukur_n", e.target.value)} className="font-mono" /></F>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <F label="Pivot Lat"><Input value={form.pivot_lat as string} onChange={(e) => set("pivot_lat", e.target.value)} className="font-mono" /></F>
                <F label="Pivot Lng"><Input value={form.pivot_lng as string} onChange={(e) => set("pivot_lng", e.target.value)} className="font-mono" /></F>
                <F label="Ukur Lat"><Input value={form.ukur_lat as string} onChange={(e) => set("ukur_lat", e.target.value)} className="font-mono" /></F>
                <F label="Ukur Lng"><Input value={form.ukur_lng as string} onChange={(e) => set("ukur_lng", e.target.value)} className="font-mono" /></F>
              </div>
            </Seksi>

            <Seksi judul="Lain-lain">
              <F label="Catatan">
                <textarea
                  value={form.catatan as string}
                  onChange={(e) => set("catatan", e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#303481]"
                  placeholder="Catatan kalibrasi, sumber koordinat, dsb."
                />
              </F>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={form.aktif === true} onChange={(e) => set("aktif", e.target.checked)} />
                Site aktif
              </label>
              <label className="flex w-fit cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="mt-[3px]"
                  checked={form.data_dummy === true}
                  onChange={(e) => set("data_dummy", e.target.checked)}
                />
                <span>
                  Data contoh
                  <span className="block text-[11px] text-gray-400">
                    Centang bila koordinat dan ambang di atas belum berasal dari survei.
                    Site tetap bisa dipakai, tapi diberi peringatan di seluruh aplikasi.
                  </span>
                </span>
              </label>
            </Seksi>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#303481] hover:bg-[#1f2259] text-white cursor-pointer">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Seksi({ judul, hint, children }: { judul: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-gray-500">{judul}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-gray-600">{label}</Label>
      {children}
      {hint && <span className="text-[10.5px] text-gray-400">{hint}</span>}
    </div>
  );
}
