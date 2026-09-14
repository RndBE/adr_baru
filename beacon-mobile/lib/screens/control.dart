import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../data/demo_repository.dart';
import '../data/models.dart';

class ControlPage extends StatelessWidget {
  const ControlPage({super.key, required this.repo});
  final DemoRepository repo;
  @override
  Widget build(BuildContext context) {
    final site = repo.site;
    final busy = repo.running;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Kontrol ADR', style: display(28)),
        const SizedBox(height: 6),
        const Text(
          'Atur instrumen. Jalankan pengukuran.',
          style: TextStyle(color: muted, fontSize: 13),
        ),
        const SizedBox(height: 18),
        Surface(
          child: Column(
            children: [
              Row(
                children: [
                  Image.asset('assets/rts.png', height: 100, width: 85),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(site.logger, style: display(24)),
                        const SizedBox(height: 8),
                        StatusPill(
                          busy
                              ? 'Mengukur'
                              : site.powered
                              ? 'Siap'
                              : 'Daya mati',
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Perintah lokal · mode demo',
                          style: TextStyle(color: muted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy || site.powered
                          ? null
                          : () => attempt(context, () => repo.power(true)),
                      icon: const Icon(Icons.power_settings_new, size: 18),
                      label: const Text('Nyalakan'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy || !site.powered
                          ? null
                          : () async {
                              if (await confirm(
                                    context,
                                    'Matikan RTS?',
                                    'Daya instrumen demo akan dimatikan.',
                                    action: 'Matikan',
                                  ) &&
                                  context.mounted) {
                                attempt(context, () => repo.power(false));
                              }
                            },
                      icon: const Icon(Icons.power_settings_new, size: 18),
                      label: const Text('Matikan'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionHeading('Sikap instrumen'),
        Surface(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Metric(
                      'Horizontal (HA)',
                      site.powered ? site.ha.toStringAsFixed(2) : '—',
                      unit: '°',
                    ),
                  ),
                  Expanded(
                    child: Metric(
                      'Vertikal (VA)',
                      site.powered ? site.va.toStringAsFixed(2) : '—',
                      unit: '°',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: !site.powered || busy
                          ? null
                          : () => sheet(
                              context,
                              'Pembacaan tilt',
                              const Column(
                                children: [
                                  LabelValue('Tilt X', '+0.0012°'),
                                  LabelValue('Tilt Y', '−0.0008°'),
                                  LabelValue('Sumber', 'Simulasi instrumen'),
                                ],
                              ),
                            ),
                      icon: const Icon(Icons.screen_rotation_alt, size: 16),
                      label: const Text('Baca tilt'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: !site.powered || busy
                          ? null
                          : () => sheet(
                              context,
                              'Simpan posisi home',
                              HomeForm(repo: repo),
                            ),
                      icon: const Icon(Icons.home_outlined, size: 18),
                      label: const Text('Set Home'),
                    ),
                  ),
                ],
              ),
              if (site.home.isNotEmpty) LabelValue('Home aktif', site.home),
            ],
          ),
        ),
        SectionHeading(
          'Sesi pengukuran',
          action: 'Konfigurasi',
          onTap: busy
              ? null
              : () => sheet(context, 'Konfigurasi RTS', ConfigForm(repo: repo)),
        ),
        Surface(
          color: ink,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.radar, color: Colors.white, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      busy ? 'Pengukuran berjalan' : 'Siap untuk running',
                      style: display(20, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                busy
                    ? '${repo.completed} prisma telah diukur · ${repo.activeSiteId}'
                    : '${repo.registered.length} prisma terdaftar pada ${site.name}.',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 18),
              if (busy) ...[
                LinearProgressIndicator(
                  value: repo.totalTargets == 0
                      ? 0
                      : repo.completed / repo.totalTargets,
                  color: const Color(0xFF92DBC9),
                  backgroundColor: Colors.white24,
                  minHeight: 5,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: danger),
                    onPressed: () => repo.stop(),
                    icon: const Icon(Icons.stop_circle_outlined),
                    label: const Text('Hentikan pengukuran'),
                  ),
                ),
              ] else
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: navy,
                    ),
                    onPressed: !site.powered || repo.registered.isEmpty
                        ? null
                        : () => sheet(
                            context,
                            'Mulai pengukuran',
                            StartForm(repo: repo),
                          ),
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('Mulai pengukuran'),
                  ),
                ),
              if (!site.powered)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text(
                    'Nyalakan RTS untuk memulai.',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
              if (repo.registered.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text(
                    'Isi slot pada menu Prisma terlebih dahulu.',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: busy || !site.powered
                  ? null
                  : () => attempt(
                      context,
                      repo.replay,
                      success:
                          'Replay SD demo selesai. Hasil tetap tersedia di riwayat.',
                    ),
              icon: const Icon(Icons.replay, size: 18),
              label: const Text('Replay SD'),
            ),
            OutlinedButton.icon(
              onPressed: () => sheet(
                context,
                'Jadwal daya mingguan',
                ScheduleForm(repo: repo),
              ),
              icon: const Icon(Icons.schedule, size: 18),
              label: const Text('Penjadwalan'),
            ),
          ],
        ),
        if (repo.latest != null && repo.latest!.readings.isNotEmpty) ...[
          const SectionHeading('Hasil prisma'),
          Surface(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: repo.latest!.readings
                  .map(
                    (r) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: (r.success ? teal : danger).withValues(
                          alpha: .08,
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            r.success
                                ? Icons.check_circle_outline
                                : Icons.error_outline,
                            size: 14,
                            color: r.success ? teal : danger,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            r.name,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
        const SectionHeading('Riwayat running'),
        if (site.sessions.isEmpty)
          const EmptyState(
            'Belum ada running',
            'Mulai pengukuran untuk membuat sesi pertama.',
          )
        else
          ...site.sessions
              .take(8)
              .map(
                (s) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Surface(
                    padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
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
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${s.state} · ${s.readings.length} prisma${s.reference ? ' · R0' : ''}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Hapus sesi ${s.id}',
                          onPressed: s.reference || s.state == 'Mengukur'
                              ? null
                              : () async {
                                  if (await confirm(
                                        context,
                                        'Hapus sesi demo?',
                                        'Sesi ${s.id} akan dihapus dari penyimpanan lokal.',
                                        action: 'Hapus',
                                      ) &&
                                      context.mounted) {
                                    attempt(
                                      context,
                                      () => repo.deleteSession(s),
                                    );
                                  }
                                },
                          icon: const Icon(
                            Icons.delete_outline,
                            size: 19,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
        if (repo.events.isNotEmpty) ...[
          const SectionHeading('Log aktivitas'),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: repo.events
                  .take(6)
                  .map(
                    (e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(e, style: mono(10, color: muted)),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

class StartForm extends StatefulWidget {
  const StartForm({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<StartForm> createState() => _StartFormState();
}

class _StartFormState extends State<StartForm> {
  final code = TextEditingController();
  String? error;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${widget.repo.site.name} · ${widget.repo.registered.length} prisma akan diukur.',
      ),
      const SizedBox(height: 16),
      TextField(
        controller: code,
        obscureText: true,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          labelText: 'Kode akses',
          helperText: 'Kode demo: 123456',
          errorText: error,
        ),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: () {
            try {
              widget.repo.start(code.text);
              Navigator.pop(context);
            } catch (e) {
              setState(
                () => error = e.toString().replaceFirst('Bad state: ', ''),
              );
            }
          },
          icon: const Icon(Icons.play_arrow),
          label: const Text('Jalankan sesi demo'),
        ),
      ),
    ],
  );
}

class HomeForm extends StatefulWidget {
  const HomeForm({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<HomeForm> createState() => _HomeFormState();
}

class _HomeFormState extends State<HomeForm> {
  final name = TextEditingController();
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      children: [
        Text(
          'Simpan arah saat ini: HA ${widget.repo.site.ha.toStringAsFixed(2)}° / VA ${widget.repo.site.va.toStringAsFixed(2)}°.',
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: name,
          decoration: const InputDecoration(labelText: 'Nama home'),
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Nama wajib diisi' : null,
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () {
            if (form.currentState!.validate()) {
              attempt(context, () {
                widget.repo.setHome(name.text.trim());
                Navigator.pop(context);
              });
            }
          },
          child: const Text('Simpan home'),
        ),
      ],
    ),
  );
}

class ConfigForm extends StatefulWidget {
  const ConfigForm({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<ConfigForm> createState() => _ConfigFormState();
}

class _ConfigFormState extends State<ConfigForm> {
  final form = GlobalKey<FormState>();
  late final fields = Map.fromEntries(
    widget.repo.site.config.entries
        .where((e) => e.key != 'Auto search')
        .map((e) => MapEntry(e.key, TextEditingController(text: e.value))),
  );
  late bool auto = widget.repo.site.config['Auto search'] == 'true';
  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Setelan disimpan untuk site ini. Satuan mengikuti instrumen pada website.',
          style: TextStyle(color: muted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        ...fields.entries.map(
          (e) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: TextFormField(
              controller: e.value,
              decoration: InputDecoration(labelText: e.key),
              keyboardType: e.key == 'Job name'
                  ? TextInputType.text
                  : const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
              validator: (v) => validateConfig(e.key, v ?? ''),
            ),
          ),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Auto search'),
          subtitle: const Text('Sapu dulu untuk mencari prisma'),
          value: auto,
          onChanged: (v) => setState(() => auto = v),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) {
                widget.repo.site.config = {
                  for (final e in fields.entries) e.key: e.value.text,
                  'Auto search': '$auto',
                };
                widget.repo.save();
                Navigator.pop(context);
                message(context, 'Konfigurasi demo disimpan.');
              }
            },
            child: const Text('Simpan konfigurasi'),
          ),
        ),
      ],
    ),
  );
}

class ScheduleForm extends StatefulWidget {
  const ScheduleForm({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<ScheduleForm> createState() => _ScheduleFormState();
}

class _ScheduleFormState extends State<ScheduleForm> {
  late final days = widget.repo.site.schedule
      .map((d) => Map<String, dynamic>.from(d))
      .toList();
  String? error;
  Future<void> pick(int day, String key) async {
    final parts = (days[day][key] as String).split(':');
    final result = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(parts[0]),
        minute: int.parse(parts[1]),
      ),
    );
    if (result != null && mounted) {
      setState(
        () => days[day][key] =
            '${result.hour.toString().padLeft(2, '0')}:${result.minute.toString().padLeft(2, '0')}',
      );
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const Text(
        'Jadwal nyala dan mati daya. Pada demo, jadwal tersimpan lokal dan tidak mengeksekusi alat.',
        style: TextStyle(fontSize: 12, color: muted),
      ),
      const SizedBox(height: 12),
      ...List.generate(
        7,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Surface(
            color: paper,
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                    [
                      'Senin',
                      'Selasa',
                      'Rabu',
                      'Kamis',
                      'Jumat',
                      'Sabtu',
                      'Minggu',
                    ][i],
                  ),
                  value: days[i]['enabled'],
                  onChanged: (v) => setState(() => days[i]['enabled'] = v),
                ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: days[i]['enabled']
                            ? () => pick(i, 'on')
                            : null,
                        child: Text('Nyala ${days[i]['on']}'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: days[i]['enabled']
                            ? () => pick(i, 'off')
                            : null,
                        child: Text('Mati ${days[i]['off']}'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      if (error != null) Text(error!, style: const TextStyle(color: danger)),
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () {
            if (days.any(
              (d) =>
                  d['enabled'] == true &&
                  (d['on'] as String).compareTo(d['off']) >= 0,
            )) {
              setState(
                () => error =
                    'Jam mati harus setelah jam nyala pada hari yang sama.',
              );
              return;
            }
            widget.repo.site.schedule = days;
            widget.repo.save();
            Navigator.pop(context);
            message(context, 'Jadwal demo disimpan.');
          },
          child: const Text('Simpan jadwal'),
        ),
      ),
    ],
  );
}
