import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../core/charts.dart';
import '../data/repository.dart';
import '../data/export_service.dart';
import '../data/models.dart';
import 'dashboard.dart';

class ResultsPage extends StatefulWidget {
  const ResultsPage({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  State<ResultsPage> createState() => _ResultsPageState();
}

class _ResultsPageState extends State<ResultsPage> {
  String mode = 'Harian', query = '', status = 'Semua';
  String? sessionId;
  DateTimeRange? range;
  Set<String> columns = {
    'Koordinat awal',
    'Koordinat hasil',
    'Pergeseran',
    'Sudut',
    'Arah',
  };
  @override
  Widget build(BuildContext context) {
    final site = widget.repo.site;
    final sessions = site.sessions
        .where(
          (s) =>
              range == null ||
              (!s.time.isBefore(range!.start) &&
                  s.time.isBefore(range!.end.add(const Duration(days: 1)))),
        )
        .toList();
    final selected =
        sessions.where((s) => s.id == sessionId).firstOrNull ??
        sessions.firstOrNull;
    final daySessions =
        selected == null
              ? <RunSession>[]
              : site.sessions
                    .where((s) => DateUtils.isSameDay(s.time, selected.time))
                    .toList()
          ..sort((a, b) => a.time.compareTo(b.time));
    final dayRows = <int, Reading>{};
    for (final s in daySessions) {
      for (final r in s.readings) {
        dayRows[r.slot] = r;
      }
    }
    final source = mode == 'Harian'
        ? dayRows.values.toList()
        : selected?.readings ?? <Reading>[];
    final rows = source
        .where(
          (r) =>
              (r.name.toLowerCase().contains(query.toLowerCase()) ||
                  'p${r.slot}'.contains(query.toLowerCase())) &&
              (status == 'Semua' || r.statusUntuk(site) == status),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Surface(
          // Padding vertikal dipangkas dari 18 yang seragam.
          //
          // Baris atas berakhir dengan IconButton dan baris bawah dengan
          // TextButton; keduanya sudah membawa padding sentuh 8–12 px sendiri.
          // Ditumpuk di atas padding kartu, jaraknya jadi dua kali lipat di
          // atas dan di bawah sementara isinya rapat di tengah.
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.calendar_month_outlined,
                    color: navy,
                    size: 19,
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Tanggal running',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Filter rentang tanggal',
                    onPressed: () async {
                      final picked = await showDateRangePicker(
                        context: context,
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(const Duration(days: 1)),
                        initialDateRange: range,
                        helpText: 'Rentang pengukuran',
                        saveText: 'Terapkan',
                      );
                      if (picked != null && mounted) {
                        setState(() => range = picked);
                      }
                    },
                    icon: const Icon(Icons.tune, size: 20),
                  ),
                ],
              ),
              if (range != null)
                InputChip(
                  label: Text(
                    '${dateLabel(range!.start)} – ${dateLabel(range!.end)}',
                    style: const TextStyle(fontSize: 10),
                  ),
                  onDeleted: () => setState(() => range = null),
                ),
              // Label mengambang "Pilih sesi" duduk DI ATAS garis atas kotak,
              // jadi tanpa jarak ini ia menempel pada baris judul.
              if (sessions.isNotEmpty) const SizedBox(height: 10),
              if (sessions.isNotEmpty)
                DropdownButtonFormField<String>(
                  key: ValueKey('${site.id}-${selected?.id}'),
                  initialValue: selected?.id,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Pilih sesi'),
                  items: sessions
                      .map(
                        (s) => DropdownMenuItem(
                          value: s.id,
                          child: Text(
                            '${dateLabel(s.time)} · ${timeLabel(s.time)}${s.reference ? ' · R0' : ''}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => sessionId = v),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${sessions.length} sesi dalam rentang',
                      style: const TextStyle(fontSize: 11, color: muted),
                    ),
                  ),
                  TextButton(
                    onPressed: () => showReference(context, site),
                    child: const Text('Acuan R0'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'Harian',
                label: Text('Harian'),
                icon: Icon(Icons.show_chart),
              ),
              ButtonSegment(
                value: 'Event',
                label: Text('Event'),
                icon: Icon(Icons.table_rows_outlined),
              ),
              ButtonSegment(
                value: 'Peta',
                label: Text('Peta'),
                icon: Icon(Icons.map_outlined),
              ),
            ],
            selected: {mode},
            onSelectionChanged: (v) => setState(() => mode = v.first),
            showSelectedIcon: false,
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Cari nama atau slot prisma',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['Semua', 'Normal', 'Waspada', 'Siaga', 'Awas', 'Gagal']
                .map(
                  (s) => Padding(
                    padding: const EdgeInsets.only(right: 7),
                    child: ChoiceChip(
                      label: Text(s, style: const TextStyle(fontSize: 11)),
                      selected: status == s,
                      onSelected: (_) => setState(() => status = s),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                '${rows.length} prisma · ${mode == 'Event' ? 'data mentah (m)' : 'pergeseran (mm)'}',
                style: const TextStyle(color: muted, fontSize: 11),
              ),
            ),
            if (mode == 'Event')
              IconButton(
                tooltip: 'Kolom data',
                icon: const Icon(Icons.view_column_outlined),
                onPressed: () => sheet(
                  context,
                  'Kolom event',
                  StatefulBuilder(
                    builder: (c, update) => Column(
                      children:
                          [
                                'Koordinat awal',
                                'Koordinat hasil',
                                'Pergeseran',
                                'Sudut',
                                'Arah',
                              ]
                              .map(
                                (k) => CheckboxListTile(
                                  title: Text(k),
                                  value: columns.contains(k),
                                  onChanged: (v) {
                                    setState(
                                      () => v!
                                          ? columns.add(k)
                                          : columns.remove(k),
                                    );
                                    update(() {});
                                  },
                                ),
                              )
                              .toList(),
                    ),
                  ),
                ),
              ),
            IconButton(
              tooltip: 'Ekspor Excel',
              onPressed: selected == null || rows.isEmpty
                  ? null
                  : () async {
                      try {
                        await exportMeasurements(
                          context,
                          site,
                          mode == 'Harian' ? daySessions : [selected],
                        );
                      } catch (_) {
                        if (context.mounted) {
                          message(context, 'Ekspor gagal. Coba lagi.');
                        }
                      }
                    },
              icon: const Icon(Icons.file_download_outlined),
            ),
          ],
        ),
        if (selected == null)
          const EmptyState(
            'Tidak ada sesi',
            'Pilih rentang lain atau mulai pengukuran melalui Kontrol ADR.',
          )
        else if (rows.isEmpty)
          const EmptyState(
            'Prisma tidak ditemukan',
            'Ubah pencarian atau filter status untuk melihat data.',
          )
        else if (mode == 'Peta')
          Surface(
            child: SitePlan(
              readings: rows,
              site: site,
              onTap: (r) => openPrism(context, widget.repo, r.slot),
            ),
          )
        else
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: mode == 'Event'
                  ? eventCard(context, r)
                  : PrismResultCard(
                      reading: r,
                      site: site,
                      onTap: () => openPrism(context, widget.repo, r.slot),
                    ),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget eventCard(BuildContext context, Reading r) => Surface(
    child: Column(
      children: [
        InkWell(
          onTap: () => openPrism(context, widget.repo, r.slot),
          child: Row(
            children: [
              Expanded(child: Text(r.name, style: display(18))),
              StatusPill(r.success ? 'Berhasil' : 'Gagal'),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
        if (columns.contains('Koordinat awal'))
          LabelValue(
            'Awal N / E / Z (m)',
            '${r.n0.toStringAsFixed(4)}\n${r.e0.toStringAsFixed(4)}\n${r.z0.toStringAsFixed(4)}',
          ),
        if (columns.contains('Koordinat hasil'))
          LabelValue(
            'Hasil N / E / Z (m)',
            r.success
                ? '${r.n.toStringAsFixed(4)}\n${r.e.toStringAsFixed(4)}\n${r.z.toStringAsFixed(4)}'
                : '—',
          ),
        if (columns.contains('Pergeseran'))
          LabelValue(
            'ΔN / ΔE / ΔZ (m)',
            r.success
                ? '${(r.dn / 1000).toStringAsFixed(4)} / ${(r.de / 1000).toStringAsFixed(4)} / ${(r.dz / 1000).toStringAsFixed(4)}'
                : '—',
          ),
        if (columns.contains('Sudut')) ...[
          LabelValue(
            'HA / VA (°)',
            '${r.ha.toStringAsFixed(4)} / ${r.va.toStringAsFixed(4)}',
          ),
          LabelValue(
            'Slope distance (m)',
            r.success ? r.sd.toStringAsFixed(4) : '—',
          ),
        ],
        if (columns.contains('Arah'))
          LabelValue(
            'Arah (°)',
            r.success ? r.bearing.toStringAsFixed(2) : '—',
          ),
      ],
    ),
  );
}


class PrismResultCard extends StatelessWidget {
  const PrismResultCard({
    super.key,
    required this.reading,
    required this.site,
    required this.onTap,
  });
  final Reading reading;
  final SiteData site;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final r = reading;
    // Status HARIAN dari backend. Ambangnya milik site dan perhitungannya sudah
    // dikerjakan `/api/deformasi`; menurunkannya lagi di sini membuat angka di
    // ponsel bisa berbeda dari angka di layar web tanpa ada yang salah menurut
    // dirinya sendiri.
    final status = r.statusUntuk(site);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: line),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 37,
                    height: 37,
                    decoration: BoxDecoration(
                      color: statusColor(status).withValues(alpha: .09),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.my_location,
                      size: 19,
                      color: statusColor(status),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.name,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          'Slot P${r.slot}',
                          style: const TextStyle(fontSize: 10, color: muted),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(status),
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right, size: 18, color: muted),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Metric(
                      'Pergeseran',
                      // "—" saat tidak ada pembacaan harian yang bisa
                      // dibandingkan dengan acuan R0, sama seperti web.
                      r.success
                          ? r.geserHarianMm?.toStringAsFixed(2) ?? '—'
                          : '—',
                      unit: 'mm',
                    ),
                  ),
                  Expanded(
                    child: Metric(
                      'Kecepatan',
                      r.success
                          ? r.lajuHarianMmd?.toStringAsFixed(2) ?? '—'
                          : '—',
                      unit: 'mm/hari',
                    ),
                  ),
                ],
              ),
              if (r.success && r.statusLajuHarian != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Text(
                      'Status laju',
                      style: TextStyle(fontSize: 11, color: muted),
                    ),
                    const SizedBox(width: 8),
                    StatusPill(r.statusLajuHarian!),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

void openPrism(BuildContext context, BeaconRepository repo, int slot) {
  Navigator.push(
    context,
    MaterialPageRoute<void>(
      builder: (_) => PrismDetailPage(repo: repo, slot: slot),
    ),
  );
}

class PrismDetailPage extends StatefulWidget {
  const PrismDetailPage({super.key, required this.repo, required this.slot});
  final BeaconRepository repo;
  final int slot;
  @override
  State<PrismDetailPage> createState() => _PrismDetailPageState();
}

class _PrismDetailPageState extends State<PrismDetailPage> {
  late int slot = widget.slot;
  DateTimeRange? range;
  String metric = 'Horizontal';
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.repo,
    builder: (context, _) {
      final site = widget.repo.site;
      final history =
          site.sessions
              .where(
                (s) =>
                    s.readings.any((r) => r.slot == slot) &&
                    (range == null ||
                        (!s.time.isBefore(range!.start) &&
                            s.time.isBefore(
                              range!.end.add(const Duration(days: 1)),
                            ))),
              )
              .toList()
            ..sort((a, b) => a.time.compareTo(b.time));
      final readings = history
          .map((s) => s.readings.firstWhere((r) => r.slot == slot))
          .toList();
      final valid = readings.where((r) => r.success).toList();
      final r = readings.lastOrNull;
      final slots =
          site.sessions
              .expand((s) => s.readings)
              .map((r) => r.slot)
              .toSet()
              .toList()
            ..sort();
      double value(Reading r) => switch (metric) {
        'ΔN' => r.dn,
        'ΔE' => r.de,
        'ΔZ' => r.dz,
        'Linear 3D' => r.linear3d,
        _ => r.displacement,
      };
      return Scaffold(
        appBar: AppBar(title: const Text('Detail prisma')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              DropdownButtonFormField<int>(
                key: ValueKey(slot),
                initialValue: slot,
                decoration: InputDecoration(labelText: 'Prisma · ${site.name}'),
                items: slots
                    .map(
                      (s) => DropdownMenuItem(
                        value: s,
                        child: Text(
                          site.sessions
                              .expand((r) => r.readings)
                              .firstWhere((r) => r.slot == s)
                              .name,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (s) => setState(() => slot = s!),
              ),
              const SizedBox(height: 18),
              if (r != null)
                Surface(
                  color: ink,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              r.name,
                              style: display(30, color: Colors.white),
                            ),
                          ),
                          StatusPill(
                            r.statusUntuk(site),
                            dark: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Metric(
                        'Pergeseran terhadap R0',
                        r.success ? r.displacement.toStringAsFixed(2) : '—',
                        unit: 'mm',
                        dark: true,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        '${dateLabel(history.last.time)} · ${timeLabel(history.last.time)}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              SectionHeading(
                'Riwayat pergeseran',
                action: 'Rentang',
                onTap: () async {
                  final picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now().add(const Duration(days: 1)),
                    initialDateRange: range,
                  );
                  if (picked != null && mounted) setState(() => range = picked);
                },
              ),
              if (range != null)
                InputChip(
                  label: Text(
                    '${dateLabel(range!.start)} – ${dateLabel(range!.end)}',
                    style: const TextStyle(fontSize: 10),
                  ),
                  onDeleted: () => setState(() => range = null),
                ),
              if (valid.isEmpty)
                const EmptyState(
                  'Tidak ada pembacaan valid',
                  'Ubah rentang tanggal untuk melihat riwayat.',
                )
              else
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        children: ['Horizontal', 'Linear 3D', 'ΔN', 'ΔE', 'ΔZ']
                            .map(
                              (m) => ChoiceChip(
                                label: Text(m),
                                selected: metric == m,
                                onSelected: (_) => setState(() => metric = m),
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 18),
                      TrendChart(
                        values: valid.map(value).toList(),
                        labels: [
                          dateLabel(history.first.time),
                          dateLabel(history.last.time),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Ambang: normal < ${site.warning} mm · awas ≥ ${site.danger} mm',
                        style: const TextStyle(fontSize: 10, color: muted),
                      ),
                    ],
                  ),
                ),
              if (r != null) ...[
                const SectionHeading('Pembacaan instrumen'),
                Surface(
                  child: Column(
                    children: [
                      LabelValue(
                        'Northing (m)',
                        r.success ? r.n.toStringAsFixed(4) : '—',
                      ),
                      LabelValue(
                        'Easting (m)',
                        r.success ? r.e.toStringAsFixed(4) : '—',
                      ),
                      LabelValue(
                        'Elevasi (m)',
                        r.success ? r.z.toStringAsFixed(4) : '—',
                      ),
                      const Divider(),
                      LabelValue(
                        'HA / VA (°)',
                        '${r.ha.toStringAsFixed(4)} / ${r.va.toStringAsFixed(4)}',
                      ),
                      LabelValue(
                        'Slope distance (m)',
                        r.success ? r.sd.toStringAsFixed(4) : '—',
                      ),
                      LabelValue(
                        'ΔN / ΔE / ΔZ (mm)',
                        r.success
                            ? '${r.dn.toStringAsFixed(2)} / ${r.de.toStringAsFixed(2)} / ${r.dz.toStringAsFixed(2)}'
                            : '—',
                      ),
                      LabelValue(
                        'Arah (°)',
                        r.success ? r.bearing.toStringAsFixed(2) : '—',
                      ),
                    ],
                  ),
                ),
              ],
              SectionHeading(
                'Data pada rentang',
                action: history.isEmpty ? null : 'Excel',
                onTap: () async {
                  try {
                    await exportMeasurements(
                      context,
                      site,
                      history,
                      slot: slot,
                    );
                  } catch (_) {
                    if (context.mounted) {
                      message(context, 'Ekspor gagal. Coba lagi.');
                    }
                  }
                },
              ),
              ...history.reversed.map((s) {
                final row = s.readings.firstWhere((v) => v.slot == slot);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Surface(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${dateLabel(s.time)} · ${timeLabel(s.time)}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                s.reference ? 'Acuan R0' : s.state,
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          row.success
                              ? '${value(row).toStringAsFixed(2)} mm'
                              : 'Gagal',
                          style: mono(12),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
      );
    },
  );
}
