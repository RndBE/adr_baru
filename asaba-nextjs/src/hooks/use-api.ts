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
    { revalidateOnFocus: false, dedupingInterval: 15000 }
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
