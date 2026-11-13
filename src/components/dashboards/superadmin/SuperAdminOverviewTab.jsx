import React from 'react';
import { 
  Users, 
  ShieldCheck, 
  FileCheck2, 
  Heart, 
  Award, 
  Activity, 
  ArrowUpRight, 
  Clock, 
  RefreshCw, 
  Sliders, 
  ShieldAlert,
  AlertCircle,
  Plus
} from 'lucide-react';
import DashboardStatCard from '../shared/DashboardStatCard';

export default function SuperAdminOverviewTab({
  stats,
  loading,
  error,
  onRefresh,
  onNavigateTab,
  onOpenCreateRequest,
  onSwitchToAdminOps,
  currentAdmin
}) {
  const totalTeamMembers = stats 
    ? (stats.activeAdmins || 0) + (stats.activeModerators || 0) + (stats.activeSuperAdmins || 0)
    : null;

  return (
    <div className="space-y-6">
      
      {/* Platform Banner */}
      <div className="card-glass rounded-3xl p-6 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white">
                Platform Governance &amp; Command
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SUPER_ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Active Administrator: <strong className="text-white">{currentAdmin?.fullName || currentAdmin?.username}</strong> // Authority: Highest Platform Governance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {onOpenCreateRequest && (
            <button
              onClick={onOpenCreateRequest}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white hover:brightness-110 text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-mars-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Blood Request</span>
            </button>
          )}
          {onSwitchToAdminOps && (
            <button
              onClick={onSwitchToAdminOps}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-cyan-500/40 text-xs font-mono font-semibold text-cyan-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Switch to Operational Admin Ops (Emergency Requests & Proof Review)"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Enter Admin Ops</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Platform Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state if stats fetch failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Core Platform Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Registered Donors */}
        <DashboardStatCard
          title="Registered Donors"
          value={stats ? stats.totalDonors : '—'}
          subtitle={stats ? `${stats.totalUsers} total registered accounts` : 'Platform database'}
          icon={Users}
          color="mars"
          unavailable={!stats && !loading}
        />

        {/* Administrative Team */}
        <DashboardStatCard
          title="Admin Staff"
          value={totalTeamMembers !== null ? totalTeamMembers : '—'}
          subtitle={stats ? `${stats.activeAdmins} Admins // ${stats.activeModerators} Mods` : 'Active accounts'}
          icon={ShieldCheck}
          color="amber"
          unavailable={!stats && !loading}
        />

        {/* Pending Verification Proofs */}
        <DashboardStatCard
          title="Pending Proofs"
          value={stats ? stats.pendingProofs : '—'}
          subtitle={stats ? `${stats.approvedProofs} approved // ${stats.rejectedProofs} rejected` : 'Awaiting clinical review'}
          icon={FileCheck2}
          color="cyan"
          unavailable={!stats && !loading}
        />

        {/* Emergency Blood Requests */}
        <DashboardStatCard
          title="Active Requests"
          value={stats ? stats.activeRequests : '—'}
          subtitle={stats ? `${stats.fulfilledRequests} fulfilled requests` : 'Live emergency requests'}
          icon={Heart}
          color="mars"
          unavailable={!stats && !loading}
        />

        {/* Issued Clinical Certificates */}
        <DashboardStatCard
          title="Issued Certificates"
          value={stats ? stats.issuedCertificates : '—'}
          subtitle="Cryptographically verified"
          icon={Award}
          color="emerald"
          unavailable={!stats && !loading}
        />
      </div>

      {/* Governance Shortcuts & Operational Command Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* Card 1: Team Governance */}
        <div className="card-glass rounded-2xl p-5 border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Administrative Governance
            </h3>
            <p className="text-xs text-slate-300">
              Provision new hospital admins, verification officers, and dispatch single-use invitation links.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('team')}
            className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono font-semibold text-amber-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Manage Admin Team</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Emergency Blood Requests */}
        <div className="card-glass rounded-2xl p-5 border border-white/10 hover:border-mars-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
              <Heart className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Emergency Blood Requests
            </h3>
            <p className="text-xs text-slate-300">
              Publish new hospital blood requisitions, review urgency queues, and manage regional fulfillment status.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('requests')}
            className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono font-semibold text-mars-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Manage Blood Requests</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Certificate Oversight */}
        <div className="card-glass rounded-2xl p-5 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Certificate Oversight
            </h3>
            <p className="text-xs text-slate-300">
              Audit all issued clinical donation certificates, inspect donor-pledge linkages, and verify public QR hashes.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('certificates')}
            className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono font-semibold text-emerald-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Audit Certificates</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Security & Audit Infrastructure */}
        <div className="card-glass rounded-2xl p-5 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Security Audit Logs
            </h3>
            <p className="text-xs text-slate-300">
              Inspect immutable audit records for authentication, role assignments, proof decisions, and administrative logins.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('audit')}
            className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono font-semibold text-cyan-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Review Security Logs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Recent Administrative Activities Stream */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
              Recent Administrative Activities
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('audit')}
            className="text-xs font-mono text-amber-400 hover:text-white underline cursor-pointer"
          >
            View All Audit Logs →
          </button>
        </div>

        {stats?.recentActivities && stats.recentActivities.length > 0 ? (
          <div className="divide-y divide-white/5">
            {stats.recentActivities.map((act) => (
              <div key={act.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    act.actor_type === 'ADMIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {act.actor_type}
                  </span>
                  <div>
                    <span className="font-semibold text-white">{act.action}</span>
                    {act.details && (
                      <span className="text-slate-400 ml-2 truncate max-w-md hidden md:inline">
                        {typeof act.details === 'string' ? act.details : JSON.stringify(act.details)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px] self-end sm:self-auto">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </span>
                  <span className="text-slate-500">{act.ip_address}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs font-mono">
            {loading ? 'Loading recent activities...' : 'No administrative activities logged yet.'}
          </div>
        )}
      </div>

    </div>
  );
}
