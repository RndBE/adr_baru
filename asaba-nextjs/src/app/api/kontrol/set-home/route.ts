import { NextRequest, NextResponse } from "next/server";
import { publishMqtt, topikPerintah } from "@/lib/mqtt";
import { getLoggerForSite } from "@/lib/sites";

/**
 * POST /api/kontrol/set-home
 *
 * Menyimpan orientasi teleskop SAAT INI sebagai posisi home, di bawah nama yang
 * diberikan operator (PROTOKOL_MQTT_ADR, Bagian C.1 — kunci `setHome`).
 *
 * `site` WAJIB, tidak seperti auto-search/power yang membiarkannya opsional
 * demi pemanggil lama. Endpoint ini baru, jadi tidak ada pemanggil lama yang
 * perlu dijaga — dan salah menebak logger di sini berarti menimpa posisi home
 * milik site lain, yang baru ketahuan saat PowerOff atau AutoTracking memutar
 * teleskop ke arah yang keliru.
 *
 * Nilai `setHome` adalah NAMA posisi home, BUKAN penanda aksi:
 *
 *   {"set_30002":{"command":"set_rts","setHome":"HOME-01"}}
 *
 * Tabel C.1 protokol menulis perintah ini TIDAK punya balasan. Kenyataannya
 * firmware membalas (terlihat 31 Agustus 2026):
 *
 *   {"setHome":{"setHome":"HOME,0,151,42,06,206,04,54;"}}
 *
 * Kunci dalamnya mengulang nama perintahnya, bukan `value` seperti aturan dasar
 * #2. Balasan itu ditangkap browser lewat MQTT WebSocket, bukan di sini — route
 * ini tetap fire-and-forget seperti auto-search dan go-to-target, jadi `success`
 * hanya berarti perintahnya terkirim ke broker.
 *
 * Body: { site: string, namaHome: string }
 */

/**
 * Batas panjang nama home.
 *
 * TIDAK ada di dokumen protokol — dipilih sendiri. 20 dipakai karena balasan
 * firmware memuat nama itu kembali di dalam satu frame pendek, dan nama panjang
 * berisiko terpotong di sana tanpa ada yang memberi tahu. Kalau dokumen protokol
 * kelak menyebut angka resmi, angka itu yang menang.
 */
const MAKS_PANJANG_NAMA_HOME = 20;

/**
 * Karakter yang merusak frame balasan.
 *
 * Balasannya berbentuk `NAMA,0,151,42,06,206,04,54;` — dipisah koma dan ditutup
 * titik koma. Nama yang memuat `,` atau `;` menggeser seluruh medan setelahnya,
 * jadi ditolak di sini daripada menghasilkan balasan yang tidak bisa dibaca.
 * Karakter kendali ditolak dengan alasan yang sama: firmware mengirim frame ini
 * sebagai teks polos.
 *
 * Tanda hubung TIDAK dilarang — `HOME-01` justru bentuk yang dipakai di lapangan.
 */
const POLA_NAMA_HOME_TERLARANG = /[,;\u0000-\u001F\u007F]/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site, namaHome } = body as { site?: string; namaHome?: string };

    if (!site) {
      return NextResponse.json(
        { success: false, error: "site wajib diisi" },
        { status: 400 }
      );
    }

    // Nama dinormalkan dengan trim saja. Huruf TIDAK dipaksa kapital: nama yang
    // tampil di UI harus sama persis dengan yang dikirim ke firmware, supaya
    // balasan bisa dicocokkan tanpa menebak-nebak transformasinya.
    const nama = typeof namaHome === "string" ? namaHome.trim() : "";

    if (!nama) {
      return NextResponse.json(
        { success: false, error: "Nama home wajib diisi" },
        { status: 400 }
      );
    }

    if (nama.length > MAKS_PANJANG_NAMA_HOME) {
      return NextResponse.json(
        {
          success: false,
          error: `Nama home maksimal ${MAKS_PANJANG_NAMA_HOME} karakter`,
        },
        { status: 400 }
      );
    }

    if (POLA_NAMA_HOME_TERLARANG.test(nama)) {
      return NextResponse.json(
        {
          success: false,
          error: "Nama home tidak boleh memuat koma, titik koma, atau karakter kendali",
        },
        { status: 400 }
      );
    }

    const id_logger = await getLoggerForSite(site);
    if (!id_logger) {
      return NextResponse.json(
        { success: false, error: `Logger untuk site "${site}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const topicTarget = topikPerintah(id_logger);
    const payload = {
      [`set_${id_logger}`]: {
        command: "set_rts",
        setHome: nama,
      },
    };
    const mqttSent = await publishMqtt(topicTarget, payload);

    return NextResponse.json({
      success: true,
      // Dinamai apa adanya: yang dijamin hanya pengiriman, bukan penyimpanan.
      // `nama_home` dikembalikan supaya UI menampilkan nama yang BENAR-BENAR
      // dikirim (sudah ter-trim), bukan isi kotak input sebelum dibersihkan.
      data: { site, id_logger, nama_home: nama, mqtt_sent: mqttSent },
      message: "Perintah Set Home terkirim. Konfirmasinya datang lewat MQTT.",
    });
  } catch (error) {
    console.error("[POST /api/kontrol/set-home]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirim perintah Set Home" },
      { status: 500 }
    );
  }
}
