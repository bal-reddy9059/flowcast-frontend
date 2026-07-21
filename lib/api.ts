import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const PRODUCTION_API_BASE = 'https://flowcast-backend-1.onrender.com/api/v1';
const LOCAL_API_BASE = 'http://localhost:8000/api/v1';

function validBaseUrl(value: string | undefined, protocols: string[]): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return protocols.includes(url.protocol) ? value.trim().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

const API_BASE =
  validBaseUrl(process.env.NEXT_PUBLIC_API_URL, ['http:', 'https:']) ??
  (process.env.NODE_ENV === 'production' ? PRODUCTION_API_BASE : LOCAL_API_BASE);

/** Match the backend's hard ceiling so requests cannot leave the UI waiting indefinitely. */
const DEFAULT_TIMEOUT_MS = 9000;
/** After this many network timeouts, briefly circuit-break outbound calls. */
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 15000;

const api = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

const STORAGE_KEY = 'flowcast_token';
const REFRESH_KEY = 'flowcast_refresh_token';

let consecutiveNetworkFails = 0;
let circuitOpenUntil = 0;

export function isApiCircuitOpen() {
  return Date.now() < circuitOpenUntil;
}

function noteNetworkFailure() {
  consecutiveNetworkFails += 1;
  if (consecutiveNetworkFails >= CIRCUIT_FAIL_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

function noteNetworkSuccess() {
  consecutiveNetworkFails = 0;
  circuitOpenUntil = 0;
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setTokens(access: string, refresh?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, access);
  document.cookie = `flowcast_token=${access}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = 'flowcast_token=; path=/; max-age=0; SameSite=Lax';
}

// ── Request interceptor: attach JWT + fail-fast when circuit is open ─
api.interceptors.request.use((config) => {
  if (isApiCircuitOpen()) {
    return Promise.reject(
      Object.assign(new Error('API circuit open — backend unreachable'), {
        code: 'ERR_CIRCUIT_OPEN',
        config,
        isAxiosError: true,
      })
    );
  }
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401, track timeouts ──────────
let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const currentAccess = getToken();
  if (!currentAccess) return null;
  try {
    const res = await axios.post(
      `${API_BASE}/auth/refresh`,
      undefined,
      {
        timeout: 3000,
        headers: { Authorization: `Bearer ${currentAccess}` },
      },
    );
    const body = res.data?.data ?? res.data;
    const access = body?.access_token as string | undefined;
    if (!access) return null;
    setTokens(access);
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => {
    noteNetworkSuccess();
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
      softFail?: boolean;
    }) | undefined;

    const isTimeout =
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.message?.toLowerCase().includes('timeout');
    const soft = Boolean(config?.softFail);

    // Soft-fail probes (e.g. notification stats) should not trip the circuit or spam logs
    if ((isTimeout || !error.response) && !soft) {
      noteNetworkFailure();
    } else if (error.response && error.response.status < 500) {
      noteNetworkSuccess();
    }

    const original = config;
    if (error.response?.status === 401 && original && !original._retry && typeof window !== 'undefined') {
      original._retry = true;
      refreshing = refreshing ?? tryRefresh().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      clearTokens();
      window.location.href = '/login';
    }
    if (
      process.env.NODE_ENV === 'development' &&
      error.code !== 'ERR_CIRCUIT_OPEN' &&
      !soft
    ) {
      const url = error.config?.url ?? '';
      const code = error.response?.status ?? error.code ?? 'NETWORK';
      const msg = (error.response?.data as { detail?: string })?.detail ?? error.message;
      console.warn(`[FlowCast API] ${code} ${url} —`, msg);
    }
    return Promise.reject(error);
  }
);

export default api;

export function wsBase(): string {
  const configured = validBaseUrl(process.env.NEXT_PUBLIC_WS_URL, ['ws:', 'wss:']);
  if (configured) return configured;
  return API_BASE.replace(/^http/, 'ws');
}

// ── Authentication ───────────────────────────────────────────────
const AUTH_TIMEOUT_MS = 3000;

export const authApi = {
  register: async (email: string, full_name: string, password: string) => {
    const res = await api.post('/auth/register', { email, full_name, password }, { timeout: AUTH_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').LoginResponse>(res.data) };
  },
  login: async (email: string, password: string) => {
    const res = await api.post(
      '/auth/login',
      { email, password },
      { timeout: AUTH_TIMEOUT_MS },
    );
    return { ...res, data: unwrapData<import('./types').LoginResponse>(res.data) };
  },
  me: async () => {
    const res = await api.get('/auth/me', {
      timeout: AUTH_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    const raw = unwrapData<Record<string, unknown>>(res.data);
    const nested = raw && typeof raw === 'object' && raw.user && typeof raw.user === 'object'
      ? (raw.user as Record<string, unknown>)
      : null;
    const merged = { ...(raw || {}), ...(nested || {}) } as unknown as import('./types').User;
    return { ...res, data: merged };
  },
  updateProfile: async (body: { full_name?: string; email?: string; [k: string]: unknown }) => {
    const res = await api.patch('/auth/profile', body, { timeout: AUTH_TIMEOUT_MS });
    const data = unwrapData<import('./types').User & { access_token?: string; user?: import('./types').User }>(res.data);
    // Prefer nested user if present (backend returns both flat + nested)
    const user = (data as { user?: import('./types').User })?.user;
    const merged = {
      ...(typeof data === 'object' && data ? data : {}),
      ...(user && typeof user === 'object' ? user : {}),
    } as import('./types').User & { access_token?: string };
    if ((data as { access_token?: string })?.access_token) {
      merged.access_token = (data as { access_token?: string }).access_token;
    }
    return { ...res, data: merged };
  },
  updateMe: (body: { full_name?: string }) =>
    api.put('/auth/profile', body, { timeout: AUTH_TIMEOUT_MS }),
  dashboard: async () => {
    const res = await api.get('/auth/dashboard', { timeout: AUTH_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').AuthDashboardData>(res.data) };
  },
  setupAdmin: (secret: string) =>
    api.post('/auth/setup-admin', undefined, { params: { secret }, timeout: AUTH_TIMEOUT_MS }),
  refresh: async () => {
    const res = await api.post('/auth/refresh', undefined, { timeout: AUTH_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').LoginResponse>(res.data) };
  },
  googleLoginUrl: () => `${API_BASE}/auth/google/login`,
  googleToken: async (id_token: string) => {
    const res = await api.post('/auth/google/token', { id_token }, { timeout: AUTH_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').LoginResponse>(res.data) };
  },
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }, { timeout: AUTH_TIMEOUT_MS }),
  deleteAccount: () => api.delete('/auth/me', { timeout: AUTH_TIMEOUT_MS }),
};

// ── Traffic ──────────────────────────────────────────────────────
const TRAFFIC_READ_CONFIG = { timeout: 6000 } as const;
const TRAFFIC_CONGESTION_ALIASES: Record<string, 'low' | 'medium' | 'high'> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  moderate: 'medium',
  normal: 'medium',
  very_high: 'high',
  severe: 'high',
  critical: 'high',
  very_low: 'low',
  light: 'low',
  clear: 'low',
  free_flow: 'low',
};

export function normalizeTrafficRecordBody(body: unknown): import('./types').TrafficRecordCreate {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Traffic record payload must be a JSON object.');
  }
  const raw = body as Record<string, unknown>;
  const location = String(raw.location ?? '').trim();
  if (location.length < 2) throw new Error('Traffic record location is required.');

  let congestion: 'low' | 'medium' | 'high' | null | undefined;
  if (raw.congestion_level != null) {
    const key = String(raw.congestion_level).trim().toLowerCase().replace(/[\s-]+/g, '_');
    congestion = TRAFFIC_CONGESTION_ALIASES[key];
    if (!congestion) {
      throw new Error('congestion_level must be low, medium, or high.');
    }
  }
  return {
    ...raw,
    location,
    congestion_level: congestion,
  } as import('./types').TrafficRecordCreate;
}

export const trafficApi = {
  records: async (params?: Record<string, string | number>) => {
    const res = await api.get('/traffic/records', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>[]>(res.data) };
  },
  createRecord: async (body: unknown) => {
    const res = await api.post('/traffic/records', normalizeTrafficRecordBody(body), { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  createBulk: async (body: unknown) => {
    if (!body || typeof body !== 'object' || !Array.isArray((body as { records?: unknown }).records)) {
      throw new Error('Bulk payload must contain a records array.');
    }
    const normalized = (body as { records: unknown[] }).records.map(normalizeTrafficRecordBody);
    const res = await api.post('/traffic/records/bulk', { records: normalized }, { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  byUuid: async (uuid: string) => {
    const res = await api.get(`/traffic/records/by-uuid/${encodeURIComponent(uuid)}`, TRAFFIC_READ_CONFIG);
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  byId: async (id: string | number) => {
    const res = await api.get(`/traffic/records/${encodeURIComponent(String(id))}`, TRAFFIC_READ_CONFIG);
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  predictions: async (params?: Record<string, string | number>) => {
    const res = await api.get('/traffic/predictions', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>[]>(res.data) };
  },
  incidents: async (params?: Record<string, string | number | boolean>) => {
    const res = await api.get('/traffic/incidents', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>[]>(res.data) };
  },
  reportIncident: async (body: unknown) => {
    const res = await api.post('/traffic/incidents', body, { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  resolveIncident: async (id: string | number) => {
    const res = await api.patch(`/traffic/incidents/${encodeURIComponent(String(id))}/resolve`, undefined, { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  predict: async (body: Record<string, unknown>) => {
    const res = await api.post('/traffic/predict', body, { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  predictionsByLocation: async (params: Record<string, string | number>) => {
    const res = await api.get('/traffic/predictions/location', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  searchLocations: async (q: string) => {
    const res = await api.get('/traffic/locations/search', { ...TRAFFIC_READ_CONFIG, params: { q, limit: 10 } });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  export: (params?: Record<string, string | number>) =>
    api.get('/traffic/export', { timeout: 6000, params, responseType: 'blob' }),
  exportCsv: () => api.get('/traffic/export', { timeout: 6000, responseType: 'blob' }),
  summary: async (params?: Record<string, string | number>) => {
    const res = await api.get('/traffic/summary', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  leaderboard: async (params?: Record<string, string | number>) => {
    const res = await api.get('/traffic/leaderboard', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  anomalies: async (params?: Record<string, string | number>) => {
    const res = await api.get('/traffic/anomalies', { ...TRAFFIC_READ_CONFIG, params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  sources: async () => {
    const res = await api.get('/traffic/sources', TRAFFIC_READ_CONFIG);
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  incidentStats: async () => {
    const res = await api.get('/traffic/incidents/stats', TRAFFIC_READ_CONFIG);
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
};

/** Unwrap `{ success, data }` API envelopes used across FlowCast services. */
function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as object)) {
    const inner = (body as { data: unknown }).data;
    if (inner !== undefined && inner !== null) return inner as T;
  }
  return body as T;
}

// ── ETA ──────────────────────────────────────────────────────────
function unwrapEta<T>(body: unknown): T {
  return unwrapData<T>(body);
}

export const etaApi = {
  get: async (params: {
    origin?: string;
    destination?: string;
    location?: string;
    distance_km?: number;
    mode?: string;
  }) => {
    const res = await api.get('/traffic/eta', { params });
    return { ...res, data: unwrapEta<import('./types').EtaResult>(res.data) };
  },
  single: async (location: string, distance_km: number, mode = 'driving') => {
    const res = await api.get('/traffic/eta', { params: { location, distance_km, mode } });
    return { ...res, data: unwrapEta<import('./types').EtaResult>(res.data) };
  },
  batch: async (body: { locations?: string[]; distance_km?: number; mode?: string } | unknown) => {
    const res = await api.post('/traffic/eta/batch', body);
    return { ...res, data: unwrapEta<import('./types').EtaBatchResponse>(res.data) };
  },
  compare: async (params: Record<string, string | number>) => {
    const res = await api.get('/traffic/eta/compare', { params });
    return { ...res, data: unwrapEta<import('./types').EtaCompareResponse>(res.data) };
  },
  locations: async () => {
    const res = await api.get('/traffic/eta/locations');
    return { ...res, data: unwrapEta<import('./types').EtaLocationsResponse>(res.data) };
  },
};

// ── Analytics ────────────────────────────────────────────────────
export const analyticsApi = {
  snapshot: async (params?: { hours?: number }) => {
    const res = await api.get('/analytics/snapshot', { params });
    return { ...res, data: unwrapData<import('./types').AnalyticsSnapshotData>(res.data) };
  },
  location: async (location: string, params?: { hours?: number }) => {
    const res = await api.get('/analytics/location', { params: { location, ...params } });
    return { ...res, data: unwrapData<import('./types').AnalyticsLocationData>(res.data) };
  },
  health: async (params?: { city?: string; hours?: number }) => {
    const res = await api.get('/analytics/health', { params });
    return { ...res, data: unwrapData<import('./types').AnalyticsHealthData>(res.data) };
  },
  calendar: async (params: { location: string; [k: string]: string | number }) => {
    const res = await api.get('/analytics/calendar', { params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  timelapse: async (params?: Record<string, string | number>) => {
    const res = await api.get('/analytics/timelapse', { params });
    return { ...res, data: unwrapData<import('./types').AnalyticsTimelapseData>(res.data) };
  },
  trend: async (params: { location: string; hours?: number; [k: string]: string | number | undefined }) => {
    const res = await api.get('/analytics/trend', { params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  trends: async (hours = 24) => {
    const res = await api.get('/analytics/trends', { params: { hours } });
    return { ...res, data: unwrapData<import('./types').AnalyticsTrendsData>(res.data) };
  },
  cityHealth: async () => {
    const res = await api.get('/analytics/city-health', { timeout: 4000 });
    return { ...res, data: unwrapData<import('./types').AnalyticsCityHealthData>(res.data) };
  },
};

// ── Routes ───────────────────────────────────────────────────────
function assertRouteOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Route request failed';
    throw Object.assign(new Error(err), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const routeApi = {
  optimizeGet: async (params: Record<string, string | number | boolean>) => {
    const res = await api.get('/routes/optimize', { params });
    return { ...res, data: assertRouteOk<import('./types').RouteResult>(res.data) };
  },
  optimize: async (body: import('./types').RouteOptimizeRequest | Record<string, unknown>) => {
    const res = await api.post('/routes/optimize', body);
    return { ...res, data: assertRouteOk<import('./types').RouteResult>(res.data) };
  },
  save: async (body: {
    route_name: string;
    origin_name: string;
    destination_name: string;
    /** Optional — backend geocodes from names when omitted */
    origin_lat?: number;
    origin_lng?: number;
    destination_lat?: number;
    destination_lng?: number;
    mode?: string;
  }) => {
    const res = await api.post('/routes/save', body);
    return { ...res, data: assertRouteOk<import('./types').SavedRoute>(res.data) };
  },
  saved: async () => {
    const res = await api.get('/routes/saved');
    const data = assertRouteOk<import('./types').SavedRoute[] | { routes?: import('./types').SavedRoute[] }>(res.data);
    const list = Array.isArray(data) ? data : (data.routes ?? []);
    return { ...res, data: list };
  },
  report: async (routeId: string) => {
    const res = await api.get(`/routes/saved/${routeId}/report`);
    return { ...res, data: assertRouteOk<Record<string, unknown>>(res.data) };
  },
  share: async (routeId: string) => {
    const res = await api.post(`/routes/saved/${routeId}/share`);
    return { ...res, data: assertRouteOk<import('./types').RouteShareData>(res.data) };
  },
  getShared: async (token: string) => {
    const res = await api.get(`/routes/shared/${token}`);
    return { ...res, data: assertRouteOk<Record<string, unknown>>(res.data) };
  },
  deleteSaved: (routeId: string) => api.delete(`/routes/saved/${routeId}`),
  /** distance_km optional — backend estimates from origin/destination when omitted */
  narrative: async (params: {
    origin: string;
    destination: string;
    distance_km?: number;
    route_id?: string;
  }) => {
    const res = await api.get('/routes/narrative', { params });
    return { ...res, data: assertRouteOk<import('./types').RouteNarrativeData>(res.data) };
  },
};

export const narrativeApi = {
  get: (origin: string, destination: string, route_id?: string) =>
    routeApi.narrative({ origin, destination, route_id }),
};

// ── Commute ──────────────────────────────────────────────────────
export const commuteApi = {
  forecast: async (location: string) => {
    const res = await api.get('/commute/forecast', { params: { location } });
    return { ...res, data: unwrapData<import('./types').CommuteForecastData>(res.data) };
  },
  bestTime: async (params: {
    location: string;
    destination?: string;
    distance_km?: number;
    mode?: string;
    window_hours?: number;
  }) => {
    const res = await api.get('/commute/best-time', { params });
    return { ...res, data: unwrapData<import('./types').CommuteBestTimeData>(res.data) };
  },
  bestDeparture: async (location: string) => {
    const res = await api.get('/commute/best-time', { params: { location } });
    return { ...res, data: unwrapData<import('./types').CommuteBestTimeData>(res.data) };
  },
  commuteScore: async (location: string) => {
    const res = await api.get('/commute/commute-score', { params: { location } });
    return { ...res, data: unwrapData<import('./types').CommuteScoreData>(res.data) };
  },
  score: async (location: string) => {
    const res = await api.get('/commute/score', { params: { location } });
    return { ...res, data: unwrapData<import('./types').CommuteScoreData>(res.data) };
  },
  stressScore: async (params: { location: string; distance_km?: number }) => {
    const res = await api.get('/commute/stress-score', { params });
    return { ...res, data: unwrapData<import('./types').CommuteStressData>(res.data) };
  },
  shouldILeave: async (params: {
    origin: string;
    destination: string;
    mode?: string;
    distance_km?: number;
  }) => {
    const res = await api.get('/commute/should-i-leave', { params });
    return { ...res, data: unwrapData<import('./types').CommuteShouldLeaveData>(res.data) };
  },
};

export const stressApi = {
  score: (location: string) => commuteApi.stressScore({ location }),
};

// ── Favorites ────────────────────────────────────────────────────
export const favoritesApi = {
  list: async () => {
    const res = await api.get('/favorites/');
    const data = unwrapData<{ total?: number; favorites?: import('./types').FavoriteLocation[] } | import('./types').FavoriteLocation[]>(res.data);
    const favorites = Array.isArray(data) ? data : (data.favorites ?? []);
    return { ...res, data: { total: Array.isArray(data) ? data.length : (data.total ?? favorites.length), favorites } };
  },
  add: async (body: {
    location_name: string;
    nickname?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const res = await api.post('/favorites/', body);
    return { ...res, data: unwrapData<import('./types').FavoriteLocation>(res.data) };
  },
  status: async () => {
    const res = await api.get('/favorites/status');
    return { ...res, data: unwrapData<import('./types').FavoritesStatusData>(res.data) };
  },
  update: async (id: string, body: { nickname?: string; location_name?: string }) => {
    const res = await api.patch(`/favorites/${id}`, body);
    return { ...res, data: unwrapData<import('./types').FavoriteLocation>(res.data) };
  },
  delete: (id: string) => api.delete(`/favorites/${id}`),
};

// ── Preferences ──────────────────────────────────────────────────
function assertPrefsOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Preferences request failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Preferences request failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

function normalizePreferences(raw: unknown): import('./types').UserPreferences {
  const r = (raw ?? {}) as Record<string, unknown>;
  const quiet = (r.quiet_hours ?? {}) as Record<string, unknown>;
  const notif = (r.notifications ?? {}) as Record<string, unknown>;
  const start = Number(
    quiet.start ?? r.quiet_hours_start ?? 22,
  );
  const end = Number(
    quiet.end ?? r.quiet_hours_end ?? 7,
  );
  return {
    user_id: r.user_id != null ? String(r.user_id) : undefined,
    preferred_mode: String(r.preferred_mode ?? 'driving'),
    alert_threshold: String(r.alert_threshold ?? r.congestion_threshold ?? 'high'),
    quiet_hours: {
      start: Number.isFinite(start) ? start : 22,
      end: Number.isFinite(end) ? end : 7,
      description: quiet.description != null ? String(quiet.description) : undefined,
    },
    notifications: {
      websocket: Boolean(notif.websocket ?? r.notify_via_websocket ?? true),
      email: Boolean(notif.email ?? r.notify_email ?? false),
    },
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
    message: r.message != null ? String(r.message) : undefined,
  };
}

export const preferencesApi = {
  get: async () => {
    const res = await api.get('/user/preferences/');
    return { ...res, data: normalizePreferences(assertPrefsOk(res.data)) };
  },
  update: async (body: import('./types').UserPreferencesUpdate) => {
    const res = await api.patch('/user/preferences/', body);
    const data = normalizePreferences(assertPrefsOk(res.data));
    const envelope = res.data as { message?: string };
    return { ...res, data, message: envelope?.message ?? data.message };
  },
};

// ── Trips ────────────────────────────────────────────────────────
function assertTripOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Trip request failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Trip request failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const tripsApi = {
  log: async (body: {
    origin: string;
    destination: string;
    mode?: string;
    distance_km?: number;
    predicted_eta_minutes?: number;
    congestion_at_departure?: string;
  }) => {
    const res = await api.post('/trips/', body);
    const envelope = res.data as { message?: string };
    return {
      ...res,
      data: assertTripOk<import('./types').TripHistory>(res.data),
      message: envelope?.message,
    };
  },
  list: async (params?: {
    limit?: number;
    /** 0-based skip count — prefer `page` instead */
    offset?: number;
    /** 1-based page number (preferred) */
    page?: number;
    mode?: string;
  }) => {
    const res = await api.get('/trips/', { params });
    const data = assertTripOk<import('./types').TripListData | import('./types').TripHistory[]>(res.data);
    if (Array.isArray(data)) {
      return {
        ...res,
        data: {
          total: data.length,
          offset: 0,
          limit: data.length,
          page: 1,
          total_pages: 1,
          returned: data.length,
          has_more: false,
          trips: data,
        } satisfies import('./types').TripListData,
      };
    }
    return { ...res, data };
  },
  stats: async () => {
    const res = await api.get('/trips/stats');
    return { ...res, data: assertTripOk<import('./types').TripStatsData>(res.data) };
  },
  delete: async (id: string) => {
    const res = await api.delete(`/trips/${id}`);
    const envelope = res.data as { message?: string };
    return {
      ...res,
      data: assertTripOk<{ id?: string }>(res.data),
      message: envelope?.message,
    };
  },
};

// ── Departure alerts ─────────────────────────────────────────────
function assertAlertOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Departure alert request failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Departure alert request failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const alertApi = {
  list: async (params?: { active_only?: boolean }) => {
    const res = await api.get('/alerts/departure/', { params });
    const data = assertAlertOk<import('./types').DepartureAlertListData | import('./types').DepartureAlert[]>(res.data);
    const alerts = Array.isArray(data) ? data : (data.alerts ?? []);
    return {
      ...res,
      data: {
        total: Array.isArray(data) ? data.length : (data.total ?? alerts.length),
        alerts,
      },
    };
  },
  create: async (body: {
    route_name: string;
    origin: string;
    destination: string;
    departure_time: string;
    days_of_week: string[];
    advance_notice_minutes?: number;
    mode?: string;
    distance_km?: number;
  }) => {
    const res = await api.post('/alerts/departure/', body);
    return { ...res, data: assertAlertOk<import('./types').DepartureAlert>(res.data) };
  },
  toggle: async (id: string) => {
    const res = await api.patch(`/alerts/departure/${id}/toggle`);
    return { ...res, data: assertAlertOk<import('./types').DepartureAlertToggleData>(res.data) };
  },
  togglePut: async (id: string) => {
    const res = await api.put(`/alerts/departure/${id}/toggle`);
    return { ...res, data: assertAlertOk<import('./types').DepartureAlertToggleData>(res.data) };
  },
  delete: async (id: string) => {
    const res = await api.delete(`/alerts/departure/${id}`);
    return { ...res, data: assertAlertOk<{ message?: string; id?: string }>(res.data) };
  },
};

// ── Eco ──────────────────────────────────────────────────────────
export const ecoApi = {
  footprint: (params: { distance_km: number; mode?: string; vehicle_type?: string }) =>
    api.get('/eco/footprint', { params }),
};

// ── India ────────────────────────────────────────────────────────
export const indiaApi = {
  live: async () => {
    const res = await api.get('/india/live', { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  cities: async () => {
    const res = await api.get('/india/cities', { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  states: async () => {
    const res = await api.get('/india/states', { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  overview: async () => {
    const res = await api.get('/india/overview', { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  hotspots: async () => {
    const res = await api.get('/india/hotspots', { timeout: 6000 });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  locations: async (params?: Record<string, string | number>) => {
    const res = await api.get('/india/locations', { timeout: 6000, params });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  districts: async (params?: {
    state?: string;
    search?: string;
    congestion?: string;
    page?: number;
    size?: number;
  }) => {
    const res = await api.get('/india/districts', {
      timeout: 6000,
      params: { page: 1, size: 50, ...params },
    });
    return { ...res, data: unwrapData<import('./types').IndiaDistrictListData>(res.data) };
  },
  districtsByState: async (state: string) => {
    const res = await api.get(`/india/districts/state/${encodeURIComponent(state)}`, { timeout: 6000 });
    return { ...res, data: unwrapData<import('./types').IndiaDistrictStateData>(res.data) };
  },
  districtDetail: async (name: string) => {
    const res = await api.get(`/india/districts/${encodeURIComponent(name)}`, { timeout: 6000 });
    return { ...res, data: unwrapData<import('./types').IndiaDistrict>(res.data) };
  },
  districtStates: async () => {
    const res = await api.get('/india/districts-states', { timeout: 6000 });
    return { ...res, data: unwrapData<import('./types').IndiaDistrictStatesData>(res.data) };
  },
};

// ── Area prediction ──────────────────────────────────────────────
function assertAreaOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Area prediction request failed';
    throw Object.assign(new Error(err), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const areaApi = {
  predict: async (params: { area: string; hours?: number; city?: string }) => {
    const res = await api.get('/traffic/area/predict', { params });
    return { ...res, data: assertAreaOk<import('./types').AreaPredictData>(res.data) };
  },
  compare: async (params: { areas: string; hours?: number }) => {
    const res = await api.get('/traffic/area/compare', { params });
    return { ...res, data: assertAreaOk<import('./types').AreaCompareData>(res.data) };
  },
  search: async (q: string) => {
    const res = await api.get('/traffic/area/search', { params: { q } });
    const data = assertAreaOk<{ total?: number; areas?: import('./types').AreaSearchItem[] } | import('./types').AreaSearchItem[]>(res.data);
    const areas = Array.isArray(data) ? data : (data.areas ?? []);
    return { ...res, data: { total: Array.isArray(data) ? data.length : (data.total ?? areas.length), areas } };
  },
  cities: async () => {
    const res = await api.get('/traffic/area/cities');
    const data = assertAreaOk<{ cities?: import('./types').AreaCityItem[]; total?: number } | import('./types').AreaCityItem[]>(res.data);
    const cities = Array.isArray(data) ? data : (data.cities ?? []);
    return { ...res, data: { total: Array.isArray(data) ? data.length : (data.total ?? cities.length), cities } };
  },
};

/** @deprecated use areaApi */
export const predictionApi = {
  forecast: (area: string, hours = 12) =>
    areaApi.predict({ area, hours }),
  hourlyPattern: (area: string) =>
    areaApi.predict({ area }),
  compare: (areas: string[]) =>
    areaApi.compare({ areas: areas.join(',') }),
};

// ── AI ───────────────────────────────────────────────────────────
export const aiApi = {
  chat: (message: string, location?: string) =>
    api.post('/ai/chat', { message, location }),
  departureCoach: (origin: string, destination: string) =>
    api.get('/ai/departure-coach', { params: { origin, destination } }),
  commuteInsight: (location: string) =>
    api.get('/ai/commute-insight', { params: { location } }),
};

// ── Stories ──────────────────────────────────────────────────────
export const storiesApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/traffic/stories', { params }),
};

// ── Multimodal ───────────────────────────────────────────────────
function assertMultimodalOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Multimodal plan failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Multimodal plan failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const multimodalApi = {
  plan: async (origin: string, destination: string, departure_time?: string) => {
    const res = await api.post('/routes/multimodal', { origin, destination, departure_time });
    return { ...res, data: assertMultimodalOk<import('./types').MultimodalPlanResponse>(res.data) };
  },
  planGet: async (params: { origin: string; destination: string; departure_time?: string }) => {
    const res = await api.get('/routes/multimodal', { params });
    return { ...res, data: assertMultimodalOk<import('./types').MultimodalPlanResponse>(res.data) };
  },
};

// ── Developer ────────────────────────────────────────────────────
export const developerApi = {
  scopes: () => api.get('/developer/scopes'),
  keys: () => api.get('/developer/keys'),
  createKey: (body: unknown) => api.post('/developer/keys', body),
  getKey: (id: string) => api.get(`/developer/keys/${id}`),
  revokeKey: (id: string) => api.delete(`/developer/keys/${id}`),
  rotateKey: (id: string) => api.post(`/developer/keys/${id}/rotate`),
  status: () => api.get('/developer/status'),
  keyStatus: () => api.get('/developer/status'),
};

// ── Weather ──────────────────────────────────────────────────────
function assertWeatherOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const errBody = body as {
      error?: string;
      detail?: string | { message?: string };
      details?: { message?: string };
    };
    const err = errBody.error
      || (typeof errBody.detail === 'string' ? errBody.detail : errBody.detail?.message)
      || errBody.details?.message
      || 'Weather request failed';
    throw Object.assign(new Error(err), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const weatherApi = {
  cities: async () => {
    const res = await api.get('/weather/cities');
    return { ...res, data: assertWeatherOk<import('./types').WeatherCitiesData>(res.data) };
  },
  cityIds: async () => {
    const res = await api.get('/weather/city-ids');
    return { ...res, data: assertWeatherOk<import('./types').WeatherCityIdsData>(res.data) };
  },
  city: async (cityId: string | number) => {
    const res = await api.get(`/weather/city/${cityId}`);
    return { ...res, data: assertWeatherOk<import('./types').WeatherCitySnapshot>(res.data) };
  },
  impact: async (params: { location: string; city_id?: string | number }) => {
    const res = await api.get('/weather/impact', { params });
    return { ...res, data: assertWeatherOk<import('./types').WeatherImpactData>(res.data) };
  },
  status: async () => {
    const res = await api.get('/weather/status');
    return { ...res, data: assertWeatherOk<import('./types').WeatherStatusData>(res.data) };
  },
};

// ── Community incidents ──────────────────────────────────────────
function assertIncidentOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Incident request failed';
    throw Object.assign(new Error(err), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const incidentsApi = {
  list: async (params?: { city?: string; type?: string }) => {
    const res = await api.get('/incidents/', { params });
    const data = assertIncidentOk<import('./types').CommunityIncidentListData | import('./types').CommunityIncident[]>(res.data);
    const incidents = Array.isArray(data) ? data : (data.incidents ?? []);
    return {
      ...res,
      data: {
        total: Array.isArray(data) ? data.length : (data.total ?? incidents.length),
        incidents,
        generated_at: Array.isArray(data) ? undefined : data.generated_at,
      },
    };
  },
  create: async (body: {
    incident_type: string;
    description: string;
    location: string;
    severity?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
  }) => {
    const res = await api.post('/incidents/', body);
    const data = assertIncidentOk<import('./types').CommunityIncidentCreateData | import('./types').CommunityIncident>(res.data);
    const incident = 'incident' in (data as object) && (data as { incident?: unknown }).incident
      ? (data as import('./types').CommunityIncidentCreateData).incident
      : (data as import('./types').CommunityIncident);
    return {
      ...res,
      data: {
        message: (data as { message?: string }).message,
        incident,
      },
    };
  },
  get: async (id: string | number) => {
    const res = await api.get(`/incidents/${id}`);
    return { ...res, data: assertIncidentOk<import('./types').CommunityIncident>(res.data) };
  },
  resolve: async (id: string | number) => {
    const res = await api.delete(`/incidents/${id}`);
    return { ...res, data: assertIncidentOk<unknown>(res.data) };
  },
  upvote: async (id: string | number) => {
    const res = await api.post(`/incidents/${id}/upvote`);
    return { ...res, data: assertIncidentOk<import('./types').CommunityIncidentVoteData>(res.data) };
  },
  downvote: async (id: string | number) => {
    const res = await api.post(`/incidents/${id}/downvote`);
    return { ...res, data: assertIncidentOk<import('./types').CommunityIncidentVoteData>(res.data) };
  },
};

// ── Crowd stations ───────────────────────────────────────────────
function unwrapCrowd<T>(body: unknown): T {
  return unwrapData<T>(body);
}

export const stationsApi = {
  list: async () => {
    const res = await api.get('/stations');
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  byCity: async (city: string) => {
    const res = await api.get(`/stations/city/${encodeURIComponent(city)}`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  byType: async (type: string) => {
    const res = await api.get(`/stations/type/${encodeURIComponent(type)}`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  byId: async (id: string) => {
    const res = await api.get(`/stations/${encodeURIComponent(id)}`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>>(res.data) };
  },
};

export const crowdApi = {
  allNow: async () => {
    const res = await api.get('/crowd/all/now');
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  now: async (id: string) => {
    const res = await api.get(`/crowd/${encodeURIComponent(id)}/now`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>>(res.data) };
  },
  hourly: async (id: string) => {
    const res = await api.get(`/crowd/${encodeURIComponent(id)}/hourly`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  weekly: async (id: string) => {
    const res = await api.get(`/crowd/${encodeURIComponent(id)}/weekly`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
  bestTime: async (id: string) => {
    const res = await api.get(`/crowd/${encodeURIComponent(id)}/best-time`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>>(res.data) };
  },
};

export const crowdLogsApi = {
  get: async (id: string) => {
    const res = await api.get(`/crowd-logs/${encodeURIComponent(id)}`);
    return { ...res, data: unwrapCrowd<Record<string, unknown>[]>(res.data) };
  },
};

// ── Admin ────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: (params?: { skip?: number; limit?: number }) =>
    api.get('/admin/users', { params }),
  deactivate: (userId: string) =>
    api.patch(`/admin/users/${userId}/deactivate`),
  activate: (userId: string) =>
    api.patch(`/admin/users/${userId}/activate`),
  toggleUser: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
  db: () => api.get('/admin/db'),
  purgeOldRecords: (params?: Record<string, string | number>) =>
    api.delete('/admin/traffic/old-records', { params }),
};

// ── Organizations ────────────────────────────────────────────────
export const orgApi = {
  getMine: () => api.get('/org'),
  create: (body: unknown) => api.post('/org', body),
  members: () => api.get('/org/members'),
  invite: (body: unknown) => api.post('/org/invite', body),
  changeRole: (userId: string, role: string) =>
    api.put(`/org/members/${userId}`, { role }),
  removeMember: (userId: string) => api.delete(`/org/members/${userId}`),
  listMine: () => api.get('/org/mine'),
  get: (orgId: string) => api.get(`/org/${orgId}`),
  update: (orgId: string, body: unknown) => api.put(`/org/${orgId}`, body),
  delete: (orgId: string) => api.delete(`/org/${orgId}`),
  inviteTo: (orgId: string, body: unknown) =>
    api.post(`/org/${orgId}/members/invite`, body),
  membersOf: (orgId: string) => api.get(`/org/${orgId}/members`),
  changeRoleOf: (orgId: string, userId: string, role: string) =>
    api.put(`/org/${orgId}/members/${userId}/role`, { role }),
  removeMemberOf: (orgId: string, userId: string) =>
    api.delete(`/org/${orgId}/members/${userId}`),
};

// ── Fleet ────────────────────────────────────────────────────────
export const fleetApi = {
  createVehicle: (orgId: string, body: unknown) =>
    api.post(`/fleet/${orgId}/vehicles`, body),
  vehicles: (orgId: string) => api.get(`/fleet/${orgId}/vehicles`),
  getVehicle: (orgId: string, vehicleId: string) =>
    api.get(`/fleet/${orgId}/vehicles/${vehicleId}`),
  updateVehicle: (orgId: string, vehicleId: string, body: unknown) =>
    api.put(`/fleet/${orgId}/vehicles/${vehicleId}`, body),
  deactivateVehicle: (orgId: string, vehicleId: string) =>
    api.delete(`/fleet/${orgId}/vehicles/${vehicleId}`),
  removeVehicle: (orgId: string, vehicleId: string) =>
    api.delete(`/fleet/${orgId}/vehicles/${vehicleId}`),
  assign: (orgId: string, vehicleId: string, body: unknown) =>
    api.post(`/fleet/${orgId}/vehicles/${vehicleId}/assign`, body),
  unassign: (orgId: string, vehicleId: string) =>
    api.delete(`/fleet/${orgId}/vehicles/${vehicleId}/assign`),
  live: (orgId: string) => api.get(`/fleet/${orgId}/live`),
  aiInsights: (orgId: string) => api.get(`/fleet/${orgId}/ai-insights`),
  logBehavior: (orgId: string, body: unknown) =>
    api.post(`/fleet/${orgId}/behavior/log`, body),
  behaviorForVehicle: (orgId: string, vehicleId: string) =>
    api.get(`/fleet/${orgId}/behavior/vehicle/${vehicleId}`),
  behaviorLeaderboard: (orgId: string) =>
    api.get(`/fleet/${orgId}/behavior/leaderboard`),
};

export const fleetInsightsApi = {
  get: (orgId: string) => api.get(`/fleet/${orgId}/ai-insights`),
};

// ── Zones ────────────────────────────────────────────────────────
function assertZoneOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Zone request failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Zone request failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export const zonesApi = {
  list: async () => {
    const res = await api.get('/zones');
    const data = assertZoneOk<import('./types').ZoneListData | import('./types').GeofenceZone[]>(res.data);
    const zones = Array.isArray(data) ? data : (data.zones ?? []);
    return { ...res, data: { total: Array.isArray(data) ? data.length : (data.total ?? zones.length), zones } };
  },
  create: async (body: {
    name: string;
    zone_type?: string;
    city?: string;
    lat_min?: number;
    lat_max?: number;
    lng_min?: number;
    lng_max?: number;
    center_lat?: number;
    center_lng?: number;
    radius_km?: number;
    congestion_threshold?: string;
  }) => {
    const res = await api.post('/zones', body);
    return { ...res, data: assertZoneOk<import('./types').GeofenceZone>(res.data) };
  },
  summary: async () => {
    const res = await api.get('/zones/summary');
    return { ...res, data: assertZoneOk<import('./types').ZoneSummaryData>(res.data) };
  },
  recentAlerts: async (limit = 20) => {
    const res = await api.get('/zones/alerts/recent', { params: { limit } });
    const data = assertZoneOk<{ alerts?: import('./types').ZoneAlertItem[]; total?: number } | import('./types').ZoneAlertItem[]>(res.data);
    const alerts = Array.isArray(data) ? data : (data.alerts ?? []);
    return { ...res, data: { total: Array.isArray(data) ? data.length : (data.total ?? alerts.length), alerts } };
  },
  get: async (id: string) => {
    const res = await api.get(`/zones/${id}`);
    return { ...res, data: assertZoneOk<import('./types').GeofenceZone>(res.data) };
  },
  delete: async (id: string) => {
    const res = await api.delete(`/zones/${id}`);
    return { ...res, data: assertZoneOk<unknown>(res.data) };
  },
  status: async (id: string) => {
    const res = await api.get(`/zones/${id}/status`);
    return { ...res, data: assertZoneOk<import('./types').ZoneStatusData>(res.data) };
  },
  alerts: async (id: string) => {
    const res = await api.get(`/zones/${id}/alerts`);
    const data = assertZoneOk<{ alerts?: import('./types').ZoneAlertItem[]; total?: number; zone_id?: string; zone_name?: string }>(res.data);
    return {
      ...res,
      data: {
        zone_id: data.zone_id,
        zone_name: data.zone_name,
        total: data.total ?? (data.alerts?.length ?? 0),
        alerts: data.alerts ?? [],
      },
    };
  },
};

// ── Webhooks ─────────────────────────────────────────────────────
export const webhooksApi = {
  eventTypes: () => api.get('/webhooks/event-types'),
  list: () => api.get('/webhooks'),
  create: (body: unknown) => api.post('/webhooks', body),
  get: (id: string) => api.get(`/webhooks/${id}`),
  update: (id: string, body: unknown) => api.put(`/webhooks/${id}`, body),
  delete: (id: string) => api.delete(`/webhooks/${id}`),
  test: (id: string) => api.post(`/webhooks/${id}/test`),
  deliveries: (id: string) => api.get(`/webhooks/${id}/deliveries`),
  rotateSecret: (id: string) => api.post(`/webhooks/${id}/rotate-secret`),
  logs: (id: string) => api.get(`/webhooks/${id}/deliveries`),
};

// ── Rules ────────────────────────────────────────────────────────
const RULE_TIMEOUT_MS = 4000;

export type AlertRuleCreateBody = {
  name: string;
  location: string;
  condition_metric: 'congestion_level' | 'average_speed' | 'vehicle_count';
  condition_operator: '>=' | '<=' | '==' | '>' | '<';
  condition_value: string;
  duration_minutes: number;
  action_type: 'notify' | 'webhook' | 'both';
  action_webhook_id?: string;
  cooldown_minutes: number;
  org_id?: string;
};

export type AlertRuleUpdateBody = Partial<Omit<AlertRuleCreateBody, 'action_webhook_id' | 'org_id'>>;

export const rulesApi = {
  list: async (params: { limit?: number; offset?: number } = {}) => {
    const res = await api.get('/rules', {
      params: { limit: 50, offset: 0, ...params },
      timeout: RULE_TIMEOUT_MS,
    });
    return { ...res, data: unwrapData<import('./types').AlertRuleListData>(res.data) };
  },
  create: async (body: AlertRuleCreateBody) => {
    const res = await api.post('/rules', body, { timeout: RULE_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').AlertRule>(res.data) };
  },
  get: async (id: string) => {
    const res = await api.get(`/rules/${encodeURIComponent(id)}`, { timeout: RULE_TIMEOUT_MS });
    return {
      ...res,
      data: unwrapData<import('./types').AlertRule & {
        recent_triggers: Array<{ triggered_at: string; metric_value: string | number | null; location: string }>;
      }>(res.data),
    };
  },
  update: async (id: string, body: AlertRuleUpdateBody) => {
    const res = await api.put(`/rules/${encodeURIComponent(id)}`, body, { timeout: RULE_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').AlertRule>(res.data) };
  },
  delete: async (id: string) => {
    const res = await api.delete(`/rules/${encodeURIComponent(id)}`, { timeout: RULE_TIMEOUT_MS });
    return { ...res, data: unwrapData<{ message: string }>(res.data) };
  },
  toggle: async (id: string) => {
    const res = await api.put(`/rules/${encodeURIComponent(id)}/toggle`, undefined, { timeout: RULE_TIMEOUT_MS });
    return { ...res, data: unwrapData<{ rule_id: string; is_active: boolean; message: string }>(res.data) };
  },
  history: async (id: string) => {
    const res = await api.get(`/rules/${encodeURIComponent(id)}/history`, { timeout: RULE_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').AlertRuleHistoryData>(res.data) };
  },
};

// ── Reports ──────────────────────────────────────────────────────
const REPORT_TIMEOUT_MS = 4000;

export const reportsApi = {
  daily: async (location: string) => {
    const res = await api.get('/reports/daily-summary', {
      params: location ? { location } : undefined,
      timeout: REPORT_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: unwrapData<import('./types').DailyReportData>(res.data) };
  },
  weekly: async (location: string) => {
    const res = await api.get('/reports/weekly-trend', {
      params: location ? { location } : undefined,
      timeout: REPORT_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: unwrapData<import('./types').WeeklyReportData>(res.data) };
  },
  hotspots: async (params?: { hours?: number; top_n?: number }) => {
    const res = await api.get('/reports/hotspot-analysis', {
      params,
      timeout: REPORT_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: unwrapData<import('./types').HotspotReportData>(res.data) };
  },
  fleetOverview: async (days = 7) => {
    const res = await api.get('/reports/fleet-overview', {
      params: { days },
      timeout: REPORT_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: unwrapData<import('./types').FleetOverviewData>(res.data) };
  },
  fleet: async (orgId: string, days = 7) => {
    const res = await api.get(`/reports/fleet-performance/${encodeURIComponent(orgId)}`, {
      params: { days },
      timeout: REPORT_TIMEOUT_MS,
    });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  zoneHealth: async (zoneId: string) => {
    const res = await api.get(`/reports/zone-health/${encodeURIComponent(zoneId)}`, {
      timeout: REPORT_TIMEOUT_MS,
    });
    return { ...res, data: unwrapData<Record<string, unknown>>(res.data) };
  },
  schedule: async (body: {
    name: string;
    report_type: 'daily_summary' | 'weekly_trend' | 'zone_health' | 'fleet_performance';
    location?: string;
    schedule: 'daily' | 'weekly' | 'manual';
    day_of_week?: number;
    org_id?: string;
  }) => {
    const res = await api.post('/reports/schedule', body, { timeout: REPORT_TIMEOUT_MS });
    return { ...res, data: unwrapData<import('./types').ScheduledReport>(res.data) };
  },
  scheduled: async () => {
    const res = await api.get('/reports/scheduled', {
      timeout: REPORT_TIMEOUT_MS,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: unwrapData<import('./types').ScheduledReportsData>(res.data) };
  },
  deleteSchedule: async (id: string) => {
    const res = await api.delete(`/reports/scheduled/${encodeURIComponent(id)}`, {
      timeout: REPORT_TIMEOUT_MS,
    });
    return { ...res, data: unwrapData<{ message: string }>(res.data) };
  },
};

// ── Live traffic / ML ────────────────────────────────────────────
export const liveTrafficApi = {
  shouldILeave: (params: { origin: string; destination: string } | string) =>
    typeof params === 'string'
      ? commuteApi.shouldILeave({ origin: params, destination: params })
      : commuteApi.shouldILeave(params),
  startTrip: (body: unknown) => api.post('/trips/live/start', body),
  endTrip: (sessionId: string) => api.delete(`/trips/live/${sessionId}`),
};

export const mlApi = {
  modelInfo: () => api.get('/traffic/ml/model-info'),
  predict: (location: string) =>
    api.get('/traffic/ml/predict', { params: { location } }),
};

// ── Heatmap ──────────────────────────────────────────────────────
export const heatmapApi = {
  get: (params?: {
    hours?: number;
    congestion_filter?: string;
    min_intensity?: number;
    limit?: number;
  }) => api.get('/traffic/heatmap', { params }),
  hotspots: (params?: {
    severity?: string;
    limit?: number;
  }) => api.get('/traffic/heatmap/hotspots', { params }),
  summary: () => api.get('/traffic/heatmap/summary'),
};

// ── Notifications ────────────────────────────────────────────────
function assertNotifOk<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in (body as object) && (body as { success: boolean }).success === false) {
    const err = (body as { error?: string; detail?: string }).error
      || (body as { detail?: string }).detail
      || 'Notification request failed';
    throw Object.assign(new Error(typeof err === 'string' ? err : 'Notification request failed'), { response: { data: body } });
  }
  return unwrapData<T>(body);
}

export interface NotificationListData {
  total?: number;
  unread?: number;
  unread_critical?: number;
  critical?: number;
  page_total?: number;
  notifications: Array<Record<string, unknown>>;
}

export interface NotificationStatsData {
  total?: number;
  total_notifications?: number;
  unread?: number;
  unread_count?: number;
  unread_critical?: number;
  read_count?: number;
  [key: string]: unknown;
}

export const notificationApi = {
  list: async (params?: { skip?: number; limit?: number; unread_only?: boolean }) => {
    const res = await api.get('/notifications', { params });
    const data = assertNotifOk<NotificationListData | Record<string, unknown>[]>(res.data);
    if (Array.isArray(data)) {
      return { ...res, data: { total: data.length, notifications: data } satisfies NotificationListData };
    }
    return {
      ...res,
      data: {
        ...data,
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
      },
    };
  },
  markAllRead: async () => {
    const res = await api.put('/notifications/read-all');
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  markRead: async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`);
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  delete: async (id: string) => {
    const res = await api.delete(`/notifications/${id}`);
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  history: async (params?: Record<string, string | number | boolean>) => {
    const res = await api.get('/notifications/history', { params });
    const data = assertNotifOk<NotificationListData | Record<string, unknown>[]>(res.data);
    if (Array.isArray(data)) {
      return { ...res, data: { total: data.length, notifications: data } satisfies NotificationListData };
    }
    return {
      ...res,
      data: {
        ...data,
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
      },
    };
  },
  markReadPost: async (id: string) => {
    const res = await api.post(`/notifications/mark-read/${id}`);
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  markAllReadPost: async () => {
    const res = await api.post('/notifications/mark-all-read');
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  test: async () => {
    const res = await api.post('/notifications/test');
    return { ...res, data: assertNotifOk<Record<string, unknown>>(res.data) };
  },
  /** Soft probe — short timeout, no console spam, does not trip circuit breaker */
  stats: async () => {
    const res = await api.get('/notifications/stats', {
      timeout: 2500,
      softFail: true,
    } as Parameters<typeof api.get>[1] & { softFail: boolean });
    return { ...res, data: assertNotifOk<NotificationStatsData>(res.data) };
  },
};
