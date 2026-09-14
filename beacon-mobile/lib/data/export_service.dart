import 'dart:typed_data';
import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'models.dart';

Uint8List measurementWorkbook(
  SiteData site,
  List<RunSession> sessions, {
  int? slot,
}) {
  final book = Excel.createExcel();
  book.rename('Sheet1', 'Pengukuran');
  final tab = book['Pengukuran'];
  tab.appendRow([TextCellValue('BEACON · ${site.name}')]);
  tab.appendRow(
    [
      'Sesi',
      'Waktu',
      'Prisma',
      'Status',
      'N0 (m)',
      'E0 (m)',
      'Z0 (m)',
      'N1 (m)',
      'E1 (m)',
      'Z1 (m)',
      'ΔN (mm)',
      'ΔE (mm)',
      'ΔZ (mm)',
      'Pergeseran (mm)',
      'HA (°)',
      'VA (°)',
      'Slope distance (m)',
    ].map(TextCellValue.new).toList(),
  );
  for (final session in sessions) {
    for (final r in session.readings.where(
      (r) => slot == null || r.slot == slot,
    )) {
      tab.appendRow([
        TextCellValue(session.id),
        TextCellValue(session.time.toIso8601String()),
        TextCellValue(r.name),
        TextCellValue(r.success ? 'Berhasil' : 'Gagal'),
        DoubleCellValue(r.n0),
        DoubleCellValue(r.e0),
        DoubleCellValue(r.z0),
        r.success ? DoubleCellValue(r.n) : null,
        r.success ? DoubleCellValue(r.e) : null,
        r.success ? DoubleCellValue(r.z) : null,
        r.success ? DoubleCellValue(r.dn) : null,
        r.success ? DoubleCellValue(r.de) : null,
        r.success ? DoubleCellValue(r.dz) : null,
        r.success ? DoubleCellValue(r.displacement) : null,
        DoubleCellValue(r.ha),
        DoubleCellValue(r.va),
        r.success ? DoubleCellValue(r.sd) : null,
      ]);
    }
  }
  return Uint8List.fromList(book.encode()!);
}

Future<void> exportMeasurements(
  BuildContext context,
  SiteData site,
  List<RunSession> sessions, {
  int? slot,
}) async {
  final bytes = measurementWorkbook(site, sessions, slot: slot);
  final box = context.findRenderObject() as RenderBox?;
  final name = 'beacon-${site.id}${slot == null ? '' : '-P$slot'}.xlsx';
  await SharePlus.instance.share(
    ShareParams(
      files: [
        XFile.fromData(
          bytes,
          mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: name,
        ),
      ],
      fileNameOverrides: [name],
      title: 'Pengukuran ${site.name}',
      sharePositionOrigin: box == null
          ? null
          : box.localToGlobal(Offset.zero) & box.size,
    ),
  );
}
