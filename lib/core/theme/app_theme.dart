import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFF0F172A); // Slate 900 for gradient base
  static const Color primary = Color(0xFFFF6D00); // Orange Accent
  static const Color textPrimary = Color(0xFFFAFAFA); // Crisp White
  static const Color textSecondary = Color(0xFF94A3B8); // Slate 400
  
  // Glassmorphism colors
  static const Color glassSurface = Color(0x33FFFFFF); // 20% White
  static const Color glassBorder = Color(0x1AFFFFFF); // 10% White
  static const Color sidebarBackground = Color(0xCC0F172A); // 80% Slate

  static final ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: Colors.transparent, // Background handled by shell
    colorScheme: const ColorScheme.dark(
      primary: primary,
      surface: Colors.transparent,
      onSurface: textPrimary,
      onPrimary: Colors.white,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).copyWith(
      displayLarge: GoogleFonts.inter(fontWeight: FontWeight.bold, color: textPrimary),
      displayMedium: GoogleFonts.inter(fontWeight: FontWeight.bold, color: textPrimary),
      headlineLarge: GoogleFonts.inter(fontWeight: FontWeight.w600, color: textPrimary),
      headlineMedium: GoogleFonts.inter(fontWeight: FontWeight.w600, color: textPrimary),
      titleLarge: GoogleFonts.inter(fontWeight: FontWeight.w600, color: textPrimary),
      bodyLarge: GoogleFonts.inter(color: textPrimary),
      bodyMedium: GoogleFonts.inter(color: textSecondary),
    ),
    dividerTheme: const DividerThemeData(color: glassBorder, thickness: 1),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      iconTheme: IconThemeData(color: textPrimary),
    ),
  );
}
