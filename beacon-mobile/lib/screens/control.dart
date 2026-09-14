import 'dart:async';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../data/beacon_api.dart';
import '../data/protokol_rts.dart';
import '../data/repository.dart';
import '../data/models.dart';

class ControlPage extends StatelessWidget {
  const ControlPage({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  Widget build(BuildContext context) {
    final site = repo.site;
    final busy = repo.running;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Surface(
          // Baris tombol menutup kartu, dan tombol bertinggi 48 px sudah
          // membawa ruang kosongnya sendiri di atas dan bawah teks. Padding
          // penuh 18 di bawahnya menjadikannya dua kali lipat.
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
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
                        Text(
                          site.location,
                          style: display(24),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          site.logger,
                          style: const TextStyle(fontSize: 12, color: muted),
                        ),
                        const SizedBox(height: 8),
                        // Label dari status_rts.dart, sama persis dengan web.
                        StatusPill(repo.labelRts),
                        if (!repo.loggerTerhubung)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'Logger belum melapor dalam sejam terakhir.',
                              style: TextStyle(fontSize: 11, color: amber),
                            ),
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
                          : () => attemptAsync(context, () => repo.power(true)),
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
                                    'Daya instrumen akan dimatikan.',
                                    action: 'Matikan',
                                  ) &&
                                  context.mounted) {
                                attemptAsync(context, () => repo.power(false));
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
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
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
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      // Membuka lembar yang MENUNGGU balasan `data_tilt` di
                      // `pub_<idAlat>`, bukan sekadar melaporkan perintah
                      // terkirim.
                      onPressed: !site.powered || busy
                          ? null
                          : () => sheet(
                              context,
                              'Pembacaan tilt',
                              TiltSheet(repo: repo),
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
                    // Warna nonaktif DISETEL EKSPLISIT.
                    //
                    // `styleFrom(backgroundColor:)` hanya berlaku saat tombol
                    // aktif; saat nonaktif Flutter jatuh ke `onSurface` 12%
                    // yang di atas kartu ink nyaris tak terlihat — tombolnya
                    // tetap memakan tinggi, jadi kartu terlihat berlubang.
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: navy,
                      disabledBackgroundColor: Colors.white24,
                      disabledForegroundColor: Colors.white60,
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
                  : () => attemptAsync(
                      context,
                      repo.replay,
                      success: 'Perintah replay SD dikirim ke alat.',
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
                                        'Hapus sesi?',
                                        'Sesi ${s.id} akan dihapus.',
                                        action: 'Hapus',
                                      ) &&
                                      context.mounted) {
                                    await attemptAsync(
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
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              '${dateLabel(e.waktu)} ${timeLabel(e.waktu)} · '
                              '${e.perintah}',
                              style: mono(10, color: muted),
                            ),
                          ),
                          // Perintah yang gagal terbit ditandai, bukan
                          // disembunyikan: itu justru yang perlu terlihat saat
                          // alat tidak merespons.
                          if (!e.terkirim)
                            Text(
                              'gagal kirim',
                              style: mono(10, color: danger),
                            ),
                        ],
                      ),
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
  final BeaconRepository repo;
  @override
  State<StartForm> createState() => _StartFormState();
}

class _StartFormState extends State<StartForm> {
  final code = TextEditingController();
  String? error;
  bool jalan = false;
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
          errorText: error,
        ),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: jalan
              ? null
              : () async {
                  setState(() {
                    jalan = true;
                    error = null;
                  });
                  final nav = Navigator.of(context);
                  try {
                    await widget.repo.start(code.text);
                    if (nav.canPop()) nav.pop();
                  } catch (e) {
                    if (mounted) {
                      setState(
                        () => error = e.toString().replaceFirst(
                          'Bad state: ',
                          '',
                        ),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => jalan = false);
                  }
                },
          icon: const Icon(Icons.play_arrow),
          label: Text(jalan ? 'Mengirim…' : 'Jalankan sesi'),
        ),
      ),
    ],
  );
}

class HomeForm extends StatefulWidget {
  const HomeForm({super.key, required this.repo});
  final BeaconRepository repo;
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
          onPressed: () async {
            if (!form.currentState!.validate()) return;
            final nav = Navigator.of(context);
            await attemptAsync(
              context,
              () => widget.repo.setHome(name.text.trim()),
            );
            if (nav.canPop()) nav.pop();
          },
          child: const Text('Simpan home'),
        ),
      ],
    ),
  );
}

class ConfigForm extends StatefulWidget {
  const ConfigForm({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  State<ConfigForm> createState() => _ConfigFormState();
}

class _ConfigFormState extends State<ConfigForm> {
  final form = GlobalKey<FormState>();
  late final fields = Map.fromEntries(
    widget.repo.site.config.entries
        .where((e) => e.key != labelAutoSearch)
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
            onPressed: () async {
              if (!form.currentState!.validate()) return;
              final config = {
                for (final e in fields.entries) e.key: e.value.text,
                labelAutoSearch: '$auto',
              };
              final nav = Navigator.of(context);
              await attemptAsync(
                context,
                () => widget.repo.simpanKonfigurasi(config),
                success: 'Konfigurasi disimpan.',
              );
              if (nav.canPop()) nav.pop();
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
  final BeaconRepository repo;
  @override
  State<ScheduleForm> createState() => _ScheduleFormState();
}

/// Jadwal mengikuti bentuk `scheduling_task` di backend: BEBERAPA waktu
/// running per hari, masing-masing bisa dinyalakan sendiri.
///
/// Sebelumnya formulir ini memodelkan satu pasang jam nyala/mati per hari.
/// Basis data tidak menyimpan hal seperti itu, jadi jadwal apa pun yang diisi
/// operator tidak akan pernah punya tempat untuk disimpan.
class _ScheduleFormState extends State<ScheduleForm> {
  late final runs = widget.repo.site.schedule
      .map((d) => Map<String, dynamic>.from(d))
      .toList();

  static const namaHari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu',
  ];

  List<Map<String, dynamic>> hari(int d) =>
      runs.where((r) => (r['days'] as num?)?.toInt() == d).toList();

  Future<void> pick(Map<String, dynamic> run) async {
    final parts = (run['time'] ?? '00:00').toString().split(':');
    final hasil = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parts.first) ?? 0,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
      ),
    );
    if (hasil != null && mounted) {
      setState(
        () => run['time'] =
            '${hasil.hour.toString().padLeft(2, '0')}:${hasil.minute.toString().padLeft(2, '0')}',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (runs.isEmpty) {
      return const EmptyState(
        'Jadwal belum tersedia',
        'Belum ada jadwal running terdaftar untuk logger ini.',
        icon: Icons.schedule,
      );
    }
    return Column(
      children: [
        const Text(
          'Waktu running otomatis per hari.',
          style: TextStyle(fontSize: 12, color: muted),
        ),
        const SizedBox(height: 12),
        ...List.generate(7, (i) {
          final daftar = hari(i + 1);
          if (daftar.isEmpty) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Surface(
              color: paper,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    namaHari[i],
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  ...daftar.map(
                    (r) => Row(
                      children: [
                        Switch(
                          value: (r['status'] as num?)?.toInt() == 1,
                          onChanged: (v) =>
                              setState(() => r['status'] = v ? 1 : 0),
                        ),
                        Expanded(
                          child: Text(
                            (r['nama'] ?? '').toString(),
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                        OutlinedButton(
                          onPressed: () => pick(r),
                          child: Text((r['time'] ?? '--:--').toString()),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () async {
              final nav = Navigator.of(context);
              await attemptAsync(
                context,
                () => widget.repo.simpanJadwal(runs),
                success: 'Jadwal disimpan.',
              );
              if (nav.canPop()) nav.pop();
            },
            child: const Text('Simpan jadwal'),
          ),
        ),
      ],
    );
  }
}

class TiltSheet extends StatefulWidget {
  const TiltSheet({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  State<TiltSheet> createState() => _TiltSheetState();
}

/// Menunggu balasan `data_tilt`, bukan melaporkan perintah terkirim.
///
/// Perintahnya tidak menggerakkan apa pun: yang dibaca adalah nilai terakhir
/// yang tersimpan di logger, disegarkan sendiri tiap menit. Jadi aman dipanggil
/// kapan saja, dan diamnya berarti tidak sampai — bukan sedang bekerja.
class _TiltSheetState extends State<TiltSheet> {
  BacaanTilt? hasil;
  String? error;
  bool menunggu = true;
  StreamSubscription<Map<String, dynamic>>? _langganan;
  Timer? _timeout;

  @override
  void initState() {
    super.initState();
    _langganan = widget.repo.balasan.listen((data) {
      // Nama balasannya `data_tilt`, BUKAN `getTilt` maupun `Tilt` — yang
      // terakhir itu diagnostik kegagalan komunikasi, bukan kemiringan.
      final b = bacaBalasanTilt(data['data_tilt']);
      if (!b.ada || !mounted) return;
      _timeout?.cancel();
      setState(() {
        hasil = b;
        menunggu = false;
      });
    });
    unawaited(_minta());
  }

  Future<void> _minta() async {
    try {
      await widget.repo.bacaTilt();
    } catch (e) {
      _gagal(e.toString().replaceFirst('Bad state: ', ''));
      return;
    }
    _timeout = Timer(const Duration(seconds: 15), () {
      if (menunggu) {
        _gagal(
          'Alat tidak menjawab dalam 15 detik. Periksa koneksi logger, lalu '
          'coba lagi.',
        );
      }
    });
  }

  void _gagal(String pesan) {
    if (!mounted) return;
    setState(() {
      error = pesan;
      menunggu = false;
    });
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _timeout?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (menunggu) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 12),
            Text('Menunggu balasan alat…'),
          ],
        ),
      );
    }
    if (error != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(error!, style: const TextStyle(color: danger)),
      );
    }
    // Nilainya ditampilkan APA ADANYA: instrumen mengirimnya sebagai string,
    // dan mengangkakannya membuat "0" hasil pembacaan tidak bisa dibedakan dari
    // 0 bawaan.
    return Column(
      children: [
        LabelValue('Tilt X', hasil!.tilt1.isEmpty ? '—' : hasil!.tilt1),
        LabelValue('Tilt Y', hasil!.tilt2.isEmpty ? '—' : hasil!.tilt2),
      ],
    );
  }
}
