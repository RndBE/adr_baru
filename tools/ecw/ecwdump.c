/*
 * ecwdump — buka berkas ECW lewat libecwj2 (ECW JPEG2000 SDK 3.3), lalu:
 *   info <in.ecw>                                        → metadata + georeferensi
 *   dump <in.ecw> <out.ppm> <w> <h>                      → seluruh raster, resolusi turunan
 *   crop <in.ecw> <out.ppm> <w> <h> <tlx> <tly> <brx> <bry>
 *
 * ECW memang dirancang untuk pembacaan resolusi turunan: meminta keluaran kecil
 * hanya mendekode level wavelet yang perlu, bukan seluruh raster.
 *
 * Nama fungsi SDK-nya berawalan NCScbm*, bukan NCS* — versi pertama berkas ini
 * memakai nama tanpa awalan itu dan tidak satu pun tertaut.
 *
 * NCSecwInit() WAJIB dipanggil lebih dulu. Headernya bilang "DO NOT call if
 * linking against the DLL", dan itu memang berlaku untuk DLL Windows; pada
 * .so Linux inisialisasi statiknya tidak jalan, jadi mutex global di dalam
 * CNCSJP2FileView masih NULL dan NCScbmOpenFileView() langsung SIGSEGV di
 * NCSMutexBegin(pMutex=0x20).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "NCSECWClient.h"
#include "NCSErrors.h"

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "usage: ecwdump info|dump|crop <in.ecw> ...\n"); return 2; }
    const char *mode = argv[1];
    char *in = (char *)argv[2];

    NCSecwInit();

    NCSFileView *pView = NULL;
    NCSError e = NCScbmOpenFileView(in, &pView, NULL);
    if (e != NCS_SUCCESS) {
        fprintf(stderr, "NCScbmOpenFileView gagal: %s\n", NCSGetErrorText(e));
        return 1;
    }
    NCSFileViewFileInfo *fi = NULL;
    NCScbmGetViewFileInfo(pView, &fi);

    if (!strcmp(mode, "info")) {
        printf("width=%u\n", (unsigned)fi->nSizeX);
        printf("height=%u\n", (unsigned)fi->nSizeY);
        printf("bands=%u\n", (unsigned)fi->nBands);
        printf("compression_rate=%u\n", (unsigned)fi->nCompressionRate);
        printf("cell_units=%d\n", (int)fi->eCellSizeUnits);
        printf("cell_x=%.12f\n", fi->fCellIncrementX);
        printf("cell_y=%.12f\n", fi->fCellIncrementY);
        /* fOrigin* = sudut KIRI-ATAS dari sel kiri-atas, bukan titik tengahnya. */
        printf("origin_x=%.6f\n", fi->fOriginX);
        printf("origin_y=%.6f\n", fi->fOriginY);
        printf("datum=%s\n", fi->szDatum ? fi->szDatum : "");
        printf("projection=%s\n", fi->szProjection ? fi->szProjection : "");
        NCScbmCloseFileView(pView);
        NCSecwShutdown();
        return 0;
    }

    if (argc < 6) { fprintf(stderr, "usage: ecwdump dump <in> <out.ppm> <w> <h>\n"); return 2; }
    const char *out = argv[3];
    UINT32 ow = (UINT32)strtoul(argv[4], NULL, 10);
    UINT32 oh = (UINT32)strtoul(argv[5], NULL, 10);

    UINT32 tlx = 0, tly = 0, brx = fi->nSizeX - 1, bry = fi->nSizeY - 1;
    if (!strcmp(mode, "crop")) {
        if (argc < 10) { fprintf(stderr, "crop butuh tlx tly brx bry\n"); return 2; }
        tlx = (UINT32)strtoul(argv[6], NULL, 10);
        tly = (UINT32)strtoul(argv[7], NULL, 10);
        brx = (UINT32)strtoul(argv[8], NULL, 10);
        bry = (UINT32)strtoul(argv[9], NULL, 10);
    }

    UINT32 nb = fi->nBands < 3 ? fi->nBands : 3;
    UINT32 bandlist[3] = {0, 1, 2};

    e = NCScbmSetFileView(pView, nb, bandlist, tlx, tly, brx, bry, ow, oh);
    if (e != NCS_SUCCESS) {
        fprintf(stderr, "NCScbmSetFileView gagal: %s\n", NCSGetErrorText(e));
        return 1;
    }

    FILE *f = fopen(out, "wb");
    if (!f) { perror("fopen"); return 1; }
    fprintf(f, "P6\n%u %u\n255\n", (unsigned)ow, (unsigned)oh);

    UINT8 *rgb = (UINT8 *)malloc((size_t)ow * 3);
    UINT8 *b0 = (UINT8 *)malloc(ow);
    UINT8 *bands[1] = {b0};

    for (UINT32 y = 0; y < oh; y++) {
        NCSEcwReadStatus st;
        if (nb >= 3) {
            st = NCScbmReadViewLineRGB(pView, rgb);
        } else {
            st = NCScbmReadViewLineBIL(pView, bands);
            for (UINT32 x = 0; x < ow; x++) rgb[x*3] = rgb[x*3+1] = rgb[x*3+2] = b0[x];
        }
        if (st != NCSECW_READ_OK) { fprintf(stderr, "baris %u gagal: status %d\n", (unsigned)y, (int)st); break; }
        fwrite(rgb, 1, (size_t)ow * 3, f);
    }
    fclose(f);
    fprintf(stderr, "selesai: %s (%ux%u) dari jendela %u,%u..%u,%u\n",
            out, (unsigned)ow, (unsigned)oh, (unsigned)tlx, (unsigned)tly, (unsigned)brx, (unsigned)bry);
    NCScbmCloseFileView(pView);
    NCSecwShutdown();
    return 0;
}
