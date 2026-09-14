import 'dart:async';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import '../data/protokol_rts.dart';
import '../data/repository.dart';
import '../data/models.dart';

class PrismsPage extends StatefulWidget {
  const PrismsPage({super.key, required this.repo});
  final BeaconRepository repo;
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
        Surface(
          // Ditutup tombol setinggi 48–50 px yang membawa ruangnya sendiri.
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          repo.site.location,
                          style: display(22),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${repo.site.logger} · '
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
              const SizedBox(height: 10),
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
                          final nav = Navigator.of(c);
                          await attemptAsync(
                            c,
                            () => widget.repo.deletePrism(p),
                          );
                          if (nav.canPop()) nav.pop();
                        }
                      },
                // Warna lewat style, bukan di-hardcode: tombol ini nonaktif saat
                // akses terkunci dan harus terlihat nonaktif juga.
                style: TextButton.styleFrom(foregroundColor: danger),
                icon: const Icon(Icons.delete_outline, size: 18),
                label: const Text('Hapus prisma'),
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
  final BeaconRepository repo;
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
          errorText: invalid ? 'Kode akses salah' : null,
        ),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () async {
            final nav = Navigator.of(context);
            try {
              await widget.repo.unlock(code.text);
              if (nav.canPop()) nav.pop();
            } catch (_) {
              if (mounted) setState(() => invalid = true);
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
  final BeaconRepository repo;
  final Prism prism;
  @override
  State<PrismForm> createState() => _PrismFormState();
}

/// Uji tembak MENUNGGU PANTULAN, bukan sekadar mengirim perintah.
///
/// Memilih backsight atau foresight tidak membuktikan apa pun — itu cuma label.
/// Yang membuktikan ada prisma di sudut itu adalah pantulan yang kembali, dan
/// pantulan itu datang di `pub_<idAlat>`. Tanpa menunggunya, slot bisa
/// tersimpan menunjuk sudut yang tidak ada prismanya — persis yang dicegah
/// `prisma-modal.tsx` di web.
class _PrismFormState extends State<PrismForm> {
  late final name = TextEditingController(text: widget.prism.name),
      height = TextEditingController(text: widget.prism.height.toString());
  late String kind = widget.prism.kind;
  bool busy = false;
  String? error;
  final form = GlobalKey<FormState>();

  /// idle → menunggu → selesai / gagal.
  ///
  /// "gagal" WAJIB jadi keadaan tersendiri: pantulan kosong berarti tidak ada
  /// prisma di sana — jawaban akhir, bukan "belum selesai". Tanpa itu layar
  /// menunggu selamanya sesuatu yang tidak akan datang.
  String ukurStatus = 'idle';
  BalasanUkur? hasilUkur;

  /// Jenis yang SEDANG diuji. Balasan jenis lain yang kebetulan lewat ditolak.
  String? ukurJenis;

  StreamSubscription<Map<String, dynamic>>? _langganan;
  Timer? _timeout;

  bool get tested => ukurStatus == 'selesai';

  /// Membatalkan hasil uji tembak.
  ///
  /// Dipanggil saat nama, tinggi, jenis, atau arah teleskop berubah: yang sudah
  /// terbukti adalah tembakan pada konfigurasi SEBELUMNYA, dan membiarkannya
  /// lulus berarti menyimpan slot atas bukti yang bukan miliknya.
  void _batalkanUji() {
    _timeout?.cancel();
    setState(() {
      ukurStatus = 'idle';
      hasilUkur = null;
      ukurJenis = null;
      error = null;
    });
  }

  @override
  void initState() {
    super.initState();
    _langganan = widget.repo.balasan.listen(_terima);
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _timeout?.cancel();
    name.dispose();
    height.dispose();
    super.dispose();
  }

  /// Hasil datang SEBELUM "done", jadi angkanya dibaca di cabang `hasil` —
  /// bukan ditunggu sampai "done" lalu baru dibaca.
  void _terima(Map<String, dynamic> data) {
    final jenis = ukurJenis;
    if (jenis == null) return;
    final b = bacaBalasanUkur(data[jenisUkur[jenis]!.balasan]);
    final label = jenisUkur[jenis]!.label;

    if (b.jenis == JenisBalasanUkur.hasil) {
      _selesaikan(
        // Keempat medan dikosongkan — penanda gagal yang paling bisa
        // dipercaya, dan ia mendahului "failed".
        gagal: b.kosong,
        hasil: b.kosong ? null : b,
        pesan: b.kosong
            ? 'Uji tembak $label tidak mendapat pantulan. Tidak ada prisma di '
                  'sudut ini, atau lintasannya terhalang.'
            : null,
      );
    } else if (b.jenis == JenisBalasanUkur.gagal) {
      _selesaikan(
        gagal: true,
        pesan:
            'Uji tembak $label gagal. Periksa bidikan dan halangan di lintasan.',
      );
    }
    // "tahap" dan "selesai" dibiarkan: angkanya sudah ditangkap di atas.
  }

  void _selesaikan({required bool gagal, BalasanUkur? hasil, String? pesan}) {
    if (!mounted) return;
    _timeout?.cancel();
    setState(() {
      ukurStatus = gagal ? 'gagal' : 'selesai';
      hasilUkur = hasil;
      ukurJenis = null;
      busy = false;
      error = pesan;
    });
  }

  /// Menembak prisma lewat alat, bukan menunggu timer.
  ///
  /// Yang bisa dipastikan hanyalah perintahnya terkirim: hasil tembakannya
  /// pulang lewat MQTT `pub_<idAlat>` yang belum di-subscribe aplikasi ini.
  /// Karena itu labelnya "perintah terkirim", bukan "berhasil" — menyebutnya
  /// berhasil berarti mengaku tahu sesuatu yang tidak diketahui.
  Future<void> test() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      ukurStatus = 'menunggu';
      hasilUkur = null;
      ukurJenis = kind;
      error = null;
    });
    try {
      await widget.repo.ukur(kind);
    } catch (e) {
      _selesaikan(
        gagal: true,
        pesan: e.toString().replaceFirst('Bad state: ', ''),
      );
      return;
    }
    // Batas 10 detik untuk `measure_*` menurut tabel durasi protokol (Bagian A),
    // diberi margin. Tanpa batas ini satu balasan yang hilang membuat tombol
    // Simpan terkunci selamanya.
    _timeout?.cancel();
    _timeout = Timer(const Duration(seconds: 20), () {
      if (ukurStatus != 'menunggu') return;
      _selesaikan(
        gagal: true,
        pesan:
            'Alat tidak menjawab dalam 20 detik. Periksa koneksi logger, lalu '
            'coba lagi.',
      );
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
          onChanged: (_) => _batalkanUji(),
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
          onChanged: (_) => _batalkanUji(),
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
                  : (_) {
                      setState(() => kind = 'bs');
                      _batalkanUji();
                    },
            ),
            ChoiceChip(
              label: const Text('FS · Foresight'),
              selected: kind == 'fs',
              onSelected: busy
                  ? null
                  : (_) {
                      setState(() => kind = 'fs');
                      _batalkanUji();
                    },
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
                        if (mounted) _batalkanUji();
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
            icon: Icon(
              switch (ukurStatus) {
                'selesai' => Icons.check_circle_outline,
                'gagal' => Icons.error_outline,
                _ => Icons.gps_fixed,
              },
            ),
            label: Text(
              switch (ukurStatus) {
                'menunggu' => 'Menunggu pantulan…',
                'selesai' => 'Pantulan diterima',
                'gagal' => 'Uji tembak ${kind.toUpperCase()} lagi',
                _ => 'Uji tembak ${kind.toUpperCase()}',
              },
            ),
          ),
        ),
        // Angka pantulan ditampilkan APA ADANYA.
        //
        // Sudut dari firmware kena bug pemotongan desimal — "151,38,71" dengan
        // detik 71 memang yang dikirim alat. Mengonversinya hanya menghasilkan
        // angka yang salah dengan cara berbeda.
        if (hasilUkur != null) ...[
          LabelValue('HA / VA', '${hasilUkur!.ha} / ${hasilUkur!.va}'),
          LabelValue('Slope / Horizontal', '${hasilUkur!.sd} / ${hasilUkur!.hd}'),
        ],
        if (error != null) Text(error!, style: const TextStyle(color: danger)),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: !tested || busy
                ? null
                : () async {
                    if (!form.currentState!.validate()) return;
                    final nav = Navigator.of(context);
                    try {
                      await widget.repo.savePrism(
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
  final BeaconRepository repo;
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
  bool gagal = false;
  final form = GlobalKey<FormState>();

  /// Perintah yang sedang ditunggu balasannya. Satu topik membawa balasan semua
  /// perintah, jadi tanpa ini balasan perintah lain bisa dikira jawaban.
  String? menunggu;

  /// Jenis ukur yang sedang berjalan — balasannya dipilah lewat NAMA KUNCI
  /// (`MeasureBS`/`MeasureFS`), bukan lewat perintah terakhir yang dikirim.
  String kindUkur = 'fs';

  StreamSubscription<Map<String, dynamic>>? _langganan;
  Timer? _timeout;

  @override
  void initState() {
    super.initState();
    _langganan = widget.repo.balasan.listen(_terima);
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _timeout?.cancel();
    ha.dispose();
    va.dispose();
    super.dispose();
  }

  void _hasil(String pesan, {bool gagal = false}) {
    if (!mounted) return;
    _timeout?.cancel();
    setState(() {
      this.gagal = gagal;
      result = pesan;
      searching = false;
      menunggu = null;
    });
  }

  void _terima(Map<String, dynamic> data) {
    switch (menunggu) {
      case 'jog':
        final b = bacaBalasanJog(data['Jog']);
        if (b.jenis == JenisBalasanJog.ditolak) {
          // Sebab penolakan ditampilkan apa adanya: tiap sebab menuntut
          // tindakan berbeda, dan "gagal" saja tidak memberi tahu yang mana.
          _hasil(
            sebabTolakJog[b.nilai] ?? 'Jog ditolak alat: ${b.nilai}',
            gagal: true,
          );
        } else if (b.jenis == JenisBalasanJog.selesai) {
          _hasil('Teleskop selesai bergeser.');
        } else if (b.jenis == JenisBalasanJog.target) {
          // Tahap, bukan akhir: ditampilkan supaya operator melihat tujuannya,
          // tapi penantiannya belum berakhir.
          if (mounted) {
            setState(() => result = 'Menuju ${b.keHa} / ${b.keVa}…');
          }
        }

      case 'auto':
        if (data.containsKey('AutoSearch')) {
          final nilai = nilaiBalasanLogger(data['AutoSearch']);
          if (balasanSelesai(nilai)) {
            _hasil('Auto Search menemukan prisma.');
          } else if (balasanGagal(nilai)) {
            _hasil(
              'Auto Search gagal: prisma tidak ditemukan. Periksa arah '
              'teleskop dan halangan di lintasan.',
              gagal: true,
            );
          }
          // Nilai lain dibiarkan menunggu: bentuk yang belum dikenal tidak
          // boleh divonis gagal maupun sukses.
        }

      case 'target':
        final paket = data['TurningTarget'] ?? data['turning_target'];
        final kelas = klasifikasiTurningTarget(paket);
        if (kelas == KelasBalasan.selesai) {
          _hasil('Teleskop sampai di target.');
        } else if (kelas == KelasBalasan.gagal) {
          final nilai = (paket is Map ? paket['value'] : null)?.toString();
          _hasil(
            nilai == 'bad target'
                ? 'Go To Target ditolak: nomor target di luar rentang 1–50 '
                      'yang dikenal perangkat.'
                : 'Go To Target gagal: teleskop tidak sampai ke posisi target.',
            gagal: true,
          );
        }

      case 'ukur':
        final b = bacaBalasanUkur(data[jenisUkur[kindUkur]!.balasan]);
        if (b.jenis == JenisBalasanUkur.hasil) {
          _hasil(
            b.kosong
                ? 'Tidak ada pantulan. Tidak ada prisma di sudut ini, atau '
                      'lintasannya terhalang.'
                : 'HA ${b.ha} · VA ${b.va} · SD ${b.sd}',
            gagal: b.kosong,
          );
        } else if (b.jenis == JenisBalasanUkur.gagal) {
          _hasil(
            'Ukur gagal. Periksa bidikan dan halangan di lintasan.',
            gagal: true,
          );
        }

      case 'hava':
        final b = bacaManualHaVa(data['ManualHAVA']);
        if (b.ada) {
          if (b.gagal) {
            _hasil(
              'Instrumen membalas tanpa sudut yang sah. Pastikan RTS menyala '
              'dan teleskopnya sudah diarahkan.',
              gagal: true,
            );
          } else {
            _hasil('Sudut instrumen: ${b.ha} / ${b.va}');
          }
        }
    }
  }

  /// Menjalankan satu perintah lalu MENUNGGU balasan alat.
  ///
  /// `detik` mengikuti tabel durasi maksimum protokol (Bagian A), diberi
  /// margin: firmware menjaga koneksi tetap hidup selama menunggu dan
  /// balasannya bisa datang terlambat beberapa detik. Tanpa batas ini, satu
  /// balasan yang hilang membuat panel menunggu selamanya.
  Future<void> perintah(
    Future<void> Function() aksi,
    String kunci, {
    required int detik,
  }) async {
    setState(() {
      searching = true;
      gagal = false;
      result = null;
      menunggu = kunci;
    });
    try {
      await aksi();
    } catch (e) {
      _hasil(e.toString().replaceFirst('Bad state: ', ''), gagal: true);
      return;
    }
    _timeout?.cancel();
    _timeout = Timer(Duration(seconds: detik), () {
      if (menunggu != kunci) return;
      _hasil(
        'Alat tidak menjawab dalam $detik detik. Periksa koneksi logger, lalu '
        'coba lagi.',
        gagal: true,
      );
    });
  }

  /// Tombol arah: menggeser sebesar satu langkah.
  Future<void> jog(double dHa, double dVa) =>
      _gerak(() => widget.repo.jog(dHa, dVa));

  /// Isian HA/VA: menuju sudut yang diketik.
  Future<void> aimAbsolut(double h, double v) =>
      _gerak(() => widget.repo.aimAbsolut(h, v));

  Future<void> _gerak(Future<void> Function() aksi) async {
    // 20 detik untuk `jog` di protokol, plus margin. Logger mengerjakannya
    // dalam tiga langkah — baca sudut, tambahkan selisih, putar — jadi
    // balasannya bertahap dan `done` datang paling akhir.
    await perintah(aksi, 'jog', detik: 40);
    if (!mounted) return;
    setState(() {
      ha.text = widget.repo.site.ha.toStringAsFixed(4);
      va.text = widget.repo.site.va.toStringAsFixed(4);
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
                      aimAbsolut(
                        double.parse(ha.text),
                        double.parse(va.text),
                      );
                    }
                  },
            child: const Text('Terapkan Manual HA/VA'),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            // Membaca sudut instrumen sekarang; tidak menggerakkan apa pun.
            // Protokol menyebutnya diagnosis tercepat — kalau ini menjawab,
            // instrumennya hidup dan terbaca.
            onPressed: searching
                ? null
                : () => perintah(
                    widget.repo.bacaSudut,
                    'hava',
                    // manual_hava 5 detik di protokol, plus margin.
                    detik: 15,
                  ),
            child: const Text('Baca sudut instrumen'),
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
                          jog(0, -step),
                icon: const Icon(Icons.keyboard_arrow_up),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filledTonal(
                    tooltip: 'Jog kiri',
                    onPressed: searching
                        ? null
                        : () => jog(-step, 0),
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
                        : () => jog(step, 0),
                    icon: const Icon(Icons.keyboard_arrow_right),
                  ),
                ],
              ),
              IconButton.filledTonal(
                tooltip: 'Jog bawah',
                onPressed: searching
                    ? null
                    : () =>
                          jog(0, step),
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
              // Slot dikirim ke firmware, bukan jog ke sudut tersimpan: alat
              // yang tahu sudut slot itu sekarang, sementara HA/VA di aplikasi
              // bisa tertinggal dari kalibrasi terakhir di lapangan.
              onPressed: searching
                  ? null
                  : () => perintah(
                      () => widget.repo.goToTarget(widget.prism.slot),
                      'target',
                      // turning_target 20 detik di protokol, plus margin.
                      detik: 40,
                    ),
              child: const Text('Go To Target'),
            ),
          ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: searching
                ? null
                : () => perintah(
                    () => widget.repo.autoSearch(slot: widget.prism.slot),
                    'auto',
                    // auto_search 30 detik di protokol, plus margin.
                    detik: 45,
                  ),
            icon: const Icon(Icons.radar),
            label: Text(searching ? 'Mengirim…' : 'Auto Search'),
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
                      : () {
                          kindUkur = kind;
                          perintah(
                            () => widget.repo.ukur(kind),
                            'ukur',
                            // measure_* 10 detik di protokol, plus margin.
                            detik: 20,
                          );
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
              style: TextStyle(color: gagal ? danger : teal, fontSize: 12),
            ),
          ),
      ],
    ),
  );
}
