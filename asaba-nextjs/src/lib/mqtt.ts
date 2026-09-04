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

/**
 * Topik per alat, sesuai PROTOKOL_MQTT_ADR bagian A.
 *
 * Sebelumnya satu topik tetap melayani semua logger, dan balasan harus ditebak
 * miliknya siapa karena balasan tidak pernah memuat ID alat. Sekarang topiknya
 * yang membedakan: perintah ke `sub_<idAlat>`, balasan perintah di
 * `pub_<idAlat>`.
 *
 * Data pengukuran berkala TIDAK keluar di `pub_<idAlat>` — ia punya topik
 * sendiri, `Logger_<idAlat>` (bagian F). Yang berlangganan di situ adalah
 * service bridge terpisah, yang meneruskan isinya ke POST /api/datamasuk/adr;
 * aplikasi ini tidak subscribe topik itu untuk menerima data.
 *
 * Pola namanya ter-hardcode di firmware — tidak ada env yang bisa mengubahnya,
 * jadi sengaja tidak dibuat bisa disetel.
 */
export function topikPerintah(idAlat: string | number): string {
  return `sub_${idAlat}`;
}

export function topikBalasan(idAlat: string | number): string {
  return `pub_${idAlat}`;
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
 * Send RTS start command via MQTT — hanya AutoTrackingStart.
 * Config dikirim dari RTS Config page, recordTarget dari Prism Config page.
 */
export async function sendRtsStartCommand(loggerId: string): Promise<boolean> {
  const sendKontrol = {
    status: "1",
    status_manual: "1",
    datetime: new Date().toISOString(),
  };

  const dataMqtt = {
    [`set_${loggerId}`]: {
      command: "set_rts",
      AutoTrackingStart: true,
    },
  };

  const r1 = await publishMqtt("kontrol-asaba", sendKontrol);
  const topicTarget = topikPerintah(loggerId);
  const r2 = await publishMqtt(topicTarget, dataMqtt);

  return r1 && r2;
}

/**
 * Send RTS config via MQTT — dipanggil saat save RTS Config.
 */
export async function sendRtsConfig(
  loggerId: string,
  config: {
    jobName: string;
    prismConst: string;
    tsHigh: string;
    locCoor: [string, string, string];
    stepRecord: number;
    retries: number;
    cycleTime: number;
  }
): Promise<boolean> {
  const topicTarget = topikPerintah(loggerId);
  const payload = {
    [`set_${loggerId}`]: {
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
  return publishMqtt(topicTarget, payload);
}

/**
 * Send recordTarget via MQTT — dipanggil saat Auto Search di Prism Config.
 */
export async function sendRtsRecordTarget(
  loggerId: string,
  target: { slot: number; name: string; targetHigh: string; HA: string; VA: string }
): Promise<boolean> {
  const topicTarget = topikPerintah(loggerId);
  const payload = {
    [`set_${loggerId}`]: {
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
  return publishMqtt(topicTarget, payload);
}

