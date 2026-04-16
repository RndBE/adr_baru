"use client";

import React, { useState } from "react";
import { Search, Pencil, ChevronLeft, ChevronRight, SlidersHorizontal, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const dummyPrismData = [
  { id: 1, pId: "P1", name: "BS_1", hAngle: "000,00,02", vAngle: "087,57,12", tHeight: "0" },
  { id: 2, pId: "P1", name: "PC_4", hAngle: "042,12,01", vAngle: "086,41,28", tHeight: "0" },
  { id: 3, pId: "P1", name: "C1", hAngle: "070,51,12", vAngle: "079,26,12", tHeight: "0" },
  { id: 4, pId: "P1", name: "C2", hAngle: "049,37,51", vAngle: "078,02,40", tHeight: "0" },
  { id: 5, pId: "P1", name: "C3", hAngle: "026,20,40", vAngle: "078,20,56", tHeight: "0" },
  { id: 6, pId: "P1", name: "C4", hAngle: "007,13,52", vAngle: "080,00,50", tHeight: "0" },
  { id: 7, pId: "P1", name: "Not Set", hAngle: "Not Set", vAngle: "Not Set", tHeight: "Not Set" },
  { id: 8, pId: "P1", name: "Not Set", hAngle: "Not Set", vAngle: "Not Set", tHeight: "Not Set" },
  { id: 9, pId: "P1", name: "Not Set", hAngle: "Not Set", vAngle: "Not Set", tHeight: "Not Set" },
  { id: 10, pId: "P1", name: "Not Set", hAngle: "Not Set", vAngle: "Not Set", tHeight: "Not Set" },
];

export default function PrismConfigPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* Sub Header Section */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shadow-inner">
            <div className="w-3.5 h-3.5 rounded-full bg-gray-800"></div>
          </div>
          <div className="flex flex-col">
            <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">Pos RTS Site MIP</h2>
            <p className="text-[12px] font-semibold text-gray-500">Koneksi Terputus</p>
          </div>
        </div>
        
        {/* Action Button */}
        <Button className="bg-[#303481] hover:bg-[#1f2259] text-white px-5 py-5 rounded-lg shadow-sm font-medium text-[13.5px] transition-colors border-none flex items-center gap-2 cursor-pointer">
          <SlidersHorizontal className="w-[16px] h-[16px]" strokeWidth={2.5} />
          Mulai Konfigurasi
        </Button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col w-full text-slate-800">
        
        {/* Card Header */}
        <div className="p-5 px-6 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-[15px]">Daftar Prisma</h3>
          
          {/* Search Box */}
          <div className="relative w-[320px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Cari ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-[38px] text-[13px] border-gray-300 focus-visible:ring-[#303481] rounded-lg bg-white"
            />
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#FAFAFB] border-b border-gray-100">
              <tr>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide w-[80px]">No</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">ID Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Nama Prisma</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Horizontal Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Vertical Angle</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Target Height</th>
                <th className="py-3.5 px-4 text-center font-bold text-gray-600 text-[12px] tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dummyPrismData.map((row, idx) => {
                const isNotSet = row.name === "Not Set";
                return (
                  <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-center text-[13px] text-gray-500 font-medium">
                      {row.id}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-[#3B82F6] text-white px-2.5 py-[3px] rounded mb-0 text-[11px] font-bold tracking-wider">
                        {row.pId}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                      {row.name}
                    </td>
                    <td className={`py-3 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                      {row.hAngle}
                    </td>
                    <td className={`py-3 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                      {row.vAngle}
                    </td>
                    <td className={`py-3 px-4 text-center text-[13px] font-medium ${isNotSet ? "text-gray-400" : "text-gray-700"}`}>
                      {row.tHeight}
                    </td>
                    <td className="py-3 px-4 flex justify-center items-center">
                      {!isNotSet ? (
                        <button className="flex items-center gap-1.5 px-4 py-1.5 border border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white transition-colors rounded-md text-[12px] font-bold cursor-pointer">
                          <Pencil className="w-[12px] h-[12px]" strokeWidth={2.5} />
                          Edit
                        </button>
                      ) : (
                        <button className="flex items-center gap-1 px-4 py-1.5 border border-[#303481] text-[#303481] hover:bg-[#303481] hover:text-white transition-colors rounded-md text-[12px] font-bold cursor-pointer">
                          <Plus className="w-[12px] h-[12px]" strokeWidth={3} />
                          Set
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-between bg-white text-slate-800">
          <p className="text-[12.5px] text-gray-500 font-medium tracking-tight">
            Menampilkan 1 - 10 dari 50 data
          </p>
          <div className="flex items-center gap-4">
            <button className="text-[12.5px] font-bold text-[#303481] hover:underline cursor-pointer transition-colors bg-transparent border-none">
              Lihat Semua
            </button>
            <div className="flex items-center gap-1.5">
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded bg-[#303481] text-white font-bold text-[12.5px] border-none cursor-pointer">
                1
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-700 font-bold text-[12.5px] hover:bg-gray-50 hover:text-gray-900 transition-colors bg-white cursor-pointer">
                2
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-700 font-bold text-[12.5px] hover:bg-gray-50 hover:text-gray-900 transition-colors bg-white cursor-pointer">
                3
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors bg-white cursor-pointer group">
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
