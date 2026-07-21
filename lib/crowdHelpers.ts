export type CrowdLevel = 'Low' | 'Moderate' | 'High' | 'Overcrowded' | 'Unavailable';

export const getCrowdColor = (level: string): string => {
  const map: Record<string, string> = {
    Low: '#10b981',
    Moderate: '#f59e0b',
    High: '#f97316',
    Overcrowded: '#ef4444',
    Unavailable: '#94a3b8',
  };
  return map[level] ?? '#94a3b8';
};

export interface CrowdStyle {
  bg: string;
  border: string;
  text: string;
  glow: string;
  progressClass: string;
  iconGlowClass: string;
}

export const getCrowdStyle = (level: string): CrowdStyle => {
  const map: Record<string, CrowdStyle> = {
    Low: {
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.25)',
      text: '#10b981',
      glow: 'rgba(16,185,129,0.2)',
      progressClass: 'progress-neon-green',
      iconGlowClass: 'icon-glow-green',
    },
    Moderate: {
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.25)',
      text: '#f59e0b',
      glow: 'rgba(245,158,11,0.2)',
      progressClass: 'progress-neon-orange',
      iconGlowClass: 'icon-glow-yellow',
    },
    High: {
      bg: 'rgba(249,115,22,0.08)',
      border: 'rgba(249,115,22,0.25)',
      text: '#f97316',
      glow: 'rgba(249,115,22,0.2)',
      progressClass: 'progress-neon-orange',
      iconGlowClass: 'icon-glow-orange',
    },
    Overcrowded: {
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.25)',
      text: '#ef4444',
      glow: 'rgba(239,68,68,0.2)',
      progressClass: 'progress-neon-red',
      iconGlowClass: 'icon-glow-red',
    },
  };
  return map[level] ?? {
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.25)',
    text: '#64748b',
    glow: 'rgba(100,116,139,0.2)',
    progressClass: 'progress-neon',
    iconGlowClass: 'icon-glow-blue',
  };
};

export const getCrowdLevelFromScore = (score: number): CrowdLevel => {
  if (score <= 25) return 'Low';
  if (score <= 50) return 'Moderate';
  if (score <= 75) return 'High';
  return 'Overcrowded';
};

export const getTypeEmoji = (type: string): string => {
  const t = (type ?? '').toLowerCase();
  if (t === 'bus') return '🚌';
  if (t.includes('rail') || t.includes('train')) return '🚆';
  return '🚉';
};

export const getTypeLabel = (type: string): string => {
  const t = (type ?? '').toLowerCase();
  if (t === 'bus') return 'Bus Station';
  if (t.includes('rail') || t.includes('train')) return 'Railway Station';
  return 'Station';
};

export const getDayName = (): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
};

/** Peel axios + `{ success, data }` envelopes down to the payload. */
export const unwrapPayload = (res: unknown): unknown => {
  let cur: unknown = res;
  for (let i = 0; i < 3; i++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    // Axios response → .data
    if ('status' in obj && 'data' in obj && ('headers' in obj || 'config' in obj)) {
      cur = obj.data;
      continue;
    }
    // API envelope → .data
    if ('success' in obj && 'data' in obj) {
      cur = obj.data;
      continue;
    }
    break;
  }
  return cur;
};

export const unwrapArray = <T>(res: unknown, fallback: T[] = []): T[] => {
  const d = unwrapPayload(res);
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    for (const key of ['data', 'stations', 'crowd', 'items', 'results', 'hourly', 'weekly', 'logs']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return fallback;
};

export const unwrapOne = <T>(res: unknown): T | null => {
  const d = unwrapPayload(res);
  if (!d || typeof d !== 'object') return null;
  if (Array.isArray(d)) return (d[0] as T) ?? null;
  const obj = d as Record<string, unknown>;
  if (obj.station && typeof obj.station === 'object') return obj.station as T;
  if (obj.crowd && typeof obj.crowd === 'object' && !Array.isArray(obj.crowd)) return obj.crowd as T;
  return d as T;
};

function pickScore(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pickLevel(score: number | null, ...vals: unknown[]): CrowdLevel {
  for (const v of vals) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t || t.toLowerCase() === 'unavailable') continue;
    if (t === 'Low' || t === 'Moderate' || t === 'High' || t === 'Overcrowded') return t;
  }
  if (score == null) return 'Unavailable';
  return getCrowdLevelFromScore(score);
}

export interface Station {
  id: string;
  name: string;
  type: string;
  city: string;
  state?: string;
  capacity?: number;
  peakHours?: string;
  peak_hours?: string;
  lat?: number | null;
  lng?: number | null;
  amenities?: string[];
  crowdScore?: number | null;
  crowd_score?: number | null;
  crowdLevel?: string;
  crowd_level?: string;
  estimatedPeople?: number | null;
  estimated_people?: number | null;
  dataSource?: string;
  data_source?: string;
  trafficSpeedKmh?: number | null;
  traffic_speed_kmh?: number | null;
  recommendation?: string;
  predictedAt?: string;
}

export interface CrowdSnapshot {
  stationId?: string;
  station_id?: string;
  id?: string;
  stationName?: string;
  station_name?: string;
  type?: string;
  city?: string;
  crowdScore?: number | null;
  crowd_score?: number | null;
  crowdLevel?: string;
  crowd_level?: string;
  data_source?: string;
  estimated_people?: number | null;
  recommendation?: string;
}

export interface HourlyPoint {
  hour: number;
  crowdScore: number;
  label: string;
  crowdLevel?: string;
  dataSource?: string;
}

export interface WeeklyPoint {
  day: string;
  avgScore: number;
  avg_score?: number;
  peak_hour?: number;
  data_source?: string;
}

export interface BestTime {
  bestTime?: string;
  best_time?: string;
  best_window_label?: string;
  window?: string;
  recommendedTime?: string;
  reason?: string;
  description?: string;
  message?: string;
  expectedScore?: number;
  expected_score?: number;
  avg_score_in_window?: number;
  avgScore?: number;
  tips?: string[];
  best_window_start?: number;
  best_window_end?: number;
}

export interface CrowdLog {
  id?: string | number;
  stationId?: string;
  station_id?: string;
  crowdScore?: number;
  crowd_score?: number;
  crowdLevel?: string;
  crowd_level?: string;
  timestamp?: string;
  created_at?: string;
  recordedAt?: string;
  recorded_at?: string;
  predicted_at?: string;
  hour_of_day?: number;
  day_of_week?: number;
}

/** Normalize a station (or crowd snapshot) into a consistent Station shape. */
export function normalizeStation(raw: unknown): Station | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.station_id ?? r.stationId ?? '');
  if (!id) return null;

  const score = pickScore(r.crowdScore, r.crowd_score);
  const level = pickLevel(score, r.crowdLevel, r.crowd_level);

  return {
    id,
    name: String(r.name ?? r.station_name ?? r.stationName ?? id),
    type: String(r.type ?? 'bus'),
    city: String(r.city ?? ''),
    state: typeof r.state === 'string' ? r.state : undefined,
    capacity: typeof r.capacity === 'number' ? r.capacity : undefined,
    peakHours: typeof r.peak_hours === 'string' ? r.peak_hours : typeof r.peakHours === 'string' ? r.peakHours : undefined,
    peak_hours: typeof r.peak_hours === 'string' ? r.peak_hours : undefined,
    lat: typeof r.lat === 'number' ? r.lat : null,
    lng: typeof r.lng === 'number' ? r.lng : null,
    amenities: Array.isArray(r.amenities) ? (r.amenities as string[]) : undefined,
    crowdScore: score,
    crowd_score: score,
    crowdLevel: level,
    crowd_level: level,
    estimatedPeople: pickScore(r.estimatedPeople, r.estimated_people),
    estimated_people: pickScore(r.estimatedPeople, r.estimated_people),
    dataSource: typeof r.data_source === 'string' ? r.data_source : typeof r.dataSource === 'string' ? r.dataSource : undefined,
    data_source: typeof r.data_source === 'string' ? r.data_source : undefined,
    trafficSpeedKmh: pickScore(r.traffic_speed_kmh, r.trafficSpeedKmh),
    traffic_speed_kmh: pickScore(r.traffic_speed_kmh, r.trafficSpeedKmh),
    recommendation: typeof r.recommendation === 'string' ? r.recommendation : undefined,
    predictedAt: typeof r.predicted_at === 'string' ? r.predicted_at : typeof r.predictedAt === 'string' ? r.predictedAt : undefined,
  };
}

export function normalizeStations(raw: unknown): Station[] {
  return unwrapArray<unknown>(raw).map(normalizeStation).filter((s): s is Station => !!s);
}

export function normalizeHourly(raw: unknown): HourlyPoint[] {
  return unwrapArray<Record<string, unknown>>(raw).map((h) => {
    const score = pickScore(h.crowdScore, h.crowd_score) ?? 0;
    return {
      hour: typeof h.hour === 'number' ? h.hour : Number(h.hour) || 0,
      label: String(h.label ?? `${h.hour ?? ''}`),
      crowdScore: score,
      crowdLevel: pickLevel(score, h.crowdLevel, h.crowd_level),
      dataSource: typeof h.data_source === 'string' ? h.data_source : undefined,
    };
  });
}

export function normalizeWeekly(raw: unknown): WeeklyPoint[] {
  return unwrapArray<Record<string, unknown>>(raw).map((d) => {
    const avg = pickScore(d.avgScore, d.avg_score) ?? 0;
    return {
      day: String(d.day ?? ''),
      avgScore: avg,
      avg_score: avg,
      peak_hour: typeof d.peak_hour === 'number' ? d.peak_hour : undefined,
      data_source: typeof d.data_source === 'string' ? d.data_source : undefined,
    };
  });
}

export function normalizeBestTime(raw: unknown): BestTime | null {
  const d = unwrapOne<Record<string, unknown>>(raw);
  if (!d) return null;
  const expected = pickScore(d.avg_score_in_window, d.expectedScore, d.expected_score, d.avgScore);
  const label = String(
    d.best_window_label ?? d.bestTime ?? d.best_time ?? d.window ?? d.recommendedTime ?? '',
  );
  return {
    ...d,
    bestTime: label || undefined,
    best_window_label: label || undefined,
    reason: typeof d.reason === 'string' ? d.reason : undefined,
    expectedScore: expected ?? undefined,
    avg_score_in_window: expected ?? undefined,
  };
}

export const normLog = (log: CrowdLog) => {
  const score = pickScore(log.crowdScore, log.crowd_score) ?? 0;
  return {
    id: log.id ?? Math.random(),
    score,
    level: pickLevel(score, log.crowdLevel, log.crowd_level),
    time: log.predicted_at ?? log.timestamp ?? log.created_at ?? log.recordedAt ?? log.recorded_at ?? '',
  };
};

/**
 * Merge /stations list with /crowd/all/now.
 * Prefer real numeric scores; never let an Unavailable crowd snapshot wipe a baseline station score.
 */
export const mergeStationsWithCrowd = (
  stations: Station[],
  crowdArr: CrowdSnapshot[],
): Station[] => {
  const map: Record<string, CrowdSnapshot> = {};
  crowdArr.forEach((c) => {
    const id = c.stationId ?? c.station_id ?? c.id ?? '';
    if (id) map[id] = c;
  });

  return stations.map((s) => {
    const base = normalizeStation(s) ?? s;
    const c = map[base.id];
    if (!c) return base;

    const crowdScore = pickScore(c.crowdScore, c.crowd_score);
    const stationScore = pickScore(base.crowdScore, base.crowd_score);
    const score = crowdScore ?? stationScore;
    const level = pickLevel(
      score,
      crowdScore != null ? (c.crowdLevel ?? c.crowd_level) : undefined,
      base.crowdLevel,
      base.crowd_level,
    );

    return {
      ...base,
      crowdScore: score,
      crowd_score: score,
      crowdLevel: level,
      crowd_level: level,
      dataSource: c.data_source ?? base.dataSource ?? base.data_source,
      data_source: c.data_source ?? base.data_source,
      estimatedPeople: pickScore(c.estimated_people, base.estimatedPeople, base.estimated_people),
      recommendation: typeof c.recommendation === 'string' ? c.recommendation : base.recommendation,
    };
  });
};

/** Apply a live WS /crowd update payload onto the current station list. */
export function applyCrowdWsUpdate(stations: Station[], payload: unknown): Station[] {
  if (!payload || typeof payload !== 'object') return stations;
  const p = payload as Record<string, unknown>;

  if (Array.isArray(p.stations)) {
    const byId = new Map<string, Station>();
    for (const raw of p.stations) {
      const n = normalizeStation(raw);
      if (n) byId.set(n.id, n);
    }
    if (!byId.size) return stations;
    if (!stations.length) return Array.from(byId.values());
    return stations.map((s) => {
      const live = byId.get(s.id);
      if (!live) return s;
      return {
        ...s,
        ...live,
        name: live.name || s.name,
        city: live.city || s.city,
        state: live.state ?? s.state,
        peakHours: s.peakHours ?? s.peak_hours ?? live.peakHours,
        peak_hours: s.peak_hours ?? live.peak_hours,
        amenities: s.amenities ?? live.amenities,
      };
    });
  }

  if (p.station && typeof p.station === 'object') {
    const live = normalizeStation(p.station);
    if (!live) return stations;
    return stations.map((s) => (s.id === live.id ? { ...s, ...live, name: live.name || s.name, city: live.city || s.city } : s));
  }

  const live = normalizeStation(p);
  if (live) {
    return stations.map((s) => (s.id === live.id ? { ...s, ...live, name: live.name || s.name, city: live.city || s.city } : s));
  }
  return stations;
}

export const isCrowdAvailable = (station: Pick<Station, 'crowdScore' | 'crowdLevel' | 'crowd_level'>) => {
  const level = station.crowdLevel ?? station.crowd_level;
  if (level && level.toLowerCase() === 'unavailable') return false;
  return typeof station.crowdScore === 'number' && Number.isFinite(station.crowdScore);
};

/** Host origin for crowd WS (`/ws/crowd` is at server root, not under /api/v1). */
export function crowdWsOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  }
  const api = process.env.NEXT_PUBLIC_API_URL || '';
  if (api) {
    return api.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  }
  return 'ws://localhost:8000';
}

export function crowdWsUrl(stationId?: string): string {
  const origin = crowdWsOrigin();
  if (stationId) return `${origin}/ws/crowd/${encodeURIComponent(stationId)}`;
  return `${origin}/ws/crowd`;
}
