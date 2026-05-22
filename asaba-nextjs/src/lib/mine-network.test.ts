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
  const [firstPoint] = getMineSensorGeoPoints(mineNetworkSensors);

  assert.deepEqual(firstPoint, {
    id: "TLT-01",
    name: "Tiltmeter North Wall",
    type: "tiltmeter",
    status: "normal",
    latitude: 3.6498,
    longitude: 117.2354,
    elevation: 74,
    value: 1.8,
    unit: "deg",
  });
});

test("summarizes mine sensor inspection priorities", () => {
  assert.deepEqual(getMineSensorPrioritySummary(mineNetworkSensors), {
    dangerCount: 2,
    cautionCount: 5,
    topDangerIds: ["TLT-02", "PZO-02"],
  });
});
