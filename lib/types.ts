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

export interface AuthDashboardData {
  user: User & { is_verified?: boolean };
  unread_notifications: number;
  active_incidents_citywide: number;
  city_health_score: number | null;
  health_period_hours: number;
  saved_routes: Array<{
    route_id: string;
    route_name: string;
    origin: string;
    destination: string;
    congestion_level: string;
    average_speed_kmh: number | null;
  }>;
  generated_at: string;
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

export interface TrafficRecordCreate {
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  vehicle_count?: number | null;
  average_speed?: number | null;
  congestion_level?: 'low' | 'medium' | 'high' | null;
  road_type?: 'arterial' | 'highway' | 'local' | 'expressway' | 'junction' | null;
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

/** Crowdsourced road incident from `/incidents/` */
export interface CommunityIncident {
  id: number;
  incident_uuid: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  incident_type: string;
  severity: string;
  description: string;
  reported_by?: string;
  upvotes: number;
  downvotes: number;
  is_active?: boolean;
  reported_at: string;
  expires_at?: string | null;
  resolved_at?: string | null;
  community_score?: number;
  city?: string;
}

export interface CommunityIncidentListData {
  total: number;
  incidents: CommunityIncident[];
  generated_at?: string;
}

export interface CommunityIncidentCreateData {
  message?: string;
  incident: CommunityIncident;
}

export interface CommunityIncidentVoteData {
  message?: string;
  upvotes: number;
  downvotes: number;
  community_score?: number;
  changed?: boolean;
  resolved?: boolean;
}

export interface WeatherCitySnapshot {
  city_id: string;
  snapshot_id?: string;
  city: string;
  country?: string;
  condition: string;
  description?: string;
  temp_c?: number;
  temp?: number;
  feels_like_c?: number;
  humidity?: number;
  wind_kmh?: number;
  wind?: number;
  rain_mm_1h?: number;
  visibility_km?: number;
  visibility?: number;
  congestion_modifier?: string;
  congestionModifier?: number;
  alert_level?: string;
  congestion_bump_levels?: number;
  impact_advice?: string;
  modifier_label?: string;
  tips?: string[];
  source?: string;
  fetched_at?: string;
  lat?: number;
  lng?: number;
}

export interface WeatherCitiesData {
  total: number;
  cities: WeatherCitySnapshot[];
  message?: string;
  severe_impact?: number;
  moderate_impact?: number;
  light_impact?: number;
  clear_cities?: number;
  network_alert?: string;
  generated_at?: string;
  tip?: string;
}

export interface WeatherCityIdEntry {
  city_id: string;
  city_name: string;
  endpoint?: string;
}

export interface WeatherCityIdsData {
  total: number;
  cities: WeatherCityIdEntry[];
  usage?: string;
}

export interface WeatherImpactData {
  location: string;
  city_id?: string | null;
  city?: string | null;
  condition?: string;
  congestion_modifier?: string;
  alert_level?: string;
  rain_mm_1h?: number;
  visibility_km?: number;
  impact_advice?: string;
  modifier_label?: string;
  congestion_bump_levels?: number;
  tips?: string[];
}

export interface WeatherStatusData {
  owm_configured: boolean;
  data_source: string;
  cities_cached: number;
  cities_monitored: number;
  last_fetch_at?: string | null;
  refresh_interval_minutes?: number;
  city_id_directory_url?: string;
  sample_city_id?: string | null;
  sample_city_url?: string | null;
  hint?: string;
}

export interface EtaResult {
  location: string;
  distance_km: number;
  eta_minutes: number;
  eta_with_buffer_minutes?: number;
  congestion_level: string;
  average_speed_kmh: number;
  vehicle_count?: number;
  traffic_condition?: string;
  confidence: string;
  data_age_minutes?: number;
  arrival_time?: string;
  calculated_at?: string;
  mode?: string;
}

export interface EtaModeBreakdown {
  eta_minutes: number;
  eta_with_buffer_minutes?: number;
  average_speed_kmh: number;
  congestion_level: string;
  traffic_condition?: string;
  confidence: string;
  data_age_minutes?: number;
  arrival_time?: string;
}

export interface EtaCompareResponse {
  location: string;
  distance_km: number;
  modes: Record<string, EtaModeBreakdown>;
  recommended_mode?: string;
  calculated_at?: string;
}

export interface EtaBatchResponse {
  results: EtaResult[];
  total_locations: number;
  fastest_location?: string;
  slowest_location?: string;
  average_eta_minutes?: number;
  calculated_at?: string;
}

export interface EtaLocationsResponse {
  city_level_supported: string[];
  locations: string[];
  total: number;
  message?: string;
}

/** @deprecated Use EtaResult */
export type ETAResponse = EtaResult;

export interface CongestionHotspot {
  city_node: string;
  state: string;
  avg_speed: number;
  current_speed: number;
  congestion: 'Critical High' | 'High' | 'Medium' | 'Low' | 'Stable Low';
  trend: 'up' | 'down' | 'stable';
}

export interface IndiaDistrict {
  district: string;
  state: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  congestion_level: 'low' | 'medium' | 'high';
  vehicle_count: number;
  congestion_ratio: number;
  source: string;
  updated_at: string;
}

export interface IndiaDistrictListData {
  total: number;
  page: number;
  size: number;
  pages: number;
  districts: IndiaDistrict[];
  congestion_filter_note?: string;
}

export interface IndiaDistrictStateData {
  state: string;
  total_districts: number;
  congestion_summary: { high: number; medium: number; low: number };
  districts: IndiaDistrict[];
}

export interface IndiaDistrictStatesData {
  total_states: number;
  states: string[];
}

export interface ReportHourlyRow {
  hour: number;
  time_label: string;
  congestion: string | number | null;
  avg_speed_kmh: number | null;
  avg_vehicles: number | null;
  data_points: number;
}

export interface DailyReportData {
  location: string;
  report_type: 'daily_summary';
  period: string;
  total_records: number;
  active_incidents: number;
  avg_speed_kmh: number;
  health_score: number;
  hourly_breakdown: ReportHourlyRow[];
  generated_at: string;
}

export interface WeeklyReportDay {
  date: string;
  day_label: string;
  avg_speed_kmh: number | null;
  avg_congestion_pct: number;
  high_congestion_pct: number;
  incidents: number;
  peak_hour: string | null;
  data_points: number;
}

export interface WeeklyReportData {
  location: string;
  report_type: 'weekly_trend';
  summary: {
    peak_today_pct: number;
    avg_today_pct: number;
    total_volume: number;
    week_avg_pct: number;
  };
  days: WeeklyReportDay[];
  vs_yesterday: number;
  vs_last_week: number;
  peak_shift: string | null;
  incidents_today: number;
  generated_at: string;
}

export interface HotspotReportData {
  report_type: 'hotspot_analysis';
  period_hours: number;
  hotspots: Array<Record<string, string | number | null>>;
  total: number;
  generated_at: string;
}

export interface FleetOverviewData {
  report_type: 'fleet_overview';
  period_days: number;
  org_id: string;
  summary: WeeklyReportData['summary'];
  vehicles: Array<{
    registration: string;
    vehicle_type: string;
    trips: number;
    total_distance_km: number;
    avg_speed_kmh: number;
    fuel_used_liters: number;
    efficiency_grade: string;
    rank: number;
  }>;
  totals: { trips: number; distance_km: number; fuel_liters: number };
  vs_yesterday: number;
  vs_last_week: number;
  peak_shift: string | null;
  incidents_today: number;
  generated_at: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  location: string | null;
  schedule: string;
  day_of_week: number | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface ScheduledReportsData {
  reports: ScheduledReport[];
  total: number;
}

export interface AlertRule {
  id: string;
  name: string;
  location: string;
  condition: string;
  condition_metric: 'congestion_level' | 'average_speed' | 'vehicle_count';
  condition_operator: '>=' | '<=' | '==' | '>' | '<';
  condition_value: string;
  duration_minutes: number;
  action_type: 'notify' | 'webhook' | 'both';
  cooldown_minutes: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface AlertRuleListData {
  rules: AlertRule[];
  total: number;
}

export interface AlertRuleHistoryData {
  rule_id: string;
  rule_name: string;
  triggers: Array<{ triggered_at: string; metric_value: string | number | null }>;
  total: number;
}

export interface AnalyticsSnapshotData {
  snapshot_time?: string;
  period_hours?: number;
  total_locations_observed?: number;
  active_incidents?: number;
  congestion_distribution?: {
    low?: number;
    medium?: number;
    high?: number;
    unknown?: number;
  };
  locations?: Array<{
    location: string;
    record_count?: number;
    avg_vehicle_count?: number;
    avg_speed?: number;
    congestion_level?: string;
  }>;
  // legacy keys (older clients / dashboard)
  total_records?: number;
  avg_congestion?: number;
  high_congestion_count?: number;
  city_health_score?: number;
  monitored_districts?: number;
}

export interface AnalyticsHealthData {
  score: number | null;
  grade?: string;
  status?: string;
  color?: string;
  breakdown?: { low_pct?: number; medium_pct?: number; high_pct?: number };
  total_records?: number;
  updated_at?: string;
  has_data?: boolean;
}

export interface AnalyticsCityHealthRow {
  city: string;
  score: number | null;
  trend: number;
  has_data?: boolean;
  period_hours?: number;
  used_fallback_window?: boolean;
  latest_sample_at?: string | null;
}

export interface AnalyticsCityHealthData {
  cities: AnalyticsCityHealthRow[];
  updated_at?: string;
}

export interface AnalyticsTrendPoint {
  hour: number;
  congestion_level: number | null;
  vehicle_count?: number;
  has_data?: boolean;
}

export interface AnalyticsTrendsData {
  hours_analysed?: number;
  data_points: AnalyticsTrendPoint[];
}

export interface AnalyticsTimelapseSnapshot {
  hour_start?: string;
  hour_label?: string;
  total_records?: number;
  has_data?: boolean;
  dominant_congestion?: string;
  high_pct?: number | null;
  medium_pct?: number | null;
  low_pct?: number | null;
  health_score?: number | null;
}

export interface AnalyticsTimelapseData {
  hours_analysed?: number;
  generated_at?: string;
  peak_congestion_snapshot?: AnalyticsTimelapseSnapshot;
  snapshots?: AnalyticsTimelapseSnapshot[];
}

export interface AnalyticsLocationData {
  location: string;
  period_hours?: number;
  record_count?: number;
  avg_vehicle_count?: number;
  avg_speed?: number;
  congestion_level?: string;
  active_incidents?: unknown[];
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

export interface RouteAlert {
  location: string;
  status: string;
  speed: number;
}

export interface RouteResult {
  origin?: string;
  destination?: string;
  distance_km: number;
  duration_minutes: number;
  avg_speed_kmh: number;
  congestion_aware?: boolean;
  congestion_summary?: string;
  mode?: string;
  polyline?: string;
  steps?: RouteStep[];
  optimization_score?: number;
  co2_kg?: number;
  trees_offset?: number;
  best_departure?: string;
  confidence?: string;
  alerts?: RouteAlert[];
}

export interface SavedRoute {
  id: string;
  user_id?: string;
  route_name: string;
  origin_name: string;
  destination_name: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface RouteNarrativeData {
  narrative: string;
  route?: {
    origin?: string;
    destination?: string;
    distance_km?: number;
  };
  traffic?: {
    eta_minutes?: number;
    expected_eta_minutes?: number;
    delay_minutes?: number;
    congestion_level?: string;
    avg_speed_kmh?: number;
  };
  active_incidents?: number;
  generated_at?: string;
}

export interface RouteShareData {
  token?: string;
  share_token?: string;
  url?: string;
  share_url?: string;
  expires_at?: string;
}

export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
}

export interface CommuteHourlyPoint {
  hour: string;
  score: number;
}

export interface CommuteForecastSlot {
  hour_offset: number;
  hour_of_day?: number;
  time_label: string;
  predicted_congestion: string;
  confidence_score: number;
  sample_size?: number;
}

export interface CommuteForecastData {
  location: string;
  forecast_generated_at?: string;
  peak_congestion_hour?: CommuteForecastSlot;
  best_departure_next_8h?: CommuteForecastSlot;
  hourly_forecast?: CommuteForecastSlot[];
  hourly?: CommuteHourlyPoint[];
}

export interface CommuteDepartureSlot {
  departure_offset_hours: number;
  departure_time: string;
  predicted_congestion: string;
  confidence_score: number;
  estimated_eta_minutes: number;
  estimated_eta_with_buffer_minutes?: number;
}

export interface CommuteBestTimeData {
  location: string;
  distance_km?: number;
  mode?: string;
  window_hours?: number;
  top_3_recommended_departures?: CommuteDepartureSlot[];
  all_slots?: CommuteDepartureSlot[];
  best_departure_time?: string;
  best_time?: string;
  best_window?: string;
  calculated_at?: string;
}

export interface CommuteScoreData {
  location: string;
  score: number;
  grade?: string;
  verdict?: string;
  best_window?: string;
  worst_window?: string;
  avg_commute_minutes?: number;
  active_incidents?: number;
  message?: string;
  evaluated_at?: string;
}

export interface CommuteStressData {
  location: string;
  matched_location?: string;
  stress_score: number;
  label: string;
  color: string;
  verdict: string;
  breakdown?: {
    duration_vs_freeflow_pct?: number;
    active_incidents?: number;
    speed_variability?: string;
    congestion_level?: string;
    avg_speed_kmh?: number;
    records_used?: number;
    data_age_hours?: number;
    data_available?: boolean;
  };
  personal_comparison?: string | null;
  tip?: string;
  active_incidents?: number;
  evaluated_at?: string;
}

export interface CommuteShouldLeaveData {
  origin: string;
  destination: string;
  distance_km?: number;
  mode?: string;
  advice?: string;
  current_eta_minutes?: number;
  optimal_eta_minutes?: number;
  optimal_departure_in_minutes?: number;
  savings_minutes?: number;
  reason?: string;
  is_intercity?: boolean;
  congestion_forecast?: Array<{
    hour_offset: number;
    hour_label: string;
    predicted_congestion: string;
    confidence_score: number;
  }>;
  calculated_at?: string;
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

export interface UserPreferencesQuietHours {
  start: number;
  end: number;
  description?: string;
}

export interface UserPreferencesNotifications {
  websocket: boolean;
  email: boolean;
}

/** Response from GET/PATCH `/user/preferences/` */
export interface UserPreferences {
  user_id?: string;
  preferred_mode: string;
  alert_threshold: string;
  quiet_hours: UserPreferencesQuietHours;
  notifications: UserPreferencesNotifications;
  updated_at?: string | null;
  message?: string;
}

export interface UserPreferencesUpdate {
  preferred_mode?: string;
  alert_threshold?: string;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  notify_via_websocket?: boolean;
  notify_email?: boolean;
}

export interface DepartureAlert {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  departure_time: string;
  timezone?: string;
  days?: string[];
  days_of_week: string[];
  advance_notice_minutes: number;
  mode?: string;
  distance_km?: number | null;
  is_active: boolean;
  created_at?: string;
  next_trigger_at?: string | null;
  last_triggered_at?: string | null;
  message?: string;
}

export interface DepartureAlertListData {
  total: number;
  alerts: DepartureAlert[];
}

export interface DepartureAlertToggleData {
  id: string;
  route_name?: string;
  departure_time?: string;
  is_active: boolean;
  next_trigger_at?: string | null;
  message?: string;
}

export interface FavoriteTrafficStatus {
  congestion_level?: string | null;
  average_speed_kmh?: number | null;
  vehicle_count?: number | null;
  last_updated?: string | null;
  active_incidents?: number;
  is_stale?: boolean;
  message?: string;
}

export interface FavoriteLocation {
  id: string;
  location_name: string;
  nickname?: string;
  latitude?: number;
  longitude?: number;
  traffic_status?: FavoriteTrafficStatus | null;
  created_at?: string;
  message?: string;
}

export interface FavoritesStatusLocation {
  id: string;
  name: string;
  congestion_level?: string | null;
  average_speed_kmh?: number | null;
  vehicle_count?: number | null;
  last_updated?: string | null;
  active_incidents?: number;
  is_stale?: boolean;
  message?: string;
}

export interface FavoritesStatusData {
  total: number;
  high_congestion_alerts: number;
  locations: FavoritesStatusLocation[];
}

export interface AreaPatternBucket {
  congestion?: string;
  avg_speed_kmh?: number | null;
  sample_size?: number;
}

export interface AreaForecastSlot {
  offset_hours: number;
  time_label: string;
  predicted_congestion: string;
  confidence?: number;
  avg_speed_kmh?: number | null;
}

export interface AreaPredictData {
  area: string;
  city?: string;
  current?: {
    congestion_level?: string;
    avg_speed_kmh?: number | null;
    vehicle_count?: number | null;
    updated_at?: string;
    data_age_minutes?: number;
    data_source?: string;
  };
  forecast?: AreaForecastSlot[];
  best_travel_time?: {
    offset_hours?: number;
    time_label?: string;
    predicted_congestion?: string;
    avg_speed_kmh?: number | null;
  };
  worst_travel_time?: {
    offset_hours?: number;
    time_label?: string;
    predicted_congestion?: string;
    avg_speed_kmh?: number | null;
  };
  hourly_pattern?: Record<string, AreaPatternBucket>;
  weekly_pattern?: Record<string, AreaPatternBucket>;
  peak_hours?: string;
  historical_records_used?: number;
  recommendation?: string;
  generated_at?: string;
}

export interface AreaCompareResult {
  area: string;
  error?: string;
  congestion_level?: string;
  avg_speed_kmh?: number | null;
  score?: number | null;
  [key: string]: unknown;
}

export interface AreaCompareData {
  areas_compared: number;
  best_area?: string | null;
  worst_area?: string | null;
  results: AreaCompareResult[];
  generated_at?: string;
}

export interface AreaSearchItem {
  name?: string;
  area?: string;
  city?: string;
  [key: string]: unknown;
}

export interface AreaCityItem {
  city?: string;
  name?: string;
  health_score?: number | null;
  areas?: number | string[];
  [key: string]: unknown;
}

export interface TripHistory {
  id: string;
  origin: string;
  destination: string;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  mode: string;
  distance_km?: number | null;
  predicted_eta_minutes?: number | null;
  congestion_at_departure?: string | null;
  taken_at?: string;
  /** @deprecated use predicted_eta_minutes */
  duration_minutes?: number;
  /** @deprecated use congestion_at_departure */
  congestion_level?: string;
  created_at?: string;
}

export interface TripListData {
  total: number;
  offset: number;
  limit: number;
  page?: number;
  total_pages?: number;
  returned: number;
  has_more: boolean;
  trips: TripHistory[];
  warning?: string;
}

export interface TripStatsData {
  total_trips: number;
  trips_last_30_days?: number;
  trips_last_7_days?: number;
  most_frequent_route?: string | null;
  top_5_routes?: Array<{ route: string; count: number }>;
  mode_breakdown?: Record<string, number>;
  congestion_breakdown?: Record<string, number>;
  eta_stats?: {
    average_eta_minutes?: number | null;
    min_eta_minutes?: number | null;
    max_eta_minutes?: number | null;
    trips_with_eta?: number;
  };
  distance_stats?: {
    total_distance_km?: number | null;
    average_distance_km?: number | null;
    trips_with_distance?: number;
  };
  first_trip_at?: string | null;
  last_trip_at?: string | null;
  generated_at?: string;
  message?: string;
}

export interface ZoneMonitoredLocation {
  name: string;
  congestion?: string;
  stored_congestion?: string;
  speed_kmh?: number | null;
}

export interface GeofenceZone {
  id: string;
  name: string;
  city?: string;
  zone_type?: string;
  shape_label?: string;
  radius_km?: number;
  congestion_threshold?: string;
  threshold_pct?: number;
  is_active?: boolean;
  created_at?: string;
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  center_lat?: number;
  center_lng?: number;
  current_congestion?: string;
  dominant_congestion?: string;
  health_score?: number | null;
  has_data?: boolean;
  avg_speed_kmh?: number | null;
  monitored_locations?: ZoneMonitoredLocation[];
  threshold_breached?: boolean;
  breaches_today?: number;
  location_count?: number;
  threshold?: string;
  evaluated_at?: string;
  zone_id?: string;
  zone_name?: string;
}

export interface ZoneSummaryData {
  total_zones: number;
  active_zones: number;
  breaches_today: number;
  cities: number;
  updated_at?: string;
}

export interface ZoneAlertItem {
  zone_id?: string;
  zone_name?: string;
  message?: string;
  severity?: string;
  congestion_level?: string;
  threshold?: string;
  affected_locations?: string[];
  avg_speed_kmh?: number | null;
  triggered_at?: string;
  time_label?: string;
}

export interface ZoneListData {
  zones: GeofenceZone[];
  total: number;
}

export interface ZoneStatusData {
  zone_id: string;
  zone_name: string;
  dominant_congestion?: string;
  has_data?: boolean;
  avg_speed_kmh?: number | null;
  health_score?: number | null;
  monitored_locations?: ZoneMonitoredLocation[];
  location_count?: number;
  threshold?: string;
  threshold_breached?: boolean;
  evaluated_at?: string;
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

export interface MultimodalSegment {
  mode: string;
  from: string;
  to: string;
  duration_min: number;
  cost_inr: number;
  notes?: string;
}

export interface MultimodalPlan {
  segments: MultimodalSegment[];
  total_duration_min: number;
  vs_driving_only_min?: number;
  total_cost_inr?: number;
  carbon_saved_kg?: number;
  summary?: string;
  source?: string;
  error?: string;
  peak_hour?: boolean;
  city_detected?: string | null;
  metro_available?: boolean;
}

export interface MultimodalPlanResponse {
  origin: string;
  destination: string;
  distance_km: number;
  plan: MultimodalPlan | null;
  generated_at?: string;
}
