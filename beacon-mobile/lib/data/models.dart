import 'dart:math' as math;

class Prism {
  final int slot;
  String name, kind;
  double height, ha, va;
  bool registered;
  Prism(
    this.slot, {
    this.name = '',
    this.kind = 'fs',
    this.height = 1.5,
    this.ha = 0,
    this.va = 90,
    this.registered = false,
  });
  String get code => 'P$slot';
  Map<String, dynamic> toJson() => {
    'slot': slot,
    'name': name,
    'kind': kind,
    'height': height,
    'ha': ha,
    'va': va,
    'registered': registered,
  };
  factory Prism.fromJson(Map<String, dynamic> j) => Prism(
    j['slot'],
    name: j['name'],
    kind: j['kind'],
    height: (j['height'] as num).toDouble(),
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    registered: j['registered'],
  );
}

class Reading {
  final int slot;
  final String name;
  final double n, e, z, n0, e0, z0, ha, va, sd;
  final bool success;
  Reading({
    required this.slot,
    required this.name,
    required this.n,
    required this.e,
    required this.z,
    required this.n0,
    required this.e0,
    required this.z0,
    required this.ha,
    required this.va,
    required this.sd,
    this.success = true,
  });
  double get dn => (n - n0) * 1000;
  double get de => (e - e0) * 1000;
  double get dz => (z - z0) * 1000;
  double get displacement => math.sqrt(dn * dn + de * de);
  double get linear3d => math.sqrt(dn * dn + de * de + dz * dz);
  double get bearing => (math.atan2(de, dn) * 180 / math.pi + 360) % 360;
  Map<String, dynamic> toJson() => {
    'slot': slot,
    'name': name,
    'n': n,
    'e': e,
    'z': z,
    'n0': n0,
    'e0': e0,
    'z0': z0,
    'ha': ha,
    'va': va,
    'sd': sd,
    'success': success,
  };
  factory Reading.fromJson(Map<String, dynamic> j) => Reading(
    slot: j['slot'],
    name: j['name'],
    n: (j['n'] as num).toDouble(),
    e: (j['e'] as num).toDouble(),
    z: (j['z'] as num).toDouble(),
    n0: (j['n0'] as num).toDouble(),
    e0: (j['e0'] as num).toDouble(),
    z0: (j['z0'] as num).toDouble(),
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    sd: (j['sd'] as num).toDouble(),
    success: j['success'],
  );
}

class RunSession {
  final String id;
  final DateTime time;
  final List<Reading> readings;
  final bool reference;
  String state;
  RunSession({
    required this.id,
    required this.time,
    required this.readings,
    this.reference = false,
    this.state = 'Selesai',
  });
  Map<String, dynamic> toJson() => {
    'id': id,
    'time': time.toIso8601String(),
    'readings': readings.map((e) => e.toJson()).toList(),
    'reference': reference,
    'state': state,
  };
  factory RunSession.fromJson(Map<String, dynamic> j) => RunSession(
    id: j['id'],
    time: DateTime.parse(j['time']),
    readings: (j['readings'] as List)
        .map((e) => Reading.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    reference: j['reference'],
    state: j['state'],
  );
}

class SiteData {
  final String id, name, location, logger;
  final double warning, alert, danger;
  final List<Prism> prisms;
  final List<RunSession> sessions;
  Map<String, String> config;
  List<Map<String, dynamic>> schedule;
  bool powered;
  double ha, va;
  String home;
  SiteData({
    required this.id,
    required this.name,
    required this.location,
    required this.logger,
    required this.prisms,
    required this.sessions,
    this.warning = 5,
    this.alert = 8,
    this.danger = 10,
    this.powered = true,
    this.ha = 124.5,
    this.va = 89.2,
    this.home = '',
    Map<String, String>? config,
    List<Map<String, dynamic>>? schedule,
  }) : config =
           config ??
           {
             'Job name': 'BEACON_MONITOR',
             'Prisma const (mm)': '0',
             'TS high (m)': '1.5',
             'Coordinate X (m)': '512400',
             'Coordinate Y (m)': '9782000',
             'Coordinate Z (m)': '132',
             'Step record': '1',
             'Retries': '3',
             'Cycle time (ms)': '5000',
             'Sapuan horizontal (°)': '6',
             'Sapuan vertikal (°)': '6',
             'Track every (menit)': '15',
             'Auto search': 'true',
           },
       schedule =
           schedule ??
           List.generate(
             7,
             (i) => {'day': i, 'enabled': i < 5, 'on': '07:00', 'off': '18:00'},
           );
  String status(double mm) => mm >= danger
      ? 'Awas'
      : mm >= alert
      ? 'Siaga'
      : mm >= warning
      ? 'Waspada'
      : 'Normal';
  String speedStatus(double mm) => mm > 3
      ? 'Awas'
      : mm > 2
      ? 'Siaga'
      : mm > 1
      ? 'Waspada'
      : 'Normal';
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'location': location,
    'logger': logger,
    'warning': warning,
    'alert': alert,
    'danger': danger,
    'prisms': prisms.map((p) => p.toJson()).toList(),
    'sessions': sessions.map((s) => s.toJson()).toList(),
    'config': config,
    'schedule': schedule,
    'powered': powered,
    'ha': ha,
    'va': va,
    'home': home,
  };
  factory SiteData.fromJson(Map<String, dynamic> j) => SiteData(
    id: j['id'],
    name: j['name'],
    location: j['location'],
    logger: j['logger'],
    warning: (j['warning'] as num).toDouble(),
    alert: (j['alert'] as num? ?? 8).toDouble(),
    danger: (j['danger'] as num).toDouble(),
    prisms: (j['prisms'] as List)
        .map((e) => Prism.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    sessions: (j['sessions'] as List)
        .map((e) => RunSession.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    config: Map<String, String>.from(j['config']),
    schedule: (j['schedule'] as List)
        .map((e) => Map<String, dynamic>.from(e))
        .toList(),
    powered: j['powered'],
    ha: (j['ha'] as num).toDouble(),
    va: (j['va'] as num).toDouble(),
    home: j['home'],
  );
}

String dateLabel(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.month - 1]} ${d.year}';
String timeLabel(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
