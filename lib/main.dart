import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cmandili_admin/core/theme/app_theme.dart';
import 'package:cmandili_admin/core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // TODO: Initialize Supabase here
  
  runApp(
    const ProviderScope(
      child: CmandiliAdminApp(),
    ),
  );
}

class CmandiliAdminApp extends ConsumerWidget {
  const CmandiliAdminApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Cmandili Admin Central',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      routerConfig: appRouter,
    );
  }
}
