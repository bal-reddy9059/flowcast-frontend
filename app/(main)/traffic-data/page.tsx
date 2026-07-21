'use client';

import { useCallback, useEffect, useState } from 'react';
import { trafficApi } from '@/lib/api';
import { ApiPageShell, Field, JsonCard, StatPill } from '@/components/ui/ApiPageShell';

type Tab = 'records' | 'predict' | 'anomalies' | 'export' | 'summary';
const errorText = (e: unknown) => {
  if (e && typeof e === 'object' && 'response' in e) {
    const detail = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) return String(item.msg);
        return String(item);
      }).join('; ');
    }
  }
  return e instanceof Error ? e.message : 'The traffic data service is unavailable.';
};
const asItems = (data: unknown): Record<string, unknown>[] => Array.isArray(data) ? data as Record<string, unknown>[] : ((data as Record<string, unknown>)?.items ?? (data as Record<string, unknown>)?.records ?? (data as Record<string, unknown>)?.incidents ?? []) as Record<string, unknown>[];
const id = (item: Record<string, unknown>) => String(item.id ?? item.uuid ?? item.incident_id ?? '');
const fulfilledData = <T,>(result: PromiseSettledResult<{ data: T }>): T | null =>
  result.status === 'fulfilled' ? result.value.data : null;

export default function TrafficDataPage() {
  const [tab, setTab] = useState<Tab>('records');
  const [records, setRecords] = useState<unknown>(null);
  const [summary, setSummary] = useState<unknown>(null);
  const [anomalies, setAnomalies] = useState<unknown>(null);
  const [sources, setSources] = useState<unknown>(null);
  const [leaderboard, setLeaderboard] = useState<unknown>(null);
  const [incidentStats, setIncidentStats] = useState<unknown>(null);
  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([]);
  const [prediction, setPrediction] = useState<unknown>(null);
  const [predictions, setPredictions] = useState<unknown>(null);
  const [lookup, setLookup] = useState<unknown>(null);
  const [locations, setLocations] = useState<unknown>(null);
  const [recordJson, setRecordJson] = useState('{"location":"Hitech City","congestion_level":"medium"}');
  const [bulkJson, setBulkJson] = useState('[{"location":"Hitech City","congestion_level":"medium"}]');
  const [predictJson, setPredictJson] = useState('{"location":"Hitech City"}');
  const [lookupValue, setLookupValue] = useState('');
  const [lookupType, setLookupType] = useState('id');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationPredictions, setLocationPredictions] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadDashboard = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const results = await Promise.allSettled([
        trafficApi.records({ limit: 50 }),
        trafficApi.summary(),
        trafficApi.anomalies({ window_minutes: 30, threshold_pct: 30 }),
        trafficApi.sources(),
        trafficApi.leaderboard({ order: 'worst', top: 10, hours: 1 }),
        trafficApi.incidentStats(),
        trafficApi.incidents({ active_only: true, limit: 20, offset: 0 }),
      ]);

      const [recordRes, summaryRes, anomalyRes, sourceRes, leaderRes, incidentStatRes, incidentRes] = results;
      const recordData = fulfilledData(recordRes);
      const summaryData = fulfilledData(summaryRes);
      const anomalyData = fulfilledData(anomalyRes);
      const sourceData = fulfilledData(sourceRes);
      const leaderData = fulfilledData(leaderRes);
      const incidentStatData = fulfilledData(incidentStatRes);
      const incidentData = fulfilledData(incidentRes);

      if (recordData !== null) setRecords(recordData);
      if (summaryData !== null) setSummary(summaryData);
      if (anomalyData !== null) setAnomalies(anomalyData);
      if (sourceData !== null) setSources(sourceData);
      if (leaderData !== null) setLeaderboard(leaderData);
      if (incidentStatData !== null) setIncidentStats(incidentStatData);
      if (incidentData !== null) setIncidents(asItems(incidentData));

      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length === results.length) {
        setError('Traffic APIs did not respond within 6 seconds. Please retry.');
      } else if (failed.length > 0) {
        setError(`${failed.length} optional traffic panel${failed.length > 1 ? 's' : ''} timed out; available data is shown.`);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  const createRecord = async () => {
    setError('');
    try {
      const created = await trafficApi.createRecord(JSON.parse(recordJson));
      setLookup(created.data);
      setRecords((await trafficApi.records({ limit: 50 })).data);
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Record payload must be valid JSON.' : errorText(e));
    }
  };
  const createBulk = async () => {
    setError('');
    try {
      const parsed = JSON.parse(bulkJson);
      await trafficApi.createBulk(Array.isArray(parsed) ? { records: parsed } : parsed);
      setRecords((await trafficApi.records({ limit: 50 })).data);
    } catch (e) { setError(e instanceof SyntaxError ? 'Bulk payload must be valid JSON.' : errorText(e)); }
  };
  const lookupRecord = async () => {
    if (!lookupValue.trim()) return;
    try { setLookup((await (lookupType === 'uuid' ? trafficApi.byUuid(lookupValue) : trafficApi.byId(lookupValue))).data); } catch (e) { setError(errorText(e)); }
  };
  const runPrediction = async () => {
    try {
      const body = JSON.parse(predictJson) as Record<string, unknown>;
      const location = String(body.location ?? '');
      const [one, all, byLoc] = await Promise.all([
        trafficApi.predict(body),
        trafficApi.predictions({ limit: 20 }),
        location ? trafficApi.predictionsByLocation({ location, limit: 10 }) : Promise.resolve({ data: null }),
      ]);
      setPrediction(one.data); setPredictions(all.data); setLocationPredictions(byLoc.data);
    } catch (e) { setError(e instanceof SyntaxError ? 'Prediction payload must be valid JSON.' : errorText(e)); }
  };
  const reportTrafficIncident = async () => {
    try {
      await trafficApi.reportIncident(JSON.parse(predictJson));
      await loadDashboard();
    } catch (e) { setError(e instanceof SyntaxError ? 'Incident payload must be valid JSON.' : errorText(e)); }
  };
  const searchLocations = async () => {
    if (!locationQuery.trim()) return;
    try { setLocations((await trafficApi.searchLocations(locationQuery)).data); } catch (e) { setError(errorText(e)); }
  };
  const download = async () => {
    try {
      const response = await trafficApi.export();
      const url = URL.createObjectURL(response.data as Blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'traffic-export.csv'; anchor.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(errorText(e)); }
  };
  const resolve = async (incidentId: string) => {
    if (!incidentId) return;
    try { await trafficApi.resolveIncident(incidentId); setIncidents((items) => items.filter((item) => id(item) !== incidentId)); } catch (e) { setError(errorText(e)); }
  };
  const tabs: Tab[] = ['records', 'predict', 'anomalies', 'export', 'summary'];

  return <ApiPageShell title="Traffic Data Console" subtitle="Inspect records, forecasting outputs, operational signals, and exports." badge="DATA OPS" onRefresh={loadDashboard} loading={loading}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'btn-gradient' : 'btn-neon'} style={{ padding: '8px 14px', borderRadius: 9, textTransform: 'capitalize', color: tab === item ? undefined : '#2563eb', fontSize: 13, fontWeight: 700 }}>{item}</button>)}</div>
    {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
    {tab === 'records' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Create traffic record</h2>
        <textarea value={recordJson} onChange={(e) => setRecordJson(e.target.value)} style={{ width: '100%', minHeight: 120, padding: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, background: '#f8fafc' }} />
        <button onClick={createRecord} className="btn-gradient" style={{ padding: '8px 14px', borderRadius: 9, marginTop: 10, fontSize: 13, fontWeight: 700 }}>Create record</button>
        <h2 style={{ margin: '18px 0 10px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Bulk create</h2>
        <textarea value={bulkJson} onChange={(e) => setBulkJson(e.target.value)} style={{ width: '100%', minHeight: 90, padding: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, background: '#f8fafc' }} />
        <button onClick={createBulk} className="btn-neon" style={{ padding: '8px 14px', borderRadius: 9, marginTop: 10, fontSize: 13, fontWeight: 700, color: '#2563eb' }}>Create bulk</button>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: 8, marginTop: 18 }}>
          <Field label="Lookup" value={lookupType} onChange={setLookupType} options={['id', 'uuid']} />
          <Field label="Record value" value={lookupValue} onChange={setLookupValue} />
          <button onClick={lookupRecord} className="btn-neon" style={{ alignSelf: 'end', padding: '9px 12px', borderRadius: 9, color: '#2563eb', fontSize: 12, fontWeight: 700 }}>Find</button>
        </div>
      </div>
      <div><JsonCard title="Record lookup" data={lookup} empty="Find a record by its ID or UUID." /><div style={{ marginTop: 16 }}><JsonCard title="Traffic records" data={records} empty="No traffic records found." /></div></div>
    </div>}
    {tab === 'predict' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Traffic prediction</h2>
        <textarea value={predictJson} onChange={(e) => setPredictJson(e.target.value)} style={{ width: '100%', minHeight: 110, padding: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, background: '#f8fafc' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button onClick={runPrediction} className="btn-gradient" style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>Predict traffic</button>
          <button onClick={reportTrafficIncident} className="btn-neon" style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#2563eb' }}>Report incident</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end', marginTop: 18 }}><Field label="Search locations" value={locationQuery} onChange={setLocationQuery} /><button onClick={searchLocations} className="btn-neon" style={{ padding: '9px 12px', borderRadius: 9, color: '#2563eb', fontSize: 12, fontWeight: 700 }}>Search</button></div>
      </div>
      <div><JsonCard title="Prediction result" data={prediction} empty="Submit a prediction request to view its result." /><div style={{ marginTop: 16 }}><JsonCard title="Predictions by location" data={locationPredictions} empty="Run prediction with a location to load location forecasts." /></div><div style={{ marginTop: 16 }}><JsonCard title="Available predictions" data={predictions} empty="Run prediction to load available forecasts." /></div><div style={{ marginTop: 16 }}><JsonCard title="Location search" data={locations} empty="Search locations by name." /></div></div>
    </div>}
    {tab === 'anomalies' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><JsonCard title="Traffic anomalies" data={anomalies} empty="No anomalies detected." /><div className="neon-card" style={{ padding: 20 }}><h2 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Open incidents</h2>{!incidents.length ? <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No open incidents found.</p> : incidents.map((item) => <div key={id(item)} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center' }}><p style={{ flex: 1, margin: 0, color: '#334155', fontSize: 12 }}>{String(item.title ?? item.description ?? item.location ?? id(item))}</p><button onClick={() => resolve(id(item))} className="btn-neon" style={{ padding: '6px 9px', borderRadius: 8, color: '#2563eb', fontSize: 11, fontWeight: 700 }}>Resolve</button></div>)}</div></div>}
    {tab === 'export' && <div className="neon-card" style={{ padding: 24 }}><h2 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 800 }}>Export traffic data</h2><p style={{ color: '#64748b', fontSize: 13 }}>Download the current traffic dataset as a file.</p><button onClick={download} className="btn-gradient" style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Download export</button></div>}
    {tab === 'summary' && <><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><StatPill label="Records" value={asItems(records).length} /><StatPill label="Anomalies" value={asItems(anomalies).length} color="#f59e0b" /><StatPill label="Open incidents" value={incidents.length} color="#ef4444" /></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><JsonCard title="Traffic summary" data={summary} /><JsonCard title="Data sources" data={sources} /><JsonCard title="Incident statistics" data={incidentStats} /><JsonCard title="Leaderboard" data={leaderboard} /></div></>}
  </ApiPageShell>;
}
