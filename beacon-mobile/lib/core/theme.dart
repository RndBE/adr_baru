import 'package:flutter/material.dart';

const ink = Color(0xFF192443),
    navy = Color(0xFF303481),
    paper = Color(0xFFF3F5FA),
    teal = Color(0xFF087F75),
    amber = Color(0xFFA66308),
    line = Color(0xFFE2E7F0),
    muted = Color(0xFF66728A),
    danger = Color(0xFFBC3646);
Color statusColor(String status) => switch (status) {
  // Label instrumen dari status_rts.dart ikut di sini supaya "Menyala, siap"
  // tidak tampil abu-abu seolah keadaan tak dikenal.
  'Normal' ||
  'Berhasil' ||
  'Selesai' ||
  'Menyala, siap' ||
  'Sedang mengukur' => teal,
  'Waspada' => amber,
  'Siaga' => const Color(0xFFCF5C22),
  'Awas' || 'Gagal' => danger,
  _ => muted,
};
TextStyle display(double size, {Color color = ink}) => TextStyle(
  fontSize: size,
  fontWeight: FontWeight.w800,
  letterSpacing: -.7,
  color: color,
  height: 1.15,
);
TextStyle mono(double size, {Color color = ink}) => TextStyle(
  fontFamily: 'monospace',
  fontSize: size,
  fontWeight: FontWeight.w600,
  color: color,
);
ThemeData beaconTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: paper,
  colorScheme: ColorScheme.fromSeed(
    seedColor: navy,
    primary: navy,
    surface: Colors.white,
    onSurface: ink,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: paper,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    centerTitle: false,
  ),
  textTheme: const TextTheme(
    bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: ink),
    bodySmall: TextStyle(fontSize: 12, height: 1.4, color: muted),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w700,
      color: ink,
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    // Putih, sewarna pemilih site.
    //
    // `paper` adalah warna latar layar, jadi field yang diisi `paper` melebur
    // dengan halaman dan hanya dibatasi garis tipis. Putih membuatnya terbaca
    // sebagai bidang yang bisa diisi. Di atas kartu yang juga putih, batasnya
    // tetap terjaga oleh `enabledBorder` di bawah.
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.all(16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: line),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: line),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(48, 50),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      minimumSize: const Size(48, 48),
      side: const BorderSide(color: line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: Colors.white,
    indicatorColor: navy.withValues(alpha: .1),
    labelTextStyle: WidgetStateProperty.resolveWith(
      (s) => TextStyle(
        fontSize: 11,
        fontWeight: s.contains(WidgetState.selected)
            ? FontWeight.w800
            : FontWeight.w500,
        color: s.contains(WidgetState.selected) ? navy : muted,
      ),
    ),
  ),
  dividerTheme: const DividerThemeData(color: line, space: 1),
);
