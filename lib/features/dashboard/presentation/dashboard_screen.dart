import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:cmandili_admin/core/theme/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row - Metric Cards
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Total Revenue Today (TND)', 
                                style: Theme.of(context).textTheme.bodyMedium,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                              child: Text('TND', style: TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                            )
                          ],
                        ),
                        const SizedBox(height: 8),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text('1,250.500 TND', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold, fontSize: 28)),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text('Today\'s trend', style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(width: 16),
                            Expanded(
                              child: SizedBox(
                                height: 30,
                                child: LineChart(
                                  LineChartData(
                                    gridData: FlGridData(show: false),
                                    titlesData: FlTitlesData(show: false),
                                    borderData: FlBorderData(show: false),
                                    lineBarsData: [
                                      LineChartBarData(
                                        spots: const [FlSpot(0, 3), FlSpot(1, 4), FlSpot(2, 3.5), FlSpot(3, 5), FlSpot(4, 4), FlSpot(5, 6)],
                                        isCurved: true,
                                        color: AppTheme.primary,
                                        barWidth: 2,
                                        dotData: FlDotData(show: false),
                                        belowBarData: BarAreaData(show: false),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )
                          ],
                        )
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 3,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Admin Commissions Today (TND)', 
                                style: Theme.of(context).textTheme.bodyMedium,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(Icons.bar_chart_rounded, color: AppTheme.primary, size: 20),
                          ],
                        ),
                        const SizedBox(height: 8),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text('215.350 TND', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold, fontSize: 28)),
                        ),
                        const SizedBox(height: 8),
                        Text('(Restaurant 10%: 125.000 TND | Driver 23%: 90.350 TND)', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondary)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Active Drivers', 
                                style: Theme.of(context).textTheme.bodyMedium,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                              child: const Text('LIVE', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                            )
                          ],
                        ),
                        const SizedBox(height: 8),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text('45', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold, fontSize: 28)),
                        ),
                        const SizedBox(height: 8),
                        Text('(38 Online, 7 Idle)', style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Pending Payouts', 
                                style: Theme.of(context).textTheme.bodyMedium,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text('KPI', style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text('3', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold, fontSize: 28)),
                        ),
                        const SizedBox(height: 8),
                        Text('requests with TND amount', style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // Middle Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Daily Performance & Flux Dashboard', 
                                style: Theme.of(context).textTheme.titleLarge,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 16),
                            const Spacer(),
                            Row(
                              children: [
                                Container(width: 12, height: 12, color: Colors.grey.shade400),
                                const SizedBox(width: 8),
                                Text('Total Orders', style: Theme.of(context).textTheme.bodySmall),
                                const SizedBox(width: 16),
                                Container(width: 12, height: 12, color: AppTheme.primary),
                                const SizedBox(width: 8),
                                Text('Admin Commission (TND)', style: Theme.of(context).textTheme.bodySmall),
                              ],
                            )
                          ],
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          height: 300,
                          child: LineChart(
                            LineChartData(
                              gridData: FlGridData(
                                show: true,
                                drawVerticalLine: true,
                                getDrawingHorizontalLine: (value) => FlLine(color: AppTheme.glassBorder, strokeWidth: 1),
                                getDrawingVerticalLine: (value) => FlLine(color: AppTheme.glassBorder, strokeWidth: 1),
                              ),
                              titlesData: FlTitlesData(
                                leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (val, meta) => Text(val.toInt().toString(), style: const TextStyle(fontSize: 10)))),
                                bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (val, meta) => Text(val.toInt().toString(), style: const TextStyle(fontSize: 10)))),
                                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                              ),
                              borderData: FlBorderData(show: false),
                              lineBarsData: [
                                LineChartBarData(
                                  spots: const [FlSpot(1, 100), FlSpot(5, 150), FlSpot(10, 188), FlSpot(15, 104), FlSpot(20, 202), FlSpot(25, 230), FlSpot(30, 233)],
                                  isCurved: true,
                                  color: AppTheme.primary,
                                  barWidth: 3,
                                  dotData: FlDotData(show: true),
                                  belowBarData: BarAreaData(
                                    show: true,
                                    gradient: LinearGradient(colors: [AppTheme.primary.withOpacity(0.5), AppTheme.primary.withOpacity(0.0)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  flex: 2,
                  child: _GlassCard(
                    padding: const EdgeInsets.all(0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Text('Operational Stream', style: Theme.of(context).textTheme.titleLarge),
                        ),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: DataTable(
                            headingRowColor: MaterialStateProperty.all(AppTheme.glassSurface),
                            columnSpacing: 16,
                            horizontalMargin: 16,
                            columns: const [
                              DataColumn(label: SizedBox(width: 70, child: Text('Order ID', style: TextStyle(fontWeight: FontWeight.bold)))),
                              DataColumn(label: SizedBox(width: 100, child: Text('Restaurant', style: TextStyle(fontWeight: FontWeight.bold)))),
                              DataColumn(label: SizedBox(width: 100, child: Text('Driver', style: TextStyle(fontWeight: FontWeight.bold)))),
                              DataColumn(label: SizedBox(width: 80, child: Text('Distance', style: TextStyle(fontWeight: FontWeight.bold)))),
                              DataColumn(label: SizedBox(width: 100, child: Text('Delivery Fee', style: TextStyle(fontWeight: FontWeight.bold)))),
                              DataColumn(label: SizedBox(width: 110, child: Text('Admin Comm.', style: TextStyle(fontWeight: FontWeight.bold)))),
                            ],
                            rows: [
                              _buildStreamRow('1042', 'Pizza Hut', 'Yassine K.', '3.2 km', '3.500 TND', '0.805 TND'),
                              _buildStreamRow('1043', 'KFC', 'Amine K.', '6.1 km', '5.075 TND', '1.167 TND'),
                              _buildStreamRow('1044', 'Cafe de Paris', 'Mourad B.', '4.0 km', '3.500 TND', '0.805 TND'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // Bottom Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Partner Leaderboard', style: Theme.of(context).textTheme.titleLarge),
                            Text('Growth %', style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
                        const SizedBox(height: 24),
                        _buildLeaderboardRow('Plan B', 215350.0, 1.0, '23.2%'),
                        _buildLeaderboardRow('L\'Ardoise', 125000.0, 0.6, '43.3%'),
                        _buildLeaderboardRow('Pizza Slice', 155000.0, 0.75, '20.0%'),
                        _buildLeaderboardRow('Plan B', 120000.0, 0.55, '10.0%'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  flex: 1,
                  child: _GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Zone Performance Heatmap', style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 16),
                        Container(
                          height: 200,
                          decoration: BoxDecoration(
                            color: AppTheme.glassSurface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.glassBorder),
                          ),
                          child: const Center(
                            child: Icon(Icons.map_rounded, size: 48, color: AppTheme.glassBorder),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  DataRow _buildStreamRow(String id, String rest, String driver, String dist, String fee, String comm) {
    return DataRow(cells: [
      DataCell(Text('#$id', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600))),
      DataCell(Text(rest)),
      DataCell(Text(driver)),
      DataCell(Text(dist)),
      DataCell(Text(fee)),
      DataCell(Text(comm, style: const TextStyle(fontWeight: FontWeight.bold))),
    ]);
  }

  Widget _buildLeaderboardRow(String name, double value, double ratio, String growth) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(name, style: const TextStyle(fontSize: 14)),
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  flex: (ratio * 100).toInt(),
                  child: Container(
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                Expanded(
                  flex: 100 - (ratio * 100).toInt(),
                  child: Container(),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          SizedBox(
            width: 100,
            child: Text('${(value / 1000).toStringAsFixed(3)} TND', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 24),
          SizedBox(
            width: 60,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Icon(Icons.trending_up, color: Colors.blueAccent, size: 16),
                const SizedBox(width: 4),
                Text(growth, style: const TextStyle(fontSize: 12)),
              ],
            ),
          )
        ],
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const _GlassCard({required this.child, this.padding = const EdgeInsets.all(24)});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: AppTheme.glassSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}
