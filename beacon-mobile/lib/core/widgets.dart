import 'package:flutter/material.dart';
import 'theme.dart';

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.color = Colors.white,
  });
  final Widget child;
  final EdgeInsets padding;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color == Colors.white ? line : color),
    ),
    child: child,
  );
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.action, this.onTap});
  final String title;
  final String? action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
    // Jarak disesuaikan dengan ADA-TIDAKNYA tombol aksi.
    //
    // `TextButton` membawa tinggi sentuh ~36 px sementara teksnya hanya ~20,
    // jadi selisihnya menambah ruang kosong di atas dan bawah baris ini. Dengan
    // padding yang sama untuk kedua kasus, judul bertombol terlihat melayang
    // jauh dari komponen di atasnya.
    padding: EdgeInsets.only(
      top: action == null ? 22 : 12,
      bottom: action == null ? 10 : 4,
    ),
    child: Row(
      children: [
        Expanded(child: Text(title, style: display(18))),
        if (action != null) TextButton(onPressed: onTap, child: Text(action!)),
      ],
    ),
  );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.text, {super.key, this.dark = false});
  final String text;
  final bool dark;
  @override
  Widget build(BuildContext context) {
    final color = dark ? const Color(0xFF9AE1CE) : statusColor(text);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            text == 'Awas' ? Icons.warning_amber_rounded : Icons.circle,
            size: text == 'Awas' ? 13 : 6,
            color: color,
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class Metric extends StatelessWidget {
  const Metric(
    this.label,
    this.value, {
    super.key,
    this.unit = '',
    this.dark = false,
  });
  final String label, value, unit;
  final bool dark;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(fontSize: 11, color: dark ? Colors.white70 : muted),
      ),
      const SizedBox(height: 6),
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.end,
        spacing: 4,
        children: [
          Text(value, style: mono(21, color: dark ? Colors.white : ink)),
          Text(
            unit,
            style: TextStyle(
              fontSize: 10,
              color: dark ? Colors.white70 : muted,
            ),
          ),
        ],
      ),
    ],
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState(
    this.title,
    this.message, {
    super.key,
    this.action,
    this.onAction,
    this.icon = Icons.inbox_outlined,
  });
  final String title, message;
  final String? action;
  final VoidCallback? onAction;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Surface(
    child: Column(
      children: [
        const SizedBox(height: 14),
        Icon(icon, size: 38, color: muted),
        const SizedBox(height: 14),
        Text(title, style: display(18), textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: muted),
        ),
        if (action != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: FilledButton(onPressed: onAction, child: Text(action!)),
          ),
        const SizedBox(height: 14),
      ],
    ),
  );
}

class SheetFrame extends StatelessWidget {
  const SheetFrame({super.key, required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        8,
        22,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: display(23))),
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    ),
  );
}

Future<T?> sheet<T>(BuildContext context, String title, Widget child) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (_) => SheetFrame(title: title, child: child),
    );
void message(BuildContext context, String text) {
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
  );
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String body, {
  String action = 'Lanjutkan',
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text(action),
          ),
        ],
      ),
    ) ??
    false;
void attempt(BuildContext context, VoidCallback action, {String? success}) {
  try {
    action();
    if (success != null) message(context, success);
  } catch (e) {
    message(context, e.toString().replaceFirst('Bad state: ', ''));
  }
}

/// Versi `attempt` untuk perintah yang menyeberang jaringan.
///
/// Perintah instrumen kini berjalan lewat HTTP, jadi galatnya baru diketahui
/// setelah jeda. `context.mounted` diperiksa karena lembar bawah tempat tombol
/// itu berada bisa sudah ditutup saat balasan tiba.
Future<void> attemptAsync(
  BuildContext context,
  Future<void> Function() action, {
  String? success,
}) async {
  try {
    await action();
    if (success != null && context.mounted) message(context, success);
  } catch (e) {
    if (context.mounted) {
      message(context, e.toString().replaceFirst('Bad state: ', ''));
    }
  }
}

class LabelValue extends StatelessWidget {
  const LabelValue(this.label, this.value, {super.key});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 4,
          child: Text(
            label,
            style: const TextStyle(color: muted, fontSize: 12),
          ),
        ),
        const SizedBox(width: 12),
        // Expanded, BUKAN Flexible.
        //
        // `Flexible` menciutkan kotak teks selebar isinya, jadi
        // `TextAlign.end` tidak punya ruang untuk bekerja: nilai pendek
        // menempel di kiri kolom sementara nilai banyak baris kebetulan
        // terlihat rata kanan. Kolom nilainya harus memenuhi sisa lebar baris
        // supaya semuanya rata pada tepi yang sama.
        Expanded(
          flex: 5,
          child: Text(value, textAlign: TextAlign.end, style: mono(12)),
        ),
      ],
    ),
  );
}

class InstrumentImage extends StatelessWidget {
  const InstrumentImage({super.key, this.size = 90});
  final double size;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(size / 2),
    child: Container(
      width: size,
      height: size,
      color: Colors.white,
      padding: const EdgeInsets.all(7),
      child: Image.asset(
        'assets/rts.png',
        fit: BoxFit.contain,
        semanticLabel: 'Instrumen RTS',
      ),
    ),
  );
}
