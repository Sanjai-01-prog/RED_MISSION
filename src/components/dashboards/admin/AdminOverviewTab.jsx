import React from 'react';
import { 
  FileCheck2, 
  Clock, 
  AlertTriangle, 
  Heart, 
  CheckCircle2, 
  Users, 
  ArrowRight, 
  Eye, 
  Check, 
  X, 
  Building2, 
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import DashboardStatCard from '../shared/DashboardStatCard';

export default function AdminOverviewTab({
  stats,
  recentProofs = [],
  recentRequests = [],
  onNavigateTab,
  onOpenProofPhoto,
  onReviewPendingProofs,
  onOpenCreateRequest,
  onRefreshData,
  currentAdmin,
  loading = false
}) {
  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  const isModerator = adminRole === 'MODERATOR';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner: Medical Command Info & Role Status */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-space-900 via-space-850 to-space-900 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-space-800 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-orbitron font-extrabold text-base sm:text-lg text-white">
                {isModerator ? 'Moderator Review Console' : 'Operational Medical Command'}
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isModerator 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {adminRole || 'ADMIN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Logged in as <span className="text-slate-200 font-semibold">{currentAdmin?.fullName || currentAdmin?.username}</span> • Live SQLite telemetry active
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isModerator && onOpenCreateRequest && (
            <button
              onClick={onOpenCreateRequest}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white hover:brightness-110 shadow-md shadow-mars-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Blood Request</span>
            </button>
          )}
          <button
            onClick={onRefreshData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono bg-space-800 hover:bg-space-750 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-mars-400' : ''}`} />
            <span>Sync Live Telemetry</span>
          </button>
        </div>
      </div>

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Pending Proofs */}
        <DashboardStatCard
          title="Pending Proofs"
          value={stats.pendingProofs}
          icon={Clock}
          color="amber"
          subtext="Awaiting verification"
        />

        {/* Approved Proofs */}
        <DashboardStatCard
          title="Approved Proofs"
          value={stats.approvedProofs}
          icon={FileCheck2}
          color="emerald"
          subtext="Certified clinical donations"
        />

        {/* Rejected Proofs */}
        <DashboardStatCard
          title="Rejected Proofs"
          value={stats.rejectedProofs}
          icon={AlertTriangle}
          color="purple"
          subtext="Requires re-submission"
        />

        {/* Active Emergency Requests */}
        <DashboardStatCard
          title="Active Requests"
          value={stats.activeRequests}
          icon={Heart}
          color="mars"
          subtext="Open emergency blood calls"
        />

        {/* Fulfilled Requests */}
        <DashboardStatCard
          title="Fulfilled Requests"
          value={stats.fulfilledRequests}
          icon={CheckCircle2}
          color="cyan"
          subtext="Complete patient matches"
        />

        {/* Total Registered Donors (Unavailable in backend) */}
        <DashboardStatCard
          title="Registered Donors"
          value="N/A"
          unavailable={true}
          icon={Users}
          color="mars"
          subtext="Census API not in backend"
        />
      </div>

      {/* Two-Column Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column: Recent Pending Proofs */}
        <div className="p-5 rounded-2xl bg-space-900 border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-orbitron font-bold text-sm text-white">
                Pending Proof Submissions
              </h3>
            </div>

            <button
              onClick={() => onNavigateTab('proofs')}
              className="flex items-center gap-1 text-xs font-mono text-mars-400 hover:text-mars-300 transition-colors cursor-pointer"
            >
              <span>View All ({stats.pendingProofs})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProofs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-mono text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
              <p>No donation proofs currently pending review.</p>
              <p className="text-[11px] text-slate-500 mt-1">All donor pledges are up to date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProofs.slice(0, 4).map((proof, pIdx) => (
                <div 
                  key={proof.id || `proof-${pIdx}`} 
                  className="p-3.5 rounded-xl bg-space-850/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/15 transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate">
                        {proof.donorName || 'Donor'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/30">
                        {proof.donorBloodGroup || proof.requestedBloodGroup || 'Blood'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        • {proof.unitsPledged || 1} Unit(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400 truncate">
                      <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{proof.hospitalName || 'Hospital'}</span>
                      <span>• For: {proof.patientName || 'Patient'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onOpenProofPhoto(proof)}
                      className="p-1.5 rounded-lg bg-space-800 hover:bg-space-750 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      title="Inspect Photo Document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onReviewPendingProofs ? onReviewPendingProofs(proof) : onNavigateTab('proofs')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Review Pending Proof in Proof Review Tab"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Review Pending Proof</span>
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => onReviewPendingProofs ? onReviewPendingProofs() : onNavigateTab('proofs')}
                className="w-full mt-2 py-2 rounded-xl text-xs font-mono font-semibold bg-space-850 hover:bg-space-800 text-amber-300 hover:text-white border border-amber-500/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Review Pending Proofs ({stats.pendingProofs})</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Emergency Blood Requests Summary */}
        <div className="p-5 rounded-2xl bg-space-900 border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-mars-500/10 text-mars-400 border border-mars-500/20">
                <Heart className="w-4 h-4 fill-mars-500/30" />
              </div>
              <h3 className="font-orbitron font-bold text-sm text-white">
                Urgent Blood Calls Summary
              </h3>
            </div>

            <button
              onClick={() => onNavigateTab('requests')}
              className="flex items-center gap-1 text-xs font-mono text-mars-400 hover:text-mars-300 transition-colors cursor-pointer"
            >
              <span>Manage Requests ({stats.activeRequests})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentRequests.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-mono text-xs">
              <Heart className="w-8 h-8 text-mars-400 mx-auto mb-2 opacity-60" />
              <p>No active emergency blood requests recorded.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests.slice(0, 4).map((req, rIdx) => {
                const isCritical = (req.urgency_level || req.urgency) === 'CRITICAL';
                const isExpired = req.is_expired || req.status === 'EXPIRED' || (Boolean(req.required_by) && new Date(req.required_by).getTime() < Date.now() && req.status !== 'FULFILLED' && req.status !== 'CANCELLED');
                const isPending = req.approval_status === 'PENDING';
                const isRejected = req.approval_status === 'REJECTED';
                const isCancelled = req.status === 'CANCELLED';
                const isFulfilled = req.status === 'FULFILLED';

                const badgeConfig = isExpired
                  ? { label: 'EXPIRED', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
                  : isPending
                  ? { label: 'PENDING', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' }
                  : isRejected
                  ? { label: 'REJECTED', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
                  : isCancelled
                  ? { label: 'CANCELLED', cls: 'bg-slate-700/40 text-slate-400 border-slate-600/30' }
                  : isFulfilled
                  ? { label: 'FULFILLED', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' }
                  : { label: 'OPEN', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };

                return (
                  <div 
                    key={req.id || `req-${rIdx}`} 
                    className="p-3.5 rounded-xl bg-space-850/80 border border-white/5 flex items-center justify-between gap-3 hover:border-white/15 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white truncate">
                          {req.patient_name || req.patientName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/30">
                          {req.blood_group || req.bloodGroup}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}>
                          {req.urgency_level || req.urgency || 'URGENT'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400 truncate">
                        <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{req.hospital_name || req.hospitalName} ({req.hospital_city || req.hospitalCity || 'City'})</span>
                        <span>• {req.units_requested || req.unitsRequested || 1} Unit(s)</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeConfig.cls}`}>
                        {badgeConfig.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
