import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Lock, 
  Users, 
  Activity, 
  RefreshCw, 
  Trash2, 
  AlertCircle,
  Database
} from 'lucide-react';
import { adminApi } from '../../../services/api';

export default function SuperAdminGovernanceTab({ currentAdmin, onLogout }) {
  // System Health
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Active Sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionActionError, setSessionActionError] = useState('');
  const [sessionActionSuccess, setSessionActionSuccess] = useState('');

  // Password update form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('Health fetch failed:', err);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // Fetch active sessions
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionActionError('');
    try {
      const res = await adminApi.getAdminSessions();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      } else {
        setSessionActionError(res.error || 'Failed to retrieve active administrative sessions.');
      }
    } catch (err) {
      console.error('Sessions fetch failed:', err);
      setSessionActionError('Network error while retrieving active sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchSessions();
  }, [fetchHealth, fetchSessions]);

  // Revoke session handler
  const handleRevokeSession = async (sessionId, username) => {
    if (!window.confirm(`Are you sure you want to revoke the active administrative session for @${username}? The admin will be immediately logged out.`)) {
      return;
    }

    setSessionActionError('');
    setSessionActionSuccess('');
    try {
      const res = await adminApi.revokeAdminSession(sessionId);
      if (res.success) {
        setSessionActionSuccess(res.message || 'Session successfully revoked.');
        fetchSessions();
      } else {
        setSessionActionError(res.error || 'Failed to revoke session.');
      }
    } catch (err) {
      console.error('Revoke error:', err);
      setSessionActionError('Network error while revoking session.');
    }
  };

  // Change password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await adminApi.changePassword(currentPassword, newPassword, confirmPassword);
      if (res.success) {
        setPasswordSuccess('Administrative password successfully updated!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Failed to update administrative password.');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('Network error while updating password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* System Health & Architecture */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">System &amp; Network Health</h3>
              <p className="text-xs text-slate-400 font-mono">Live server status and database connectivity</p>
            </div>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loadingHealth}
            className="p-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Health"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-space-900 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Service Status</span>
            <div className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{healthData?.status || 'ONLINE'}</span>
            </div>
            <p className="text-[10px] text-slate-400">HTTP/REST Core Online</p>
          </div>

          <div className="p-4 rounded-xl bg-space-900 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Database Engine</span>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{healthData?.database || 'SQLite (node:sqlite)'}</span>
            </div>
            <p className="text-[10px] text-slate-400">Strict ACID Transactions</p>
          </div>

          <div className="p-4 rounded-xl bg-space-900 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Environment</span>
            <div className="text-sm font-bold text-amber-300 uppercase">
              {healthData?.environment || 'Development'}
            </div>
            <p className="text-[10px] text-slate-400">Node.js 24 Execution</p>
          </div>

          <div className="p-4 rounded-xl bg-space-900 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Server Time</span>
            <div className="text-xs font-bold text-slate-300 truncate">
              {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'Synchronized'}
            </div>
            <p className="text-[10px] text-slate-400">{healthData?.timestamp ? new Date(healthData.timestamp).toLocaleDateString() : 'UTC Clock'}</p>
          </div>
        </div>
      </div>

      {/* Active Administrative Sessions & Remote Revocation */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">Active Administrative Sessions ({sessions.length})</h3>
              <p className="text-xs text-slate-400 font-mono">Live admin tokens with remote revocation capability</p>
            </div>
          </div>

          <button
            onClick={fetchSessions}
            disabled={loadingSessions}
            className="px-3 py-1.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Feedback messages */}
        {sessionActionError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{sessionActionError}</span>
          </div>
        )}
        {sessionActionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{sessionActionSuccess}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Administrator</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Last Active</th>
                <th className="py-2.5 px-3">Expires At</th>
                <th className="py-2.5 px-3 text-right">Session Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sessions.length > 0 ? (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{s.full_name || s.username}</span>
                        {s.isCurrentSession && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[10px]">@{s.username}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.role_id === 'SUPER_ADMIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        s.role_id === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {s.role_id}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300">{s.ip_address}</td>

                    <td className="py-3 px-3 text-slate-400">
                      {new Date(s.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-3 text-slate-400">
                      {new Date(s.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {s.isCurrentSession ? (
                        <span className="text-slate-500 text-[11px] font-mono italic">
                          Active Session
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevokeSession(s.id, s.username)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Revoke session remotely"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-400 text-xs font-mono">
                    {loadingSessions ? 'Querying active sessions...' : 'No active administrative sessions found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Policies Overview & Super Admin Password Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Core Platform Security Policies (Enforced Server-Side) */}
        <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">Platform Security Standard</h3>
              <p className="text-[11px] text-slate-400 font-mono">Immutable cryptographic and access control policies</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="p-3 rounded-xl bg-space-900 border border-white/5 flex items-center justify-between">
              <span className="text-slate-300">Mandatory Dual 2FA</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mobile OTP + Email OTP</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-space-900 border border-white/5 flex items-center justify-between">
              <span className="text-slate-300">Admin Inactivity Timeout</span>
              <span className="text-amber-300 font-bold">30 Minutes Idle</span>
            </div>

            <div className="p-3 rounded-xl bg-space-900 border border-white/5 flex items-center justify-between">
              <span className="text-slate-300">Max Session Duration</span>
              <span className="text-slate-300 font-bold">8 Hours Max</span>
            </div>

            <div className="p-3 rounded-xl bg-space-900 border border-white/5 flex items-center justify-between">
              <span className="text-slate-300">Automated Account Lockout</span>
              <span className="text-rose-400 font-bold">5 Failed Attempts (30m Lockout)</span>
            </div>

            <div className="p-3 rounded-xl bg-space-900 border border-white/5 flex items-center justify-between">
              <span className="text-slate-300">Single-Use Invitation Expiry</span>
              <span className="text-cyan-400 font-bold">7 Days Lifetime</span>
            </div>
          </div>
        </div>

        {/* Update Super Admin Password */}
        <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">Super Admin Password</h3>
              <p className="text-[11px] text-slate-400 font-mono">Update master administrative login credentials</p>
            </div>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-all cursor-pointer shadow-md shadow-amber-600/20 hover:brightness-110 disabled:opacity-50"
            >
              {passwordLoading ? 'Updating...' : 'Update Master Password'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
