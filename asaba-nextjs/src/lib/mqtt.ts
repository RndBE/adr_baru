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
  const r2 = await publishMqtt("ADR_Tambang_Kaltara", dataMqtt);

  return r1 && r2;
}
