/**
 * Ubah sebuah <svg> yang sedang tampil jadi PNG.
 *
 * Dipakai ekspor Excel: ExcelJS 4.4 bisa menyisipkan GAMBAR (`addImage`) tapi
 * tidak bisa membuat grafik native Excel — tidak ada `addChart` sama sekali.
 * Jadi grafik gabungan masuk ke berkas sebagai gambar, dan deret angkanya ikut
 * di lembar terpisah supaya pembaca masih bisa membuat grafik Excel sendiri.
 *
 * Browser-only: memakai canvas dan getComputedStyle.
 */

/**
 * Warna dan font di grafik ditulis sebagai custom property CSS
 * (`var(--ink-3)`, `var(--font-geist-mono)`). Begitu SVG-nya dilepas dari
 * dokumen dan dimuat lewat <img>, tidak ada lagi yang menyelesaikan variabel
 * itu — seluruh garis dan teks jatuh ke hitam atau hilang. Karena itu tiap
 * `var(--nama)` diganti nilai terhitungnya SEBELUM diserialkan.
 */
export function gantiVariabelCss(
  markup: string,
  /** Nilai terhitung sebuah custom property; "" bila tidak terdefinisi. */
  resolusi: (nama: string) => string
): string {
  const sudah = new Map<string, string>();
  return markup.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (utuh, nama: string, cadangan?: string) => {
    if (!sudah.has(nama)) sudah.set(nama, resolusi(nama).trim());
    const nilai = sudah.get(nama)!;
    // Variabel tak terdefinisi jatuh ke nilai cadangan di dalam var() kalau ada;
    // kalau tidak, teksnya dibiarkan utuh. Menggantinya dengan string kosong
    // akan menghasilkan atribut kosong, dan SVG-nya ditolak sebagai gambar.
    // Kutip ganda di dalam nilai akan MENUTUP atribut yang sedang ditulisi.
    // Nama font hasil next/font datang berkutip — `"__geistMono_abc"` — dan
    // menyisipkannya ke font-family="var(--font-geist-mono), …" menghasilkan
    // font-family=""__geistMono_abc", …" : atribut putus, SVG tidak lagi sah,
    // dan <img> menolaknya tanpa memberi tahu apa yang salah. Kutip ganda
    // ditukar kutip tunggal, yang sah di CSS dan tidak menutup atribut.
    if (nilai) return nilai.replace(/"/g, "'");
    return cadangan?.trim() ? cadangan.trim() : utuh;
  });
}

/**
 * Font web tidak ikut termuat di dalam <img>, jadi nama font apa pun akan jatuh
 * ke bawaan peramban. Ditulis tegas ke tumpukan generik supaya hasilnya sama di
 * mesin mana pun, bukan bergantung font yang kebetulan terpasang.
 */
export const FONT_EKSPOR = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function seragamkanFont(markup: string): string {
  return (
    markup
      // Bentuk ATRIBUT: font-family="…"
      .replace(/font-family\s*=\s*(["'])(?:(?!\1).)*\1/g, `font-family="${FONT_EKSPOR}"`)
      // Bentuk DEKLARASI CSS di dalam atribut style: font-family: …
      //
      // Dua bentuk ini TIDAK boleh ditangani satu pola. Pola tunggal yang
      // menerima ":" maupun "=" lalu menulis ulang jadi bentuk atribut akan
      // menghasilkan style="font-family="…"" — tanda kutip bersarang, markup
      // rusak, dan SVG-nya ditolak saat dimuat sebagai gambar. Grafiknya lalu
      // hilang dari berkas Excel tanpa satu pun galat.
      .replace(/font-family\s*:\s*[^;"]*/g, `font-family:${FONT_EKSPOR}`)
  );
}

export interface GrafikPng {
  dataUrl: string;
  /** Ukuran dalam piksel CSS — bukan piksel gambar, yang dikali `skala`. */
  lebar: number;
  tinggi: number;
}

/**
 * `skala` menaikkan resolusi gambar tanpa mengubah ukuran tampilnya di Excel;
 * 2 membuat teks sumbu tetap tajam saat lembarnya di-zoom atau dicetak.
 */
export async function svgKePng(
  svg: SVGSVGElement,
  opsi: { skala?: number; latar?: string } = {}
): Promise<GrafikPng> {
  const skala = opsi.skala ?? 2;
  const kotak = svg.getBoundingClientRect();
  const lebar = Math.max(1, Math.round(kotak.width || svg.clientWidth || 800));
  const tinggi = Math.max(1, Math.round(kotak.height || svg.clientHeight || 300));

  const salinan = svg.cloneNode(true) as SVGSVGElement;
  salinan.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  salinan.setAttribute("width", String(lebar));
  salinan.setAttribute("height", String(tinggi));
  if (!salinan.getAttribute("viewBox")) {
    salinan.setAttribute("viewBox", `0 0 ${lebar} ${tinggi}`);
  }

  const gaya = getComputedStyle(svg);
  let markup = new XMLSerializer().serializeToString(salinan);
  // Urutannya penting: font diseragamkan DULU. Kalau var() diselesaikan lebih
  // dulu, nilai font berkutip sempat masuk ke dalam markup, dan kalaupun
  // kutipnya ditukar hasilnya tetap tergantung pada apa yang dikembalikan
  // peramban. Menyeragamkan lebih dulu membuat var(--font-*) tidak pernah
  // sampai ke tahap substitusi sama sekali.
  markup = seragamkanFont(markup);
  markup = gantiVariabelCss(markup, (nama) => gaya.getPropertyValue(nama));

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const gambar = await new Promise<HTMLImageElement>((selesai, gagal) => {
    const img = new Image();
    img.onload = () => selesai(img);
    img.onerror = () => gagal(new Error("SVG tidak bisa dimuat sebagai gambar"));
    img.src = url;
  });

  const kanvas = document.createElement("canvas");
  kanvas.width = lebar * skala;
  kanvas.height = tinggi * skala;
  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  // Latar ditimpa putih: PNG transparan di atas sel Excel yang juga putih
  // memang tidak terlihat bedanya, tapi begitu lembarnya diberi warna atau
  // dicetak, teks sumbu yang gelap di atas transparan bisa jadi tak terbaca.
  ctx.fillStyle = opsi.latar ?? "#ffffff";
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);

  return { dataUrl: kanvas.toDataURL("image/png"), lebar, tinggi };
}

/** <svg> milik grafik Recharts di dalam sebuah wadah; null bila belum tergambar. */
export function cariSvgRecharts(wadah: HTMLElement | null): SVGSVGElement | null {
  return wadah?.querySelector<SVGSVGElement>("svg.recharts-surface") ?? null;
}
