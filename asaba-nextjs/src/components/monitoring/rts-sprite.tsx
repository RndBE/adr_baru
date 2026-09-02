"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TOTAL_FRAME = 65; // /rts-frames/1.png … 65.png
const FRAME_MS = 60;

/**
 * Foto unit RTS sebagai sprite 65 frame — frame yang sama dengan halaman
 * Kontrol ADR. Saat `running`, bagian atas berputar bolak-balik di atas dasar
 * yang diam; saat idle hanya frame pertama yang dimuat.
 *
 * File frame berlatar PUTIH PEKAT (bukan transparan). Di panel gelap itu akan
 * jadi kotak putih, maka foto ditaruh di piringan terang dan dicampur dengan
 * mix-blend multiply: putihnya melebur ke gradien piringan tanpa tepi kotak,
 * sementara warna instrumennya sendiri hampir tidak berubah.
 */
export function RtsSprite({
  running,
  size = 128,
  className,
}: {
  running: boolean;
  size?: number;
  className?: string;
}) {
  const [frame, setFrame] = useState(1);
  const arah = useRef<1 | -1>(1);
  // Diset saat putaran dimulai; tick pertama mengembalikan frame ke 1 supaya
  // gerakan selalu berawal dari posisi diam — tanpa setState di dalam effect.
  const mulaiUlang = useRef(false);

  useEffect(() => {
    if (!running) return;
    arah.current = 1;
    mulaiUlang.current = true;
    // Muat semua frame lebih dulu supaya putaran pertama tidak berkedip.
    const cache = Array.from({ length: TOTAL_FRAME }, (_, i) => {
      const im = new window.Image();
      im.src = `/rts-frames/${i + 1}.png`;
      return im;
    });
    const id = setInterval(() => {
      setFrame((prev) => {
        if (mulaiUlang.current) {
          mulaiUlang.current = false;
          return 1;
        }
        let next = prev + arah.current;
        if (next >= TOTAL_FRAME) {
          arah.current = -1;
          next = TOTAL_FRAME;
        } else if (next <= 1) {
          arah.current = 1;
          next = 1;
        }
        return next;
      });
    }, FRAME_MS);
    return () => {
      clearInterval(id);
      cache.length = 0;
    };
  }, [running]);

  // Saat diam selalu frame 1 — state lama boleh tertinggal, tidak dipakai.
  const frameTampil = running ? frame : 1;

  return (
    <div
      aria-hidden="true"
      className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 50% 38%, #ffffff 0%, #eef0f7 62%, #dde1ee 100%)",
        boxShadow:
          "0 0 0 1px oklch(1 0 0 / 14%), 0 18px 36px -18px oklch(0 0 0 / 70%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rts-frames/1.png"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
      />
      {running && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/rts-frames/${frameTampil}.png`}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
          style={{ clipPath: "inset(0 0 18.5% 0)" }}
        />
      )}
    </div>
  );
}
