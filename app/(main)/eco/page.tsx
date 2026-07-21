'use client';

import { useCallback, useEffect, useState } from 'react';
import { ecoApi } from '@/lib/api';
import { ApiPageShell, Field, JsonCard, StatPill } from '@/components/ui/ApiPageShell';

type Result = Record<string, unknown>;
const formatError = (e: unknown) => e instanceof Error ? e.message : 'Unable to calculate this footprint.';
const numberValue = (data: Result | null, keys: string[]) => {
  const value = keys.map((key) => data?.[key]).find((item) => item !== undefined);
  return value === undefined ? '—' : String(value);
};

export default function EcoPage() {
  const [distance, setDistance] = useState('10');
  const [mode, setMode] = useState('driving');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const calculate = useCallback(async () => {
    setLoading(true); setError('');
    try { setResult((await ecoApi.footprint({ distance_km: Number(distance), mode })).data as Result); }
    catch (e) { setError(formatError(e)); } finally { setLoading(false); }
  }, [distance, mode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void calculate(); }, [calculate]);

  return <ApiPageShell title="Eco Footprint" subtitle="Understand the environmental impact of each journey." badge="ECO INSIGHT" onRefresh={calculate} loading={loading}>
    <div className="neon-card" style={{ padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Field label="Distance (km)" type="number" value={distance} onChange={setDistance} />
        <Field label="Travel mode" value={mode} onChange={setMode} options={['driving', 'transit', 'walking', 'cycling']} />
      </div>
      <button onClick={calculate} className="btn-gradient" style={{ marginTop: 16, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Calculate footprint</button>
      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatPill label="CO₂ emissions" value={numberValue(result, ['co2_kg', 'co2_emissions_kg', 'emissions'])} color="#0ea5e9" />
      <StatPill label="Per kilometre" value={numberValue(result, ['co2_per_km', 'emissions_per_km'])} color="#10b981" />
      <StatPill label="Footprint rating" value={numberValue(result, ['rating', 'footprint', 'impact'])} color="#f59e0b" />
    </div>
    <JsonCard title="Footprint calculation" data={result} empty="Choose a distance and mode to calculate the trip footprint." />
  </ApiPageShell>;
}
