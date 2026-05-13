import 'package:flutter/material.dart';
import 'package:cmandili_admin/core/theme/app_theme.dart';

class PartnersScreen extends StatefulWidget {
  const PartnersScreen({super.key});

  @override
  State<PartnersScreen> createState() => _PartnersScreenState();
}

class _PartnersScreenState extends State<PartnersScreen> {
  // Mock data for UI demonstration until Supabase integration is wired up.
  final List<Map<String, dynamic>> _mockPartners = [
    {
      'id': '1',
      'name': 'La Pizzeria Centrale',
      'type': 'Restaurant',
      'total_orders': 145,
      'total_revenue': 3450.500, // Subtotal of all orders
      'status': 'Active'
    },
    {
      'id': '2',
      'name': 'Sushi Express',
      'type': 'Restaurant',
      'total_orders': 89,
      'total_revenue': 2890.000,
      'status': 'Active'
    },
    {
      'id': '3',
      'name': 'Carrefour Market',
      'type': 'Supermarket',
      'total_orders': 210,
      'total_revenue': 8400.250,
      'status': 'Active'
    },
  ];

  Map<String, dynamic>? _selectedPartner;

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
                      'Partners & Restaurants',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.separated(
                      itemCount: _mockPartners.length,
                      separatorBuilder: (context, index) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final partner = _mockPartners[index];
                        final isSelected = _selectedPartner?['id'] == partner['id'];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          selectedTileColor: AppTheme.glassSurface,
                          selected: isSelected,
                          onTap: () {
                            setState(() {
                              _selectedPartner = partner;
                            });
                          },
                          title: Text(
                            partner['name'],
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: isSelected ? AppTheme.primary : AppTheme.textPrimary,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                ),
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Text(
                              '${partner['type']} • ${partner['status']}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                          trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
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
            child: _selectedPartner == null
                ? Center(
                    child: Text(
                      'Select a partner to view details',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppTheme.textSecondary),
                    ),
                  )
                : _buildPartnerDetail(_selectedPartner!),
          ),
        ],
      ),
    );
  }

  Widget _buildPartnerDetail(Map<String, dynamic> partner) {
    // Exact 10% commission logic
    final double totalRevenue = partner['total_revenue'];
    final double platformCut = totalRevenue * 0.10; // 10%

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
                child: const Icon(Icons.storefront_rounded, size: 32, color: AppTheme.primary),
              ),
              const SizedBox(width: 24),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    partner['name'],
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
                    ),
                    child: Text(
                      partner['type'],
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.primary, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 48),
          Text('Financial Breakdown (TND)', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _DetailMetricCard(
                  title: 'Generated Subtotal',
                  value: '${totalRevenue.toStringAsFixed(3)} TND',
                  subtitle: 'Across ${partner['total_orders']} orders',
                  icon: Icons.receipt_long_rounded,
                ),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: _DetailMetricCard(
                  title: 'Platform Due (10%)',
                  value: '${platformCut.toStringAsFixed(3)} TND',
                  subtitle: 'Strict 10% commission on subtotal',
                  icon: Icons.pie_chart_rounded,
                  valueColor: AppTheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 48),
          Text('Recent Orders', style: Theme.of(context).textTheme.titleLarge),
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
                child: Text('Data Table: Individual orders and their exact 10% cut will be listed here.'),
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
