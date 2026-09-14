import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../data/demo_repository.dart';
import '../data/models.dart';

class PrismsPage extends StatefulWidget {
  const PrismsPage({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<PrismsPage> createState() => _PrismsPageState();
}

class _PrismsPageState extends State<PrismsPage> {
  String query = '', filter = 'Terisi';
  int? selected;
  @override
  Widget build(BuildContext context) {
    final repo = widget.repo;
    final rows = repo.site.prisms
        .where(
          (p) =>
              (filter == 'Semua' ||
                  (filter == 'Terisi' ? p.registered : !p.registered)) &&
              (p.name.toLowerCase().contains(query.toLowerCase()) ||
                  p.code.toLowerCase().contains(query.toLowerCase())),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Prism Config', style: display(28)),
        const SizedBox(height: 6),
        const Text(
          'Titik acuan dan target pemantauan.',
          style: TextStyle(color: muted, fontSize: 13),
        ),
        const SizedBox(height: 18),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(repo.site.logger, style: display(22)),
                        const SizedBox(height: 4),
                        Text(
                          '${repo.registered.length} dari 50 slot terpakai',
                          style: const TextStyle(fontSize: 12, color: muted),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    repo.unlocked
                        ? Icons.lock_open_rounded
                        : Icons.lock_outline,
                    color: repo.unlocked ? amber : navy,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              LayoutBuilder(
                builder: (context, constraints) {
                  final count = constraints.maxWidth < 350 ? 6 : 8;
                  return Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: repo.site.prisms.map((p) {
                      final width =
                          (constraints.maxWidth - (count - 1) * 6) / count;
                      return Semantics(
                        label:
                            'Slot ${p.code}, ${p.registered ? p.name : 'kosong'}',
                        button: true,
                        child: Material(
                          color: selected == p.slot
                              ? navy
                              : p.registered
                              ? (p.kind == 'bs'
                                    ? const Color(0xFFE6E6F6)
                                    : const Color(0xFFE4F2EE))
                              : paper,
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () {
                              setState(() => selected = p.slot);
                              openSlot(p);
                            },
                            child: Container(
                              width: width,
                              height: 44,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: selected == p.slot ? navy : line,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${p.slot}',
                                style: mono(
                                  12,
                                  color: selected == p.slot
                                      ? Colors.white
                                      : p.registered
                                      ? navy
                                      : muted,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 12),
              const Wrap(
                spacing: 16,
                runSpacing: 6,
                children: [
                  Text(
                    '● BS · acuan',
                    style: TextStyle(color: navy, fontSize: 10),
                  ),
                  Text(
                    '● FS · pantau',
                    style: TextStyle(color: teal, fontSize: 10),
                  ),
                  Text(
                    '○ Slot kosong',
                    style: TextStyle(color: muted, fontSize: 10),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: repo.unlocked
                    ? OutlinedButton.icon(
                        onPressed: repo.lock,
                        icon: const Icon(Icons.lock_outline, size: 18),
                        label: const Text('Selesai konfigurasi'),
                      )
                    : FilledButton.icon(
                        onPressed: () => sheet(
                          context,
                          'Buka akses konfigurasi',
                          UnlockForm(repo: repo),
                        ),
                        icon: const Icon(Icons.lock_open, size: 18),
                        label: const Text('Mulai konfigurasi'),
                      ),
              ),
              if (repo.unlocked)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text(
                    'Akses terbuka · perubahan hanya pada perangkat demo.',
                    style: TextStyle(color: amber, fontSize: 11),
                  ),
                ),
            ],
          ),
        ),
        const SectionHeading('Daftar slot'),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Cari slot atau nama prisma',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          children: ['Terisi', 'Kosong', 'Semua']
              .map(
                (f) => ChoiceChip(
                  label: Text(f),
                  selected: filter == f,
                  onSelected: (_) => setState(() => filter = f),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 10),
        if (rows.isEmpty)
          const EmptyState(
            'Slot tidak ditemukan',
            'Ubah nama pencarian atau pilih filter lainnya.',
          )
        else
          ...rows.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                child: ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: line),
                  ),
                  leading: CircleAvatar(
                    backgroundColor: paper,
                    child: Text(p.code, style: mono(11, color: navy)),
                  ),
                  title: Text(
                    p.registered ? p.name : 'Slot kosong',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    p.registered
                        ? '${p.kind.toUpperCase()} · Tinggi ${p.height.toStringAsFixed(2)} m'
                        : 'Ketuk untuk mengisi prisma',
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 19),
                  onTap: () => openSlot(p),
                ),
              ),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  void openSlot(Prism p) {
    sheet(
      context,
      'Slot ${p.code}',
      ListenableBuilder(
        listenable: widget.repo,
        builder: (c, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p.registered ? p.name : 'Belum dikonfigurasi',
              style: display(23),
            ),
            const SizedBox(height: 12),
            if (p.registered) ...[
              LabelValue(
                'Jenis',
                p.kind == 'bs'
                    ? 'Backsight · titik acuan'
                    : 'Foresight · titik pantau',
              ),
              LabelValue('Tinggi target', '${p.height} m'),
              LabelValue(
                'HA / VA',
                '${p.ha.toStringAsFixed(4)}° / ${p.va.toStringAsFixed(4)}°',
              ),
              const SizedBox(height: 12),
            ],
            if (!widget.repo.unlocked)
              const Text(
                'Buka akses melalui Mulai konfigurasi untuk mengubah slot.',
                style: TextStyle(color: muted),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    !widget.repo.unlocked ||
                        widget.repo.running ||
                        !widget.repo.site.powered
                    ? null
                    : () {
                        Navigator.pop(c);
                        sheet(
                          context,
                          p.registered ? 'Ubah ${p.code}' : 'Isi ${p.code}',
                          PrismForm(repo: widget.repo, prism: p),
                        );
                      },
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: Text(p.registered ? 'Ubah prisma' : 'Isi slot'),
              ),
            ),
            if (p.registered) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed:
                      !widget.repo.unlocked ||
                          widget.repo.running ||
                          !widget.repo.site.powered
                      ? null
                      : () {
                          Navigator.pop(c);
                          sheet(
                            context,
                            'Arahkan teleskop',
                            AimForm(repo: widget.repo, prism: p),
                          );
                        },
                  icon: const Icon(Icons.my_location, size: 18),
                  label: const Text('Go To Target / Bidik'),
                ),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed:
                    !widget.repo.unlocked ||
                        widget.repo.running ||
                        !widget.repo.site.powered
                    ? null
                    : () async {
                        if (await confirm(
                              c,
                              'Kosongkan ${p.code}?',
                              'Konfigurasi ${p.name} dihapus. Riwayat pengukuran tetap tersedia.',
                              action: 'Hapus',
                            ) &&
                            c.mounted) {
                          attempt(c, () {
                            widget.repo.deletePrism(p);
                            Navigator.pop(c);
                          });
                        }
                      },
                icon: const Icon(Icons.delete_outline, color: danger, size: 18),
                label: const Text(
                  'Hapus prisma',
                  style: TextStyle(color: danger),
                ),
              ),
            ],
            if (!widget.repo.site.powered)
              const Text(
                'Nyalakan RTS dari menu Kontrol untuk mengubah atau membidik.',
                style: TextStyle(color: amber, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
}

class UnlockForm extends StatefulWidget {
  const UnlockForm({super.key, required this.repo});
  final DemoRepository repo;
  @override
  State<UnlockForm> createState() => _UnlockFormState();
}

class _UnlockFormState extends State<UnlockForm> {
  final code = TextEditingController();
  bool invalid = false;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      TextField(
        controller: code,
        keyboardType: TextInputType.number,
        obscureText: true,
        decoration: InputDecoration(
          labelText: 'Kode akses',
          helperText: 'Kode demo: 123456',
          errorText: invalid ? 'Kode akses salah' : null,
        ),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () {
            if (widget.repo.unlock(code.text)) {
              Navigator.pop(context);
            } else {
              setState(() => invalid = true);
            }
          },
          child: const Text('Buka konfigurasi'),
        ),
      ),
    ],
  );
}

class PrismForm extends StatefulWidget {
  const PrismForm({super.key, required this.repo, required this.prism});
  final DemoRepository repo;
  final Prism prism;
  @override
  State<PrismForm> createState() => _PrismFormState();
}

class _PrismFormState extends State<PrismForm> {
  late final name = TextEditingController(text: widget.prism.name),
      height = TextEditingController(text: widget.prism.height.toString());
  late String kind = widget.prism.kind;
  bool tested = false, busy = false;
  String? error;
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    name.dispose();
    height.dispose();
    super.dispose();
  }

  Future<void> test() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      tested = false;
      error = null;
    });
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    setState(() {
      busy = false;
      tested = true;
    });
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: name,
          enabled: !busy,
          decoration: const InputDecoration(
            labelText: 'Nama prisma',
            hintText: 'Contoh: PR-13',
          ),
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Nama wajib diisi' : null,
          onChanged: (_) => setState(() => tested = false),
        ),
        const SizedBox(height: 14),
        TextFormField(
          controller: height,
          enabled: !busy,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Tinggi target (m)'),
          validator: (v) {
            final n = double.tryParse(v ?? '');
            return n == null || !n.isFinite || n < 0
                ? 'Masukkan tinggi ≥ 0 m'
                : null;
          },
          onChanged: (_) => setState(() => tested = false),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: const Text('BS · Backsight'),
              selected: kind == 'bs',
              onSelected: busy
                  ? null
                  : (_) => setState(() {
                      kind = 'bs';
                      tested = false;
                    }),
            ),
            ChoiceChip(
              label: const Text('FS · Foresight'),
              selected: kind == 'fs',
              onSelected: busy
                  ? null
                  : (_) => setState(() {
                      kind = 'fs';
                      tested = false;
                    }),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Surface(
          color: paper,
          child: Column(
            children: [
              const Text(
                'Bidik prisma sebelum melakukan uji tembak.',
                style: TextStyle(fontSize: 12, color: muted),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () async {
                        await sheet(
                          context,
                          'Bidik / Manual HA-VA',
                          AimForm(repo: widget.repo, prism: widget.prism),
                        );
                        if (mounted) setState(() => tested = false);
                      },
                icon: const Icon(Icons.control_camera),
                label: const Text('Arahkan teleskop'),
              ),
              LabelValue(
                'HA / VA saat ini',
                '${widget.repo.site.ha.toStringAsFixed(3)}° / ${widget.repo.site.va.toStringAsFixed(3)}°',
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: busy ? null : test,
            icon: Icon(tested ? Icons.check_circle_outline : Icons.gps_fixed),
            label: Text(
              busy
                  ? 'Mengukur…'
                  : tested
                  ? 'Uji tembak berhasil (demo)'
                  : 'Uji tembak ${kind.toUpperCase()}',
            ),
          ),
        ),
        if (tested)
          const LabelValue(
            'Pantulan simulasi',
            'HA/VA terekam · jarak 125.72 m',
          ),
        if (error != null) Text(error!, style: const TextStyle(color: danger)),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: !tested || busy
                ? null
                : () {
                    if (!form.currentState!.validate()) return;
                    try {
                      widget.repo.savePrism(
                        Prism(
                          widget.prism.slot,
                          name: name.text.trim(),
                          height: double.parse(height.text),
                          kind: kind,
                          registered: true,
                          ha: widget.repo.site.ha,
                          va: widget.repo.site.va,
                        ),
                      );
                      Navigator.pop(context);
                    } catch (e) {
                      setState(
                        () => error = e.toString().replaceFirst(
                          'Bad state: ',
                          '',
                        ),
                      );
                    }
                  },
            child: const Text('Simpan prisma'),
          ),
        ),
      ],
    ),
  );
}

class AimForm extends StatefulWidget {
  const AimForm({super.key, required this.repo, required this.prism});
  final DemoRepository repo;
  final Prism prism;
  @override
  State<AimForm> createState() => _AimFormState();
}

class _AimFormState extends State<AimForm> {
  late final ha = TextEditingController(
        text: widget.repo.site.ha.toStringAsFixed(4),
      ),
      va = TextEditingController(text: widget.repo.site.va.toStringAsFixed(4));
  double step = 1;
  bool searching = false;
  String? result;
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    ha.dispose();
    va.dispose();
    super.dispose();
  }

  void aim(double h, double v) {
    attempt(context, () {
      widget.repo.aim(h, v);
      setState(() {
        ha.text = widget.repo.site.ha.toStringAsFixed(4);
        va.text = widget.repo.site.va.toStringAsFixed(4);
        result = 'Arah diperbarui (simulasi)';
      });
    });
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Target ${widget.prism.code} · ${widget.prism.name}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: ha,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(labelText: 'HA (°)'),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  return n == null || !n.isFinite || n < 0 || n >= 360
                      ? '0 ≤ HA < 360'
                      : null;
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: va,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(labelText: 'VA (°)'),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  return n == null || !n.isFinite || n < 0 || n > 180
                      ? '0 ≤ VA ≤ 180'
                      : null;
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: searching
                ? null
                : () {
                    if (form.currentState!.validate()) {
                      aim(double.parse(ha.text), double.parse(va.text));
                    }
                  },
            child: const Text('Terapkan Manual HA/VA'),
          ),
        ),
        const SizedBox(height: 12),
        const Text('Langkah jog', style: TextStyle(fontSize: 12, color: muted)),
        Wrap(
          spacing: 8,
          children: [.1, 1.0, 5.0]
              .map(
                (v) => ChoiceChip(
                  label: Text('$v°'),
                  selected: step == v,
                  onSelected: (_) => setState(() => step = v),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 10),
        Center(
          child: Column(
            children: [
              IconButton.filledTonal(
                tooltip: 'Jog atas',
                onPressed: searching
                    ? null
                    : () =>
                          aim(widget.repo.site.ha, widget.repo.site.va - step),
                icon: const Icon(Icons.keyboard_arrow_up),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filledTonal(
                    tooltip: 'Jog kiri',
                    onPressed: searching
                        ? null
                        : () => aim(
                            widget.repo.site.ha - step,
                            widget.repo.site.va,
                          ),
                    icon: const Icon(Icons.keyboard_arrow_left),
                  ),
                  const Padding(
                    padding: EdgeInsets.all(15),
                    child: Icon(Icons.my_location, color: navy),
                  ),
                  IconButton.filledTonal(
                    tooltip: 'Jog kanan',
                    onPressed: searching
                        ? null
                        : () => aim(
                            widget.repo.site.ha + step,
                            widget.repo.site.va,
                          ),
                    icon: const Icon(Icons.keyboard_arrow_right),
                  ),
                ],
              ),
              IconButton.filledTonal(
                tooltip: 'Jog bawah',
                onPressed: searching
                    ? null
                    : () =>
                          aim(widget.repo.site.ha, widget.repo.site.va + step),
                icon: const Icon(Icons.keyboard_arrow_down),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (widget.prism.registered)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: searching
                  ? null
                  : () => aim(widget.prism.ha, widget.prism.va),
              child: const Text('Go To Target'),
            ),
          ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: searching
                ? null
                : () async {
                    setState(() => searching = true);
                    await Future<void>.delayed(
                      const Duration(milliseconds: 700),
                    );
                    if (!mounted) return;
                    aim(widget.repo.site.ha + .015, widget.repo.site.va + .008);
                    setState(() {
                      searching = false;
                      result = 'Target ditemukan · simulasi Auto Search';
                    });
                  },
            icon: const Icon(Icons.radar),
            label: Text(searching ? 'Mencari prisma…' : 'Auto Search'),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: ['bs', 'fs']
              .map(
                (kind) => OutlinedButton(
                  onPressed: searching
                      ? null
                      : () async {
                          setState(() => searching = true);
                          await Future<void>.delayed(
                            const Duration(milliseconds: 650),
                          );
                          if (!mounted) return;
                          setState(() {
                            searching = false;
                            result =
                                'Ukur ${kind.toUpperCase()} berhasil (demo)\nHA ${widget.repo.site.ha.toStringAsFixed(4)}° · VA ${widget.repo.site.va.toStringAsFixed(4)}°\nSlope distance 125.72 m';
                          });
                        },
                  child: Text('Ukur ${kind.toUpperCase()}'),
                ),
              )
              .toList(),
        ),
        if (result != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              result!,
              style: const TextStyle(color: teal, fontSize: 12),
            ),
          ),
      ],
    ),
  );
}
