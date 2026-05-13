import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cmandili_admin/features/dashboard/presentation/dashboard_screen.dart';
import 'package:cmandili_admin/features/partners/presentation/partners_screen.dart';
import 'package:cmandili_admin/features/drivers/presentation/drivers_screen.dart';
import 'package:cmandili_admin/shared/widgets/admin_shell.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/dashboard',
  routes: [
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) {
        return AdminShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/partners',
          builder: (context, state) => const PartnersScreen(),
        ),
        GoRoute(
          path: '/drivers',
          builder: (context, state) => const DriversScreen(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const Center(child: Text('Settings (Coming Soon)')),
        ),
      ],
    ),
  ],
);
