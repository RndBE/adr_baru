"use client";

import { useEffect, useState } from "react";
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
export function useLogKontrol(
  site?: string,
  limit = 50,
  opts: {
    /**
     * Sertakan rincian prisma per sesi (jumlah ditembak & berhasil). Default
     * true — perilaku lama. Matikan bila hanya butuh daftar tanggalnya: server
     * menjalankan satu query `rts` PER sesi, jadi pada limit besar ini mahal
     * sekali padahal hasilnya tidak dipakai.
     */
    withPrisma?: boolean;
  } = {}
) {
  const params = new URLSearchParams();
  if (site) params.set("site", site);
  params.set("limit", String(limit));
  if (opts.withPrisma === false) params.set("with_prisma", "false");

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
export function useDeformasi(
  idLog: string | null,
  opts: {
    /**
     * Saat `idLog` berganti, tetap kembalikan data sesi sebelumnya sampai yang
     * baru tiba (isLoading tetap true). Dipakai Beranda supaya tabel & grafik
     * tidak berkedip ke skeleton tiap kali sesi dipilih.
     */
    keepPreviousData?: boolean;
  } = {}
) {
  const { data, error, isLoading, mutate } = useSWR(
    idLog ? `/api/deformasi?id_log=${idLog}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: opts.keepPreviousData ?? false,
    }
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

/** Baris logger yang dibutuhkan untuk menemukan unit RTS. */
interface LoggerRingkas {
  id_logger?: string;
  temp_data?: string;
}

/**
 * Status koneksi RTS — terhubung bila data terakhir masuk dalam 1 jam terakhir.
 *
 * Ambang "1 jam" dihitung terhadap `nowMs` yang di-tick tiap menit, BUKAN
 * terhadap Date.now() saat render. Sebelumnya nilai itu dibaca saat render:
 * karena SWR tidak memuat ulang daftar logger (`revalidateOnFocus: false`,
 * `dedupingInterval: 30s`) selama tidak ada data baru, tidak ada yang memicu
 * render berikutnya — sehingga status "Terhubung" bertahan di layar meski
 * datanya sudah berhenti berjam-jam. Pola tick ini sama dengan yang dipakai
 * panel instrumen di Dashboard.
 */
export function useRtsConnectionStatus() {
  const { loggers } = useLoggers();
  const rtsLogger = (loggers as LoggerRingkas[] | undefined)?.find(
    (l) => l?.temp_data === "temp_rts"
  );
  const { detail } = useLoggerDetail(rtsLogger?.id_logger || null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tempRts = detail?.tempData?.[0];

  // Nilai waktu di DB adalah jam dinding WIB, jadi zonanya dipasang eksplisit.
  const isConnected = (() => {
    if (!tempRts?.waktu) return false;
    const rawWaktu =
      typeof tempRts.waktu === "string"
        ? tempRts.waktu
        : new Date(tempRts.waktu).toISOString();
    const dbWibStr = rawWaktu.split(".")[0].replace("Z", "") + "+07:00";
    const waktuTerakhirMs = new Date(dbWibStr).getTime();
    if (isNaN(waktuTerakhirMs)) return false;
    return waktuTerakhirMs >= nowMs - 60 * 60 * 1000;
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
    sensor7: tempRts?.sensor7 ?? 0,
  };
}
