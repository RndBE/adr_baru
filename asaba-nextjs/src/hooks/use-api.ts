"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch all loggers with location & category info.
 * GET /api/loggers
 */
export function useLoggers() {
  const { data, error, isLoading, mutate } = useSWR("/api/loggers", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
  return {
    loggers: data?.data || [],
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}

/**
 * Fetch a single logger detail with prisms, temp data, parameters.
 * GET /api/loggers/[id]
 */
export function useLoggerDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/loggers/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      refreshInterval: 1000,   // auto-refresh setiap 3 detik supaya kesan real-time
    }
  );
  return {
    detail: data?.data || null,
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}

/**
 * Fetch log_kontrol entries (tanggal running).
 * GET /api/log-kontrol?site=xxx&limit=xxx
 */
export function useLogKontrol(site?: string, limit = 50) {
  const params = new URLSearchParams();
  if (site) params.set("site", site);
  params.set("limit", String(limit));

  const { data, error, isLoading, mutate } = useSWR(
    `/api/log-kontrol?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  return {
    logs: data?.data || [],
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}

/**
 * Fetch deformation data for a specific log entry.
 * GET /api/deformasi?id_log=XXXX
 */
export function useDeformasi(idLog: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    idLog ? `/api/deformasi?id_log=${idLog}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  return {
    deformasi: data?.data || null,
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}

/**
 * Fetch sensor data (awlr/ews/rts) for a specific logger.
 * GET /api/sensor-data?logger=xxx&table=xxx&from=xxx&to=xxx&limit=xxx
 */
export function useSensorData(
  logger: string | null,
  table: string | null,
  opts?: { from?: string; to?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (logger) params.set("logger", logger);
  if (table) params.set("table", table);
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  if (opts?.limit) params.set("limit", String(opts.limit));

  const { data, error, isLoading, mutate } = useSWR(
    logger && table ? `/api/sensor-data?${params.toString()}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  return {
    sensorData: data?.data || [],
    isLoading,
    isError: !!error || data?.success === false,
    mutate,
  };
}

/**
 * Fetch RTS connection status (Connected if latest data < 1 hour)
 */
export function useRtsConnectionStatus() {
  const { loggers } = useLoggers();
  const rtsLogger = loggers?.find((l: any) => l?.temp_data === "temp_rts");
  const { detail } = useLoggerDetail(rtsLogger?.id_logger || null);

  const tempRts = detail?.tempData?.[0];

  const isConnected = (() => {
    if (!tempRts?.waktu) return false;
    const rawWaktu = typeof tempRts.waktu === "string" ? tempRts.waktu : new Date(tempRts.waktu).toISOString();
    const dbWibStr = rawWaktu.split(".")[0].replace("Z", "") + "+07:00";
    const waktuTerakhirMs = new Date(dbWibStr).getTime();
    const satuJamLaluMs = Date.now() - (60 * 60 * 1000);
    return waktuTerakhirMs >= satuJamLaluMs;
  })();

  return { 
    isConnected, 
    lastUpdate: tempRts?.waktu || null, 
    idLogger: rtsLogger?.id_logger,
    sensor14: tempRts?.sensor14 ?? 0,
    sensor16: tempRts?.sensor16 ?? 0,
    sensor17: tempRts?.sensor17 ?? 0,
    sensor5: tempRts?.sensor5 ?? 0,
    sensor6: tempRts?.sensor6 ?? 0,
    sensor7: tempRts?.sensor7 ?? 0
  };
}
