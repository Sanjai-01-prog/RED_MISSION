import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Clock, 
  ShieldCheck, 
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { adminApi } from '../../../services/api';

export default function SuperAdminTeamTab({
  teamList = [],
  invitationsList = [],
  loading = false,
  onRefreshTeam,
  currentAdmin
}) {
  // Forms & Actions state
  const [createForm, setCreateForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    roleId: 'ADMIN'
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MODERATOR');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [createdAccountResult, setCreatedAccountResult] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Handle Manual Account Creation
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setActionLoading(true);

    try {
      const res = await adminApi.createAccount(createForm);
      if (res.success) {
        setCreatedAccountResult(res.account);
        setActionSuccess(res.message || 'Account successfully created!');
        setCreateForm({ fullName: '', username: '', email: '', mobileNumber: '', roleId: 'ADMIN' });
        if (onRefreshTeam) onRefreshTeam();
      } else {
        setActionError(res.error || 'Failed to create administrative account.');
      }
    } catch (err) {
      console.error('Account creation error:', err);
      setActionError('Network error while provisioning administrative account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Email Invitation Dispatch
  const handleSendInvite = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setActionLoading(true);

    try {
      const res = await adminApi.sendInvitation(inviteEmail, inviteRole);
      if (res.success) {
        setInviteResult(res.invitation);
        setActionSuccess(res.message || 'Invitation link successfully dispatched!');
        setInviteEmail('');
        if (onRefreshTeam) onRefreshTeam();
      } else {
        setActionError(res.error || 'Failed to dispatch administrative invitation.');
      }
    } catch (err) {
      console.error('Invite error:', err);
      setActionError('Network error while dispatching invitation link.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clipboard utility
  const copyToClipboard = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  // Filtered team list
  const filteredTeam = teamList.filter(member => {
    const matchesSearch = 
      (member.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.mobile_number || '').includes(searchQuery);

    const matchesRole = roleFilter === 'ALL' || member.role_id === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">

      {/* Notifications / Feedback Banners */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Provisioning Forms: Manual Creation & Invitation Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Method 1: Direct Account Provisioning */}
        <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">Direct Admin Provisioning</h3>
              <p className="text-[11px] text-slate-400 font-mono">Immediate account creation with temporary credentials</p>
            </div>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="e.g. dr_rajesh"
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Role Authority</label>
                <select
                  value={createForm.roleId}
                  onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="ADMIN">ADMIN (Hospital Administrator)</option>
                  <option value="MODERATOR">MODERATOR (Verification Officer)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="admin@hospital.org"
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Mobile (+91)</label>
                <input
                  type="tel"
                  value={createForm.mobileNumber}
                  onChange={(e) => setCreateForm({ ...createForm, mobileNumber: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-all cursor-pointer shadow-md shadow-amber-600/20 hover:brightness-110 disabled:opacity-50"
            >
              {actionLoading ? 'Provisioning...' : 'Provision Account & Generate Temp Password'}
            </button>
          </form>

          {/* Provisioning Credential Result Card */}
          {createdAccountResult && (
            <div className="p-4 rounded-xl bg-space-900 border border-amber-500/40 text-xs font-mono space-y-2 animate-in fade-in">
              <div className="text-amber-400 font-bold flex items-center justify-between">
                <span>Account Provisioned:</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {createdAccountResult.roleId}
                </span>
              </div>
              <div className="text-slate-300">Username: <strong className="text-white">{createdAccountResult.username}</strong></div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-space-950 border border-white/10">
                <span className="text-slate-400">Temp Password: <strong className="text-amber-300 font-bold ml-1">{createdAccountResult.temporaryPassword}</strong></span>
                <button
                  onClick={() => copyToClipboard(createdAccountResult.temporaryPassword, 'tempPass')}
                  className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                  title="Copy password"
                >
                  {copiedKey === 'tempPass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                User will be required to update password immediately upon first 2FA verification.
              </p>
            </div>
          )}
        </div>

        {/* Method 2: Single-Use Email Invitation */}
        <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm text-white">Single-Use Email Invitation</h3>
              <p className="text-[11px] text-slate-400 font-mono">Invitee self-enrolls credentials via secure cryptographic link</p>
            </div>
          </div>

          <form onSubmit={handleSendInvite} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Invitee Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="officer@redmission.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">Assigned Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="MODERATOR">MODERATOR (Verification Officer)</option>
                <option value="ADMIN">ADMIN (Hospital Administrator)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-space-900/60 border border-white/5 text-[11px] text-slate-400 font-mono space-y-1">
              <div className="text-slate-300 font-semibold">Security Token Parameters:</div>
              <div>• Validity: 7 Days from dispatch</div>
              <div>• Single-use consumption with SHA-256 HMAC digest</div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-all cursor-pointer shadow-md shadow-cyan-600/20 hover:brightness-110 disabled:opacity-50"
            >
              {actionLoading ? 'Dispatching...' : 'Dispatch Invitation Link (7 Days)'}
            </button>
          </form>

          {/* Invitation Result Card */}
          {inviteResult && (
            <div className="p-4 rounded-xl bg-space-900 border border-emerald-500/40 text-xs font-mono space-y-2 animate-in fade-in">
              <div className="text-emerald-400 font-bold flex items-center justify-between">
                <span>Invitation Dispatched:</span>
                <span className="text-[10px] text-slate-400">{inviteResult.roleId}</span>
              </div>
              <div className="text-slate-300 truncate">Email: <strong className="text-white">{inviteResult.email}</strong></div>
              {inviteResult.demoLink && (
                <div className="p-2 rounded bg-space-950 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-300">Demo Link (Development):</span>
                    <button
                      onClick={() => copyToClipboard(inviteResult.demoLink, 'inviteLink')}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Copy link"
                    >
                      {copiedKey === 'inviteLink' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400 break-all select-all font-mono">
                    {inviteResult.demoLink}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Active Administrative Team Roster */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
              Active Administrative Team ({filteredTeam.length})
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Authorized clinical administrators and verification officers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search filter */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team member..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MODERATOR">MODERATOR</option>
            </select>

            <button
              onClick={onRefreshTeam}
              disabled={loading}
              className="p-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Team Roster"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Full Name / Username</th>
                <th className="py-2.5 px-3">Role Authority</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Created By</th>
                <th className="py-2.5 px-3 text-right">Provisioned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTeam.length > 0 ? (
                filteredTeam.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{m.full_name}</div>
                      <div className="text-slate-400 text-[10px]">@{m.username}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.role_id === 'SUPER_ADMIN' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : m.role_id === 'ADMIN' 
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {m.role_id}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      <div>{m.email}</div>
                      <div className="text-[10px] text-slate-500">{m.mobile_number}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{m.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{m.created_by || 'SYSTEM'}</td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 text-xs font-mono">
                    {loading ? 'Loading team roster...' : 'No administrative team members match the filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Table */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
              Pending Invitations ({invitationsList.length})
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Unaccepted single-use invitation tokens currently active
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Invitee Email</th>
                <th className="py-2.5 px-3">Designated Role</th>
                <th className="py-2.5 px-3">Invited By</th>
                <th className="py-2.5 px-3">Dispatched Date</th>
                <th className="py-2.5 px-3 text-right">Expires At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invitationsList.length > 0 ? (
                invitationsList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">{inv.email}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {inv.role_id}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">@{inv.invited_by_username || 'Admin'}</td>
                    <td className="py-3 px-3 text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-right text-amber-300 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{new Date(inv.expires_at).toLocaleDateString()}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400 text-xs font-mono">
                    No pending invitations. All issued invitations have been accepted or expired.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
