'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Crown, Shield, User2, Mail, Plus, Trash2, Users, CheckCircle2 } from 'lucide-react';
import { orgApi } from '@/lib/api';

interface Member {
  id: string; full_name: string; email: string;
  role: 'owner' | 'admin' | 'member'; joined_at: string; is_active: boolean;
}
interface Org { id: string; name: string; plan: string; my_role: string; }

const ORG: Org     = { id: 'org-001', name: 'FlowCast India Enterprise', plan: 'Enterprise', my_role: 'owner' };
const MEMBERS: Member[] = [
  { id: '1', full_name: 'Aditya Sharma',  email: 'aditya@company.in',  role: 'owner',  joined_at: '2024-01-15', is_active: true  },
  { id: '2', full_name: 'Priya Patel',    email: 'priya@company.in',   role: 'admin',  joined_at: '2024-02-01', is_active: true  },
  { id: '3', full_name: 'Rahul Singh',    email: 'rahul@company.in',   role: 'member', joined_at: '2024-02-15', is_active: true  },
  { id: '4', full_name: 'Meena Iyer',     email: 'meena@company.in',   role: 'member', joined_at: '2024-03-01', is_active: true  },
  { id: '5', full_name: 'Kiran Kumar',    email: 'kiran@company.in',   role: 'admin',  joined_at: '2024-03-10', is_active: false },
  { id: '6', full_name: 'Sanjay Reddy',   email: 'sanjay@company.in',  role: 'member', joined_at: '2024-04-02', is_active: true  },
];

const ROLE = {
  owner:  { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', Icon: Crown  },
  admin:  { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', Icon: Shield },
  member: { bg: 'rgba(100,116,139,0.1)', text: '#475569', Icon: User2  },
};

export default function OrgPage() {
  const [org,       setOrg]       = useState<Org>(ORG);
  const [members,   setMembers]   = useState<Member[]>(MEMBERS);
  const [showForm,  setShowForm]  = useState(false);
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState<'admin' | 'member'>('member');
  const [sending,   setSending]   = useState(false);
  const [success,   setSuccess]   = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const mineRes = await orgApi.listMine();
      const mine = mineRes.data?.organizations ?? mineRes.data;
      if (Array.isArray(mine) && mine.length) {
        setOrgs(mine);
        const selectedOrg = mine[0];
        setOrg(selectedOrg);
        const [detail, memberRes] = await Promise.all([orgApi.get(String(selectedOrg.id)), orgApi.membersOf(String(selectedOrg.id))]);
        if (detail.data) setOrg(detail.data);
        if (memberRes.data?.members?.length) setMembers(memberRes.data.members);
      } else {
        const [oRes, mRes] = await Promise.all([orgApi.getMine(), orgApi.members()]);
        if (oRes.data) setOrg(oRes.data);
        if (mRes.data?.members?.length) setMembers(mRes.data.members);
      }
    } catch { /* stubs */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const invite = async () => {
    if (!email.trim()) return;
    setSending(true);
    try { await (org?.id ? orgApi.inviteTo(org.id, { email, role }) : orgApi.invite({ email, role })); } catch { /* ok */ }
    setMembers((p) => [...p, { id: Date.now().toString(), full_name: email.split('@')[0], email, role, joined_at: new Date().toISOString(), is_active: true }]);
    setSuccess(`Invite sent to ${email}`);
    setEmail(''); setShowForm(false); setSending(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const changeRole = async (id: string, r: 'admin' | 'member') => {
    try { await (org?.id ? orgApi.changeRoleOf(org.id, id, r) : orgApi.changeRole(id, r)); } catch { /* ok */ }
    setMembers((p) => p.map((m) => m.id === id ? { ...m, role: r } : m));
  };

  const remove = async (id: string) => {
    try { await (org?.id ? orgApi.removeMemberOf(org.id, id) : orgApi.removeMember(id)); } catch { /* ok */ }
    setMembers((p) => p.filter((m) => m.id !== id));
  };

  const owners  = members.filter((m) => m.role === 'owner').length;
  const admins  = members.filter((m) => m.role === 'admin').length;
  const regular = members.filter((m) => m.role === 'member').length;

  return (
    <div className="space-y-5" style={{ maxWidth: 900 }}>

      {/* ── Page Hero ─────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-purple" style={{ width: 52, height: 52 }}>
              <Building2 size={26} color="#a78bfa" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>{org.name}</h1>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99 }} className="neon-badge-blue">{org.plan}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Manage members, roles and fleet access</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[{ l: 'Total', v: members.length }, { l: 'Owners', v: owners }, { l: 'Admins', v: admins }, { l: 'Members', v: regular }].map(({ l, v }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p className="gradient-text-animated" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{v}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => void orgApi.create({ name: 'New organization' }).then(fetchData)} className="btn-neon" style={{ padding: '7px 10px', borderRadius: 8, fontSize: 11 }}>Create org</button>
            <button onClick={() => void orgApi.update(org.id, { name: org.name }).then(fetchData)} className="btn-neon" style={{ padding: '7px 10px', borderRadius: 8, fontSize: 11 }}>Sync org</button>
            <button onClick={() => void orgApi.delete(org.id).then(fetchData)} style={{ padding: '7px 10px', borderRadius: 8, fontSize: 11, color: '#ef4444' }}>Delete org</button>
          </div>
        </div>
      </div>

      {/* ── Success toast ───────────────────────────────── */}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600 }} className="neon-badge-green">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      {/* ── Members table ───────────────────────────────── */}
      <div className="neon-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="icon-glow icon-glow-purple" style={{ width: 28, height: 28 }}>
              <Users size={13} color="#a78bfa" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Team Members</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }} className="neon-badge-blue">{members.length}</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
            <Plus size={13} /> Invite Member
          </button>
        </div>

        {showForm && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', background: 'rgba(59,130,246,0.03)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 28, height: 28, flexShrink: 0 }}>
              <Mail size={13} color="#3b82f6" />
            </div>
            <input type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, minWidth: 220, fontSize: 13, borderRadius: 9, padding: '7px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827' }} />
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              style={{ fontSize: 13, borderRadius: 9, padding: '7px 10px', border: '1.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={invite} disabled={sending} className="btn-gradient" style={{ padding: '7px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, opacity: sending ? 0.7 : 1 }}>
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              {['Member', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const rc = ROLE[m.role];
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 12px rgba(124,58,237,0.4)' }}>
                        {m.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280' }}>{m.email}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: rc.bg, color: rc.text, textTransform: 'capitalize' }}>
                      <rc.Icon size={10} /> {m.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span
                      className={m.is_active ? 'neon-badge-green' : ''}
                      style={m.is_active
                        ? { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }
                        : { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#9ca3af' }
                      }>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#9ca3af' }}>
                    {new Date(m.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    {m.role !== 'owner' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value as 'admin' | 'member')}
                          style={{ fontSize: 11, borderRadius: 7, padding: '4px 8px', border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer', background: '#fff' }}>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => remove(m.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}
                        ><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
