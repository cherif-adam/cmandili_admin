import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:ui';
import 'package:cmandili_admin/core/theme/app_theme.dart';

class AdminShell extends StatelessWidget {
  final Widget child;

  const AdminShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        // The main background gradient replacing the cityscape image
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0F2027),
              Color(0xFF203A43),
              Color(0xFF2C5364),
            ],
          ),
        ),
        child: Row(
          children: [
            // Glass Sidebar
            ClipRRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(
                  width: 250,
                  decoration: const BoxDecoration(
                    color: AppTheme.sidebarBackground,
                    border: Border(
                      right: BorderSide(color: AppTheme.glassBorder),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 32),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppTheme.primary,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Center(
                                child: Text('C', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Cmandili',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 48),
                      _SidebarItem(
                        icon: Icons.home_rounded,
                        title: 'Overview',
                        route: '/dashboard',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.account_balance_wallet_rounded,
                        title: 'Finance & Payouts',
                        route: '/finance',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.storefront_rounded,
                        title: 'Partners & KYC',
                        route: '/partners',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.dashboard_rounded,
                        title: 'Dashboard',
                        route: '/dummy1',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.rocket_launch_rounded,
                        title: 'Deployments',
                        route: '/dummy2',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.delivery_dining_rounded,
                        title: 'Netiveries',
                        route: '/dummy3',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.history_rounded,
                        title: 'Recents',
                        route: '/dummy4',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.two_wheeler_rounded,
                        title: 'Drivers',
                        route: '/drivers',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.color_lens_rounded,
                        title: 'Colors',
                        route: '/dummy5',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      _SidebarItem(
                        icon: Icons.description_rounded,
                        title: 'Report paport',
                        route: '/dummy6',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      const Spacer(),
                      const Divider(),
                      _SidebarItem(
                        icon: Icons.settings_rounded,
                        title: 'Global Settings',
                        route: '/settings',
                        currentRoute: GoRouterState.of(context).uri.toString(),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
            // Main Content Area with Topbar
            Expanded(
              child: Column(
                children: [
                  // Top Bar
                  ClipRRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        height: 70,
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        decoration: const BoxDecoration(
                          color: Color(0x88D4D4D8), // Light gray translucent top bar
                          border: Border(bottom: BorderSide(color: AppTheme.glassBorder)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Admin Central 2.0',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    color: Colors.black87,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            Row(
                              children: [
                                // Live Sync Badge
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.green.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: Colors.green.withOpacity(0.5)),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: Colors.green,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Live Sync: Online (3s ago)',
                                        style: TextStyle(color: Colors.green, fontWeight: FontWeight.w600, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 24),
                                // Admin Profile
                                Row(
                                  children: [
                                    const CircleAvatar(
                                      radius: 16,
                                      backgroundImage: NetworkImage('https://i.pravatar.cc/150?img=11'),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      'Admin - Ahmed',
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                            color: Colors.black87,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(Icons.keyboard_arrow_down, color: Colors.black54),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Dashboard Content
                  Expanded(
                    child: child,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String route;
  final String currentRoute;

  const _SidebarItem({
    required this.icon,
    required this.title,
    required this.route,
    required this.currentRoute,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = currentRoute.startsWith(route) && route != '/';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (route.startsWith('/dummy')) return; // ignore dummies
            context.go(route);
          },
          borderRadius: BorderRadius.circular(8),
          hoverColor: AppTheme.glassSurface,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected ? AppTheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected ? Colors.white : AppTheme.textSecondary,
                ),
                const SizedBox(width: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: isSelected ? Colors.white : AppTheme.textSecondary,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
