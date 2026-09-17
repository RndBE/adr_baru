#!/usr/bin/env python3
"""
Ubah kontur DXF jadi DEM raster untuk lantai scene Visualisasi 3D.

    python3 tools/dxf/kontur-ke-dem.py <kontur.dxf> <keluaran.png> \
        --bbox minE minN maxE maxN [--lebar 800]

Keluarannya PNG abu-abu + alfa:
  - nilai abu  = elevasi, dipetakan linier dari minZ..maxZ ke 0..255
  - alfa 0     = tidak ada data tinggi di sel itu
Rentang minZ/maxZ dicetak ke stdout; simpan ke t_site.basemap_dem_min_z/max_z.

── Kenapa relaksasi Laplace, bukan IDW ─────────────────────────────────────

Interpolasi jarak-terbalik dari simpul kontur menghasilkan "mata sapi": tiap
simpul jadi puncak atau cekungan kecil, dan lerengnya bertangga mengikuti garis
konturnya. Di atas ortofoto tambang hasilnya terlihat seperti kerusakan data,
bukan seperti tanah.

Yang dipakai di sini: garis konturnya dirasterkan sebagai sel bernilai TETAP,
lalu sel sisanya direlaksasi berulang ke rata-rata empat tetangganya. Itu
menyelesaikan persamaan Laplace dengan kontur sebagai syarat batas — permukaan
paling mulus yang masih melewati setiap garis kontur dengan tepat. Persis
perilaku yang diharapkan dari peta topografi, dan tanpa dependensi selain numpy.

── Sel yang tidak punya jawaban ────────────────────────────────────────────

Di luar jangkauan konturnya, relaksasi cuma menyebarkan nilai tepi ke mana-mana
— mulus, meyakinkan, dan tidak berdasar apa pun. Sel di luar area survei karena
itu ditandai nodata, dan penampil tidak menggambar segitiga di sana. Ortofoto
BPP 1-4 memang lebih luas daripada surveinya: tepi barat ~160 m dan tepi timur
~40 m tidak punya kontur sama sekali.

Batas areanya dicari dengan PENUTUPAN morfologis — dilatasi sejauh
`--jangkauan` lalu erosi sejauh itu juga — bukan sekadar "sejauh apa dari garis
kontur terdekat". Bedanya penting: kolam yang datar memang TIDAK punya garis
kontur di tengahnya, jadi ukuran jarak akan melubangi justru bagian yang paling
disurvei. Penutupan menambal lubang yang terkurung tanpa ikut memuaikan tepi
luarnya. Sesudah itu ditambah pemuaian kecil `--tepi` supaya tanahnya tidak
berhenti persis di garis kontur terluar.
"""
import argparse, struct, sys, zlib
import numpy as np


def baca_kontur(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        baris = [l.rstrip("\r\n") for l in f]
    kode, nilai = baris[0::2], baris[1::2]
    plines, cur, vx = [], None, None
    for k, v in zip(kode, nilai):
        k = k.strip()
        if k == "0":
            if vx is not None and cur is not None:
                cur.append(vx)
                vx = None
            if v == "POLYLINE":
                if cur:
                    plines.append(cur)
                cur = []
            elif v == "VERTEX":
                vx = {}
            elif v == "SEQEND":
                if cur:
                    plines.append(cur)
                cur = None
        elif vx is not None:
            if k == "10": vx["x"] = float(v)
            elif k == "20": vx["y"] = float(v)
            elif k == "30": vx["z"] = float(v)
    if cur:
        plines.append(cur)
    return [[(t["x"], t["y"], t["z"]) for t in p if "x" in t] for p in plines if len(p) >= 2]


def tulis_png_gray_alpha(path, gray, alpha):
    """PNG 8-bit grayscale+alpha. Ditulis tangan supaya tidak perlu Pillow."""
    h, w = gray.shape
    baris = bytearray()
    for y in range(h):
        baris.append(0)  # filter None
        baris += np.stack([gray[y], alpha[y]], axis=1).astype(np.uint8).tobytes()

    def chunk(tipe, data):
        return (struct.pack(">I", len(data)) + tipe + data
                + struct.pack(">I", zlib.crc32(tipe + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 4, 0, 0, 0))  # colour type 4 = gray+alpha
    png += chunk(b"IDAT", zlib.compress(bytes(baris), 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dxf")
    ap.add_argument("keluaran")
    ap.add_argument("--bbox", nargs=4, type=float, required=True,
                    metavar=("minE", "minN", "maxE", "maxN"))
    ap.add_argument("--lebar", type=int, default=800)
    ap.add_argument("--jangkauan", type=float, default=250.0,
                    help="radius penutupan morfologis, meter — harus lebih besar "
                         "dari kolam datar terlebar supaya tengahnya tidak berlubang")
    ap.add_argument("--tepi", type=float, default=15.0,
                    help="pemuaian akhir di luar kontur terluar, meter")
    ap.add_argument("--iterasi", type=int, default=3000)
    a = ap.parse_args()

    minE, minN, maxE, maxN = a.bbox
    W = a.lebar
    H = max(2, round(W * (maxN - minN) / (maxE - minE)))
    selE = (maxE - minE) / W
    selN = (maxN - minN) / H
    print(f"grid {W} x {H}  ({selE:.2f} x {selN:.2f} m per sel)")

    plines = baca_kontur(a.dxf)
    print(f"polyline {len(plines)}, vertex {sum(len(p) for p in plines)}")

    Z = np.zeros((H, W), dtype=np.float64)
    tetap = np.zeros((H, W), dtype=bool)

    # Rasterisasi: tiap ruas dicuplik lebih rapat daripada satu sel, supaya
    # tidak ada garis kontur yang bocor melewati grid tanpa meninggalkan jejak.
    for p in plines:
        arr = np.asarray(p, dtype=np.float64)
        for i in range(len(arr) - 1):
            x0, y0, z0 = arr[i]
            x1, y1, z1 = arr[i + 1]
            n = int(max(abs(x1 - x0) / selE, abs(y1 - y0) / selN) * 2) + 2
            t = np.linspace(0.0, 1.0, n)
            xs, ys = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            zs = z0 + (z1 - z0) * t
            cx = np.clip(((xs - minE) / selE).astype(np.int32), 0, W - 1)
            cy = np.clip(((maxN - ys) / selN).astype(np.int32), 0, H - 1)
            Z[cy, cx] = zs
            tetap[cy, cx] = True

    print(f"sel bernilai tetap: {int(tetap.sum())} ({100*tetap.mean():.1f}%)")
    if not tetap.any():
        sys.exit("tidak ada kontur yang jatuh di dalam bbox")

    def dilatasi(m, n):
        out = m.copy()
        for _ in range(n):
            g = np.zeros_like(out)
            g[1:, :] |= out[:-1, :]; g[:-1, :] |= out[1:, :]
            g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
            out |= g
        return out

    def erosi(m, n):
        # Erosi = dilatasi pada komplemennya. Tepi grid diperlakukan sebagai
        # LUAR, supaya area yang menyentuh tepi tidak ikut menciut ke dalam.
        luar = ~m
        for _ in range(n):
            g = luar.copy()
            g[1:, :] |= luar[:-1, :]; g[:-1, :] |= luar[1:, :]
            g[:, 1:] |= luar[:, :-1]; g[:, :-1] |= luar[:, 1:]
            luar = g
        return ~luar

    sel_min = min(selE, selN)
    n_tutup = int(round(a.jangkauan / sel_min))
    n_tepi = int(round(a.tepi / sel_min))
    ada = erosi(dilatasi(tetap, n_tutup), n_tutup)
    if n_tepi:
        ada = dilatasi(ada, n_tepi)
    print(f"sel berdata: {int(ada.sum())} ({100*ada.mean():.1f}%)  "
          f"[penutupan {n_tutup} sel, tepi {n_tepi} sel]")

    # Relaksasi Laplace di sel yang belum tetap.
    Z[~tetap] = Z[tetap].mean()
    for it in range(a.iterasi):
        rata = np.empty_like(Z)
        rata[1:-1, 1:-1] = 0.25 * (Z[:-2, 1:-1] + Z[2:, 1:-1] + Z[1:-1, :-2] + Z[1:-1, 2:])
        rata[0, :] = Z[1, :]; rata[-1, :] = Z[-2, :]
        rata[:, 0] = Z[:, 1]; rata[:, -1] = Z[:, -2]
        baru = np.where(tetap, Z, rata)
        delta = np.abs(baru - Z).max()
        Z = baru
        if delta < 1e-4:
            print(f"konvergen di iterasi {it} (delta {delta:.2e})")
            break
    else:
        print(f"berhenti di {a.iterasi} iterasi (delta {delta:.2e})")

    minZ = float(Z[ada].min()); maxZ = float(Z[ada].max())
    gray = np.zeros((H, W), dtype=np.uint8)
    rentang = maxZ - minZ or 1.0
    gray[ada] = np.clip(np.round((Z[ada] - minZ) / rentang * 255), 0, 255)
    alpha = np.where(ada, 255, 0).astype(np.uint8)
    tulis_png_gray_alpha(a.keluaran, gray, alpha)

    print(f"\nminZ {minZ:.3f}   maxZ {maxZ:.3f}   (langkah {rentang/255:.3f} m per tingkat abu)")
    print(f"ditulis: {a.keluaran}")
    print("\nIsi ke t_site:")
    print(f"  basemap_dem_url   = '/basemap/<slug>-dem.png'")
    print(f"  basemap_dem_min_z = {minZ:.3f}")
    print(f"  basemap_dem_max_z = {maxZ:.3f}")


if __name__ == "__main__":
    main()
