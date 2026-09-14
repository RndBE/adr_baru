import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/charts.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../data/repository.dart';
import '../data/models.dart';
import 'results.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    super.key,
    required this.repo,
    required this.onNavigate,
  });
  final BeaconRepository repo;
  final ValueChanged<int> onNavigate;
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  String? selectedSession;
  BeaconRepository get repo => widget.repo;
  void onNavigate(int index) => widget.onNavigate(index);
  @override
  Widget build(BuildContext context) {
    final site = repo.site;
    final latest =
        site.sessions.where((s) => s.id == selectedSession).firstOrNull ??
        repo.latest;
    final rows = latest?.readings ?? <Reading>[];
    final valid = rows.where((r) => r.success).toList();
    final attention = valid
        .where((r) => site.status(r.displacement) != 'Normal')
        .toList();
    final max = valid.isEmpty
        ? 0.0
        : valid.map((r) => r.displacement).reduce(math.max);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Surface(
          color: ink,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.cell_tower, color: Colors.white70, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ROBOTIC TOTAL STATION',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .7),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  StatusPill(repo.labelRts, dark: true),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Nama pos jadi judul, id logger jadi keterangan.
                        //
                        // Yang dikenali operator adalah posnya; id logger itu
                        // alamat perangkat — perlu terbaca, tapi bukan yang
                        // dicari mata lebih dulu.
                        Text(
                          site.location,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: display(28, color: Colors.white),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          site.logger,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const InstrumentImage(),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(color: Colors.white24),
              ),
              Row(
                children: [
                  Expanded(
                    child: Metric(
                      'Baterai',
                      site.battery?.toStringAsFixed(1) ?? '—',
                      unit: '%',
                      dark: true,
                    ),
                  ),
                  Expanded(
                    child: Metric(
                      'Suhu',
                      site.temperature?.toStringAsFixed(1) ?? '—',
                      unit: '°C',
                      dark: true,
                    ),
                  ),
                  Expanded(
                    child: Metric(
                      'Prisma aktif',
                      '${repo.registered.length}',
                      unit: '/ 50',
                      dark: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: Surface(
                child: Metric(
                  'Pergeseran maks.',
                  valid.isEmpty ? '—' : max.toStringAsFixed(2),
                  unit: 'mm',
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Surface(
                child: Metric(
                  'Perlu perhatian',
                  '${attention.length}',
                  unit: 'prisma',
                ),
              ),
            ),
          ],
        ),
        if (attention.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Material(
              color: const Color(0xFFFFF5E5),
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => openPrism(context, repo, attention.last.slot),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: amber),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '${attention.map((r) => r.name).join(' & ')} melewati ambang normal.',
                          style: const TextStyle(
                            color: Color(0xFF81530D),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: amber),
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (latest != null) ...[
          const SizedBox(height: 20),
          DropdownButtonFormField<String>(
            key: ValueKey(latest.id),
            initialValue: latest.id,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Sesi pengamatan',
              prefixIcon: Icon(Icons.history),
            ),
            items: site.sessions
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
            onChanged: (id) => setState(() => selectedSession = id),
          ),
        ],
        SectionHeading(
          'Denah pengamatan',
          action: 'Lihat hasil',
          onTap: () => onNavigate(3),
        ),
        if (rows.isEmpty)
          EmptyState(
            'Belum ada pengukuran',
            'Isi slot prisma, lalu mulai sesi dari Kontrol ADR.',
            action: 'Buka kontrol',
            onAction: () => onNavigate(1),
          )
        else
          Surface(
            child: SitePlan(
              readings: rows,
              site: site,
              onTap: (r) => openPrism(context, repo, r.slot),
            ),
          ),
        SectionHeading(
          'Ringkasan sesi',
          action: 'Riwayat',
          onTap: () => onNavigate(3),
        ),
        if (latest != null)
          Surface(
            child: Column(
              children: [
                Row(
                  children: [
                    const Icon(Icons.history, color: navy),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${dateLabel(latest.time)} · ${timeLabel(latest.time)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            '${valid.length}/${rows.length} prisma berhasil',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    StatusPill(latest.state),
                  ],
                ),
                const SizedBox(height: 16),
                LinearProgressIndicator(
                  value: rows.isEmpty ? 0 : valid.length / rows.length,
                  color: teal,
                  backgroundColor: line,
                  borderRadius: BorderRadius.circular(4),
                  minHeight: 5,
                ),
                const SizedBox(height: 8),
                LabelValue('Total running', '${site.sessions.length} sesi'),
                InkWell(
                  onTap: () => showReference(context, site),
                  child: const LabelValue('Acuan pengukuran', 'Lihat R0  →'),
                ),
              ],
            ),
          ),
        if (valid.isNotEmpty) ...[
          const SectionHeading('Arah pergeseran'),
          Surface(
            child: DisplacementCompass(readings: rows, site: site),
          ),
          const SectionHeading('Hasil sesi'),
          Surface(
            child: Column(
              children: rows
                  .map(
                    (r) => InkWell(
                      onTap: () => openPrism(context, repo, r.slot),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                r.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            Text(
                              r.success
                                  ? '${r.displacement.toStringAsFixed(2)} mm'
                                  : '—',
                              style: mono(12),
                            ),
                            const SizedBox(width: 10),
                            StatusPill(
                              r.success ? site.status(r.displacement) : 'Gagal',
                            ),
                            const Icon(
                              Icons.chevron_right,
                              size: 17,
                              color: muted,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SectionHeading('Profil elevasi'),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Elevasi prisma pada sesi terpilih (m)',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
                const SizedBox(height: 12),
                TrendChart(
                  values: valid.map((r) => r.z).toList(),
                  unit: 'm',
                  color: navy,
                  labels: [valid.first.name, valid.last.name],
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

void showReference(BuildContext context, SiteData site) {
  final refs = site.sessions.where((s) => s.reference);
  final ref = refs.isEmpty ? null : refs.first;
  sheet(
    context,
    'Acuan R0',
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Pergeseran dihitung terhadap koordinat pada sesi acuan ini.',
        ),
        const SizedBox(height: 16),
        Surface(
          color: paper,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(site.name, style: display(18)),
              const SizedBox(height: 8),
              Text(
                ref == null
                    ? 'Belum tersedia'
                    : '${dateLabel(ref.time)} · ${timeLabel(ref.time)}',
                style: mono(15),
              ),
              if (ref != null)
                Text(
                  ref.id,
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Acuan R0 hanya dapat dilihat, sesuai fungsi website saat ini.',
          style: TextStyle(color: muted, fontSize: 12),
        ),
      ],
    ),
  );
}
