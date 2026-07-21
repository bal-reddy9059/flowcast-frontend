'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Bell, Car, Shield, Save, CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { authApi, preferencesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthDashboardData, UserPreferences } from '@/lib/types';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'travel', label: 'Travel Preferences', icon: Car },
  { id: 'security', label: 'Security', icon: Shield },
];

const MODES = ['driving', 'transit', 'walking'] as const;
const THRESHOLDS = ['low', 'medium', 'high'] as const;

const DEFAULT_PREFS: UserPreferences = {
  preferred_mode: 'driving',
  alert_threshold: 'high',
  quiet_hours: { start: 22, end: 7, description: 'No alerts from 22:00 to 07:00' },
  notifications: { websocket: true, email: false },
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{
        background: checked ? '#3b82f6' : '#d1d5db',
        boxShadow: checked ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  );
}

function hourToTime(h: number) {
  return `${String(Math.max(0, Math.min(23, h))).padStart(2, '0')}:00`;
}

function timeToHour(t: string) {
  const h = Number((t || '0').split(':')[0]);
  return Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0;
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Request failed';
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsError, setPrefsError] = useState('');
  const [profile, setProfile] = useState({ full_name: user?.full_name || '', email: user?.email || '' });
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [dashboard, setDashboard] = useState<AuthDashboardData | null>(null);

  const fetchPrefs = useCallback(async () => {
    setPrefsLoading(true);
    setPrefsError('');
    try {
      const res = await preferencesApi.get();
      setPrefs(res.data);
    } catch (e) {
      setPrefsError(apiError(e));
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPrefs();
  }, [fetchPrefs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setProfile({ full_name: user.full_name || '', email: user.email || '' });
  }, [user]);

  useEffect(() => {
    void authApi
      .dashboard()
      .then((res) => setDashboard(res.data))
      .catch(() => {});
  }, []);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSavePrefs = async () => {
    setPrefsBusy(true);
    setPrefsError('');
    try {
      const res = await preferencesApi.update({
        preferred_mode: prefs.preferred_mode,
        alert_threshold: prefs.alert_threshold,
        quiet_hours_start: prefs.quiet_hours.start,
        quiet_hours_end: prefs.quiet_hours.end,
        notify_via_websocket: prefs.notifications.websocket,
        notify_email: prefs.notifications.email,
      });
      setPrefs(res.data);
      flashSaved();
    } catch (e) {
      setPrefsError(apiError(e));
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const res = await authApi.updateProfile({ full_name: profile.full_name });
      const updated = res.data as {
        full_name?: string;
        email?: string;
        access_token?: string;
        user?: { full_name?: string; email?: string };
      };
      const nextName = updated?.full_name || updated?.user?.full_name || profile.full_name;
      const nextEmail = updated?.email || updated?.user?.email || profile.email;
      setProfile({ full_name: nextName, email: nextEmail });
      // Persist refreshed JWT (includes new full_name for header fallback)
      if (updated?.access_token) {
        const { setTokens } = await import('@/lib/api');
        setTokens(updated.access_token);
      }
      const [, dashResult] = await Promise.allSettled([refreshUser(), authApi.dashboard()]);
      if (dashResult.status === 'fulfilled') setDashboard(dashResult.value.data);
      flashSaved();
    } catch (e) {
      setPrefsError(apiError(e));
    }
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    if (pwd.newPwd !== pwd.confirm) {
      setPwdError('New passwords do not match');
      return;
    }
    if (pwd.newPwd.length < 8) {
      setPwdError('Password must be at least 8 characters');
      return;
    }
    try {
      await authApi.changePassword(pwd.current, pwd.newPwd);
      setPwdSuccess('Password changed successfully');
      setPwd({ current: '', newPwd: '', confirm: '' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setPwdError(e.response?.data?.detail || 'Failed to change password');
    }
  };

  return (
    <div className="slide-up" style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Settings
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Notification settings, preferred travel mode, and quiet hours
            </p>
          </div>
          <button
            onClick={() => void fetchPrefs()}
            disabled={prefsLoading}
            className="btn-neon flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ color: '#2563eb' }}
          >
            <RefreshCw size={13} style={{ animation: prefsLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            Reload prefs
          </button>
        </div>
      </div>

      {prefsError && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {prefsError}
        </div>
      )}

      <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="mobile-h-scroll" style={{ borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', fontSize: 13, fontWeight: 600,
                border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                color: tab === id ? '#2563eb' : '#6b7280',
                borderBottom: tab === id ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Profile</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Your account details</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Full name</label>
                <input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Email</label>
                <input
                  value={profile.email}
                  readOnly
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: '#f8fafc', color: '#64748b' }}
                />
              </div>
              <button onClick={() => void handleSaveProfile()} className={saved ? 'btn-neon' : 'btn-gradient'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
              <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>Account dashboard</p>
                {dashboard ? (
                  <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#475569' }}>
                    <div><span style={{ color: '#94a3b8' }}>Name · </span>{dashboard.user?.full_name || (dashboard.user as { name?: string } | undefined)?.name || '—'}</div>
                    <div><span style={{ color: '#94a3b8' }}>Email · </span>{dashboard.user?.email || '—'}</div>
                    <div><span style={{ color: '#94a3b8' }}>Unread alerts · </span>{dashboard.unread_notifications ?? 0}</div>
                    <div><span style={{ color: '#94a3b8' }}>City health · </span>{dashboard.city_health_score ?? '—'}{typeof dashboard.city_health_score === 'number' ? '%' : ''}</div>
                    <div><span style={{ color: '#94a3b8' }}>Active incidents · </span>{dashboard.active_incidents_citywide ?? 0}</div>
                    <div><span style={{ color: '#94a3b8' }}>Saved routes · </span>{Array.isArray(dashboard.saved_routes) ? dashboard.saved_routes.length : 0}</div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Loading account summary…</p>
                )}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Notification Preferences</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>
                  Backed by GET/PATCH <code style={{ fontSize: 11 }}>/user/preferences/</code>
                  {prefs.updated_at ? ` · updated ${new Date(prefs.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}
                </p>
              </div>

              {prefsLoading ? (
                <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { key: 'websocket' as const, label: 'WebSocket / in-app alerts', desc: 'Live push over the notifications socket' },
                      { key: 'email' as const, label: 'Email alerts', desc: 'Congestion alerts via email when SMTP is configured' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', margin: 0 }}>{label}</p>
                          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{desc}</p>
                        </div>
                        <Toggle
                          checked={prefs.notifications[key]}
                          onChange={(v) => setPrefs((p) => ({
                            ...p,
                            notifications: { ...p.notifications, [key]: v },
                          }))}
                          disabled={prefsBusy}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                      Quiet hours (Asia/Kolkata)
                    </label>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
                      {prefs.quiet_hours.description
                        || `No alerts from ${hourToTime(prefs.quiet_hours.start)} to ${hourToTime(prefs.quiet_hours.end)}`}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>Start hour</label>
                        <input
                          type="time"
                          value={hourToTime(prefs.quiet_hours.start)}
                          onChange={(e) => setPrefs((p) => ({
                            ...p,
                            quiet_hours: { ...p.quiet_hours, start: timeToHour(e.target.value) },
                          }))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>End hour</label>
                        <input
                          type="time"
                          value={hourToTime(prefs.quiet_hours.end)}
                          onChange={(e) => setPrefs((p) => ({
                            ...p,
                            quiet_hours: { ...p.quiet_hours, end: timeToHour(e.target.value) },
                          }))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                      Alert threshold — notify when congestion is at least
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {THRESHOLDS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPrefs({ ...prefs, alert_threshold: t })}
                          className={prefs.alert_threshold === t ? 'btn-gradient' : 'btn-neon'}
                          style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={prefsBusy}
                    onClick={() => void handleSavePrefs()}
                    className={saved ? 'btn-neon' : 'btn-gradient'}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content', opacity: prefsBusy ? 0.7 : 1 }}
                  >
                    {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                    {prefsBusy ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'travel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Travel Preferences</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Default commute mode (driving / walking / transit)</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>Default Travel Mode</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, preferred_mode: m })}
                      className={prefs.preferred_mode === m ? 'btn-gradient' : 'btn-neon'}
                      style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={prefsBusy}
                onClick={() => void handleSavePrefs()}
                className={saved ? 'btn-neon' : 'btn-gradient'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content', opacity: prefsBusy ? 0.7 : 1 }}
              >
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {prefsBusy ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
              </button>
            </div>
          )}

          {tab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Security Settings</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Manage your password and account security</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'current', label: 'Current Password', value: pwd.current, onChange: (v: string) => setPwd({ ...pwd, current: v }) },
                  { key: 'new', label: 'New Password', value: pwd.newPwd, onChange: (v: string) => setPwd({ ...pwd, newPwd: v }) },
                  { key: 'confirm', label: 'Confirm New Password', value: pwd.confirm, onChange: (v: string) => setPwd({ ...pwd, confirm: v }) },
                ].map(({ key, label, value, onChange }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                      />
                      {key === 'current' && (
                        <button
                          type="button"
                          onClick={() => setShowPwd(!showPwd)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                        >
                          {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pwdError && (
                  <div className="flex items-center gap-2 neon-badge-red" style={{ padding: '10px 14px', borderRadius: 9, fontSize: 13 }}>
                    {pwdError}
                  </div>
                )}
                {pwdSuccess && (
                  <div className="flex items-center gap-2 neon-badge-green" style={{ padding: '10px 14px', borderRadius: 9, fontSize: 13 }}>
                    <CheckCircle2 size={14} />
                    {pwdSuccess}
                  </div>
                )}
                <button
                  onClick={() => void handleChangePassword()}
                  className="btn-gradient"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}
                >
                  <Shield size={15} />
                  Update Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
