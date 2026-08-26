"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type StatusKode = "aktif" | "belum-berlaku" | "kedaluwarsa";

type KodeAksesRow = {
  id: number;
  id_user: number;
  nama_user: string | null;
  username: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: StatusKode;
};

type UserRow = { id_user: number; nama: string; username: string };

const BADGE: Record<StatusKode, { label: string; kelas: string }> = {
  aktif: { label: "Aktif", kelas: "bg-emerald-100 text-emerald-700" },
  "belum-berlaku": { label: "Belum berlaku", kelas: "bg-blue-100 text-blue-700" },
  kedaluwarsa: { label: "Kedaluwarsa", kelas: "bg-red-100 text-red-700" },
};

/** Tanggal hari ini dalam format input date. */
function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtTanggal(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}-${m}-${y}` : iso;
}

const KOSONG = { id_user: "", kode: "", tanggal_mulai: hariIni(), tanggal_selesai: "" };

export function TabKodeAkses() {
  const [data, setData] = useState<KodeAksesRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KodeAksesRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lihatKode, setLihatKode] = useState(false);
  const [form, setForm] = useState({ ...KOSONG });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, u] = await Promise.all([
        fetch("/api/kode-akses").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ]);
      if (k.success) setData(k.data);
      if (u.success) setUsers(u.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...KOSONG, id_user: users[0] ? String(users[0].id_user) : "" });
    setError(null);
    setLihatKode(false);
    setOpen(true);
  };

  const openEdit = (row: KodeAksesRow) => {
    setEditing(row);
    setForm({
      id_user: String(row.id_user),
      // Kosong = pertahankan kode lama. Kode aslinya tidak tersimpan, hanya
      // hash-nya, jadi tidak ada yang bisa ditampilkan di sini.
      kode: "",
      tanggal_mulai: row.tanggal_mulai,
      tanggal_selesai: row.tanggal_selesai,
    });
    setError(null);
    setLihatKode(false);
    setOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const url = editing ? `/api/kode-akses/${editing.id}` : "/api/kode-akses";
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

  const handleDelete = async (row: KodeAksesRow) => {
    if (!confirm(`Hapus kode akses milik ${row.nama_user ?? "user " + row.id_user}?`)) return;
    const res = await fetch(`/api/kode-akses/${row.id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) load();
    else alert(res.error || "Gagal menghapus");
  };

  const takBerlaku = data.filter((k) => k.status !== "aktif");
  const adaAktif = data.some((k) => k.status === "aktif");

  return (
    <>
      {!loading && !adaAktif && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <div className="text-[12.5px] leading-relaxed text-red-900">
            <span className="font-bold">Tidak ada kode akses yang berlaku hari ini.</span>{" "}
            Selama begini, kontrol RTS tidak bisa dijalankan siapa pun — perbarui masa
            berlakunya atau tambahkan kode baru.
          </div>
        </div>
      )}

      {!loading && adaAktif && takBerlaku.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            {takBerlaku.length} kode akses sedang tidak berlaku (kedaluwarsa atau belum
            mulai). Kode tersebut ditolak saat dipakai.
          </div>
        </div>
      )}

      <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
          <div>
            <h2 className="text-[14.5px] font-bold text-gray-900">Kode Akses</h2>
            <p className="mt-0.5 text-[11.5px] text-gray-500">
              Membuka perintah kontrol RTS di halaman Kontrol ADR dan Prism Config
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
                  <TableHead className="text-xs font-bold text-gray-500">PEMILIK</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">KODE</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">BERLAKU</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500">STATUS</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 text-right">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-400 text-sm">
                      Belum ada kode akses
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, i) => (
                    <TableRow key={row.id} className="hover:bg-gray-50 border-b border-[#F0F0F0]">
                      <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-800">
                          {row.nama_user ?? `User ${row.id_user}`}
                        </div>
                        {row.username && (
                          <div className="text-[11px] text-gray-400">{row.username}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Kode aslinya tidak tersimpan — hanya hash-nya. Tidak
                            ada yang bisa ditampilkan, dan itu memang disengaja. */}
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-400">
                          <KeyRound className="h-3.5 w-3.5" /> tersimpan terenkripsi
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {fmtTanggal(row.tanggal_mulai)} — {fmtTanggal(row.tanggal_selesai)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-[2px] text-[10px] font-bold ${BADGE[row.status].kelas}`}>
                          {BADGE[row.status].label}
                        </span>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Kode Akses" : "Tambah Kode Akses"}</DialogTitle>
            <DialogDescription className="text-[12px]">
              {editing
                ? "Kode lama tidak bisa ditampilkan — hanya hash-nya yang tersimpan. Kosongkan kolom Kode bila tidak ingin menggantinya."
                : "Kode disimpan dalam bentuk hash dan tidak bisa dibaca kembali. Catat kodenya sekarang."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-gray-600">Pemilik *</Label>
              <select
                value={form.id_user}
                onChange={(e) => set("id_user", e.target.value)}
                className="h-9 cursor-pointer rounded-md border border-gray-200 px-3 text-[13px] outline-none focus:border-[#303481]"
              >
                <option value="">— Pilih user —</option>
                {users.map((u) => (
                  <option key={u.id_user} value={u.id_user}>
                    {u.nama} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-gray-600">
                {editing ? "Kode Baru (kosongkan bila tidak diganti)" : "Kode Akses *"}
              </Label>
              <div className="relative">
                <Input
                  type={lihatKode ? "text" : "password"}
                  value={form.kode}
                  onChange={(e) => set("kode", e.target.value)}
                  placeholder={editing ? "biarkan kosong" : "minimal 4 karakter"}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setLihatKode((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  title={lihatKode ? "Sembunyikan" : "Tampilkan"}
                >
                  {lihatKode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-gray-600">Berlaku Mulai *</Label>
                <Input type="date" value={form.tanggal_mulai} onChange={(e) => set("tanggal_mulai", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-gray-600">Berlaku Sampai *</Label>
                <Input type="date" value={form.tanggal_selesai} onChange={(e) => set("tanggal_selesai", e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              Di luar rentang ini kode akan ditolak saat dipakai menjalankan kontrol.
            </p>
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
