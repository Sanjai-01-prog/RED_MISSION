import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  UserPlus, 
  Mail, 
  Key, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Copy, 
  Check, 
  Lock,
  FileText
} from 'lucide-react';
import { adminApi } from '../../services/api';

export default function AdminManagementPanel({ currentAdmin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'team' | 'invitations' | 'audit' | 'password'
  const [teamList, setTeamList] = useState([]);
  const [invitationsList, setInvitationsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    roleId: 'ADMIN'
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MODERATOR');
  const [createdAccountResult, setCreatedAccountResult] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Password change
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  const isSuperAdmin = currentAdmin?.roleId === 'SUPER_ADMIN';

  useEffect(() => {
    loadTeamData();
  }, [activeTab]);

  const loadTeamData = async () => {
    if (activeTab === 'team' || activeTab === 'overview') {
      if (isSuperAdmin) {
        setLoading(true);
        const res = await adminApi.getTeam();
        setLoading(false);
        if (res.success) {
          setTeamList(res.team || []);
          setInvitationsList(res.invitations || []);
        }
      }
    } else if (activeTab === 'audit' && isSuperAdmin) {
      setLoading(true);
      const res = await adminApi.getAuditLogs();
      setLoading(false);
      if (res.success) {
        setAuditLogs(res.logs || []);
      }
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setLoading(true);

    const res = await adminApi.createAccount(createForm);
    setLoading(false);

    if (res.success) {
      setCreatedAccountResult(res.account);
      setActionSuccess(res.message);
      setCreateForm({ fullName: '', username: '', email: '', mobileNumber: '', roleId: 'ADMIN' });
      loadTeamData();
    } else {
      setActionError(res.error || 'Failed to create account.');
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setLoading(true);

    const res = await adminApi.sendInvitation(inviteEmail, inviteRole);
    setLoading(false);

    if (res.success) {
      setInviteResult(res.invitation);
      setActionSuccess(res.message);
      setInviteEmail('');
      loadTeamData();
    } else {
      setActionError(res.error || 'Failed to dispatch invitation.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setLoading(true);

    const res = await adminApi.changePassword(currentPass, newPass, confirmNewPass);
    setLoading(false);

    if (res.success) {
      setActionSuccess('Password successfully updated!');
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
    } else {
      setActionError(res.error || 'Failed to change password.');
    }
  };

  const copyToClipboard = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  return (
    <section id="admin-management-panel" className="py-12 relative bg-space-950/90 border-t border-amber-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with Active Admin Badge */}
        <div className="card-glass rounded-3xl p-6 border border-amber-500/30 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-orbitron font-extrabold text-2xl text-white">
                  {currentAdmin.fullName}
                </h3>
                <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {currentAdmin.roleName || currentAdmin.roleId}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Session: NBTC-COMMAND-NODE // Inactivity Limit: 30 Mins // Max Duration: 8h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-mars-400" />
              <span>Exit Command Mode</span>
            </button>
          </div>
        </div>

        {/* Action Error / Success Banners */}
        {actionError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-space-900 text-slate-400 hover:text-white'
            }`}
          >
            Command Overview
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'team' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-space-900 text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Governance ({teamList.length})</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'audit' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-space-900 text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Security Audit Logs</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'password' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-space-900 text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Admin Password</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* TAB 1: COMMAND OVERVIEW                              */}
        {/* ==================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="card-glass rounded-2xl p-5 border border-white/10 space-y-2">
                <span className="text-[11px] font-mono text-slate-400">ASSIGNED ROLE</span>
                <div className="text-xl font-orbitron font-bold text-amber-400">
                  {currentAdmin.roleName || currentAdmin.roleId}
                </div>
                <p className="text-xs text-slate-300">
                  {isSuperAdmin ? 'Full platform administration & governance privileges active.' : 'Authorized medical administration & operational permissions.'}
                </p>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-white/10 space-y-2">
                <span className="text-[11px] font-mono text-slate-400">2FA SECURITY STATUS</span>
                <div className="text-xl font-orbitron font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Dual 2FA Verified</span>
                </div>
                <p className="text-xs text-slate-300">
                  Both Mobile OTP and Email OTP were successfully confirmed for this active session.
                </p>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-white/10 space-y-2">
                <span className="text-[11px] font-mono text-slate-400">SESSION POLICY</span>
                <div className="text-xl font-orbitron font-bold text-white">
                  30m Idle / 8h Max
                </div>
                <p className="text-xs text-slate-300">
                  Automatic session revocation enforced server-side upon 30 minutes of inactivity.
                </p>
              </div>
            </div>

            {/* Permissions list */}
            <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-3">
              <h4 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
                Server-Enforced Role Permissions ({currentAdmin.permissions?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-2">
                {(currentAdmin.permissions || ['FULL_ADMINISTRATION']).map((p, i) => (
                  <span key={p || `perm-${i}`} className="px-3 py-1 rounded-lg bg-space-900 border border-white/10 text-xs font-mono text-slate-300">
                    ✔ {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TEAM GOVERNANCE (SUPER ADMIN ONLY)            */}
        {/* ==================================================== */}
        {activeTab === 'team' && isSuperAdmin && (
          <div className="space-y-8">
            
            {/* Create Account & Invite Forms Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Method 1: Manual Account Creation */}
              <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-orbitron font-bold text-sm text-white">Method 1: Manual Account Creation</h4>
                    <span className="text-[11px] text-slate-400 font-mono">Generates temporary password for first login</span>
                  </div>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-300">Full Name</label>
                    <input
                      type="text"
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                      placeholder="e.g. Dr. Ramesh Gupta"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-300">Username</label>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                        placeholder="e.g. dr_gupta"
                        className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-300">Role</label>
                      <select
                        value={createForm.roleId}
                        onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MODERATOR">MODERATOR</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-300">Email</label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        placeholder="admin@hospital.org"
                        className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-300">Mobile Number</label>
                      <input
                        type="tel"
                        value={createForm.mobileNumber}
                        onChange={(e) => setCreateForm({ ...createForm, mobileNumber: e.target.value })}
                        placeholder="+91 98XXX XXXXX"
                        className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Account & Generate Temp Password'}
                  </button>
                </form>

                {createdAccountResult && (
                  <div className="p-3.5 rounded-xl bg-space-900 border border-amber-500/40 text-xs font-mono space-y-1 animate-in fade-in">
                    <div className="text-amber-400 font-bold">Account Created Successfully:</div>
                    <div className="text-slate-300">Username: <strong className="text-white">{createdAccountResult.username}</strong></div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Temp Password: <strong className="text-amber-300 text-sm tracking-wider">{createdAccountResult.temporaryPassword}</strong></span>
                      <button
                        onClick={() => copyToClipboard(createdAccountResult.temporaryPassword, 'tempPass')}
                        className="p-1 hover:text-white"
                      >
                        {copiedKey === 'tempPass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Method 2: Email Invitation */}
              <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-orbitron font-bold text-sm text-white">Method 2: Email Invitation</h4>
                    <span className="text-[11px] text-slate-400 font-mono">Invitee sets their own password via secure link</span>
                  </div>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-300">Invitee Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="doctor@medicalcenter.org"
                      className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-300">Assigned Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                    >
                      <option value="ADMIN">ADMIN (Hospital Administrator)</option>
                      <option value="MODERATOR">MODERATOR (Verification Officer)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Dispatch Single-Use Invitation Link (7 Days)'}
                  </button>
                </form>

                {inviteResult && (
                  <div className="p-3.5 rounded-xl bg-space-900 border border-emerald-500/40 text-xs font-mono space-y-1 animate-in fade-in">
                    <div className="text-emerald-400 font-bold">Invitation Dispatched:</div>
                    <div className="text-slate-300 truncate">Email: {inviteResult.email}</div>
                    {inviteResult.demoLink && (
                      <div className="text-[11px] text-amber-300 break-all pt-1">
                        Demo Link: <a href={inviteResult.demoLink} className="underline">{inviteResult.demoLink}</a>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Active Team Table */}
            <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
                Active Administrative Team ({teamList.length})
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Full Name / Username</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Created By</th>
                      <th className="py-2.5 px-3 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {teamList.map((m) => (
                      <tr key={m.id} className="hover:bg-white/5">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{m.full_name}</div>
                          <div className="text-slate-400 text-[10px]">@{m.username}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.role_id === 'SUPER_ADMIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            m.role_id === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {m.role_id}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <div>{m.email}</div>
                          <div className="text-[10px] text-slate-500">{m.mobile_number}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>{m.is_active ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{m.created_by || 'SYSTEM'}</td>
                        <td className="py-3 px-3 text-right text-slate-400">
                          {new Date(m.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: SECURITY AUDIT LOGS (SUPER ADMIN ONLY)        */}
        {/* ==================================================== */}
        {activeTab === 'audit' && isSuperAdmin && (
          <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
                Security Audit Infrastructure ({auditLogs.length} Events)
              </h4>
              <button
                onClick={loadTeamData}
                className="text-xs font-mono text-amber-400 hover:text-white underline cursor-pointer"
              >
                Refresh Logs
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor Type</th>
                    <th className="py-2.5 px-3">Security Action</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-space-850 text-slate-300 text-[10px]">
                          {log.actor_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-amber-300">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                        {log.details || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {log.ip_address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: CHANGE ADMIN PASSWORD                         */}
        {/* ==================================================== */}
        {activeTab === 'password' && (
          <div className="max-w-md mx-auto card-glass rounded-2xl p-6 border border-white/10 space-y-4">
            <h4 className="font-orbitron font-bold text-base text-white">
              Update Administrative Password
            </h4>

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300">New Password (Min 8 chars)</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPass}
                  onChange={(e) => setConfirmNewPass(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

      </div>
    </section>
  );
}
