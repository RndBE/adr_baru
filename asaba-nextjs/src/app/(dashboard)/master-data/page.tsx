"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, MapPin, Users, Radio, Layers, KeyRound, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TabSite } from "@/components/master-data/tab-site";
import { TabKodeAkses } from "@/components/master-data/tab-kode-akses";

// Simple toast helper
const toast = { success: (msg: string) => console.log("✅", msg), error: (msg: string) => alert(msg) };

// ─── Types ─────────────────────────────────────────────────────────────────

type Lokasi = { idlokasi: number; nama_lokasi: string; latitude: string; longitude: string };
type UserData = { id_user: number; nama: string; username: string; level_user: string; alamat: string; telp: string; instansi?: string; bidang?: string };
type LoggerData = { id: number; id_logger: string; nama_logger: string; lokasi_logger: string; kategori_log: string; tabel: string; nama_lokasi?: string; nama_kategori?: string };
type KategoriLogger = { id_katlogger: number; nama_kategori: string; tabel: string };

const TABS = [
  { key: "site", label: "Site", icon: Layers },
  { key: "lokasi", label: "Lokasi", icon: MapPin },
  { key: "user", label: "User", icon: Users },
  { key: "logger", label: "Logger", icon: Radio },
  { key: "kode-akses", label: "Kode Akses", icon: KeyRound },
] as const;
type TabKey = typeof TABS[number]["key"];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("site");

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-white">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Master Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kelola data Site, Lokasi, User, Logger, dan Kode Akses</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#EAEAEA]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "border-[#303481] text-[#303481]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "site" && <TabSite />}
        {activeTab === "lokasi" && <TabLokasi />}
        {activeTab === "user" && <TabUser />}
        {activeTab === "logger" && <TabLogger />}
        {activeTab === "kode-akses" && <TabKodeAkses />}
      </div>
    </div>
  );
}

// ─── TAB LOKASI ─────────────────────────────────────────────────────────────

function TabLokasi() {
  const [data, setData] = useState<Lokasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lokasi | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nama_lokasi: "", latitude: "", longitude: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lokasi").then(r => r.json());
    if (res.success) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ nama_lokasi: "", latitude: "", longitude: "" }); setOpen(true); };
  const openEdit = (row: Lokasi) => { setEditing(row); setForm({ nama_lokasi: row.nama_lokasi, latitude: row.latitude, longitude: row.longitude }); setOpen(true); };

  const handleSave = async () => {
    if (!form.nama_lokasi.trim()) return toast.error("Nama lokasi wajib diisi");
    setSaving(true);
    try {
      const url = editing ? `/api/lokasi/${editing.idlokasi}` : "/api/lokasi";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json());
      if (res.success) { toast.success(editing ? "Lokasi diperbarui" : "Lokasi ditambahkan"); setOpen(false); load(); }
      else toast.error(res.error || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Lokasi) => {
    if (!confirm(`Hapus lokasi "${row.nama_lokasi}"?`)) return;
    const res = await fetch(`/api/lokasi/${row.idlokasi}`, { method: "DELETE" }).then(r => r.json());
    if (res.success) { toast.success("Lokasi dihapus"); load(); }
    else toast.error(res.error || "Gagal menghapus");
  };

  return (
    <>
      <CrudCard title="Data Lokasi" onAdd={openAdd}>
        {loading ? <LoadingRow cols={4} /> : (
          <Table>
            <TableHeader className="bg-[#F5F6FA]">
              <TableRow>
                <TableHead className="w-12 text-xs font-bold text-gray-500">#</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">NAMA LOKASI</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">LATITUDE</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">LONGITUDE</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? <EmptyRow cols={5} /> : data.map((row, i) => (
                <TableRow key={row.idlokasi} className="hover:bg-gray-50 border-b border-[#F0F0F0]">
                  <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium text-gray-800">{row.nama_lokasi}</TableCell>
                  <TableCell className="text-xs text-gray-600 font-mono">{row.latitude}</TableCell>
                  <TableCell className="text-xs text-gray-600 font-mono">{row.longitude}</TableCell>
                  <TableCell className="text-right">
                    <ActionButtons onEdit={() => openEdit(row)} onDelete={() => handleDelete(row)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CrudCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lokasi" : "Tambah Lokasi"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Field label="Nama Lokasi *">
              <Input value={form.nama_lokasi} onChange={e => setForm(f => ({ ...f, nama_lokasi: e.target.value }))} placeholder="Contoh: Site MIP" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-6.123456" />
              </Field>
              <Field label="Longitude">
                <Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="106.123456" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#303481] hover:bg-[#1f2259] text-white cursor-pointer">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── TAB USER ───────────────────────────────────────────────────────────────

const LEVEL_OPTIONS = ["admin", "operator", "viewer"];

function TabUser() {
  const [data, setData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nama: "", username: "", password: "", level_user: "operator", alamat: "", telp: "", instansi: "", bidang: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users").then(r => r.json());
    if (res.success) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ nama: "", username: "", password: "", level_user: "operator", alamat: "", telp: "", instansi: "", bidang: "" });
    setOpen(true);
  };
  const openEdit = (row: UserData) => {
    setEditing(row);
    setForm({ nama: row.nama, username: row.username, password: "", level_user: row.level_user, alamat: row.alamat, telp: row.telp, instansi: row.instansi || "", bidang: row.bidang || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nama || !form.username || !form.level_user) return toast.error("nama, username, level wajib diisi");
    if (!editing && !form.password) return toast.error("Password wajib diisi untuk user baru");
    setSaving(true);
    try {
      const url = editing ? `/api/users/${editing.id_user}` : "/api/users";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json());
      if (res.success) { toast.success(editing ? "User diperbarui" : "User ditambahkan"); setOpen(false); load(); }
      else toast.error(res.error || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: UserData) => {
    if (!confirm(`Hapus user "${row.nama}"?`)) return;
    const res = await fetch(`/api/users/${row.id_user}`, { method: "DELETE" }).then(r => r.json());
    if (res.success) { toast.success("User dihapus"); load(); }
    else toast.error(res.error || "Gagal menghapus");
  };

  return (
    <>
      <CrudCard title="Data User" onAdd={openAdd}>
        {loading ? <LoadingRow cols={5} /> : (
          <Table>
            <TableHeader className="bg-[#F5F6FA]">
              <TableRow>
                <TableHead className="w-12 text-xs font-bold text-gray-500">#</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">NAMA</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">USERNAME</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">LEVEL</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">TELP</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">INSTANSI</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? <EmptyRow cols={7} /> : data.map((row, i) => (
                <TableRow key={row.id_user} className="hover:bg-gray-50 border-b border-[#F0F0F0]">
                  <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium text-gray-800">{row.nama}</TableCell>
                  <TableCell className="text-xs text-gray-600 font-mono">{row.username}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.level_user === "admin" ? "bg-purple-100 text-purple-700" : row.level_user === "operator" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {row.level_user}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{row.telp || "-"}</TableCell>
                  <TableCell className="text-xs text-gray-600">{row.instansi || "-"}</TableCell>
                  <TableCell className="text-right">
                    <ActionButtons onEdit={() => openEdit(row)} onDelete={() => handleDelete(row)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CrudCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama *"><Input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap" /></Field>
              <Field label="Username *"><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" autoComplete="off" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={editing ? "Password (kosongkan jika tidak diubah)" : "Password *"}>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="Level *">
                <Select value={form.level_user} onValueChange={v => setForm(f => ({ ...f, level_user: v as string }))}>
                  <SelectTrigger className="h-9 text-sm border-[#D1D5DB] cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telp"><Input value={form.telp} onChange={e => setForm(f => ({ ...f, telp: e.target.value }))} placeholder="08xx" /></Field>
              <Field label="Instansi"><Input value={form.instansi} onChange={e => setForm(f => ({ ...f, instansi: e.target.value }))} placeholder="Nama instansi" /></Field>
            </div>
            <Field label="Alamat"><Input value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} placeholder="Alamat" /></Field>
            <Field label="Bidang"><Input value={form.bidang} onChange={e => setForm(f => ({ ...f, bidang: e.target.value }))} placeholder="Bidang pekerjaan" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#303481] hover:bg-[#1f2259] text-white cursor-pointer">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── TAB LOGGER ─────────────────────────────────────────────────────────────

function TabLogger() {
  const [data, setData] = useState<LoggerData[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriLogger[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoggerData | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id_logger: "", nama_logger: "", lokasi_logger: "", kategori_log: "", tabel: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [logRes, lokRes, katRes] = await Promise.all([
      fetch("/api/loggers").then(r => r.json()),
      fetch("/api/lokasi").then(r => r.json()),
      fetch("/api/master-data/kategori").then(r => r.json()).catch(() => ({ success: false, data: [] })),
    ]);
    if (logRes.success) setData(logRes.data as LoggerData[]);
    if (lokRes.success) setLokasiList(lokRes.data);
    if (katRes.success) setKategoriList(katRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ id_logger: "", nama_logger: "", lokasi_logger: "", kategori_log: "", tabel: "" }); setOpen(true); };
  const openEdit = (row: LoggerData) => { setEditing(row); setForm({ id_logger: row.id_logger, nama_logger: row.nama_logger, lokasi_logger: String(row.lokasi_logger), kategori_log: String(row.kategori_log), tabel: row.tabel }); setOpen(true); };

  const handleSave = async () => {
    if (!form.id_logger || !form.nama_logger || !form.lokasi_logger || !form.kategori_log || !form.tabel) return toast.error("Semua field wajib diisi");
    setSaving(true);
    try {
      const url = editing ? `/api/loggers/${editing.id}` : "/api/loggers";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json());
      if (res.success) { toast.success(editing ? "Logger diperbarui" : "Logger ditambahkan"); setOpen(false); load(); }
      else toast.error(res.error || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: LoggerData) => {
    if (!confirm(`Hapus logger "${row.nama_logger}"?`)) return;
    const res = await fetch(`/api/loggers/${row.id}`, { method: "DELETE" }).then(r => r.json());
    if (res.success) { toast.success("Logger dihapus"); load(); }
    else toast.error(res.error || "Gagal menghapus");
  };

  return (
    <>
      <CrudCard title="Data Logger" onAdd={openAdd}>
        {loading ? <LoadingRow cols={6} /> : (
          <Table>
            <TableHeader className="bg-[#F5F6FA]">
              <TableRow>
                <TableHead className="w-12 text-xs font-bold text-gray-500">#</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">ID LOGGER</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">NAMA LOGGER</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">LOKASI</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">KATEGORI</TableHead>
                <TableHead className="text-xs font-bold text-gray-500">TABEL</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? <EmptyRow cols={7} /> : data.map((row, i) => (
                <TableRow key={row.id} className="hover:bg-gray-50 border-b border-[#F0F0F0]">
                  <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                  <TableCell className="text-xs font-mono font-semibold text-[#303481]">{row.id_logger}</TableCell>
                  <TableCell className="text-sm font-medium text-gray-800">{row.nama_logger}</TableCell>
                  <TableCell className="text-xs text-gray-600">{(row as any).nama_lokasi || row.lokasi_logger}</TableCell>
                  <TableCell className="text-xs text-gray-600">{(row as any).nama_kategori || row.kategori_log}</TableCell>
                  <TableCell className="text-xs font-mono text-gray-600">{row.tabel}</TableCell>
                  <TableCell className="text-right">
                    <ActionButtons onEdit={() => openEdit(row)} onDelete={() => handleDelete(row)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CrudCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Logger" : "Tambah Logger"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID Logger *"><Input value={form.id_logger} onChange={e => setForm(f => ({ ...f, id_logger: e.target.value }))} placeholder="cth: RTS01" disabled={!!editing} /></Field>
              <Field label="Nama Logger *"><Input value={form.nama_logger} onChange={e => setForm(f => ({ ...f, nama_logger: e.target.value }))} placeholder="Nama logger" /></Field>
            </div>
            <Field label="Lokasi *">
              <Select value={form.lokasi_logger} onValueChange={v => setForm(f => ({ ...f, lokasi_logger: v as string }))}>
                <SelectTrigger className="h-9 text-sm border-[#D1D5DB] cursor-pointer"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                <SelectContent>
                  {lokasiList.map(l => <SelectItem key={l.idlokasi} value={String(l.idlokasi)}>{l.nama_lokasi}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Kategori *">
              {kategoriList.length > 0 ? (
                <Select value={form.kategori_log} onValueChange={v => { const kat = kategoriList.find(k => String(k.id_katlogger) === v); setForm(f => ({ ...f, kategori_log: v as string, tabel: (kat ? kat.tabel : f.tabel) as string })); }}>
                  <SelectTrigger className="h-9 text-sm border-[#D1D5DB] cursor-pointer"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {kategoriList.map(k => <SelectItem key={k.id_katlogger} value={String(k.id_katlogger)}>{k.nama_kategori}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.kategori_log} onChange={e => setForm(f => ({ ...f, kategori_log: e.target.value }))} placeholder="ID Kategori (angka)" />
              )}
            </Field>
            <Field label="Tabel *"><Input value={form.tabel} onChange={e => setForm(f => ({ ...f, tabel: e.target.value }))} placeholder="cth: rts" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#303481] hover:bg-[#1f2259] text-white cursor-pointer">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function CrudCard({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
        <h2 className="text-[14.5px] font-bold text-gray-900">{title}</h2>
        <Button onClick={onAdd} className="bg-[#303481] hover:bg-[#1f2259] text-white h-9 px-4 text-sm rounded-lg cursor-pointer flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 cursor-pointer transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 cursor-pointer transition-colors" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function LoadingRow({ cols }: { cols: number }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-[#303481]" />
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center text-gray-400 text-sm">Tidak ada data</TableCell>
    </TableRow>
  );
}
