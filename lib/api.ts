import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ──────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('flowcast_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: 401 redirect + dev logging ────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('flowcast_token');
      window.location.href = '/login';
    }
    if (process.env.NODE_ENV === 'development') {
      const url  = error.config?.url ?? '';
      const code = error.response?.status ?? 'NETWORK';
      const msg  = (error.response?.data as { detail?: string })?.detail ?? error.message;
      console.warn(`[FlowCast API] ${code} ${url} —`, msg);
    }
    return Promise.reject(error);
  }
);

export default api;

// ── WebSocket URL helper ─────────────────────────────────────────
// Use NEXT_PUBLIC_WS_URL when set; otherwise derive from API_BASE.
// Handles both http→ws and https→wss automatically.
export function wsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  return API_BASE.replace(/^http/, 'ws');
}

// ── Named API helpers ────────────────────────────────────────────
// Thin wrappers so pages import typed calls instead of raw strings.

export const authApi = {
  login:          (email: string, password: string) =>
    api.post<{ access_token: string; user: import('./types').User }>('/auth/login', { email, password }),
  register:       (email: string, full_name: string, password: string) =>
    api.post('/auth/register', { email, full_name, password }),
  me:             () => api.get<import('./types').User>('/auth/me'),
  updateName:     (full_name: string) => api.put('/auth/me', { full_name }),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  deleteAccount:  () => api.delete('/auth/me'),
};

export const trafficApi = {
  records:    (params?: Record<string, string | number>) => api.get('/traffic/records', { params }),
  incidents:  () => api.get('/traffic/incidents'),
  predict:    (body: Record<string, unknown>) => api.post('/traffic/predict', body),
  anomalies:  () => api.get('/traffic/anomalies'),
  exportCsv:  () => api.get('/traffic/export/csv', { responseType: 'blob' }),
};

export const etaApi = {
  single: (location: string, distance_km: number, mode = 'driving') =>
    api.get('/traffic/eta', { params: { location, distance_km, mode } }),
  batch:     (locations: unknown[]) => api.post('/traffic/eta/batch', { locations }),
  locations: () => api.get('/traffic/eta/locations'),
};

export const analyticsApi = {
  snapshot:  () => api.get('/analytics/snapshot'),
  trends:    (hours = 24) => api.get('/analytics/trends', { params: { hours } }),
  cityHealth: () => api.get('/analytics/city-health'),
  timelapse: () => api.get('/analytics/timelapse'),
};

export const indiaApi = {
  overview:   () => api.get('/india/overview'),
  cities:     () => api.get('/india/cities'),
  city:       (name: string) => api.get(`/india/cities/${encodeURIComponent(name)}`),
  heatmap:    () => api.get('/india/heatmap'),
  hotspots:   () => api.get('/india/hotspots'),
  health:     () => api.get('/india/health'),
  districts:  () => api.get('/india/districts'),
};

export const routeApi = {
  optimize: (body: import('./types').RouteOptimizeRequest) => api.post('/routes/optimize', body),
  saved:    () => api.get('/routes/saved'),
  save:     (body: unknown) => api.post('/routes/saved', body),
  deleteSaved: (id: string) => api.delete(`/routes/saved/${id}`),
  share:    (id: string) => api.post(`/routes/saved/${id}/share`),
  getShare: (token: string) => api.get(`/routes/share/${token}`),
};

export const commuteApi = {
  forecast:      (location: string) => api.get('/commute/forecast', { params: { location } }),
  bestDeparture: (location: string) => api.get('/commute/best-departure', { params: { location } }),
  score:         (location: string) => api.get('/commute/score', { params: { location } }),
};

export const notificationApi = {
  list:    (params?: { skip?: number; limit?: number }) => api.get('/notifications', { params }),
  stats:   () => api.get('/notifications/stats'),
  markRead:    (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete:  (id: string) => api.delete(`/notifications/${id}`),
};

export const alertApi = {
  list:   () => api.get('/alerts/departure'),
  create: (body: unknown) => api.post('/alerts/departure', body),
  toggle: (id: string) => api.put(`/alerts/departure/${id}/toggle`),
  delete: (id: string) => api.delete(`/alerts/departure/${id}`),
};

export const favoritesApi = {
  list:   () => api.get('/favorites'),
  add:    (body: unknown) => api.post('/favorites', body),
  delete: (id: string) => api.delete(`/favorites/${id}`),
  status: (id: string) => api.get(`/favorites/${id}/status`),
};

export const preferencesApi = {
  get:    () => api.get('/user/preferences'),
  update: (body: import('./types').UserPreferences) => api.put('/user/preferences', body),
};

export const tripsApi = {
  list:   (params?: { skip?: number; limit?: number }) => api.get('/trips', { params }),
  log:    (body: unknown) => api.post('/trips', body),
  stats:  () => api.get('/trips/stats'),
  delete: (id: string) => api.delete(`/trips/${id}`),
};

export const ecoApi = {
  footprint: (distance_km: number, mode: string) =>
    api.get('/eco/footprint', { params: { distance_km, mode } }),
  compare:   (distance_km: number) => api.get('/eco/compare', { params: { distance_km } }),
  tips:      () => api.get('/eco/tips'),
};

export const predictionApi = {
  forecast:      (area: string, hours = 12) => api.get('/prediction/forecast', { params: { area, hours } }),
  hourlyPattern: (area: string) => api.get('/prediction/hourly-pattern', { params: { area } }),
  compare:       (areas: string[]) => api.get('/prediction/compare', { params: { areas: areas.join(',') } }),
};

export const adminApi = {
  users:          (params?: { skip?: number; limit?: number }) => api.get('/admin/users', { params }),
  user:           (id: string) => api.get(`/admin/users/${id}`),
  toggleUser:     (id: string) => api.put(`/admin/users/${id}/toggle`),
  deleteUser:     (id: string) => api.delete(`/admin/users/${id}`),
  stats:          () => api.get('/admin/stats'),
  dbHealth:       () => api.get('/admin/db/health'),
  dbVacuum:       () => api.post('/admin/db/vacuum'),
  trafficRecords: (params?: Record<string, unknown>) => api.get('/admin/traffic/records', { params }),
  deleteRecord:   (id: string) => api.delete(`/admin/traffic/records/${id}`),
};

export const heatmapApi = {
  get:      (params?: { hours?: number; congestion_filter?: string; min_intensity?: number; limit?: number }) =>
    api.get('/traffic/heatmap', { params }),
  hotspots: (params?: { severity?: string; limit?: number }) =>
    api.get('/traffic/heatmap/hotspots', { params }),
  summary:  () => api.get('/traffic/heatmap/summary'),
};

// ── Enterprise APIs ──────────────────────────────────────────────────────────

export const orgApi = {
  list:         () => api.get('/org'),
  create:       (body: unknown) => api.post('/org', body),
  members:      (orgId: string) => api.get(`/org/${orgId}/members`),
  invite:       (orgId: string, body: unknown) => api.post(`/org/${orgId}/invite`, body),
  changeRole:   (orgId: string, userId: string, role: string) => api.put(`/org/${orgId}/members/${userId}`, { role }),
  removeMember: (orgId: string, userId: string) => api.delete(`/org/${orgId}/members/${userId}`),
};

export const fleetApi = {
  vehicles:    (orgId: string) => api.get(`/fleet/${orgId}/vehicles`),
  addVehicle:  (orgId: string, body: unknown) => api.post(`/fleet/${orgId}/vehicles`, body),
  live:        (orgId: string) => api.get(`/fleet/${orgId}/live`),
  assign:      (orgId: string, vId: string, driverId: string) => api.put(`/fleet/${orgId}/vehicles/${vId}/assign`, { driver_id: driverId }),
  removeVehicle: (orgId: string, vId: string) => api.delete(`/fleet/${orgId}/vehicles/${vId}`),
};

export const zonesApi = {
  list:    () => api.get('/zones'),
  create:  (body: unknown) => api.post('/zones', body),
  status:  (id: string) => api.get(`/zones/${id}/status`),
  alerts:  (id: string) => api.get(`/zones/${id}/alerts`),
  delete:  (id: string) => api.delete(`/zones/${id}`),
};

export const webhooksApi = {
  list:    () => api.get('/webhooks'),
  create:  (body: unknown) => api.post('/webhooks', body),
  logs:    (id: string) => api.get(`/webhooks/${id}/logs`),
  test:    (id: string) => api.post(`/webhooks/${id}/test`),
  delete:  (id: string) => api.delete(`/webhooks/${id}`),
};

export const rulesApi = {
  list:    () => api.get('/rules'),
  create:  (body: unknown) => api.post('/rules', body),
  toggle:  (id: string) => api.put(`/rules/${id}/toggle`),
  history: (id: string) => api.get(`/rules/${id}/history`),
  delete:  (id: string) => api.delete(`/rules/${id}`),
};

export const reportsApi = {
  daily:       (location: string) => api.get('/reports/daily-summary',  { params: { location } }),
  weekly:      (location: string) => api.get('/reports/weekly-trend',   { params: { location } }),
  hotspots:    () => api.get('/reports/hotspot-analysis'),
  fleet:       (orgId: string)    => api.get(`/reports/fleet-performance/${orgId}`),
  zoneHealth:  (zoneId: string)   => api.get(`/reports/zone-health/${zoneId}`),
  schedule:    (body: unknown)    => api.post('/reports/schedule', body),
};

// ── AI Feature APIs ──────────────────────────────────────────────────────────

export const aiApi = {
  chat:            (message: string, location?: string) =>
    api.post('/ai/chat', { message, location }),
  departureCoach:  (origin: string, destination: string) =>
    api.get('/ai/departure-coach', { params: { origin, destination } }),
  commuteInsight:  (location: string) =>
    api.get('/ai/commute-insight', { params: { location } }),
};

export const storiesApi = {
  list: () => api.get('/traffic/stories'),
};

export const stressApi = {
  score: (location: string) =>
    api.get('/commute/stress-score', { params: { location } }),
};

export const multimodalApi = {
  plan: (origin: string, destination: string, departure_time?: string) =>
    api.post('/routes/multimodal', { origin, destination, departure_time }),
};

export const fleetInsightsApi = {
  get: (orgId: string) => api.get(`/fleet/${orgId}/ai-insights`),
};

export const narrativeApi = {
  get: (origin: string, destination: string, route_id?: string) =>
    api.get('/routes/narrative', { params: { origin, destination, route_id } }),
};

export const liveTrafficApi = {
  shouldILeave: (location: string) => api.get('/commute/should-i-leave', { params: { location } }),
  startTrip:    (body: unknown) => api.post('/trips/live/start', body),
  endTrip:      (sessionId: string) => api.delete(`/trips/live/${sessionId}`),
};

export const weatherApi = {
  cities:  () => api.get('/weather/cities'),
  city:    (name: string) => api.get(`/weather/city/${encodeURIComponent(name)}`),
  impact:  (location: string) => api.get('/weather/impact', { params: { location } }),
};

export const incidentsApi = {
  list:     (params?: { city?: string; type?: string }) => api.get('/incidents', { params }),
  create:   (body: unknown) => api.post('/incidents', body),
  upvote:   (id: string) => api.post(`/incidents/${id}/upvote`),
  downvote: (id: string) => api.post(`/incidents/${id}/downvote`),
};

export const mlApi = {
  modelInfo: () => api.get('/traffic/ml/model-info'),
  predict:   (location: string) => api.get('/traffic/ml/predict', { params: { location } }),
};

export const developerApi = {
  keys:       () => api.get('/developer/keys'),
  createKey:  (body: unknown) => api.post('/developer/keys', body),
  revokeKey:  (id: string) => api.delete(`/developer/keys/${id}`),
  rotateKey:  (id: string) => api.post(`/developer/keys/${id}/rotate`),
  keyStatus:  () => api.get('/developer/status'),
};
