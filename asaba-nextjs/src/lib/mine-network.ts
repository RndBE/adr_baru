export type MineSensorType =
  | "tiltmeter"
  | "crack-meter"
  | "piezometer"
  | "rain-gauge"
  | "vibration"
  | "gnss";

export type MineSensorStatus = "normal" | "caution" | "danger";

export interface MineNetworkSensor {
  id: string;
  name: string;
  type: MineSensorType;
  status: MineSensorStatus;
  zone: string;
  criticalPoint: string;
  x: number;
  y: number;
  value: number;
  unit: string;
  threshold: string;
  trend: "naik" | "stabil" | "turun";
  lastUpdate: string;
  battery: number;
  signal: number;
  note: string;
}

export interface MineSensor3DPoint {
  id: string;
  name: string;
  type: MineSensorType;
  status: MineSensorStatus;
  x: number;
  y: number;
  z: number;
  depth: number;
}

export interface MineSensorGeoPoint {
  id: string;
  name: string;
  type: MineSensorType;
  status: MineSensorStatus;
  latitude: number;
  longitude: number;
  elevation: number;
  value: number;
  unit: string;
}

export const mineSensorTypeLabels: Record<MineSensorType, string> = {
  tiltmeter: "Tiltmeter",
  "crack-meter": "Crack Meter",
  piezometer: "Piezometer",
  "rain-gauge": "Rain Gauge",
  vibration: "Vibration",
  gnss: "GNSS",
};

export const mineNetworkSensors: MineNetworkSensor[] = [
  {
    id: "TLT-01",
    name: "Tiltmeter North Wall",
    type: "tiltmeter",
    status: "normal",
    zone: "Pit Utara",
    criticalPoint: "Bench 740",
    x: 27,
    y: 22,
    value: 1.8,
    unit: "deg",
    threshold: "< 3.0 deg",
    trend: "stabil",
    lastUpdate: "10:42 WIB",
    battery: 88,
    signal: 92,
    note: "Kemiringan masih dalam rentang operasi.",
  },
  {
    id: "TLT-02",
    name: "Tiltmeter Highwall Timur",
    type: "tiltmeter",
    status: "danger",
    zone: "Pit Timur",
    criticalPoint: "Highwall 812",
    x: 71,
    y: 28,
    value: 5.7,
    unit: "deg",
    threshold: "> 5.0 deg",
    trend: "naik",
    lastUpdate: "10:43 WIB",
    battery: 74,
    signal: 86,
    note: "Perlu inspeksi geoteknik dan pembatasan akses di bawah highwall.",
  },
  {
    id: "TLT-03",
    name: "Tiltmeter Waste Dump",
    type: "tiltmeter",
    status: "normal",
    zone: "Waste Dump",
    criticalPoint: "Dump Crest",
    x: 16,
    y: 65,
    value: 0.9,
    unit: "deg",
    threshold: "< 3.0 deg",
    trend: "turun",
    lastUpdate: "10:39 WIB",
    battery: 91,
    signal: 77,
    note: "Tidak ada perubahan kemiringan signifikan.",
  },
  {
    id: "CRK-01",
    name: "Crack Meter Crest A",
    type: "crack-meter",
    status: "caution",
    zone: "Pit Barat",
    criticalPoint: "Crest A",
    x: 38,
    y: 33,
    value: 12.4,
    unit: "mm",
    threshold: "10-18 mm",
    trend: "naik",
    lastUpdate: "10:41 WIB",
    battery: 82,
    signal: 81,
    note: "Retakan melebar perlahan, pantau interval lebih rapat.",
  },
  {
    id: "CRK-02",
    name: "Crack Meter Ramp Selatan",
    type: "crack-meter",
    status: "normal",
    zone: "Ramp Selatan",
    criticalPoint: "Haul Road S2",
    x: 55,
    y: 73,
    value: 4.6,
    unit: "mm",
    threshold: "< 10 mm",
    trend: "stabil",
    lastUpdate: "10:38 WIB",
    battery: 79,
    signal: 89,
    note: "Retakan stabil di sisi jalan angkut.",
  },
  {
    id: "CRK-03",
    name: "Crack Meter Bench 690",
    type: "crack-meter",
    status: "normal",
    zone: "Pit Tengah",
    criticalPoint: "Bench 690",
    x: 47,
    y: 42,
    value: 6.1,
    unit: "mm",
    threshold: "< 10 mm",
    trend: "stabil",
    lastUpdate: "10:44 WIB",
    battery: 93,
    signal: 94,
    note: "Retakan minor, tidak ada percepatan deformasi.",
  },
  {
    id: "PZO-01",
    name: "Piezometer Toe Utara",
    type: "piezometer",
    status: "normal",
    zone: "Pit Utara",
    criticalPoint: "Toe Drain N1",
    x: 32,
    y: 50,
    value: 17.2,
    unit: "kPa",
    threshold: "< 25 kPa",
    trend: "turun",
    lastUpdate: "10:36 WIB",
    battery: 86,
    signal: 78,
    note: "Tekanan air pori menurun setelah pompa aktif.",
  },
  {
    id: "PZO-02",
    name: "Piezometer East Slope",
    type: "piezometer",
    status: "danger",
    zone: "Pit Timur",
    criticalPoint: "Seepage Line E4",
    x: 76,
    y: 47,
    value: 42.8,
    unit: "kPa",
    threshold: "> 38 kPa",
    trend: "naik",
    lastUpdate: "10:45 WIB",
    battery: 68,
    signal: 83,
    note: "Tekanan air pori tinggi, cek drainase dan rembesan lereng.",
  },
  {
    id: "PZO-03",
    name: "Piezometer Dump Toe",
    type: "piezometer",
    status: "caution",
    zone: "Waste Dump",
    criticalPoint: "Toe Dump W3",
    x: 22,
    y: 77,
    value: 31.4,
    unit: "kPa",
    threshold: "25-38 kPa",
    trend: "naik",
    lastUpdate: "10:40 WIB",
    battery: 72,
    signal: 75,
    note: "Kenaikan terpantau setelah hujan, lanjutkan pemantauan.",
  },
  {
    id: "RNG-01",
    name: "Rain Gauge Ridge",
    type: "rain-gauge",
    status: "normal",
    zone: "Ridge",
    criticalPoint: "Weather Station 1",
    x: 61,
    y: 14,
    value: 3.2,
    unit: "mm/h",
    threshold: "< 10 mm/h",
    trend: "turun",
    lastUpdate: "10:45 WIB",
    battery: 95,
    signal: 91,
    note: "Hujan ringan, belum memicu alarm hidrologi.",
  },
  {
    id: "RNG-02",
    name: "Rain Gauge Selatan",
    type: "rain-gauge",
    status: "caution",
    zone: "Ramp Selatan",
    criticalPoint: "Weather Station 2",
    x: 67,
    y: 82,
    value: 18.6,
    unit: "mm/h",
    threshold: "10-25 mm/h",
    trend: "naik",
    lastUpdate: "10:45 WIB",
    battery: 90,
    signal: 88,
    note: "Intensitas hujan sedang, siapkan inspeksi drainase.",
  },
  {
    id: "RNG-03",
    name: "Rain Gauge Office",
    type: "rain-gauge",
    status: "normal",
    zone: "Office",
    criticalPoint: "Base Camp",
    x: 86,
    y: 68,
    value: 1.1,
    unit: "mm/h",
    threshold: "< 10 mm/h",
    trend: "stabil",
    lastUpdate: "10:37 WIB",
    battery: 97,
    signal: 96,
    note: "Kondisi area kantor normal.",
  },
  {
    id: "VIB-01",
    name: "Vibration Blasting North",
    type: "vibration",
    status: "normal",
    zone: "Pit Utara",
    criticalPoint: "Blast Block N7",
    x: 43,
    y: 24,
    value: 1.6,
    unit: "mm/s",
    threshold: "< 3.0 mm/s",
    trend: "stabil",
    lastUpdate: "10:32 WIB",
    battery: 84,
    signal: 73,
    note: "Getaran blasting terakhir masih aman.",
  },
  {
    id: "VIB-02",
    name: "Vibration Crusher Line",
    type: "vibration",
    status: "normal",
    zone: "Crusher",
    criticalPoint: "Conveyor Transfer",
    x: 83,
    y: 39,
    value: 2.2,
    unit: "mm/s",
    threshold: "< 3.0 mm/s",
    trend: "stabil",
    lastUpdate: "10:34 WIB",
    battery: 81,
    signal: 87,
    note: "Getaran alat masih di bawah ambang.",
  },
  {
    id: "VIB-03",
    name: "Vibration Ramp Barat",
    type: "vibration",
    status: "caution",
    zone: "Pit Barat",
    criticalPoint: "Ramp W1",
    x: 30,
    y: 58,
    value: 3.8,
    unit: "mm/s",
    threshold: "3.0-5.0 mm/s",
    trend: "naik",
    lastUpdate: "10:44 WIB",
    battery: 69,
    signal: 79,
    note: "Getaran meningkat, korelasikan dengan lalu lintas alat berat.",
  },
  {
    id: "GNS-01",
    name: "GNSS Prism Crest Timur",
    type: "gnss",
    status: "caution",
    zone: "Pit Timur",
    criticalPoint: "Crest E2",
    x: 68,
    y: 36,
    value: 24.5,
    unit: "mm",
    threshold: "20-35 mm",
    trend: "naik",
    lastUpdate: "10:43 WIB",
    battery: 76,
    signal: 82,
    note: "Pergerakan horizontal meningkat di crest timur.",
  },
  {
    id: "GNS-02",
    name: "GNSS Dump Reference",
    type: "gnss",
    status: "normal",
    zone: "Waste Dump",
    criticalPoint: "Reference W",
    x: 12,
    y: 84,
    value: 8.3,
    unit: "mm",
    threshold: "< 20 mm",
    trend: "stabil",
    lastUpdate: "10:35 WIB",
    battery: 89,
    signal: 84,
    note: "Titik referensi dump stabil.",
  },
  {
    id: "GNS-03",
    name: "GNSS Main Ramp",
    type: "gnss",
    status: "normal",
    zone: "Ramp Utama",
    criticalPoint: "Haul Road M1",
    x: 58,
    y: 55,
    value: 11.7,
    unit: "mm",
    threshold: "< 20 mm",
    trend: "stabil",
    lastUpdate: "10:42 WIB",
    battery: 92,
    signal: 90,
    note: "Pergerakan masih rendah di jalur angkut utama.",
  },
];

export function getMineSensorStatusSummary(sensors: MineNetworkSensor[]) {
  return sensors.reduce(
    (summary, sensor) => {
      summary.total += 1;
      summary[sensor.status] += 1;
      return summary;
    },
    { total: 0, normal: 0, caution: 0, danger: 0 }
  );
}

export function getMineSensorTypeSummary(sensors: MineNetworkSensor[]) {
  return sensors.reduce(
    (summary, sensor) => {
      summary[sensor.type] += 1;
      return summary;
    },
    {
      tiltmeter: 0,
      "crack-meter": 0,
      piezometer: 0,
      "rain-gauge": 0,
      vibration: 0,
      gnss: 0,
    } satisfies Record<MineSensorType, number>
  );
}

export function formatMineSensorValue(sensor: MineNetworkSensor) {
  return `${sensor.value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(sensor.value) ? 0 : 1,
  })} ${sensor.unit}`;
}

export function getMineSensor3DPoints(sensors: MineNetworkSensor[]): MineSensor3DPoint[] {
  return sensors.map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    type: sensor.type,
    status: sensor.status,
    x: sensor.x,
    y: sensor.y,
    z: Math.max(16, Math.round(88 - sensor.y * 0.65)),
    depth: Math.max(5, Math.round(sensor.y * 0.35)),
  }));
}

export function getMineSensorGeoPoints(sensors: MineNetworkSensor[]): MineSensorGeoPoint[] {
  const baseLatitude = 3.642;
  const baseLongitude = 117.231;
  const latitudeScale = 0.00027857;
  const longitudeScale = 0.000163;

  return sensors.map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    type: sensor.type,
    status: sensor.status,
    latitude: Number((baseLatitude + (50 - sensor.y) * latitudeScale).toFixed(4)),
    longitude: Number((baseLongitude + sensor.x * longitudeScale).toFixed(4)),
    elevation: Math.max(16, Math.round(88 - sensor.y * 0.65)),
    value: sensor.value,
    unit: sensor.unit,
  }));
}

export function getMineSensorPrioritySummary(sensors: MineNetworkSensor[]) {
  const dangerSensors = sensors.filter((sensor) => sensor.status === "danger");
  const cautionSensors = sensors.filter((sensor) => sensor.status === "caution");

  return {
    dangerCount: dangerSensors.length,
    cautionCount: cautionSensors.length,
    topDangerIds: dangerSensors.slice(0, 3).map((sensor) => sensor.id),
  };
}
