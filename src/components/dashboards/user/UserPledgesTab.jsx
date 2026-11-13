import React, { useState } from 'react';
import { 
  Heart, 
  Upload, 
  Award, 
  X, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Phone, 
  MapPin, 
  Calendar,
  AlertCircle,
  FileCheck2
} from 'lucide-react';
import DashboardTable from '../shared/DashboardTable';
import StatusBadge from '../shared/StatusBadge';
import { pledgeApi } from '../../../services/api';

export default function UserPledgesTab({
  pledges = [],
  loading = false,
  onRefresh,
  onOpenProofModal,
  onViewCertificate
}) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'APPROVED' | 'CANCELLED'
  const [cancellingPledge, setCancellingPledge] = useState(null);
  const [cancelReason, setCancelReason] = useState('Personal schedule conflict');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Filter pledges
  const filteredPledges = pledges.filter(p => {
    if (filter === 'ACTIVE') {
      return p.rawStatus !== 'CANCELLED' && p.displayStatus !== 'Approved' && p.rawStatus !== 'APPROVED';
    }
    if (filter === 'APPROVED') {
      return p.displayStatus === 'Approved' || p.rawStatus === 'APPROVED' || p.certificate;
    }
    if (filter === 'CANCELLED') {
      return p.rawStatus === 'CANCELLED' || p.displayStatus === 'Cancelled';
    }
    return true;
  });

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingPledge) return;

    setCancelLoading(true);
    setCancelError('');

    try {
      const res = await pledgeApi.cancel(cancellingPledge.id, cancelReason);
      if (res.success) {
        setCancellingPledge(null);
        if (onRefresh) onRefresh();
      } else {
        setCancelError(res.error || 'Failed to cancel pledge.');
      }
    } catch (err) {
      setCancelError('Network error cancelling pledge. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-space-900/60 p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: `All Pledges (${pledges.length})` },
            { id: 'ACTIVE', label: `Active (${pledges.filter(p => p.rawStatus !== 'CANCELLED' && p.displayStatus !== 'Approved').length})` },
            { id: 'APPROVED', label: `Approved (${pledges.filter(p => p.displayStatus === 'Approved').length})` },
            { id: 'CANCELLED', label: `Cancelled (${pledges.filter(p => p.rawStatus === 'CANCELLED').length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap cursor-pointer
                ${filter === tab.id
                  ? 'bg-mars-600 text-white font-semibold shadow-md shadow-mars-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing {filteredPledges.length} commitments
        </div>
      </div>

      {/* Main Table */}
      <DashboardTable
        title="My Blood Pledges & Reservations"
        subtitle="Manage your voluntary units reserved for emergency medical patients"
        loading={loading}
        isEmpty={filteredPledges.length === 0}
        emptyMessage={filter === 'ALL' ? 'No pledges created yet' : `No ${filter.toLowerCase()} pledges found`}
        emptySubtext={filter === 'ALL' ? 'You have not pledged blood for any emergency requests yet.' : 'There are no pledges matching this filter.'}
        columns={[
          { label: 'Pledge Ref & Patient' },
          { label: 'Hospital & Location' },
          { label: 'Blood Group' },
          { label: 'Deadline' },
          { label: 'Status' },
          { label: 'Actions', className: 'text-right' }
        ]}
      >
        {filteredPledges.map((pledge, pIdx) => {
          const isCancelable = pledge.rawStatus === 'PLEDGED' || pledge.rawStatus === 'PROOF_PENDING';
          const canUploadProof = pledge.displayStatus === 'Donation Proof Pending' || pledge.displayStatus === 'Pledged' || pledge.displayStatus === 'Rejected';
          const hasCertificate = Boolean(pledge.certificate || pledge.displayStatus === 'Approved');

          return (
            <tr key={pledge.id || `pledge-${pIdx}`} className="hover:bg-white/5 transition-colors">
              
              {/* Reference & Patient */}
              <td className="py-3.5 px-4">
                <div className="font-bold text-white font-mono text-xs">
                  {pledge.patientName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ref: {pledge.id}
                </div>
                {pledge.urgencyLevel && (
                  <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    pledge.urgencyLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {pledge.urgencyLevel}
                  </span>
                )}
              </td>

              {/* Hospital & Location */}
              <td className="py-3.5 px-4">
                <div className="font-medium text-slate-200">
                  {pledge.hospitalName}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>{pledge.hospitalCity}</span>
                </div>
                {pledge.contactPhone && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-slate-500" />
                    <span>{pledge.contactPhone}</span>
                  </div>
                )}
              </td>

              {/* Blood Group */}
              <td className="py-3.5 px-4">
                <span className="px-2.5 py-1 rounded-full bg-mars-500/20 text-mars-400 font-bold border border-mars-500/30 text-xs font-mono">
                  {pledge.bloodGroup}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">
                  {pledge.unitsPledged} Unit{pledge.unitsPledged > 1 ? 's' : ''}
                </span>
              </td>

              {/* Deadline */}
              <td className="py-3.5 px-4">
                <div className="text-slate-300 text-xs">
                  {pledge.requiredBy ? new Date(pledge.requiredBy).toLocaleDateString() : 'Immediate'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Reserved {new Date(pledge.reservedAt).toLocaleDateString()}
                </div>
              </td>

              {/* Status */}
              <td className="py-3.5 px-4">
                <StatusBadge status={pledge.displayStatus} />
                {pledge.displayStatus === 'Rejected' && pledge.proof?.rejectionReason && (
                  <p className="text-[10px] text-rose-400/90 mt-1 max-w-[150px] truncate" title={pledge.proof.rejectionReason}>
                    Note: {pledge.proof.rejectionReason}
                  </p>
                )}
              </td>

              {/* Actions */}
              <td className="py-3.5 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  
                  {/* Upload / Re-upload Proof Button */}
                  {canUploadProof && (
                    <button
                      onClick={() => onOpenProofModal(pledge)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white shadow-md shadow-mars-600/30 hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{pledge.displayStatus === 'Rejected' ? 'Re-upload Proof' : 'Upload Proof'}</span>
                    </button>
                  )}

                  {/* View Certificate */}
                  {hasCertificate && (
                    <button
                      onClick={() => onViewCertificate(pledge)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Certificate</span>
                    </button>
                  )}

                  {/* Cancel Button */}
                  {isCancelable && (
                    <button
                      onClick={() => {
                        setCancellingPledge(pledge);
                        setCancelError('');
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                      title="Cancel this pledge"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>

            </tr>
          );
        })}
      </DashboardTable>

      {/* Cancel Confirmation Modal */}
      {cancellingPledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md card-glass rounded-3xl border border-rose-500/30 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-orbitron font-bold text-base text-white">
                  Cancel Blood Pledge?
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Ref: {cancellingPledge.id}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Cancelling your pledge will release your reserved blood unit back to the patient pool so another donor can fulfill the request.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-400">
                  Select Reason for Cancellation:
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white text-xs font-mono focus:border-rose-500/50 outline-none"
                >
                  <option value="Personal schedule conflict">Personal schedule conflict</option>
                  <option value="Unable to reach hospital in time">Unable to reach hospital in time</option>
                  <option value="Temporary health concern / unwell">Temporary health concern / unwell</option>
                  <option value="Pledged in error">Pledged in error</option>
                  <option value="Other commitment">Other commitment</option>
                </select>
              </div>

              {cancelError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingPledge(null)}
                  disabled={cancelLoading}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
                >
                  Keep Pledge
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
