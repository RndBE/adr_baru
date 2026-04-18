"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface PrismaMarkerData {
  id_prisma: string;
  nama_prisma: string;
  site: string | null;
  // Server-computed Lat/Lon (from utm2ll(), same as PHP)
  lat0: number | null;
  lon0: number | null;
  lat1: number | null;
  lon1: number | null;
  DN: string;
  DE: string;
  DZ: string;
  linear: number;
  arah_pergeseran: string;
  SD1: string;
  hasData: boolean;
}

interface Props {
  markers: PrismaMarkerData[];
  site: string | null;
}

export default function PrismaMap({ markers, site }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);

  const isCcp = (site || "").toLowerCase().includes("ccp");

  // Center coordinates based on site (same hardcoded as PHP)
  const center: [number, number] = isCcp
    ? [3.6307977846194737, 117.23368934932883]
    : [3.6444116043375363, 117.24226908676536];
  const zoom = isCcp ? 18 : 15;

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = require("leaflet");

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Satellite tile (Esri World Imagery)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 22 }
    ).addTo(map);

    // ── ADR/RTS marker ──
    const rtsIcon = L.divIcon({
      className: "",
      html: `<div style="
        position:relative;width:32px;height:32px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          width:30px;height:30px;background:white;
          border:2px solid #303481;border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#303481" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(center, { icon: rtsIcon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:system-ui;padding:2px;">
          <div style="font-weight:800;font-size:13px;color:#1f2937;margin-bottom:3px;">📡 ADR / RTS</div>
          <div style="font-size:11px;color:#6b7280">Site ${isCcp ? "CCP 3" : "VP"}</div>
        </div>`, { className: "prisma-popup" });

    // ── Prisma markers ──
    const r0Points: [number, number][] = [];

    markers.forEach((pr) => {
      if (!pr.lat0 || !pr.lon0) return;

      r0Points.push([pr.lat0, pr.lon0]);

      const hasNew = pr.hasData && !!(pr.lat1 && pr.lon1);
      const namaBersih = pr.nama_prisma.replace(/_/g, " ");
      const linierMm = pr.linear ? (pr.linear * 1000).toFixed(4) : "-";

      // Marker icon — crosshair style
      const stroke = hasNew ? "#3b82f6" : "#9ca3af";
      const prismaIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:26px;height:26px;
          background:white;
          border:2px solid ${stroke};
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="${stroke}" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      // Popup
      const popupHtml = hasNew
        ? `<div style="font-family:system-ui;min-width:190px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
              </svg>
              <span style="font-weight:800;font-size:13px;color:#1f2937">${namaBersih}</span>
            </div>
            <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;margin-bottom:5px;">COORDINATE SHIFT</div>
            <table style="border-collapse:collapse;width:100%;margin-bottom:10px;">
              <tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:11px;">Delta X</td>
                  <td style="font-weight:700;color:#1f2937;font-size:12px;">${pr.DE}</td></tr>
              <tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:11px;">Delta Y</td>
                  <td style="font-weight:700;color:#1f2937;font-size:12px;">${pr.DN}</td></tr>
              <tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:11px;">Delta Z</td>
                  <td style="font-weight:700;color:#1f2937;font-size:12px;">${pr.DZ}</td></tr>
            </table>
            <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;margin-bottom:5px;">SLOPE DISTANCE</div>
            <div style="font-weight:700;font-size:13px;color:#1f2937;">${pr.SD1}</div>
          </div>`
        : `<div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:800;font-size:13px;color:#1f2937;margin-bottom:6px;">${namaBersih}</div>
            <div style="font-size:11px;color:#ef4444;font-weight:600;">Belum ada data pengukuran</div>
          </div>`;

      L.marker([pr.lat0, pr.lon0], { icon: prismaIcon })
        .addTo(map)
        .bindPopup(popupHtml, { maxWidth: 280, className: "prisma-popup" });

      // Label
      L.marker([pr.lat0, pr.lon0], { opacity: 0 })
        .addTo(map)
        .bindTooltip(namaBersih, {
          permanent: true,
          direction: "top",
          offset: [0, -15],
          className: "prisma-label",
        });

      // Displacement arrow
      if (hasNew && pr.lat1 && pr.lon1) {
        const dLat = pr.lat1 - pr.lat0;
        const dLon = pr.lon1 - pr.lon0;
        const scale = 15;
        const endLat = pr.lat0 + dLat * scale;
        const endLon = pr.lon0 + dLon * scale;

        L.polyline([[pr.lat0, pr.lon0], [endLat, endLon]], {
          color: "#60a5fa",
          weight: 2,
          opacity: 0.9,
        }).addTo(map);

        const arrowIcon = L.divIcon({
          className: "",
          html: `<div style="width:8px;height:8px;background:#60a5fa;border:1.5px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });
        L.marker([endLat, endLon], { icon: arrowIcon }).addTo(map);
      }
    });

    // R0 connection line
    if (r0Points.length > 1) {
      L.polyline(r0Points, {
        color: "#e5e7eb",
        weight: 1,
        opacity: 0.8,
        dashArray: "4 6",
      }).addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, site]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ height: "520px" }}>
      <style>{`
        .prisma-label {
          background: rgba(255,255,255,0.92) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 2px 8px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #1f2937 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25) !important;
          white-space: nowrap !important;
          backdrop-filter: blur(2px);
        }
        .prisma-label::before { display: none !important; }
        .prisma-popup .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.22) !important;
          padding: 0 !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
        }
        .prisma-popup .leaflet-popup-content { margin: 14px 16px !important; }
        .prisma-popup .leaflet-popup-tip-container { display: none !important; }
        .leaflet-bar {
          border-radius: 8px !important;
          overflow: hidden;
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35) !important;
        }
        .leaflet-bar a {
          background: rgba(255,255,255,0.9) !important;
          color: #374151 !important;
          font-weight: 700 !important;
          border-bottom: 1px solid #e5e7eb !important;
          backdrop-filter: blur(4px);
        }
        .leaflet-bar a:hover { background: white !important; }
        .leaflet-bar a:last-child { border-bottom: none !important; }
      `}</style>

      {/* Site badge */}
      <div className="absolute z-[1000] top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/40 px-3 py-2">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Site</div>
        <div className="text-[13px] font-extrabold text-[#303481]">{isCcp ? "CCP 3" : "VP"}</div>
      </div>

      {/* Legend */}
      <div className="absolute z-[1000] bottom-10 left-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/40 px-3 py-3 flex flex-col gap-2">
        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-0.5">Legenda</div>
        <div className="flex items-center gap-2 text-[11.5px] text-gray-700 font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
          Prisma Terukur
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-gray-700 font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
          Prisma Gagal
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-gray-700 font-medium">
          <span className="inline-block w-5 border-t-2 border-blue-400" />
          Arah Pergeseran
        </div>
      </div>

      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
