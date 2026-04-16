"use client";

import React, { useState } from "react";
import { 
  History, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Box as BoxIcon, 
  Table as TableIcon, 
  Map as MapIcon, 
  Filter 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const dummyRuns = [
  { id: 1, date: "30-03-2026 16:06", badge1: "CPP 3", badge1Color: "bg-[#4285F4]", badge2: "", active: true },
  { id: 2, date: "30-03-2026 16:06", badge1: "CPP 3", badge1Color: "bg-[#4285F4]", badge2: "", active: false },
  { id: 3, date: "30-03-2026 16:06", badge1: "CPP 3", badge1Color: "bg-[#4285F4]", badge2: "", active: false },
  { id: 4, date: "30-03-2026 16:06", badge1: "CPP 3", badge1Color: "bg-[#4285F4]", badge2: "", active: false },
  { id: 5, date: "30-03-2026 16:06", badge1: "CPP 3", badge1Color: "bg-[#4285F4]", badge2: "R0", badge2Color: "bg-[#6B7280]", active: false },
  { id: 6, date: "30-03-2026 16:06", badge1: "VP", badge1Color: "bg-[#F97316]", badge2: "", active: false },
  { id: 7, date: "30-03-2026 16:06", badge1: "VP", badge1Color: "bg-[#F97316]", badge2: "", active: false },
  { id: 8, date: "30-03-2026 16:06", badge1: "VP", badge1Color: "bg-[#F97316]", badge2: "", active: false },
  { id: 9, date: "30-03-2026 16:06", badge1: "VP", badge1Color: "bg-[#F97316]", badge2: "", active: false },
];

const dummyTableData = [
  { id: "", y: "401306.514", z: "63.8350", ha: "359,59,35", va: "087,57,30", sd: "35.7696", dx: "0.012", dy: "0.012", dz: "0.012", lin: "0.01", arah: "344 (Utara)" },
  ...Array(9).fill({ id: "436", y: "401324.75945021", z: "81.1777", ha: "353,57,16", va: "086,38,37", sd: "222.9413", dx: "-0.008", dy: "-0.008", dz: "-0.008", lin: "0.02", arah: "306 (Barat Laut)" })
];

export default function HasilPengukuranPage() {
  const [activeTab, setActiveTab] = useState("Event");
  const [activeView, setActiveView] = useState("Tabel");

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* Sub Header Section */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center shadow-inner">
          <div className="w-3.5 h-3.5 rounded-full bg-gray-800"></div>
        </div>
        <div className="flex flex-col">
          <h2 className="font-extrabold text-[#1f2937] text-[18px] leading-tight">Pos RTS Site MIP</h2>
          <p className="text-[12px] font-medium text-gray-500">Koneksi Terputus</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">
        
        {/* Left Column: Tanggal Running */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-[15px]">Tanggal Running</h3>
            <History className="w-[18px] h-[18px] text-gray-500" />
          </div>
          {/* List */}
          <div className="flex flex-col">
            {dummyRuns.map((run, idx) => (
              <div 
                key={run.id} 
                className={`py-3.5 px-5 border-b border-gray-100 flex items-center gap-2 cursor-pointer transition-colors
                  ${run.active ? 'bg-[#FAFBFF] border-l-4 border-l-[#4285F4]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
              >
                <span className="text-[13px] text-gray-800 font-medium">{run.date}</span>
                {run.badge1 && (
                  <span className={`px-2 py-[2px] rounded text-white text-[10px] font-bold leading-tight ${run.badge1Color}`}>
                    {run.badge1}
                  </span>
                )}
                {run.badge2 && (
                  <span className={`px-2 py-[2px] rounded text-white text-[10px] font-bold leading-tight ${run.badge2Color}`}>
                    {run.badge2}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Pagination Tanggal */}
          <div className="py-4 flex justify-center border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors bg-white cursor-pointer group">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded bg-[#303481] text-white font-bold text-[12.5px] border-none cursor-pointer">
                1
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-700 font-bold text-[12.5px] hover:bg-gray-50 transition-colors bg-white cursor-pointer">
                2
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-700 font-bold text-[12.5px] hover:bg-gray-50 transition-colors bg-white cursor-pointer">
                3
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors bg-white cursor-pointer group">
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Data Prisma */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header Row */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-[16px]">Data Prisma</h3>
            <div className="flex gap-3">
              <Button variant="outline" className="h-[38px] px-5 border-[#2E7D32] text-[#2E7D32] font-semibold text-[13px] rounded-lg hover:bg-[#E8F5E9] hover:text-[#2E7D32]">
                <Download className="w-[15px] h-[15px] mr-1.5" strokeWidth={2.5} />
                Download Excel
              </Button>
              <Button className="h-[38px] px-5 bg-[#303481] hover:bg-[#1f2259] text-white font-semibold text-[13px] rounded-lg border-none">
                <BoxIcon className="w-[15px] h-[15px] mr-1.5" strokeWidth={2.5} />
                Buka 3D
              </Button>
            </div>
          </div>

          {/* Tabs Row */}
          <div className="px-6 pt-3 flex gap-8 border-b border-gray-200">
            <button 
              className={`pb-3 text-[14px] font-bold border-b-4 transition-colors ${activeTab === "Event" ? "border-[#303481] text-[#303481]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
              onClick={() => setActiveTab("Event")}
            >
              Event
            </button>
            <button 
              className={`pb-3 text-[14px] font-bold border-b-4 transition-colors ${activeTab === "Harian" ? "border-[#303481] text-[#303481]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
              onClick={() => setActiveTab("Harian")}
            >
              Harian
            </button>
          </div>

          {/* Toolbar Control */}
          <div className="px-6 py-4 flex flex-wrap items-center gap-5">
            {/* View Segmented Control */}
            <div className="flex rounded-lg overflow-hidden border border-[#EAEAEA] shadow-sm">
              <button 
                onClick={() => setActiveView("Tabel")}
                className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-colors ${activeView === "Tabel" ? "bg-[#303481] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                <TableIcon className="w-4 h-4" /> Tabel
              </button>
              <button 
                onClick={() => setActiveView("Peta")}
                className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-colors ${activeView === "Peta" ? "bg-[#303481] text-white" : "bg-white text-gray-600 border-l border-[#EAEAEA] hover:bg-gray-50"}`}
              >
                <MapIcon className="w-4 h-4" /> Peta
              </button>
            </div>
            
            {/* Filter */}
            <Button variant="outline" className="h-[38px] border-[#EAEAEA] text-gray-700 font-bold text-[13px] shadow-sm">
              <Filter className="w-4 h-4 mr-2" /> Filter
            </Button>

            {/* Info Badges */}
            <div className="flex items-center gap-4 ml-auto lg:ml-0">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                Date Selected
                <span className="px-3 py-1 bg-[#303481] text-white rounded-md text-[11.5px] font-bold tracking-wider relative top-[0.5px]">
                  30-03-2026 16:06
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                Total Prism :
                <span className="w-[28px] h-[22px] flex items-center justify-center bg-[#303481] text-white rounded-full text-[11.5px] font-bold">
                  10
                </span>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-center border-collapse min-w-[1000px]">
              <thead className="bg-[#FAFAFB]">
                {/* Header Top Level */}
                <tr>
                  <th rowSpan={2} className="w-[50px] border-b border-gray-100"></th>
                  <th colSpan={5} className="py-3 px-2 border-b border-gray-100 font-bold text-gray-600 text-[12.5px] tracking-wide">
                    Hasil Pengukuran
                  </th>
                  <th colSpan={4} className="py-3 px-2 border-b border-l border-gray-100 font-bold text-gray-600 text-[12.5px] tracking-wide bg-[#F4F5F7]/30">
                    Pergeseran
                  </th>
                  <th rowSpan={2} className="py-3 px-4 border-b border-l border-gray-100 font-bold text-gray-600 text-[12.5px] tracking-wide w-[180px]">
                    Arah<br/>Pergeseran
                  </th>
                </tr>
                {/* Header Second Level */}
                <tr>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px]">Y</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px]">Z</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px]">HA</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px]">VA</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px]">Slope Distance</th>
                  <th className="py-2.5 px-3 border-b border-l border-gray-100 font-bold text-gray-600 text-[12.5px] bg-[#F4F5F7]/30">ΔX</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px] bg-[#F4F5F7]/30">ΔY</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px] bg-[#F4F5F7]/30">ΔZ</th>
                  <th className="py-2.5 px-3 border-b border-gray-100 font-bold text-gray-600 text-[12.5px] bg-[#F4F5F7]/30">Linier</th>
                </tr>
              </thead>
              <tbody>
                {dummyTableData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-3 text-[13px] text-gray-600 font-medium">
                      {row.id}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.y}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.z}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.ha}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.va}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.sd}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium border-l border-gray-100">
                      {row.dx}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.dy}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.dz}
                    </td>
                    <td className="py-3.5 px-3 text-[13px] text-gray-700 font-medium">
                      {row.lin}
                    </td>
                    <td className="py-3.5 px-4 text-[13px] text-gray-700 font-medium border-l border-gray-100">
                      {row.arah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Scrollbar placeholder info or custom styling could go here, 
              but it mostly relies on browser's overflow-x-auto */}
          <div className="h-4 bg-gray-50 border-t border-gray-100 w-full rounded-b-xl hidden"></div>
        </div>
      </div>
    </div>
  );
}
