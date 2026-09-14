import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../data/models.dart';
import 'theme.dart';
import 'widgets.dart';

class TrendChart extends StatelessWidget {
  const TrendChart({
    super.key,
    required this.values,
    this.labels = const [],
    this.color = teal,
    this.height = 160,
    this.unit = 'mm',
  });
  final List<double> values;
  final List<String> labels;
  final Color color;
  final double height;
  final String unit;
  @override
  Widget build(BuildContext context) => Semantics(
    label:
        'Grafik $unit: ${values.map((v) => v.toStringAsFixed(2)).join(', ')}',
    child: Column(
      children: [
        SizedBox(
          height: height,
          child: CustomPaint(
            size: Size.infinite,
            painter: _TrendPainter(values, color, unit),
          ),
        ),
        if (labels.isNotEmpty)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: labels
                .map(
                  (l) => Text(
                    l,
                    style: const TextStyle(fontSize: 10, color: muted),
                  ),
                )
                .toList(),
          ),
      ],
    ),
  );
}

class _TrendPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  final String unit;
  _TrendPainter(this.values, this.color, this.unit);
  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final min = unit == 'm'
        ? values.reduce(math.min) - 2
        : math.min(0.0, values.reduce(math.min));
    final max = unit == 'm'
        ? values.reduce(math.max) + 2
        : math.max(min + 1, values.reduce(math.max) * 1.15);
    final rect = Rect.fromLTWH(34, 10, size.width - 42, size.height - 22);
    final grid = Paint()
      ..color = line
      ..strokeWidth = 1;
    for (var i = 0; i < 4; i++) {
      final y = rect.top + rect.height * i / 3;
      canvas.drawLine(Offset(rect.left, y), Offset(rect.right, y), grid);
      _text(
        canvas,
        ((max - (max - min) * i / 3)).toStringAsFixed(1),
        Offset(0, y - 6),
        muted,
        9,
      );
    }
    Offset point(int i) => Offset(
      rect.left +
          (values.length == 1
              ? rect.width / 2
              : rect.width * i / (values.length - 1)),
      rect.bottom - (values[i] - min) / (max - min) * rect.height,
    );
    final path = Path()..moveTo(point(0).dx, point(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(point(i).dx, point(i).dy);
    }
    final fill = Path.from(path)
      ..lineTo(point(values.length - 1).dx, rect.bottom)
      ..lineTo(point(0).dx, rect.bottom)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: .2), color.withValues(alpha: .01)],
        ).createShader(rect),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round,
    );
    for (var i = 0; i < values.length; i++) {
      canvas.drawCircle(point(i), 3, Paint()..color = Colors.white);
      canvas.drawCircle(point(i), 2, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter old) => true;
}

void _text(Canvas c, String text, Offset offset, Color color, double size) {
  final p = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        fontSize: size,
        color: color,
        fontWeight: FontWeight.w600,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  p.paint(c, offset);
}

class SitePlan extends StatelessWidget {
  const SitePlan({
    super.key,
    required this.readings,
    required this.site,
    this.onTap,
  });
  final List<Reading> readings;
  final SiteData site;
  final ValueChanged<Reading>? onTap;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        height: 240,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xFFEDF3F4),
          borderRadius: BorderRadius.circular(14),
        ),
        child: LayoutBuilder(
          builder: (context, box) {
            final size = Size(box.maxWidth, 240);
            final points = planPoints(readings, size);
            return Stack(
              children: [
                CustomPaint(size: size, painter: _PlanPainter(points)),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Text('DENAH LOKAL · 2D', style: mono(9, color: muted)),
                ),
                const Positioned(
                  right: 14,
                  top: 12,
                  child: Column(
                    children: [
                      Icon(Icons.navigation, size: 17, color: navy),
                      Text('U', style: TextStyle(fontSize: 9, color: navy)),
                    ],
                  ),
                ),
                for (var i = 0; i < readings.length; i++)
                  Positioned(
                    left: points[i].dx - 22,
                    top: points[i].dy - 22,
                    child: Semantics(
                      label: 'Prisma ${readings[i].name}',
                      button: true,
                      child: InkWell(
                        onTap: () => onTap?.call(readings[i]),
                        borderRadius: BorderRadius.circular(24),
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(
                                  color: readings[i].success
                                      ? statusColor(
                                          site.status(readings[i].displacement),
                                        )
                                      : muted,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 2,
                                  ),
                                ),
                              ),
                              Text(
                                readings[i].name,
                                style: const TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w700,
                                  color: ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: size.width / 2 - 25,
                  bottom: 15,
                  child: const Column(
                    children: [
                      Icon(Icons.cell_tower, color: navy, size: 24),
                      Text(
                        'RTS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: navy,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
      const SizedBox(height: 10),
      const Wrap(
        spacing: 12,
        runSpacing: 6,
        children: [
          StatusPill('Normal'),
          StatusPill('Waspada'),
          StatusPill('Siaga'),
          StatusPill('Awas'),
        ],
      ),
      const SizedBox(height: 6),
      const Text(
        'Koordinat lokal E/N · ketuk titik untuk detail',
        style: TextStyle(fontSize: 10, color: muted),
      ),
    ],
  );
}

List<Offset> planPoints(List<Reading> readings, Size size) {
  if (readings.isEmpty) return [];
  final minE = readings.map((r) => r.e0).reduce(math.min),
      maxE = readings.map((r) => r.e0).reduce(math.max);
  final minN = readings.map((r) => r.n0).reduce(math.min),
      maxN = readings.map((r) => r.n0).reduce(math.max);
  return readings
      .map(
        (r) => Offset(
          30 + (r.e0 - minE) / math.max(1, maxE - minE) * (size.width - 60),
          45 + (maxN - r.n0) / math.max(1, maxN - minN) * 130,
        ),
      )
      .toList();
}

class _PlanPainter extends CustomPainter {
  final List<Offset> points;
  _PlanPainter(this.points);
  @override
  void paint(Canvas c, Size s) {
    final grid = Paint()
      ..color = const Color(0xFFDDE6E8)
      ..strokeWidth = .7;
    for (double x = 0; x < s.width; x += 26) {
      c.drawLine(Offset(x, 0), Offset(x, s.height), grid);
    }
    for (double y = 0; y < s.height; y += 26) {
      c.drawLine(Offset(0, y), Offset(s.width, y), grid);
    }
    final origin = Offset(s.width / 2, s.height - 40);
    for (final p in points) {
      c.drawLine(
        origin,
        p,
        Paint()
          ..color = navy.withValues(alpha: .12)
          ..strokeWidth = 1,
      );
    }
    final contour = Paint()
      ..color = teal.withValues(alpha: .12)
      ..strokeWidth = 10
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < 3; i++) {
      c.drawArc(
        Rect.fromCenter(
          center: Offset(s.width * .7, 130),
          width: s.width + i * 70,
          height: 100 + i * 60,
        ),
        3.2,
        3.1,
        false,
        contour,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _PlanPainter old) => true;
}

class DisplacementCompass extends StatelessWidget {
  const DisplacementCompass({
    super.key,
    required this.readings,
    required this.site,
  });
  final List<Reading> readings;
  final SiteData site;
  @override
  Widget build(BuildContext context) => Semantics(
    label:
        'Arah pergeseran: ${readings.where((r) => r.success).map((r) => '${r.name} ${r.bearing.toStringAsFixed(1)} derajat').join(', ')}',
    child: Column(
      children: [
        SizedBox(
          height: 220,
          child: CustomPaint(
            size: Size.infinite,
            painter: _CompassPainter(readings, site),
          ),
        ),
        const Text(
          'Utara di atas · panjang vektor = pergeseran horizontal',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 10, color: muted),
        ),
      ],
    ),
  );
}

class _CompassPainter extends CustomPainter {
  _CompassPainter(this.readings, this.site);
  final List<Reading> readings;
  final SiteData site;
  @override
  void paint(Canvas c, Size s) {
    final center = Offset(s.width / 2, 106);
    final radius = math.min(s.width / 2 - 30, 82.0);
    final valid = readings.where((r) => r.success).toList();
    final max =
        valid.fold<double>(site.danger, (a, b) => math.max(a, b.displacement)) *
        1.15;
    for (final limit in [site.warning, site.alert, site.danger]) {
      c.drawCircle(
        center,
        radius * limit / max,
        Paint()
          ..color = statusColor(site.status(limit)).withValues(alpha: .45)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
    c.drawLine(
      center - Offset(radius, 0),
      center + Offset(radius, 0),
      Paint()..color = line,
    );
    c.drawLine(
      center - Offset(0, radius),
      center + Offset(0, radius),
      Paint()..color = line,
    );
    _text(c, 'U', center + Offset(-3, -radius - 20), navy, 11);
    _text(c, 'S', center + Offset(-3, radius + 8), muted, 10);
    _text(c, 'B', center + Offset(-radius - 18, -6), muted, 10);
    _text(c, 'T', center + Offset(radius + 8, -6), muted, 10);
    for (final r in valid) {
      final end = center + Offset(r.de / max * radius, -r.dn / max * radius);
      final color = statusColor(site.status(r.displacement));
      c.drawLine(
        center,
        end,
        Paint()
          ..color = color
          ..strokeWidth = 1.7,
      );
      c.drawCircle(end, 2.5, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _CompassPainter old) => true;
}
