'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Bell, Car, Shield, Globe, Save, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'travel', label: 'Travel Preferences', icon: Car },
  { id: 'security', label: 'Security', icon: Shield },
];

const MODES = ['driving', 'transit', 'walking', 'cycling'];
const THRESHOLDS = ['low', 'medium', 'high', 'critical'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? '#3b82f6' : '#d1d5db',
        boxShadow: checked ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({
    notifications_enabled: true,
    preferred_mode: 'driving',
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    congestion_threshold: 'high',
    language: 'en',
    email_alerts: true,
    push_alerts: false,
    departure_reminders: true,
    incident_alerts: true,
  });
  const [profile, setProfile] = useState({ full_name: user?.full_name || '', email: user?.email || '' });
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await api.get('/user/preferences');
      if (res.data) setPrefs((p) => ({ ...p, ...res.data }));
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPrefs();
    if (user) setProfile({ full_name: user.full_name, email: user.email });
  }, [fetchPrefs, user]);

  const handleSavePrefs = async () => {
    try {
      await api.put('/user/preferences', prefs);
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveProfile = async () => {
    try {
      await api.put('/auth/me', { full_name: profile.full_name });
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      await api.post('/auth/change-password', { current_password: pwd.current, new_password: pwd.newPwd });
      setPwdSuccess('Password changed successfully');
      setPwd({ current: '', newPwd: '', confirm: '' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setPwdError(e.response?.data?.detail || 'Failed to change password');
    }
  };

  return (
    <div className="slide-up" style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Manage your account preferences and security</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Tab nav */}
        <div style={{ width: 192, flexShrink: 0 }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="w-full flex items-center gap-2.5 text-sm font-medium text-left transition-all"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: tab === id ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: tab === id ? '#3b82f6' : '#374151',
                  borderLeft: tab === id ? '3px solid #3b82f6' : '3px solid transparent',
                  boxShadow: tab === id ? '0 0 12px rgba(59,130,246,0.15)' : 'none',
                }}
              >
                <Icon size={16} style={{ color: tab === id ? '#3b82f6' : '#6b7280' }} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="neon-card" style={{ flex: 1, padding: '24px' }}>
          {/* Profile tab */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Profile Information</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Update your account details</p>
              </div>
              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: 64, height: 64, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 22, fontWeight: 900,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    boxShadow: '0 0 24px rgba(59,130,246,0.4)',
                  }}
                >
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#111827', margin: 0 }}>{profile.full_name}</p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: '2px 0 6px' }}>{profile.email}</p>
                  <span className="neon-badge-blue" style={{ fontSize: 11 }}>
                    {user?.is_admin ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Full Name</label>
                  <input
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, color: '#111827', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Email</label>
                  <input
                    value={profile.email}
                    disabled
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13.5, color: '#9ca3af', background: '#f9fafb', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  <Globe size={14} style={{ display: 'inline', marginRight: 6 }} />
                  Language
                </label>
                <select
                  value={prefs.language}
                  onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
                  style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, color: '#374151', background: '#fff', outline: 'none' }}
                >
                  {LANGUAGES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                </select>
              </div>
              <button onClick={handleSaveProfile} className={saved ? 'btn-neon' : 'btn-gradient'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Notifications tab */}
          {tab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Notification Preferences</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Control how and when you receive alerts</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { key: 'notifications_enabled', label: 'Enable All Notifications', desc: 'Master switch for all notifications' },
                  { key: 'email_alerts', label: 'Email Alerts', desc: 'Receive congestion alerts via email' },
                  { key: 'push_alerts', label: 'Push Notifications', desc: 'Browser push notifications for critical alerts' },
                  { key: 'departure_reminders', label: 'Departure Reminders', desc: 'Alerts before scheduled departure times' },
                  { key: 'incident_alerts', label: 'Incident Reports', desc: 'Notifications for new traffic incidents on your routes' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{desc}</p>
                    </div>
                    <Toggle
                      checked={(prefs as Record<string, unknown>)[key] as boolean}
                      onChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Quiet Hours Start</label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Quiet Hours End</label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                  Alert Threshold — notify when congestion is
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {THRESHOLDS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setPrefs({ ...prefs, congestion_threshold: t })}
                      className={prefs.congestion_threshold === t ? 'btn-gradient' : 'btn-neon'}
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSavePrefs} className={saved ? 'btn-neon' : 'btn-gradient'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved!' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* Travel preferences tab */}
          {tab === 'travel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Travel Preferences</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Set your default commute settings</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>Default Travel Mode</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MODES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setPrefs({ ...prefs, preferred_mode: m })}
                      className={prefs.preferred_mode === m ? 'btn-gradient' : 'btn-neon'}
                      style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSavePrefs} className={saved ? 'btn-neon' : 'btn-gradient'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved!' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* Security tab */}
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
                        style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: 13.5, color: '#111827', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
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
                  onClick={handleChangePassword}
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
    </div>
  );
}
