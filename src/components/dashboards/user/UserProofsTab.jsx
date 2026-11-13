import React from 'react';
import { FileCheck2, Clock, CheckCircle2, XCircle, AlertCircle, Upload, Award, Building2, Calendar } from 'lucide-react';
import DashboardTable from '../shared/DashboardTable';
import StatusBadge from '../shared/StatusBadge';

export default function UserProofsTab({
  pledges = [],
  loading = false,
  onOpenProofModal,
  onViewCertificate,
  onNavigateTab
}) {
  // Pledges that have an uploaded proof or are awaiting review
  const proofItems = pledges.filter(p => 
    p.proof != null || p.displayStatus === 'Under Admin Review' || p.displayStatus === 'Rejected' || p.displayStatus === 'Approved'
  );

  return (
    <div className="space-y-6">
      
      {/* Informational Guidance Banner */}
      <div className="card-glass rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
          <FileCheck2 className="w-5 h-5" />
        </div>
        <div className="text-xs font-mono space-y-1">
          <h4 className="font-bold text-white">
            Medical Verification Process
          </h4>
          <p className="text-slate-300">
            Uploaded donation slips and hospital certificates are manually verified by clinical administrators. Once approved, your official NBTC lifesaver certificate is generated instantly.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DashboardTable
        title="Donation Proof Submissions"
        subtitle="Tracking the clinical verification status of your uploaded proofs"
        loading={loading}
        isEmpty={proofItems.length === 0}
        emptyMessage="No donation proofs submitted yet"
        emptySubtext="When you fulfill an emergency pledge at a hospital, upload your donation slip to initiate verification."
        emptyAction={
          <button
            onClick={() => onNavigateTab('pledges')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-mars-600 hover:bg-mars-500 text-white transition-colors"
          >
            Go to My Pledges
          </button>
        }
        columns={[
          { label: 'Hospital & Patient' },
          { label: 'Submitted Date' },
          { label: 'Review Status' },
          { label: 'Clinical Feedback / Notes' },
          { label: 'Actions', className: 'text-right' }
        ]}
      >
        {proofItems.map((pledge, pIdx) => {
          const proof = pledge.proof;
          const isPending = pledge.displayStatus === 'Under Admin Review' || proof?.status === 'PENDING';
          const isApproved = pledge.displayStatus === 'Approved' || proof?.status === 'APPROVED';
          const isRejected = pledge.displayStatus === 'Rejected' || proof?.status === 'REJECTED';

          return (
            <tr key={pledge.id || proof?.id || `proof-${pIdx}`} className="hover:bg-white/5 transition-colors">
              
              {/* Hospital & Patient */}
              <td className="py-3.5 px-4">
                <div className="font-semibold text-white">
                  {pledge.hospitalName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Patient: {pledge.patientName} • Pledge: {pledge.id}
                </div>
              </td>

              {/* Submitted Date */}
              <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {proof?.submittedAt 
                      ? new Date(proof.submittedAt).toLocaleDateString()
                      : pledge.reservedAt 
                      ? new Date(pledge.reservedAt).toLocaleDateString()
                      : 'Recently'}
                  </span>
                </div>
              </td>

              {/* Review Status */}
              <td className="py-3.5 px-4">
                <StatusBadge status={pledge.displayStatus} />
              </td>

              {/* Feedback / Notes */}
              <td className="py-3.5 px-4 max-w-xs">
                {isRejected ? (
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{proof?.rejectionReason || 'Document photo was illegible or incomplete. Please resubmit.'}</span>
                  </div>
                ) : isPending ? (
                  <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Awaiting clinical administrator review</span>
                  </div>
                ) : isApproved ? (
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clinically verified & approved</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="py-3.5 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  {isRejected && (
                    <button
                      onClick={() => onOpenProofModal(pledge)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Resubmit Proof</span>
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => onViewCertificate(pledge)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Certificate</span>
                    </button>
                  )}
                </div>
              </td>

            </tr>
          );
        })}
      </DashboardTable>

    </div>
  );
}
