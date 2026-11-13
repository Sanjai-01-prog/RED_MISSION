import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Search, 
  Filter, 
  Plus, 
  RefreshCw, 
  Building2, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Check, 
  X,
  Lock,
  Layers,
  Users,
  ShieldCheck
} from 'lucide-react';
import { requestApi } from '../../../services/api';
import CreateRequestModal from './CreateRequestModal';
import { formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../../utils/donorAvailability';

const BLOOD_GROUPS = ['ALL', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function AdminRequestsTab({
  requests = [],
  loading = false,
  onRefreshRequests,
  onRequestCreated,
  currentAdmin,
  initialOpenCreate = false,
  onConsumeInitialOpenCreate
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'FULFILLED'
  const [urgencyFilter, setUrgencyFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'URGENT' | 'STANDARD'
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(Boolean(initialOpenCreate));
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [matchingRequestId, setMatchingRequestId] = useState(null);
  const [matchingData, setMatchingData] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [eligibleOnlyFilter, setEligibleOnlyFilter] = useState(false);
  const [selectingDonorKey, setSelectingDonorKey] = useState(null);

  const permissions = currentAdmin?.permissions || [];
  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  
  // RBAC: ADMIN (MANAGE_REQUESTS) and SUPER_ADMIN can create/manage requests. MODERATOR is read-only.
  const canManageRequests = permissions.includes('MANAGE_REQUESTS') || adminRole === 'ADMIN' || adminRole === 'SUPER_ADMIN';

  useEffect(() => {
    if (initialOpenCreate && canManageRequests) {
      setIsCreateModalOpen(true);
      if (onConsumeInitialOpenCreate) {
        onConsumeInitialOpenCreate();
      }
    }
  }, [initialOpenCreate, canManageRequests, onConsumeInitialOpenCreate]);

  const loadMatchingDonors = async (requestId, eligibleOnly = eligibleOnlyFilter) => {
    setMatchingLoading(true);
    try {
      const res = await requestApi.getMatchingDonors(requestId, { eligibleOnly }, 'admin');
      if (res?.success) {
        setMatchingData(res);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res?.error || 'Failed to evaluate compatible emergency donors.'
        });
      }
    } catch (err) {
      console.error('Matching donors error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error fetching compatible donors.'
      });
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleToggleMatchingPanel = async (request) => {
    if (matchingRequestId === request.id) {
      setMatchingRequestId(null);
      setMatchingData(null);
      return;
    }
    setMatchingRequestId(request.id);
    setMatchingData(null);
    await loadMatchingDonors(request.id, eligibleOnlyFilter);
  };

  const handleSelectDonorForDispatch = async (requestObj, donor) => {
    if (!canManageRequests || !donor.selectable) return;
    const key = donor.userId || donor.publicReference || donor.id;
    setSelectingDonorKey(key);
    setFeedbackMessage(null);
    try {
      const res = await requestApi.selectDonor(
        requestObj.id,
        { donorUserId: donor.userId || donor.id },
        'admin'
      );
      if (res?.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Donor ${donor.fullName || donor.displayName} (${donor.bloodGroup}) selected & reserved for ${requestObj.patient_name || requestObj.patientName}.`
        });
        window.dispatchEvent(new CustomEvent('pledge-updated'));
        if (onRefreshRequests) onRefreshRequests();
        await loadMatchingDonors(requestObj.id, eligibleOnlyFilter);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res?.error || 'Unable to assign selected donor.'
        });
        await loadMatchingDonors(requestObj.id, eligibleOnlyFilter);
      }
    } catch (err) {
      console.error('Select donor error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error selecting donor for dispatch.'
      });
    } finally {
      setSelectingDonorKey(null);
    }
  };

  // Approve request handler
  const handleApproveRequest = async (request) => {
    if (!canManageRequests) return;
    setActionLoadingId(request.id);
    setFeedbackMessage(null);

    try {
      const res = await requestApi.approveRequest(request.id);
      if (res?.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Blood request for patient ${request.patient_name || request.patientName} approved and published.`
        });
        if (onRefreshRequests) onRefreshRequests();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res?.error || 'Failed to approve blood request.'
        });
      }
    } catch (err) {
      console.error('Approve request error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error approving blood request.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject request handler
  const handleRejectRequest = async (request) => {
    if (!canManageRequests) return;
    const reason = window.prompt(
      `Enter reason for rejecting blood request [${request.id}] (optional):`,
      'Declined during administrative hospital verification.'
    );
    if (reason === null) return; // User cancelled prompt

    setActionLoadingId(request.id);
    setFeedbackMessage(null);

    try {
      const res = await requestApi.rejectRequest(request.id, reason);
      if (res?.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Blood request for patient ${request.patient_name || request.patientName} has been rejected.`
        });
        if (onRefreshRequests) onRefreshRequests();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res?.error || 'Failed to reject blood request.'
        });
      }
    } catch (err) {
      console.error('Reject request error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error rejecting blood request.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle status handler
  const handleToggleStatus = async (request) => {
    if (!canManageRequests) return;

    const currentStatus = (request.status || 'OPEN').toUpperCase();
    const nextStatus = currentStatus === 'OPEN' ? 'FULFILLED' : 'OPEN';

    setActionLoadingId(request.id);
    setFeedbackMessage(null);

    try {
      const res = await requestApi.updateStatus(request.id, nextStatus);
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Request for patient ${request.patient_name || request.patientName} marked as ${nextStatus}.`
        });
        if (onRefreshRequests) onRefreshRequests();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'Failed to update request status.'
        });
      }
    } catch (err) {
      console.error('Update status error:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Network error updating request status.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const rawStatus = (req.status || 'OPEN').toUpperCase();
    const rawUrgencyVal = (req.urgency_level || req.urgency || 'URGENT').toUpperCase();
    const urgencyVal = rawUrgencyVal === 'NORMAL' ? 'STANDARD' : rawUrgencyVal;
    const bgVal = (req.blood_group || req.bloodGroup || '').toUpperCase();

    const isCancelled = rawStatus === 'CANCELLED';
    const isFulfilled = rawStatus === 'FULFILLED' || (Number(req.units_requested || 0) > 0 && Number(req.units_fulfilled || 0) >= Number(req.units_requested || 0));
    const isExpired = Boolean(req.is_expired) || (!isCancelled && !isFulfilled && req.required_by && !isNaN(new Date(req.required_by).getTime()) && new Date(req.required_by).getTime() < Date.now());
    const isPending = (req.approval_status || '').toUpperCase() === 'PENDING' && !isExpired && !isCancelled && !isFulfilled;
    const isApproved = (req.approval_status || (req.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase() === 'APPROVED' && !isExpired && !isCancelled;

    // Status filter tabs
    if (statusFilter === 'PENDING' && !isPending) return false;
    if (statusFilter === 'OPEN' && (!isApproved || isFulfilled || isExpired)) return false;
    if (statusFilter === 'FULFILLED' && !isFulfilled) return false;
    if (statusFilter === 'EXPIRED' && !isExpired) return false;

    // Urgency filter
    if (urgencyFilter !== 'ALL' && urgencyVal !== urgencyFilter) return false;

    // Blood group filter
    if (bloodGroupFilter !== 'ALL' && bgVal !== bloodGroupFilter) return false;

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const patientName = (req.patient_name || req.patientName || '').toLowerCase();
    const hospitalName = (req.hospital_name || req.hospitalName || '').toLowerCase();
    const hospitalCity = (req.hospital_city || req.hospitalCity || '').toLowerCase();
    const contactPerson = (req.contact_person || req.contactPerson || '').toLowerCase();
    const phone = (req.contact_phone || req.contactPhone || '').toLowerCase();

    return (
      patientName.includes(query) ||
      hospitalName.includes(query) ||
      hospitalCity.includes(query) ||
      contactPerson.includes(query) ||
      phone.includes(query) ||
      bgVal.toLowerCase().includes(query)
    );
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

      {/* Control Bar: Filters, Search, and Create Action */}
      <div className="space-y-3 p-4 rounded-2xl bg-space-900 border border-white/10">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Status Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-space-950/80 border border-white/5 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Requests' },
              { id: 'PENDING', label: 'Pending Review' },
              { id: 'OPEN', label: 'Approved / Active' },
              { id: 'FULFILLED', label: 'Fulfilled' },
              { id: 'EXPIRED', label: 'Expired' }
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
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

          {/* Search & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, hospital, city..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-space-950 border border-white/10 text-xs font-mono text-white placeholder-slate-500 focus:border-mars-500 focus:outline-none"
              />
            </div>

            <button
              onClick={onRefreshRequests}
              disabled={loading}
              className="p-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Refresh Requests"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mars-400' : ''}`} />
            </button>

            {/* Create Request Action (ADMIN & SUPER_ADMIN Only) */}
            {canManageRequests ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white hover:brightness-110 shadow-md shadow-mars-600/30 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Blood Request</span>
              </button>
            ) : (
              <div 
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-mono bg-space-950 border border-white/5 text-slate-500 cursor-not-allowed"
                title="Permission MANAGE_REQUESTS required to publish requests (Moderator is read-only)"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Read-Only Monitor</span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Filter Dropdowns: Urgency & Blood Group */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Urgency:</span>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-space-950 border border-white/10 text-slate-200 text-xs focus:border-mars-500 focus:outline-none"
            >
              <option value="ALL">All Urgencies</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="URGENT">Urgent Only</option>
              <option value="STANDARD">Standard Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Blood Group:</span>
            <select
              value={bloodGroupFilter}
              onChange={(e) => setBloodGroupFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-space-950 border border-white/10 text-slate-200 text-xs focus:border-mars-500 focus:outline-none"
            >
              {BLOOD_GROUPS.map(bg => (
                <option key={bg} value={bg}>{bg === 'ALL' ? 'All Groups' : bg}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-[11px] text-slate-500">
            Showing <strong className="text-slate-300">{filteredRequests.length}</strong> of {requests.length} requests
          </div>
        </div>
      </div>

      {/* Emergency Requests List */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-space-900 border border-white/10 text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-mars-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono">Synchronizing live emergency blood requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-space-900 border border-white/10 text-slate-400">
          <Heart className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="font-orbitron font-bold text-sm text-white mb-1">
            No Blood Requests Match Filters
          </h4>
          <p className="text-xs font-mono text-slate-500">
            Try adjusting your status, urgency, or blood group filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req, reqIdx) => {
            const rawStatus = (req.status || 'OPEN').toUpperCase();
            const rawUrgency = (req.urgency_level || req.urgency || 'URGENT').toUpperCase();
            const urgency = rawUrgency === 'NORMAL' ? 'STANDARD' : rawUrgency;
            const isCritical = urgency === 'CRITICAL';
            const isActionLoading = actionLoadingId === req.id;

            const isCancelled = rawStatus === 'CANCELLED';
            const isFulfilled = rawStatus === 'FULFILLED' || (Number(req.units_requested || 0) > 0 && Number(req.units_fulfilled || 0) >= Number(req.units_requested || 0));
            const isExpired = Boolean(req.is_expired) || (!isCancelled && !isFulfilled && req.required_by && !isNaN(new Date(req.required_by).getTime()) && new Date(req.required_by).getTime() < Date.now());
            const rawApproval = (req.approval_status || (req.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase();
            const isPending = rawApproval === 'PENDING' && !isExpired && !isCancelled && !isFulfilled;
            const isRejected = rawApproval === 'REJECTED';
            const isApproved = rawApproval === 'APPROVED';
            const isOpen = isApproved && rawStatus === 'OPEN' && !isExpired && !isFulfilled;

            return (
              <div
                key={req.id || `req-${reqIdx}`}
                className="p-4 sm:p-5 rounded-2xl bg-space-900 border border-white/10 hover:border-white/20 transition-all space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Request Main Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-orbitron font-bold text-sm text-white truncate">
                        {req.patient_name || req.patientName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/30">
                        {req.blood_group || req.bloodGroup}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}>
                        {urgency}
                      </span>

                      {/* Truthful Lifecycle Status Badge */}
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                          EXPIRED
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700/40 text-slate-400 border border-slate-600/30">
                          CANCELLED
                        </span>
                      ) : isFulfilled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                          FULFILLED
                        </span>
                      ) : isPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
                          PENDING REVIEW
                        </span>
                      ) : isRejected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          REJECTED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          APPROVED
                        </span>
                      )}

                      {req.created_by_role && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-white/5 text-slate-300 border border-white/10">
                          By {req.created_by_role}
                        </span>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">Hospital: <strong className="text-slate-200">{req.hospital_name || req.hospitalName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">City: <span className="text-slate-300">{req.hospital_city || req.hospitalCity || 'N/A'}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Layers className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>Units: <strong className="text-mars-400">{req.units_requested || req.unitsRequested || 1} Needed</strong> ({req.units_fulfilled || req.unitsFulfilled || 0} Fulfilled)</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">Contact: <span className="text-slate-300">{req.contact_person || req.contactPerson || 'N/A'}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">Phone: <span className="text-slate-300">{req.contact_phone || req.contactPhone || 'N/A'}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">Required By: <span className={`${isExpired ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>{req.required_by || req.requiredBy ? new Date(req.required_by || req.requiredBy).toLocaleDateString() : 'Immediate'}{isExpired ? ' (Expired)' : ''}</span></span>
                      </div>
                    </div>

                    {/* Notes / Clinical condition */}
                    {(req.clinical_condition || req.clinicalCondition || req.notes) && (
                      <p className="text-[11px] font-mono text-slate-400 italic">
                        Note: {req.clinical_condition || req.clinicalCondition || req.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
                    {isExpired ? (
                      <span className="text-[11px] font-mono text-slate-500 px-2.5 py-1 bg-space-950 rounded-lg border border-white/5">
                        Deadline Expired
                      </span>
                    ) : isPending && canManageRequests ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req)}
                          disabled={isActionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                          title="Verify and Approve Blood Request"
                        >
                          {isActionLoading ? (
                            <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req)}
                          disabled={isActionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                          title="Reject Blood Request"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : isOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleMatchingPanel(req)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border ${
                            matchingRequestId === req.id
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-space-850 hover:bg-space-800 text-slate-200 border-white/10'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{matchingRequestId === req.id ? 'Hide Matches' : 'Match Donors'}</span>
                        </button>

                        {canManageRequests && (
                          <button
                            onClick={() => handleToggleStatus(req)}
                            disabled={isActionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30"
                            title="Mark as Fulfilled"
                          >
                            {isActionLoading ? (
                              <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Mark Fulfilled</span>
                          </button>
                        )}
                      </>
                    ) : isFulfilled && canManageRequests ? (
                      <button
                        onClick={() => handleToggleStatus(req)}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/30"
                        title="Re-open Call"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Re-open Call</span>
                      </button>
                    ) : (
                      <span 
                        className="text-[11px] font-mono text-slate-500 px-2 py-1 bg-space-950 rounded-lg border border-white/5"
                        title="Moderator or read-only view"
                      >
                        Status: {req.mapped_status || req.status_category || rawStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expandable Matching Donors Panel with 3-Month Cooldown Enforcement */}
                {matchingRequestId === req.id && (
                  <div className="pt-4 border-t border-white/10 space-y-3 text-xs font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-orbitron font-bold text-white text-xs">
                          Compatible Voluntary Donors ({req.blood_group || req.bloodGroup})
                        </span>
                        {matchingData && (
                          <>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                              {matchingData.eligibleCount} Eligible
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                              {matchingData.cooldownCount} In 3-Month Cooldown
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !eligibleOnlyFilter;
                          setEligibleOnlyFilter(next);
                          loadMatchingDonors(req.id, next);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-space-900 border border-white/10 text-slate-300 hover:text-white text-[11px] cursor-pointer self-start sm:self-auto"
                      >
                        {eligibleOnlyFilter ? 'Showing: Eligible Only' : 'Showing: All Compatible (Incl. Cooldown)'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>{matchingData?.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}</span>
                    </div>

                    {matchingLoading ? (
                      <div className="p-4 text-center text-slate-400">Evaluating donor cooldown &amp; compatibility...</div>
                    ) : !matchingData || matchingData.donors.length === 0 ? (
                      <div className="p-4 text-center rounded-xl bg-space-950/60 border border-white/5 text-slate-400">
                        No compatible voluntary donors found under current filter.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {matchingData.donors.map((d, dIdx) => {
                          const dKey = d.userId || d.publicReference || d.id || `donor-${dIdx}`;
                          const reavailFormatted = formatCalendarDate(d.reavailableDate);
                          const cooldownNoteId = `admin-cooldown-${req.id}-${dKey}`;
                          return (
                            <div
                              key={dKey}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                d.isInCooldown
                                  ? 'bg-amber-500/5 border-amber-500/25'
                                  : d.selectable
                                  ? 'bg-space-900/80 border-white/10'
                                  : 'bg-space-950/60 border-white/5 opacity-75'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-white truncate">
                                    {d.fullName || d.displayName}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-mars-500/20 text-mars-300 border border-mars-500/30 text-[10px] font-bold">
                                    {d.bloodGroup}
                                  </span>
                                  {d.isInCooldown ? (
                                    <span
                                      id={cooldownNoteId}
                                      className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                                    >
                                      Temporarily Unavailable • Cooldown until {reavailFormatted || d.reavailableDate}
                                    </span>
                                  ) : d.isAvailable ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                      Available
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-300 border border-slate-600/30 text-[10px]">
                                      {d.availabilityLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {d.city} {d.cityMatch ? '• Same City' : ''} • {d.totalDonationsCount || 0} Verified
                                  {d.isInCooldown && d.daysRemaining > 0 ? ` • ${d.daysRemaining}d remaining` : ''}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={!canManageRequests || !d.selectable || selectingDonorKey === dKey}
                                aria-disabled={!d.selectable ? 'true' : undefined}
                                aria-describedby={d.isInCooldown ? cooldownNoteId : undefined}
                                onClick={() => handleSelectDonorForDispatch(req, d)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border shrink-0 transition-all ${
                                  d.selectable && canManageRequests
                                    ? 'bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border-emerald-500/40 cursor-pointer'
                                    : 'bg-space-950 border-white/10 text-slate-500 cursor-not-allowed opacity-70'
                                }`}
                              >
                                {selectingDonorKey === dKey
                                  ? 'Assigning...'
                                  : d.alreadyPledged
                                  ? 'Pledged'
                                  : d.isInCooldown
                                  ? 'In Cooldown'
                                  : d.selectable
                                  ? 'Select Donor'
                                  : 'Unavailable'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Request Modal */}
      <CreateRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentAdmin={currentAdmin}
        onRequestCreated={(newReq) => {
          if (onRequestCreated) onRequestCreated(newReq);
          if (onRefreshRequests) onRefreshRequests();
        }}
      />

    </div>
  );
}
