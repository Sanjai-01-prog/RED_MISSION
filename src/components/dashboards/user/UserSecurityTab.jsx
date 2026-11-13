import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  KeyRound,
  RefreshCw
} from 'lucide-react';
import DashboardTable from '../shared/DashboardTable';
import { userApi } from '../../../services/api';

export default function UserSecurityTab({
  currentUser
}) {
  const [securityData, setSecurityData] = useState({ activities: [], activeSessions: [] });
  const [loading, setLoading] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const res = await userApi.getSecurityActivity();
      if (res.success) {
        setSecurityData({
          activities: res.activities || [],
          activeSessions: res.activeSessions || []
        });
      }
    } catch (err) {
      console.error('Failed to load security activity', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleLogoutOtherSessions = async () => {
    if (!confirm('Are you sure you want to log out all other active sessions across your other devices?')) return;

    setTerminating(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await userApi.logoutOtherSessions();
      if (res.success) {
        setMessage({ text: 'All other active sessions have been securely terminated.', type: 'success' });
        fetchSecurityData();
      } else {
        setMessage({ text: res.error || 'Failed to terminate other sessions.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error terminating other sessions.', type: 'error' });
    } finally {
      setTerminating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Security Status Card */}
      <div className="card-glass rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Account Security &amp; Access Controls
            </h3>
            <p className="text-xs font-mono text-slate-300">
              Multi-device session oversight and real-time security activity audit logs
            </p>
          </div>
        </div>

        <button
          onClick={fetchSecurityData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {message.text && (
        <div className={`p-3 rounded-2xl text-xs font-mono flex items-center gap-2 ${
          message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Sessions Section */}
      <div className="card-glass rounded-2xl border border-white/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">
              Active Authorized Sessions
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Devices currently holding valid authentication tokens for your account
            </p>
          </div>

          <button
            onClick={handleLogoutOtherSessions}
            disabled={terminating}
            className="px-3.5 py-1.5 rounded-xl text-xs font-mono text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{terminating ? 'Terminating...' : 'Terminate Other Sessions'}</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="space-y-2.5">
          {securityData.activeSessions.length > 0 ? (
            securityData.activeSessions.map((session, idx) => (
              <div 
                key={session.id || idx}
                className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-space-900 border border-white/10 flex items-center justify-center text-slate-300">
                    {session.device_info?.toLowerCase().includes('mobile') || session.device_info?.toLowerCase().includes('android') || session.device_info?.toLowerCase().includes('iphone') ? (
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Laptop className="w-4 h-4 text-mars-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>{session.device_info || 'Authenticated Browser'}</span>
                      {session.is_current && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        <span>{session.ip_address || '127.0.0.1'}</span>
                      </span>
                      <span>•</span>
                      <span>Last active: {session.last_active ? new Date(session.last_active).toLocaleString() : 'Active now'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Valid Session</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl bg-space-850/40 text-center text-xs font-mono text-slate-400">
              Only your current active browser session is active.
            </div>
          )}
        </div>
      </div>

      {/* Security Audit Log Activity Table */}
      <DashboardTable
        title="Security & Access Audit Trail"
        subtitle="Immutable security logs of your account authentication events"
        loading={loading}
        isEmpty={securityData.activities.length === 0}
        emptyMessage="No recent security events logged"
        emptySubtext="Authentication events such as logins and session updates will be logged here."
        columns={[
          { label: 'Event Type' },
          { label: 'Timestamp' },
          { label: 'IP Address' },
          { label: 'Status' }
        ]}
      >
        {securityData.activities.map((act, idx) => (
          <tr key={act.id || idx} className="hover:bg-white/5 transition-colors">
            <td className="py-3 px-4 font-semibold text-white">
              {act.action || act.activity_type || 'User Authentication'}
            </td>
            <td className="py-3 px-4 font-mono text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{act.created_at ? new Date(act.created_at).toLocaleString() : 'Recent'}</span>
              </div>
            </td>
            <td className="py-3 px-4 font-mono text-xs text-slate-400">
              {act.ip_address || '127.0.0.1'}
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified</span>
              </span>
            </td>
          </tr>
        ))}
      </DashboardTable>

    </div>
  );
}
