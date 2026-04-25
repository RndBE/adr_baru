/**
 * MQTT client wrapper for RTS control commands.
 * Ported from CI3 Kontrol controller.
 */
import mqtt from "mqtt";

interface MqttConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

function getConfig(): MqttConfig {
  return {
    host: process.env.MQTT_HOST || "mqtt.beacontelemetry.com",
    port: parseInt(process.env.MQTT_PORT || "8883", 10),
    username: process.env.MQTT_USERNAME || "userlog",
    password: process.env.MQTT_PASSWORD || "b34c0n",
  };
}

/**
 * Publish a message to an MQTT topic.
 */
export async function publishMqtt(
  topic: string,
  message: object | string
): Promise<boolean> {
  const config = getConfig();
  const url = `mqtts://${config.host}:${config.port}`;

  return new Promise((resolve) => {
    const client = mqtt.connect(url, {
      username: config.username,
      password: config.password,
      // Bypass TLS in development — set MQTT_REJECT_UNAUTHORIZED=true in production
      rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === "true",
      connectTimeout: 10000,
    });

    client.on("connect", () => {
      const payload =
        typeof message === "string" ? message : JSON.stringify(message);
      client.publish(topic, payload, { qos: 0 }, (err) => {
        client.end();
        if (err) {
          console.error("[MQTT] Publish error:", err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    client.on("error", (err) => {
      console.error("[MQTT] Connection error:", err);
      client.end();
      resolve(false);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      client.end(true);
      resolve(false);
    }, 15000);
  });
}

/**
 * Send RTS start command via MQTT.
 * Ported from PHP Kontrol::lanjut_kontrol().
 */
/**
 * Config RTS yang dikirim pada tahap 1.
 */
export type RtsConfigPayload = {
  jobName: string;
  prismConst: string;
  tsHigh: string;
  locCoor: [string, string, string];
  stepRecord: number;
  retries: number;
  cycleTime: number;
};

/**
 * Target prisma yang dikirim pada tahap 2 (per-prisma).
 */
export type RtsPrismaTarget = {
  slot: number;
  name: string;
  targetHigh: string;
  HA: string;
  VA: string;
};

/**
 * Send RTS start command via MQTT — 3 tahap berurutan:
 * 1. Kirim config (jobName, prismConst, tsHigh, locCoor, stepRecord, retries, cycleTime)
 * 2. Kirim recordTarget untuk setiap prisma (slot, name, targetHigh, HA, VA)
 * 3. Kirim AutoTrackingStart: true
 */
export async function sendRtsStartCommand(
  loggerId: string,
  config: RtsConfigPayload,
  prismaTargets: RtsPrismaTarget[]
): Promise<boolean> {
  const topicTarget = process.env.MQTT_TOPIC || "ADR_Tambang_Kaltara";
  const setKey = `set_${loggerId}`;

  // Tahap 0: Kirim status kontrol
  const sendKontrol = {
    status: "1",
    status_manual: "1",
    datetime: new Date().toISOString(),
  };
  const r0 = await publishMqtt("kontrol-asaba", sendKontrol);

  // Tahap 1: Kirim config RTS
  const configPayload = {
    [setKey]: {
      command: "set_rts",
      jobName: config.jobName,
      prismConst: config.prismConst,
      tsHigh: config.tsHigh,
      locCoor: config.locCoor,
      stepRecord: config.stepRecord,
      retries: config.retries,
      cycleTime: config.cycleTime,
    },
  };
  const r1 = await publishMqtt(topicTarget, configPayload);

  // Tahap 2: Kirim recordTarget per-prisma
  let r2 = true;
  for (const target of prismaTargets) {
    const targetPayload = {
      [setKey]: {
        command: "set_rts",
        recordTarget: {
          slot: target.slot,
          name: target.name,
          targetHigh: target.targetHigh,
          HA: target.HA,
          VA: target.VA,
        },
      },
    };
    const ok = await publishMqtt(topicTarget, targetPayload);
    if (!ok) r2 = false;
  }

  // Tahap 3: Kirim AutoTrackingStart
  const startPayload = {
    [setKey]: {
      command: "set_rts",
      AutoTrackingStart: true,
    },
  };
  const r3 = await publishMqtt(topicTarget, startPayload);

  return r0 && r1 && r2 && r3;
}
