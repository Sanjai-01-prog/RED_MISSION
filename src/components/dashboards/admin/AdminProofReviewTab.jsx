import React, { useState } from 'react';
import { 
  FileCheck2, 
  Search, 
  Filter, 
  Eye, 
  Check, 
  X, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  AlertTriangle,
  RefreshCw,
  Lock
} from 'lucide-react';
import { proofApi, certificateApi } from '../../../services/api';
import { formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../../utils/donorAvailability';

export default function AdminProofReviewTab({
  proofs = [],
  loading = false,
  onRefreshProofs,
  onOpenProofPhoto,
  onViewCertificate,
  currentAdmin,
  activeFilter = 'PENDING',
  onFilterChange
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rejection modal state
  const [rejectingProof, setRejectingProof] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Approval confirmation modal state
  const [approvingProof, setApprovingProof] = useState(null);

  // Certificate lookup loading state by pledgeId
  const [certLoadingPledgeId, setCertLoadingPledgeId] = useState(null);

  const permissions = currentAdmin?.permissions || [];
  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  const canVerifyProofs = permissions.includes('VERIFY_PROOFS') || adminRole === 'ADMIN' || adminRole === 'SUPER_ADMIN';
  const canViewCertificates = permissions.includes('VIEW_CERTIFICATES') || adminRole === 'SUPER_ADMIN';

  // Approve action
  const handleConfirmApprove = async () => {
    if (!approvingProof) return;
    setReviewActionLoading(true);
    setFeedbackMessage(null);

    try {
      const res = await proofApi.reviewProof(approvingProof.id, 'APPROVE');
      if (res.success) {
        const reavailStr = res.donorAvailability?.reavailableDate
          ? formatCalendarDate(res.donorAvailability.reavailableDate)
          : null;
        setFeedbackMessage({
          type: 'success',
          text: reavailStr
            ? `Proof for donor ${approvingProof.donorName || 'donor'} approved! Certificate ${res.certificateId || ''} issued. 3-month donor cooldown active until ${reavailStr}.`
            : `Proof for donor ${approvingProof.donorName || 'donor'} approved successfully! Certificate ${res.certificateId || ''} has been issued.`
        });
        setApprovingProof(null);
        window.dispatchEvent(new CustomEvent('proof-reviewed'));
        if (onRefreshProofs) onRefreshProofs();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'Failed to approve donation proof.'
        });
      }
    } catch (err) {
      console.error('Approve proof error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error approving donation proof.'
      });
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Reject action
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingProof || !rejectionReason.trim()) return;

    setReviewActionLoading(true);
    setFeedbackMessage(null);

    try {
      const res = await proofApi.reviewProof(rejectingProof.id, 'REJECT', rejectionReason.trim());
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Proof rejected. Donor notified with rejection reason: "${rejectionReason.trim()}".`
        });
        setRejectingProof(null);
        setRejectionReason('');
        if (onRefreshProofs) onRefreshProofs();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'Failed to record rejection.'
        });
      }
    } catch (err) {
      console.error('Reject proof error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error recording proof rejection.'
      });
    } finally {
      setReviewActionLoading(false);
    }
  };

  // View certificate action: performs API lookup using actual proof.pledgeId
  const handleViewCertificateClick = async (proof) => {
    if (!proof?.pledgeId) {
      setFeedbackMessage({
        type: 'error',
        text: 'Pledge ID is missing for this donation proof record.'
      });
      return;
    }

    setCertLoadingPledgeId(proof.pledgeId);
    setFeedbackMessage(null);

    try {
      // Lookup certificate using the actual pledgeId on the backend endpoint GET /api/certificates/:pledgeId
      const res = await certificateApi.getCertificate(proof.pledgeId, 'admin');
      if (res.success && res.certificate) {
        if (onViewCertificate) {
          onViewCertificate(res.certificate);
        }
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'Clinical certificate record not found for this pledge.'
        });
      }
    } catch (err) {
      console.error('Certificate retrieval error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error retrieving certificate record from secure registry.'
      });
    } finally {
      setCertLoadingPledgeId(null);
    }
  };

  // Filter & Search proofs
  const filteredProofs = proofs.filter((p) => {
    const status = (p.status || p.proofStatus || 'PENDING').toUpperCase();
    const matchesFilter = activeFilter === 'all' || status === activeFilter.toUpperCase();

    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesFilter;

    const donorName = (p.donorName || '').toLowerCase();
    const donorPhone = (p.donorMobile || '').toLowerCase();
    const donorEmail = (p.donorEmail || '').toLowerCase();
    const hospital = (p.hospitalName || '').toLowerCase();
    const patient = (p.patientName || '').toLowerCase();
    const bloodGroup = (p.requestedBloodGroup || p.donorBloodGroup || '').toLowerCase();

    const matchesSearch = 
      donorName.includes(query) ||
      donorPhone.includes(query) ||
      donorEmail.includes(query) ||
      hospital.includes(query) ||
      patient.includes(query) ||
      bloodGroup.includes(query);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in slide-in-from-top-2 ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Control Bar: Tabs, Search, and Live Refresh */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-space-900 border border-white/10">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-space-950/80 border border-white/5 overflow-x-auto">
          {[
            { id: 'PENDING', label: 'Pending Review' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'all', label: 'All Proofs' }
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-mars-600 text-white font-semibold shadow-md shadow-mars-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar & Sync Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donor, patient, hospital..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-space-950 border border-white/10 text-xs font-mono text-white placeholder-slate-500 focus:border-mars-500 focus:outline-none"
            />
          </div>

          <button
            onClick={onRefreshProofs}
            disabled={loading}
            className="p-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Refresh Proofs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mars-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Proof Submissions Table / Cards */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-space-900 border border-white/10 text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-mars-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono">Loading donation proofs from clinical telemetry...</p>
        </div>
      ) : filteredProofs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-space-900 border border-white/10 text-slate-400">
          <FileCheck2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="font-orbitron font-bold text-sm text-white mb-1">
            No Donation Proofs Found
          </h4>
          <p className="text-xs font-mono text-slate-500">
            {searchQuery 
              ? 'No proofs match your current search query.' 
              : `There are currently no donation proofs in the '${activeFilter}' queue.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProofs.map((proof) => {
            const status = (proof.status || proof.proofStatus || 'PENDING').toUpperCase();
            const isApproved = status === 'APPROVED';
            const isRejected = status === 'REJECTED';
            const isPending = status === 'PENDING';

            return (
              <div 
                key={proof.id}
                className="p-4 sm:p-5 rounded-2xl bg-space-900 border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Proof Core Information */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-orbitron font-bold text-sm text-white truncate">
                      {proof.donorName || 'Anonymous Donor'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/30">
                      {proof.donorBloodGroup || proof.requestedBloodGroup || 'Blood Group'}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">
                      {proof.unitsPledged || 1} Unit(s)
                    </span>
                    
                    {/* Status Pill */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isApproved 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : isRejected
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      {status}
                    </span>

                    {proof.donorAvailability?.isInCooldown && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                        Cooldown until {formatCalendarDate(proof.donorAvailability.reavailableDate) || proof.donorAvailability.reavailableDate}
                      </span>
                    )}
                  </div>

                  {/* Donor & Patient Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">Hospital: <strong className="text-slate-200">{proof.hospitalName || 'N/A'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">Patient: <strong className="text-slate-200">{proof.patientName || 'N/A'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">Phone: <span className="text-slate-300">{proof.donorMobile || 'N/A'}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">Email: <span className="text-slate-300">{proof.donorEmail || 'N/A'}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">Submitted: <span className="text-slate-300">{proof.submittedAt ? new Date(proof.submittedAt).toLocaleDateString() : 'Recent'}</span></span>
                    </div>
                    {proof.reviewedByAdminName && (
                      <div className="flex items-center gap-1.5 truncate text-slate-400 text-[11px]">
                        <span>Reviewed by: <span className="text-amber-400">{proof.reviewedByAdminName}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Rejection Note Display if rejected */}
                  {isRejected && proof.rejectionReason && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400 mt-0.5" />
                      <span>Rejection Reason: <strong>{proof.rejectionReason}</strong></span>
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
                  {/* Photo Preview Button */}
                  <button
                    onClick={() => onOpenProofPhoto(proof)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-space-850 hover:bg-space-800 text-slate-200 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title="Inspect Proof Document"
                  >
                    <Eye className="w-3.5 h-3.5 text-mars-400" />
                    <span>View Photo</span>
                  </button>

                  {/* Approve Action (Pending or Re-evaluating) */}
                  {canVerifyProofs && (isPending || isRejected) && (
                    <button
                      onClick={() => setApprovingProof(proof)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                      title="Approve Donation & Issue Certificate"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Approve</span>
                    </button>
                  )}

                  {/* Reject Action (Pending) */}
                  {canVerifyProofs && isPending && (
                    <button
                      onClick={() => {
                        setRejectingProof(proof);
                        setRejectionReason('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      title="Reject Proof with Reason"
                    >
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      <span>Reject</span>
                    </button>
                  )}

                  {/* View Certificate (Approved Only, requires VIEW_CERTIFICATES) */}
                  {isApproved && (
                    canViewCertificates ? (
                      <button
                        onClick={() => handleViewCertificateClick(proof)}
                        disabled={certLoadingPledgeId === proof.pledgeId}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        title="View Official Certificate"
                      >
                        {certLoadingPledgeId === proof.pledgeId ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                        ) : (
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>View Certificate</span>
                      </button>
                    ) : (
                      <div 
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-mono bg-space-950 border border-white/5 text-slate-500 cursor-not-allowed"
                        title="Permission VIEW_CERTIFICATES required (Not granted to Moderator)"
                      >
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>Certificate Locked</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Confirmation Dialog */}
      {approvingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-space-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-orbitron font-bold text-sm text-white">
                  Approve Donation Proof
                </h4>
                <p className="text-xs font-mono text-slate-400">
                  Confirmation required for clinical certificate issuance.
                </p>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-300 leading-relaxed bg-space-950/60 p-3 rounded-xl border border-white/5">
              Are you sure you want to approve the donation proof submitted by <strong className="text-white">{approvingProof.donorName}</strong> for hospital <strong className="text-white">{approvingProof.hospitalName}</strong>? This action will generate an official QR-verified Clinical Lifesaver Certificate and automatically place the donor in a <strong className="text-amber-300">3-month temporary recovery cooldown</strong>.
            </p>
            <p className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl leading-relaxed">
              {MEDICAL_COOLDOWN_NOTE}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovingProof(null)}
                disabled={reviewActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-mono bg-space-850 hover:bg-space-800 text-slate-300 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={reviewActionLoading}
                className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5"
              >
                {reviewActionLoading ? 'Issuing Certificate...' : 'Approve & Issue Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Dialog with Mandatory Reason */}
      {rejectingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-space-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-orbitron font-bold text-sm text-white">
                  Reject Donation Proof
                </h4>
                <p className="text-xs font-mono text-slate-400">
                  Mandatory rejection reason required for donor re-submission.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Hospital donation certificate is illegible or missing official doctor stamp."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-rose-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingProof(null);
                    setRejectionReason('');
                  }}
                  disabled={reviewActionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-mono bg-space-850 hover:bg-space-800 text-slate-300 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewActionLoading || !rejectionReason.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                >
                  {reviewActionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
