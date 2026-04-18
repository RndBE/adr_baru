"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Pencil, ChevronLeft, ChevronRight,
  SlidersHorizontal, Plus, Loader2, X, Check, AlertCircle,
  Lock, Eye, EyeOff
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";

// =================== TYPES ===================
interface PrismaSlot {
  slot: number;
  id?: number;
  id_prisma: string;
  id_logger?: string;
  nama_prisma: string;
  status_controller?: string;
  target_height: string | number;
  HA: string;
  VA: string;
  SlopDis?: string;
  registered: boolean;
}

interface ApiResponse {
  success: boolean;
  data: PrismaSlot[];
  id_logger?: string;
  error?: string;
}

// =================== MODAL SET/EDIT ===================
function PrismaModal({
  mode,
  slot,
  onClose,
  onSuccess,
}: {
  mode: "set" | "edit";
  slot: PrismaSlot;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [namaPrisma, setNamaPrisma] = useState(
    slot.registered ? slot.nama_prisma : ""
  );
  const [targetHeight, setTargetHeight] = useState(
    slot.registered ? String(slot.target_height) : "0"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!namaPrisma.trim()) {
      setError("Nama Prisma wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const method = mode === "set" ? "POST" : "PUT";
      const body =
        mode === "set"
          ? { slot_id: slot.slot, nama_prisma: namaPrisma, target_height: targetHeight }
          : { slot_id: slot.slot, nama_prisma: namaPrisma, target_height: targetHeight };

      const res = await fetch("/api/prism-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">
              {mode === "set" ? "Set Prisma Baru" : "Edit Prisma"}
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">Slot {slot.id_prisma}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-bold text-gray-700">Nama Prisma</label>
            <Input
              value={namaPrisma}
              onChange={(e) => setNamaPrisma(e.target.value)}
              placeholder="cth: BS_1, PC_4, C1 ..."
              className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481]"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-bold text-gray-700">Target Height</label>
            <Input
              type="number"
              value={targetHeight}
              onChange={(e) => setTargetHeight(e.target.value)}
              placeholder="0"
              className="h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 h-[38px] border border-gray-300 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer bg-white"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 h-[38px] bg-[#303481] hover:bg-[#1f2259] text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer border-none"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {mode === "set" ? "Simpan" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================== MODAL AKSES KODE ===================
function AccessCodeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kontrol/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_akses: code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Kode Akses Salah");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[16px] shadow-2xl w-full max-w-[450px] mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-[20px] font-bold text-black font-sans tracking-tight">Masukkan Kode Akses</h2>
          <button onClick={onClose} className="text-black hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none mt-0.5">
            <X className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>
        </div>
        
        <p className="text-[14px] text-[#1c1c1c] font-sans mb-5 font-medium leading-relaxed">
          Masukkan kode akses untuk memulai konfigurasi
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5 text-[13px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col mb-8">
          <label className="text-[14px] font-bold text-black mb-2.5">Kode Akses</label>
          <div className="relative">
            <Lock className="w-[18px] h-[18px] text-black absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
            <Input
              type={showPassword ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pl-[42px] pr-[42px] h-[48px] text-[20px] tracking-[4px] font-bold text-black border-[#C0C4DF] rounded-[10px] bg-white focus-visible:ring-1 focus-visible:ring-[#303481]"
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:opacity-70 cursor-pointer bg-transparent border-none"
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2.5} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-[20px] mt-2">
          <button
            onClick={onClose}
            className="w-[120px] h-[42px] border border-[#303481] rounded-lg text-[14.5px] font-semibold text-[#303481] hover:bg-[#F8F9FC] transition-colors cursor-pointer bg-white"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className="w-[120px] h-[42px] bg-[#303481] hover:bg-[#20235a] text-white rounded-lg text-[14.5px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer border-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim"}
          </button>
        </div>

      </div>
    </div>
  );
}

// =================== MAIN PAGE ===================
const PAGE_SIZE = 10;

export default function PrismConfigPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [allData, setAllData] = useState<PrismaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "set" | "edit";
    slot: PrismaSlot | null;
  }>({ open: false, mode: "set", slot: null });
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  // ── Fetch data dari /api/prism-config ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prism-config");
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengambil data");
      setAllData(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filter berdasarkan search ──
  const filtered = allData.filter((row) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      row.id_prisma.toLowerCase().includes(q) ||
      row.nama_prisma.toLowerCase().includes(q)
    );
  });

  // ── Pagination ──
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const registeredCount = allData.filter((d) => d.registered).length;

  const handleModalSuccess = () => {
    setModal({ open: false, mode: "set", slot: null });
    fetchData();
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">

      {/* Sub Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shadow-inner">
            <div className="w-3.5 h-3.5 rounded-full bg-gray-800" />
          </div>
          <div className="flex flex-col">
            <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">
              Pos RTS Site MIP
            </h2>
            <p className="text-[12px] font-medium text-gray-500">Koneksi Terputus</p>
          </div>
        </div>
        <Button 
          onClick={() => setAccessModalOpen(true)}
          className="bg-[#303481] hover:bg-[#1f2259] text-white px-5 py-5 rounded-lg shadow-sm font-medium text-[13.5px] transition-colors border-none flex items-center gap-2.5 cursor-pointer"
        >
          <Image src="/mulai_konfigurasi.svg" alt="Mulai Konfigurasi" width={18} height={18} />
          Mulai Konfigurasi
        </Button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col w-full text-slate-800">

        {/* Card Header */}
        <div className="p-5 px-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 text-[15px]">Daftar Prisma</h3>
            {!loading && (
              <span className="text-[12px] text-gray-400 font-medium">
                ({registeredCount} terdaftar dari 50 slot)
              </span>
            )}
          </div>
          <div className="relative w-[320px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Cari nama/ID prisma..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-lg bg-white"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 mx-6 mt-4 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-[13px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={fetchData} className="ml-auto text-[#303481] font-bold hover:underline cursor-pointer bg-transparent border-none">
              Coba Lagi
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 border-b border-gray-100">
              <tr>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide w-[70px]">No</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">ID Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Nama Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Horizontal Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Vertical Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Target Height</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 className="w-7 h-7 animate-spin text-[#303481]" />
                      <span className="text-[13px] font-medium">Memuat data prisma...</span>
                    </div>
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 text-[13px]">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              ) : (
                pageData.map((row, idx) => {
                  const isNotSet = !row.registered;
                  const globalIdx = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr
                      key={row.id_prisma}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center text-[13px] text-gray-500 font-medium">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-[#3B82F6] text-white px-2.5 py-[3px] rounded text-[11px] font-bold tracking-wider">
                          {row.id_prisma}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400 italic" : "text-gray-800"}`}>
                        {isNotSet ? "Not Set" : row.nama_prisma}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.HA || "-")}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.VA || "-")}
                      </td>
                      <td className={`py-3.5 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                        {isNotSet ? "Not Set" : (row.target_height ?? "-")}
                      </td>
                      <td className="py-3.5 px-4 flex justify-center items-center">
                        {!isNotSet ? (
                          <button
                            onClick={() => setModal({ open: true, mode: "edit", slot: row })}
                            className="flex items-center gap-1.5 px-4 py-1.5 border border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white transition-colors rounded-md text-[12px] font-bold cursor-pointer"
                          >
                            <Pencil className="w-[12px] h-[12px]" strokeWidth={2.5} />
                            Edit
                          </button>
                        ) : (
                          <button
                            onClick={() => setModal({ open: true, mode: "set", slot: row })}
                            className="flex items-center gap-1 px-4 py-1.5 border border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white transition-colors rounded-md text-[12px] font-bold cursor-pointer"
                          >
                            <Plus className="w-[12px] h-[12px]" strokeWidth={3} />
                            Set
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-between bg-gray-100 text-slate-800">
          <p className="text-[12.5px] text-gray-500 font-medium tracking-tight">
            {loading
              ? "Memuat..."
              : `Menampilkan ${filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} - ${Math.min(currentPage * PAGE_SIZE, filtered.length)} dari ${filtered.length} data`}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setCurrentPage(1); setSearchTerm(""); }}
              className="text-[12.5px] font-bold text-[#303481] hover:underline cursor-pointer transition-colors bg-transparent border-none"
            >
              Lihat Semua
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-[12.5px] font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? "bg-[#303481] text-white border-none"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Set / Edit Prisma */}
      {modal.open && modal.slot && (
        <PrismaModal
          mode={modal.mode}
          slot={modal.slot}
          onClose={() => setModal({ open: false, mode: "set", slot: null })}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Modal Kode Akses */}
      {accessModalOpen && (
        <AccessCodeModal 
          onClose={() => setAccessModalOpen(false)}
          onSuccess={() => {
            setAccessModalOpen(false);
            // Optionally refresh state or do something else after success
            alert("Sistem berhasil dikonfigurasi.");
          }}
        />
      )}
    </div>
  );
}
