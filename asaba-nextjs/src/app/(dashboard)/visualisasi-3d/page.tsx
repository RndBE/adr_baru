"use client";

import React, { useState } from "react";
import { 
  History, 
  Target, 
  Sliders, 
  Crosshair, 
  Play, 
  ChevronDown, 
  Maximize,
  Camera,
  ZoomIn,
  Move,
  RefreshCw,
  Home,
  Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Visualisasi3DPage() {
  const [coneScale, setConeScale] = useState("0,2");
  const [threshold, setThreshold] = useState("0,0008");

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        
        {/* Left Column: Form & Status */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* Card 1: Form Input */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm p-6 flex flex-col gap-6">
            
            {/* Waktu Pengukuran */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <History className="w-[15px] h-[15px]" strokeWidth={2.5} />
                <h3 className="font-bold text-[12px] tracking-widest uppercase">WAKTU PENGUKURAN</h3>
              </div>
              <div className="relative cursor-pointer">
                <select className="w-full appearance-none bg-white border border-gray-300 text-gray-800 text-[13.5px] rounded-md px-4 py-2.5 font-medium outline-none focus:border-[#303481] cursor-pointer">
                  <option>21/11/2025 10:06:35 (CPP3)</option>
                  <option>21/11/2025 09:00:00 (CPP2)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Referensi RTS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <Target className="w-[15px] h-[15px]" strokeWidth={2.5} />
                <h3 className="font-bold text-[12px] tracking-widest uppercase">REFERENSI RTS</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold text-gray-800">Easting (E)</label>
                  <Input 
                    type="number" 
                    defaultValue="525952" 
                    className="h-[38px] text-[13px] font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold text-gray-800">Northing (N)</label>
                  <Input 
                    type="number" 
                    defaultValue="401320.988" 
                    className="h-[38px] text-[13px] font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold text-gray-800">Elevation (Z)</label>
                  <Input 
                    type="number" 
                    defaultValue="62.559" 
                    className="h-[38px] text-[13px] font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Pengaturan Visualisasi */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#303481]">
                <Sliders className="w-[15px] h-[15px]" strokeWidth={2.5} />
                <h3 className="font-bold text-[12px] tracking-widest uppercase">PENGATURAN VISUALISASI</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold text-gray-800">Cone Scale</label>
                  <Input 
                    type="text" 
                    value={coneScale} 
                    onChange={(e) => setConeScale(e.target.value)}
                    className="h-[38px] text-[13px] font-medium text-[#303481] bg-[#F8F9FA] border-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold text-gray-800">Threshold Linear</label>
                  <Input 
                    type="text" 
                    value={threshold} 
                    onChange={(e) => setThreshold(e.target.value)}
                    className="h-[38px] text-[13px] font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Render Button */}
            <Button className="w-full h-[42px] bg-[#303481] hover:bg-[#1f2259] text-white font-bold text-[13.5px] mt-1 shadow-sm rounded-lg flex items-center justify-center gap-2">
              <Play className="w-[14px] h-[14px] fill-white" />
              Load & Render 3D
            </Button>
            
          </div>

          {/* Card 2: Status Render */}
          <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#303481] mb-2">
              <Crosshair className="w-[15px] h-[15px]" strokeWidth={2.5} />
              <h3 className="font-bold text-[12px] tracking-widest uppercase">STATUS RENDER</h3>
            </div>
            
            <div className="flex flex-col gap-3.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-semibold text-gray-600">Waktu Data</span>
                <span className="font-bold text-gray-800">21-11-2025 10:06:35</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-semibold text-gray-600">Prisma Terbaca</span>
                <span className="font-bold text-gray-800">10</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-semibold text-gray-600">Shot Valid</span>
                <span className="font-bold text-[#16A34A]">10 / 10</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-semibold text-gray-600">Shot Gagal</span>
                <span className="font-bold text-gray-800">0</span>
              </div>
              <div className="flex justify-between items-center text-[13px] pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-600">Status Render</span>
                <span className="font-bold text-[#16A34A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                  Berhasil
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: 3D Visualization Area */}
        <div className="bg-white border border-[#EAEAEA] rounded-[8px] shadow-sm flex flex-col w-full h-[850px] p-6 relative">
          
          {/* Header */}
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-[20px] font-extrabold text-[#111827] tracking-tight">RTS Deformasi 3D</h2>
            <p className="text-[13px] font-medium text-gray-500">
              Pos RTS Site MIP <span className="mx-1.5">•</span> 21/11/2025 10:06:35
            </p>
          </div>

          {/* Dummy 3D Canvas Area */}
          <div className="flex-1 relative border border-gray-100 bg-[#FAFAFC] rounded-lg overflow-hidden flex items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
            
            {/* Top Left Tool */}
            <div className="absolute top-4 left-4 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:bg-gray-50 transition-colors text-gray-600">
              <Maximize className="w-4 h-4" />
            </div>

            {/* Top Right Tools (Plotly-like) */}
            <div className="absolute top-4 right-4 flex items-center bg-white border border-gray-200 rounded-md shadow-sm text-gray-500">
              <div className="p-1.5 hover:bg-gray-50 border-r border-gray-200 cursor-pointer"><Camera className="w-4 h-4" /></div>
              <div className="p-1.5 hover:bg-gray-50 border-r border-gray-200 cursor-pointer"><ZoomIn className="w-4 h-4" /></div>
              <div className="p-1.5 hover:bg-gray-50 border-r border-gray-200 cursor-pointer"><Move className="w-4 h-4" /></div>
              <div className="p-1.5 hover:bg-gray-50 border-r border-gray-200 cursor-pointer"><RefreshCw className="w-4 h-4" /></div>
              <div className="p-1.5 hover:bg-gray-50 border-r border-gray-200 cursor-pointer"><Home className="w-4 h-4" /></div>
              <div className="p-1.5 hover:bg-gray-50 cursor-pointer"><Save className="w-4 h-4" /></div>
            </div>

            {/* Scale Bar (Right side) */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
              <span className="text-[11px] font-bold text-gray-600 mb-1">Linear</span>
              <div className="flex items-start">
                <div className="w-[18px] h-[300px] rounded-full border border-gray-300 bg-gradient-to-b from-[#7F1D1D] via-[#EA580C] to-[#FFF7ED]"></div>
                <div className="flex flex-col justify-between h-[300px] py-1 pl-2 text-[10px] font-bold text-gray-600">
                  <span>0.024</span>
                  <span>0.022</span>
                  <span>0.02</span>
                  <span>0.018</span>
                  <span>0.016</span>
                  <span>0.014</span>
                  <span>0.012</span>
                  <span>0.01</span>
                  <span>0.008</span>
                </div>
              </div>
            </div>

            {/* Legend (Bottom Left) */}
            <div className="absolute bottom-4 left-6 flex items-center gap-5 text-[11.5px] font-bold text-gray-600 bg-white/80 px-4 py-2 rounded-lg border border-gray-200 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                Baseline
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 border-t-2 border-[#EA580C]"></span>
                Displacement
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]"></span>
                Hasil
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#DC2626] rotate-45"></span>
                RTS
              </div>
            </div>

            {/* Dummy Mockup Popup/Tooltip (Center) */}
            <div className="absolute bottom-28 right-40 bg-[#FDBA74] text-slate-900 text-[10px] px-3 py-2 rounded shadow-lg border border-[#EA580C] w-[260px]">
              <div className="font-extrabold text-[12px] mb-1.5 flex items-center gap-1.5">
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-black inline-block"></span>
                BS_1
              </div>
              <div className="flex justify-between font-bold mb-1 border-b border-[#EA580C]/30 pb-1">
                <div>LINIER <br/><span className="text-[13px] font-black">0.0128</span></div>
                <div>ARAH <br/><span className="text-[12px] font-black">344°</span> (Utara)</div>
              </div>
              <div className="font-medium text-[9px] leading-tight opacity-90 mt-1.5">
                <p>Awal &nbsp;&nbsp;E: 525919.3140 &nbsp;&nbsp;N: 401306.5140 &nbsp;&nbsp;Z: 63.8350</p>
                <p>Hasil &nbsp;&nbsp;E: 525919.3106 &nbsp;&nbsp;N: 401306.5262 &nbsp;&nbsp;Z: 63.8273</p>
                <p className="font-bold text-black mt-0.5">Delta &nbsp;&nbsp;ΔE: -0.0034 &nbsp;&nbsp;ΔN: -0.0122 &nbsp;&nbsp;ΔZ: 0.0023</p>
              </div>
              {/* Dummy Line linking popup to point */}
              <div className="absolute -left-[18px] top-1/2 -mt-[8px] w-0 h-0 border-t-[8px] border-b-[8px] border-r-[18px] border-t-transparent border-b-transparent border-r-[#FDBA74] filter drop-shadow-md"></div>
              <div className="absolute -left-[24px] top-1/2 w-2 h-2 rounded-full bg-[#DC2626] -translate-y-1/2"></div>
            </div>

            <p className="text-gray-400 font-bold tracking-widest uppercase opacity-40">3D Visualization Canvas</p>
          </div>
        </div>

      </div>
    </div>
  );
}
