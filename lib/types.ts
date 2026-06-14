export interface User {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  auth_provider: string;
  is_active?: boolean;
  created_at?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface TrafficRecord {
  id: number;
  location: string;
  latitude: number;
  longitude: number;
  vehicle_count: number;
  average_speed: number;
  congestion_level: 'low' | 'medium' | 'high';
  road_type: string;
  created_at: string;
}

export interface Incident {
  id: number;
  title: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reported_at: string;
  status: 'active' | 'resolved';
}

export interface ETAResponse {
  location: string;
  distance_km: number;
  mode: string;
  congestion_level: string;
  average_speed_kmh: number;
  eta_minutes: number;
  eta_range: { min: number; max: number };
  confidence: string;
  last_updated: string;
}

export interface CongestionHotspot {
  city_node: string;
  state: string;
  avg_speed: number;
  current_speed: number;
  congestion: 'Critical High' | 'High' | 'Medium' | 'Low' | 'Stable Low';
  trend: 'up' | 'down' | 'stable';
}

export interface AnalyticsSnapshot {
  total_records: number;
  avg_congestion: number;
  high_congestion_count: number;
  active_incidents: number;
  city_health_score: number;
  monitored_districts: number;
  ws_latency_ms: number;
}

export interface TrendDataPoint {
  time: string;
  congestion: number;
  vehicles: number;
}

export interface IndiaDistrict {
  id: string;
  name: string;
  state: string;
  congestion_score: number;
  status: 'fluid' | 'moderate' | 'critical';
  flow_rate: number;
}

export interface RouteOptimizeRequest {
  origin: { lat: number; lng: number } | string;
  destination: { lat: number; lng: number } | string;
  mode: 'driving' | 'transit' | 'walking';
  alternatives?: boolean;
}

export interface RouteResult {
  distance_km: number;
  duration_minutes: number;
  avg_speed_kmh: number;
  congestion_aware: boolean;
  polyline?: string;
  steps?: RouteStep[];
  optimization_score?: number;
  co2_kg?: number;
  trees_offset?: number;
}

export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'congestion_alert' | 'system' | 'departure_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean;
  created_at: string;
}

export interface UserPreferences {
  notifications_enabled: boolean;
  preferred_mode: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  congestion_threshold: string;
  language: string;
}

export interface DepartureAlert {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  departure_time: string;
  advance_notice_minutes: number;
  days_of_week: string[];
  is_active: boolean;
}

export interface TripHistory {
  id: string;
  origin: string;
  destination: string;
  distance_km: number;
  duration_minutes: number;
  mode: string;
  congestion_level: string;
  notes?: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_active_users: number;
  traffic_records_today: number;
  system_uptime_percent: number;
  db_connection_pool: { used: number; total: number };
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  last_poll: string;
}

export type CongestionLevel = 'low' | 'medium' | 'high' | 'critical';
export type TravelMode = 'driving' | 'transit' | 'walking';
