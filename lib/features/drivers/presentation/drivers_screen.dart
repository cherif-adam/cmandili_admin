import 'package:flutter/material.dart';
import 'package:cmandili_admin/core/theme/app_theme.dart';
import 'dart:math';

class DriversScreen extends StatefulWidget {
  const DriversScreen({super.key});

  @override
  State<DriversScreen> createState() => _DriversScreenState();
}

class _DriversScreenState extends State<DriversScreen> {
  // Mock data for UI demonstration until Supabase integration is wired up.
  final List<Map<String, dynamic>> _mockDrivers = [
    {
      'id': 'd1',
      'name': 'Ahmed Ben Ali',
      'vehicle': 'Motorcycle',
      'total_runs': 42,
      'total_distance_km': 215.5,
      'status': 'Online'
    },
    {
      'id': 'd2',
      'name': 'Sami Trabelsi',
      'vehicle': 'Car',
      'total_runs': 18,
      'total_distance_km': 130.2,
      'status': 'Offline'
    },
  ];

  Map<String, dynamic>? _selectedDriver;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          // Master View (List)
          Expanded(
            flex: 1,
            child: Container(
              decoration: const BoxDecoration(
                border: Border(right: BorderSide(color: AppTheme.glassBorder)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Text(
                      'Driver Fleet',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.separated(
                      itemCount: _mockDrivers.length,
                      separatorBuilder: (context, index) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final driver = _mockDrivers[index];
                        final isSelected = _selectedDriver?['id'] == driver['id'];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          selectedTileColor: AppTheme.glassSurface,
                          selected: isSelected,
                          onTap: () {
                            setState(() {
                              _selectedDriver = driver;
                            });
                          },
                          title: Text(
                            driver['name'],
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: isSelected ? AppTheme.primary : AppTheme.textPrimary,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                ),
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Text(
                              '${driver['vehicle']} • ${driver['status']}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                          trailing: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: driver['status'] == 'Online' ? AppTheme.primary : Colors.grey.shade700,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Detail View
          Expanded(
            flex: 2,
            child: _selectedDriver == null
                ? Center(
                    child: Text(
                      'Select a driver to view details',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppTheme.textSecondary),
                    ),
                  )
                : _buildDriverDetail(_selectedDriver!),
          ),
        ],
      ),
    );
  }

  Widget _buildDriverDetail(Map<String, dynamic> driver) {
    // Business Logic Calculation (Mocked aggregation. Real app will calculate per order exactly)
    // To simulate per-order distance variation accurately, we'll assume an average distance per order for the mock.
    final int runs = driver['total_runs'];
    final double totalDistance = driver['total_distance_km'];
    final double avgDistancePerOrder = totalDistance / runs;
    
    // Exact Tunisian Delivery Formula per order: 3.500 + max(0, distance - 4) * 0.750
    final double avgExtraDistance = max(0, avgDistancePerOrder - 4);
    final double avgFeePerOrder = 3.500 + (avgExtraDistance * 0.750);
    final double totalDeliveryRevenue = avgFeePerOrder * runs;
    
    // Platform takes strictly 23% of total delivery revenue
    final double platformCut = totalDeliveryRevenue * 0.23;
    final double driverEarnings = totalDeliveryRevenue - platformCut;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(48.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppTheme.glassSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.glassBorder),
                ),
                child: const Icon(Icons.two_wheeler_rounded, size: 32, color: AppTheme.primary),
              ),
              const SizedBox(width: 24),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    driver['name'],
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${driver['vehicle']} • ${driver['total_runs']} Completed Runs',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 48),
          Text('Delivery Revenue & Commissions (TND)', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _DetailMetricCard(
                  title: 'Total Delivery Fees',
                  value: '${totalDeliveryRevenue.toStringAsFixed(3)} TND',
                  subtitle: 'Formula: 3.500 + 0.750/km > 4km',
                  icon: Icons.payments_rounded,
                ),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: _DetailMetricCard(
                  title: 'Platform Due (23%)',
                  value: '${platformCut.toStringAsFixed(3)} TND',
                  subtitle: 'Platform\'s exact 23% cut',
                  icon: Icons.account_balance_wallet_rounded,
                  valueColor: AppTheme.primary,
                ),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: _DetailMetricCard(
                  title: 'Driver Earnings',
                  value: '${driverEarnings.toStringAsFixed(3)} TND',
                  subtitle: 'Net cash kept by driver',
                  icon: Icons.directions_car_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 48),
          Text('Run History', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 24),
          Container(
            decoration: BoxDecoration(
              color: AppTheme.glassSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.glassBorder),
            ),
            child: const Center(
              child: Padding(
                padding: EdgeInsets.all(48),
                child: Text('Data Table: Individual deliveries and precise per-order formulas will be listed here.'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailMetricCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color? valueColor;

  const _DetailMetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.glassSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: Theme.of(context).textTheme.bodyMedium),
              Icon(icon, size: 20, color: AppTheme.textSecondary),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: valueColor ?? AppTheme.textPrimary,
                ),
          ),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
