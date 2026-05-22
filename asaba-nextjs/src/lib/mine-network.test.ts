import assert from "node:assert/strict";
import test from "node:test";

import {
  getMineSensor3DPoints,
  getMineSensorGeoPoints,
  getMineSensorPrioritySummary,
  getMineSensorStatusSummary,
  getMineSensorTypeSummary,
  mineNetworkSensors,
} from "./mine-network";

test("summarizes mine network sensor statuses", () => {
  assert.deepEqual(getMineSensorStatusSummary(mineNetworkSensors), {
    total: 18,
    normal: 11,
    caution: 5,
    danger: 2,
  });
});

test("summarizes mine network sensors by type", () => {
  assert.deepEqual(getMineSensorTypeSummary(mineNetworkSensors), {
    tiltmeter: 3,
    "crack-meter": 3,
    piezometer: 3,
    "rain-gauge": 3,
    vibration: 3,
    gnss: 3,
  });
});

test("projects mine sensors into stable 3d map coordinates", () => {
  const [firstPoint] = getMineSensor3DPoints(mineNetworkSensors);

  assert.deepEqual(firstPoint, {
    id: "TLT-01",
    name: "Tiltmeter North Wall",
    type: "tiltmeter",
    status: "normal",
    x: 27,
    y: 22,
    z: 74,
    depth: 8,
  });
});

test("projects mine sensors into dummy geospatial coordinates", () => {
  const geoPoints = getMineSensorGeoPoints(mineNetworkSensors);
  const [firstPoint] = geoPoints;

  assert.deepEqual(firstPoint, {
    id: "TLT-01",
    name: "Tiltmeter North Wall",
    type: "tiltmeter",
    status: "normal",
    latitude: 3.6518,
    longitude: 117.2369,
    elevation: 74,
    value: 1.8,
    unit: "deg",
  });

  assert.ok(geoPoints.every((point) => point.latitude >= 3.6455 && point.latitude <= 3.6526));
  assert.ok(geoPoints.every((point) => point.longitude >= 117.2357 && point.longitude <= 117.2413));
});

test("summarizes mine sensor inspection priorities", () => {
  assert.deepEqual(getMineSensorPrioritySummary(mineNetworkSensors), {
    dangerCount: 2,
    cautionCount: 5,
    topDangerIds: ["TLT-02", "PZO-02"],
  });
});
