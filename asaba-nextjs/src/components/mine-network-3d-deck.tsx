"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import DeckGL from "@deck.gl/react";
import { ColumnLayer, LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import { useMemo, useState } from "react";
import {
  formatMineSensorValue,
  getMineSensorGeoPoints,
  mineNetworkSensors,
  type MineSensorGeoPoint,
  type MineSensorStatus,
} from "@/lib/mine-network";

const STATUS_COLORS: Record<MineSensorStatus, [number, number, number]> = {
  normal: [16, 185, 129],
  caution: [245, 158, 11],
  danger: [239, 68, 68],
};

const SENSOR_ELEVATION: Record<MineSensorStatus, number> = {
  normal: 55,
  caution: 85,
  danger: 115,
};

// MapLibre style with ESRI World Imagery — free, no API key
const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    imagery: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery &copy; Esri",
    },
  },
  layers: [{ id: "imagery", type: "raster" as const, source: "imagery" }],
};

const networkLineIds = [
  ["TLT-01", "VIB-01"],
  ["VIB-01", "CRK-01"],
  ["CRK-01", "PZO-01"],
  ["PZO-01", "VIB-03"],
  ["VIB-03", "TLT-03"],
  ["TLT-03", "GNS-02"],
  ["PZO-01", "GNS-03"],
  ["GNS-03", "CRK-02"],
  ["CRK-02", "RNG-02"],
  ["GNS-03", "GNS-01"],
  ["GNS-01", "TLT-02"],
  ["TLT-02", "PZO-02"],
  ["PZO-02", "VIB-02"],
  ["VIB-02", "RNG-03"],
  ["TLT-02", "RNG-01"],
];

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  showHeatmap: boolean;
  topView: boolean;
}

export function MineNetwork3DDeck({ selectedId, onSelect, showHeatmap, topView }: Props) {
  const geoPoints = useMemo(() => getMineSensorGeoPoints(mineNetworkSensors), []);

  const centerLng = geoPoints.reduce((s, p) => s + p.longitude, 0) / geoPoints.length;
  const centerLat = geoPoints.reduce((s, p) => s + p.latitude, 0) / geoPoints.length;

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: centerLng,
    latitude: centerLat,
    zoom: 14.5,
    pitch: 52,
    bearing: -12,
  });

  const cameraViewState = useMemo<MapViewState>(
    () => ({
      ...viewState,
      pitch: topView ? 0 : viewState.pitch || 52,
      bearing: topView ? 0 : viewState.bearing || -12,
      zoom: topView ? Math.max(viewState.zoom, 15) : viewState.zoom,
    }),
    [topView, viewState]
  );

  const networkData = useMemo(() => {
    return networkLineIds
      .map(([fromId, toId]) => ({
        from: geoPoints.find((p) => p.id === fromId),
        to: geoPoints.find((p) => p.id === toId),
      }))
      .filter((d): d is { from: MineSensorGeoPoint; to: MineSensorGeoPoint } =>
        Boolean(d.from && d.to)
      );
  }, [geoPoints]);

  function sensorOf(p: MineSensorGeoPoint) {
    return mineNetworkSensors.find((s) => s.id === p.id)!;
  }

  function getElev(p: MineSensorGeoPoint) {
    return SENSOR_ELEVATION[sensorOf(p).status];
  }

  function getColor(p: MineSensorGeoPoint, alpha: number): [number, number, number, number] {
    return [...STATUS_COLORS[sensorOf(p).status], alpha] as [number, number, number, number];
  }

  const layers = [
    // Deformation heatmap overlay
    showHeatmap &&
      new HeatmapLayer<MineSensorGeoPoint>({
        id: "heatmap",
        data: geoPoints,
        getPosition: (d) => [d.longitude, d.latitude],
        getWeight: (d) => {
          const s = sensorOf(d).status;
          return s === "danger" ? 3 : s === "caution" ? 2 : 1;
        },
        radiusPixels: 90,
        intensity: 2.2,
        threshold: 0.03,
        colorRange: [
          [0, 200, 80, 80],
          [200, 230, 0, 120],
          [255, 200, 0, 150],
          [255, 110, 0, 185],
          [220, 20, 20, 220],
        ],
      }),

    // Network connection lines
    new LineLayer<{ from: MineSensorGeoPoint; to: MineSensorGeoPoint }>({
      id: "network-lines",
      data: networkData,
      getSourcePosition: (d) => [d.from.longitude, d.from.latitude, 0],
      getTargetPosition: (d) => [d.to.longitude, d.to.latitude, 0],
      getColor: [148, 163, 184, 150],
      getWidth: 2,
      widthUnits: "pixels",
    }),

    // 3D extruded pillars
    new ColumnLayer<MineSensorGeoPoint>({
      id: "pillars",
      data: geoPoints,
      diskResolution: 16,
      radius: 14,
      extruded: true,
      getPosition: (d) => [d.longitude, d.latitude],
      getElevation: (d) => getElev(d),
      getFillColor: (d) => getColor(d, d.id === selectedId ? 230 : 160),
      getLineColor: [255, 255, 255, 60],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
      onClick: (info: PickingInfo<MineSensorGeoPoint>) => {
        if (info.object) onSelect(info.object.id);
      },
      updateTriggers: { getFillColor: [selectedId] },
    }),

    // Sensor dots on top of pillars
    new ScatterplotLayer<MineSensorGeoPoint>({
      id: "sensors",
      data: geoPoints,
      getPosition: (d) => [d.longitude, d.latitude, getElev(d) + 6],
      getRadius: (d) => (d.id === selectedId ? 20 : 13),
      getFillColor: (d) => getColor(d, 255),
      getLineColor: [255, 255, 255, 230],
      lineWidthMinPixels: 2,
      stroked: true,
      radiusUnits: "meters",
      pickable: true,
      onClick: (info: PickingInfo<MineSensorGeoPoint>) => {
        if (info.object) onSelect(info.object.id);
      },
      updateTriggers: { getRadius: [selectedId] },
    }),

    // Sensor labels
    new TextLayer<MineSensorGeoPoint>({
      id: "labels",
      data: geoPoints,
      getPosition: (d) => [d.longitude, d.latitude, getElev(d) + 30],
      getText: (d) => {
        const s = sensorOf(d);
        return `${d.id}  ${formatMineSensorValue(s)}`;
      },
      getSize: 12,
      getColor: [255, 255, 255, 240],
      getBackgroundColor: [15, 15, 30, 210],
      background: true,
      backgroundPadding: [6, 3, 6, 3],
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700,
      billboard: true,
      sizeUnits: "pixels",
      pickable: true,
      onClick: (info: PickingInfo<MineSensorGeoPoint>) => {
        if (info.object) onSelect(info.object.id);
      },
    }),
  ].filter(Boolean);

  return (
    <DeckGL
      viewState={cameraViewState}
      onViewStateChange={({ viewState: vs }) => setViewState(vs as MapViewState)}
      controller={{ scrollZoom: true, dragPan: true, dragRotate: true, doubleClickZoom: true }}
      layers={layers}
      style={{ position: "absolute", inset: "0" }}
      getCursor={({ isDragging, isHovering }) =>
        isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
      }
    >
      <Map mapStyle={SATELLITE_STYLE} />
    </DeckGL>
  );
}
