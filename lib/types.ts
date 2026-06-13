export interface Driver {
  id: string
  user_id: string
  is_online: boolean
  current_lat: number
  current_lng: number
  last_location_update: string
  profile?: Profile
  wallet?: Wallet
  stats?: DriverStats
}

export interface DriverStats {
  total_deliveries: number
  total_earnings: number
  commission_owed: number
}

export interface Partner {
  id: string
  user_id: string
  entity_id: string
  commission_rate: number | null
  profile?: Profile
  restaurant?: Restaurant
  wallet?: Wallet
  stats?: PartnerStats
}

export interface PartnerStats {
  total_orders: number
  total_revenue: number
  commission_owed: number
}

export interface Restaurant {
  id: string
  name: string
  partner_id: string
  latitude: number
  longitude: number
}

export interface Profile {
  id: string
  full_name: string
  phone: string
  email: string
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  status: 'active' | 'blocked'
  updated_at: string
}

export interface Order {
  id: string
  status: string
  user_id: string
  restaurant_id: string
  driver_id: string | null
  subtotal: number
  delivery_fee: number
  total: number
  platform_fee: number
  driver_fee_cut: number
  payment_method: string
  created_at: string
  restaurant?: { name: string }
  driver?: { profile?: Profile }
  customer_name?: string
  customer_phone?: string
}

export interface Settlement {
  id: string
  user_id: string
  entity_type: 'restaurant' | 'supermarket' | 'driver'
  amount: number
  type: string
  status: string
  description: string
  related_order_id: string
  created_at: string
}

export interface DailyRevenue {
  date: string
  restaurant_commissions: number
  driver_commissions: number
  total: number
}
