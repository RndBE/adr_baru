"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Maximize, Check, AlertTriangle } from "lucide-react";
import { useSites, fallbackBadge } from "@/hooks/use-sites";

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

function parseDelta(value: string): number | null {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rata-rata posisi marker — dipakai sebagai center cadangan untuk site
 *  yang center petanya belum diisi. */
function averageMarkerLatLng(
  markers: PrismaMarkerData[]
): [number, number] | null {
  const titik = markers
    .map((m) => [m.lat1 ?? m.lat0, m.lon1 ?? m.lon0] as const)
    .filter(
      (p): p is readonly [number, number] =>
        p[0] !== null && p[1] !== null && Number.isFinite(p[0]) && Number.isFinite(p[1])
    );
  if (titik.length === 0) return null;
  const lat = titik.reduce((a, p) => a + p[0], 0) / titik.length;
  const lng = titik.reduce((a, p) => a + p[1], 0) / titik.length;
  return [lat, lng];
}

export default function PrismaMap({ markers, site }: Props) {
  const { bySlug: siteBySlug } = useSites();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<{
    cartoLayer: import("leaflet").TileLayer;
    googleLayer: import("leaflet").TileLayer;
  } | null>(null);

  const [mapType, setMapType] = useState<"Map" | "Satellite">("Map");
  const [showTerrain, setShowTerrain] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const siteRow = siteBySlug(site);
  const siteLabel = siteRow?.badge_label ?? fallbackBadge(site).label;
  const siteNama = siteRow?.nama ?? fallbackBadge(site).nama;

  // Center peta berasal dari master data site. Site yang belum dikalibrasi
  // (map_lat/map_lng masih null) di-fallback ke rata-rata posisi marker agar
  // peta tetap menunjukkan sesuatu yang benar, bukan koordinat site lain.
  const markerCenter = averageMarkerLatLng(markers);
  const center: [number, number] =
    siteRow?.map_lat != null && siteRow?.map_lng != null
      ? [siteRow.map_lat, siteRow.map_lng]
      : markerCenter ?? [0, 0];
  const zoom = siteRow?.map_lat != null ? siteRow.map_zoom : markerCenter ? 16 : 2;
  const belumTerkalibrasi = !siteRow || !siteRow.terkalibrasi;
  const dataDummy = !!siteRow?.data_dummy;

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
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      preferCanvas: true, // Uses canvas for rendering vectors (lines/markers), much smoother and faster
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Define separate layers so switching is instant and cached
    const cartoLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ["a", "b", "c", "d"],
        keepBuffer: 8,
        crossOrigin: true,
        className: 'map-layer-transition',
      }
    );

    const googleLayer = L.tileLayer(
      "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      {
        maxZoom: 22,
        maxNativeZoom: 21,
        subdomains: ["0", "1", "2", "3"],
        keepBuffer: 8,
        crossOrigin: true,
        className: 'map-layer-transition',
      }
    );

    // Initial layer to add
    if (mapType === "Satellite") {
      googleLayer.addTo(map);
    } else {
      cartoLayer.addTo(map);
    }

    tileLayerRef.current = { cartoLayer, googleLayer };

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
          <div style="font-size:11px;color:#6b7280">Site ${siteNama}</div>
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
      const emptyIcon = L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0] });
      L.marker([pr.lat0, pr.lon0], { icon: emptyIcon })
        .addTo(map)
        .bindTooltip(namaBersih, {
          permanent: true,
          direction: "top",
          offset: [0, -15],
          className: "prisma-label",
        });

      // Displacement direction indicator
      if (hasNew && pr.lat1 && pr.lon1) {
        const startPoint = map.latLngToLayerPoint([pr.lat0, pr.lon0]);
        let targetPoint = map.latLngToLayerPoint([pr.lat1, pr.lon1]);

        const deltaE = parseDelta(pr.DE);
        const deltaN = parseDelta(pr.DN);
        if (
          deltaE !== null &&
          deltaN !== null &&
          (Math.abs(deltaE) > 1e-12 || Math.abs(deltaN) > 1e-12)
        ) {
          const metersPerDegreeLat = 111320;
          const metersPerDegreeLon =
            metersPerDegreeLat * Math.cos((pr.lat0 * Math.PI) / 180);
          const targetLat = pr.lat0 + deltaN / metersPerDegreeLat;
          const targetLon =
            pr.lon0 + deltaE / Math.max(Math.abs(metersPerDegreeLon), 1e-12);
          targetPoint = map.latLngToLayerPoint([targetLat, targetLon]);
        }

        const vectorX = targetPoint.x - startPoint.x;
        const vectorY = targetPoint.y - startPoint.y;
        const vectorLength = Math.hypot(vectorX, vectorY);
        if (vectorLength <= 0) return;

        const displayLengthPx = 90;
        const endPoint = L.point(
          startPoint.x + (vectorX / vectorLength) * displayLengthPx,
          startPoint.y + (vectorY / vectorLength) * displayLengthPx
        );
        const endLatLng = map.layerPointToLatLng(endPoint);
        const endLat = endLatLng.lat;
        const endLon = endLatLng.lng;

        L.polyline([[pr.lat0, pr.lon0], [endLat, endLon]], {
          color: "#2563eb",
          weight: 3.5,
          opacity: 1,
        }).addTo(map);

        const arrowIcon = L.divIcon({
          className: "",
          html: `<div style="width:10px;height:10px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([endLat, endLon], { icon: arrowIcon }).addTo(map);
      }
    });

    // R0 connection line
    if (r0Points.length > 1) {
      L.polyline(r0Points, {
        color: "#ffffff",
        weight: 2,
        opacity: 0.9,
        dashArray: "5 7",
      }).addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, site]); // Dependencies: only recreate map if markers or site change

  // Dynamically switch layers seamlessly
  useEffect(() => {
    if (!tileLayerRef.current || !mapInstanceRef.current) return;
    const { cartoLayer, googleLayer } = tileLayerRef.current;
    const map = mapInstanceRef.current;

    if (mapType === "Satellite") {
      // Update google layer URL based on labels
      const lyrs = showLabels ? "y" : "s";
      googleLayer.setUrl(`https://mt{s}.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`);
      
      if (!map.hasLayer(googleLayer)) map.addLayer(googleLayer);
      if (map.hasLayer(cartoLayer)) map.removeLayer(cartoLayer);
    } else {
      if (!map.hasLayer(cartoLayer)) map.addLayer(cartoLayer);
      if (map.hasLayer(googleLayer)) map.removeLayer(googleLayer);
    }
  }, [mapType, showLabels]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Ensure map is smoothly resized whenever container dimensions change
  useEffect(() => {
    if (!containerRef.current) return;
    
    let timeoutId: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      // Wait for the browser resize/fullscreen animation to settle (approx 150ms)
      // before telling Leaflet to redraw. This prevents tile flickering/blinking.
      timeoutId = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 150);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden bg-[#F8F9FA] shadow-sm" style={{ height: "520px" }}>
      <style>{`
        .map-layer-transition {
          transition: opacity 0.4s ease-in-out;
        }
        :fullscreen {
          height: 100vh !important;
          width: 100vw !important;
          border-radius: 0 !important;
        }
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
        <div className="text-[13px] font-extrabold text-[#303481]">{siteLabel}</div>
      </div>

      {/* Peringatan — posisi/nilai site ini belum bisa dipercaya */}
      {(belumTerkalibrasi || dataDummy) && (
        <div className="absolute z-[1000] top-3 left-1/2 -translate-x-1/2 flex items-start gap-2 max-w-[380px] bg-amber-50/95 backdrop-blur-sm border border-amber-300 rounded-lg shadow-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-[1px]" />
          <div className="text-[11.5px] leading-snug text-amber-900">
            {belumTerkalibrasi ? (
              <>
                <span className="font-bold">Site belum dikalibrasi.</span>{" "}
                {siteRow
                  ? "Center peta belum diisi — tampilan memakai rata-rata posisi prisma."
                  : `Site "${site ?? "?"}" belum terdaftar di Master Data → Site.`}{" "}
                Posisi dan nilai pergeseran belum bisa dianggap sahih.
              </>
            ) : (
              <>
                <span className="font-bold">Data contoh.</span> Koordinat dan ambang
                site ini belum berasal dari survei — tampilan hanya untuk demo.
              </>
            )}
          </div>
        </div>
      )}

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
          <span className="inline-block w-5 border-t-[3.5px] border-blue-600 rounded-full" />
          Arah Pergeseran
        </div>
      </div>

      {/* Custom Map UI Controls (Top Right) */}
      <div className="absolute z-[1000] top-3 right-3 flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2">
          {/* Map/Satellite Toggle */}
          <div className="flex bg-white rounded-md shadow-sm border border-[#EAEAEA] overflow-hidden text-[13px] font-bold">
            <button 
              onClick={() => setMapType("Map")}
              className={`px-4 py-1.5 transition-colors cursor-pointer ${mapType === "Map" ? "bg-[#303481] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Map
            </button>
            <button 
              onClick={() => setMapType("Satellite")}
              className={`px-4 py-1.5 transition-colors cursor-pointer ${mapType === "Satellite" ? "bg-[#303481] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Satellite
            </button>
          </div>
          {/* Fullscreen Button */}
          <button 
            onClick={toggleFullscreen}
            className="w-[34px] h-[32px] bg-white rounded-md shadow-sm border border-[#EAEAEA] flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
        


        {/* Labels Checkbox for Satellite */}
        {mapType === "Satellite" && (
          <label className="flex items-center gap-2 bg-white rounded-md shadow-sm border border-[#EAEAEA] px-3 py-1.5 cursor-pointer text-[12px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">
            <div className={`flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border ${showLabels ? "bg-[#303481] border-[#303481]" : "bg-white border-gray-300"}`}>
              {showLabels && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            Labels
            <input 
              type="checkbox" 
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
