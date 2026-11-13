import React, { useState } from 'react';
import { 
  Droplet, 
  Clock, 
  MapPin, 
  Building2, 
  User, 
  Phone, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  RefreshCw, 
  Eye, 
  X,
  FileText,
  Heart
} from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import { requestApi } from '../../../services/api';

const STATUS_CATEGORIES = [
  { id: 'ALL', label: 'All Requests' },
  { id: 'Pending Request', label: 'Pending Request' },
  { id: 'Approved', label: 'Approved' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Successfully Completed', label: 'Successfully Completed' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'Expired', label: 'Expired' },
];

export default function UserRequestsTab({ 
  requests = [], 
  loading = false, 
  onRefresh, 
  onRaiseRequest 
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Exact category counts
  const categoryCounts = {
    'ALL': requests.length,
    'Pending Request': requests.filter(r => (r.mapped_status || r.status_category) === 'Pending Request').length,
    'Approved': requests.filter(r => (r.mapped_status || r.status_category) === 'Approved').length,
    'In Progress': requests.filter(r => (r.mapped_status || r.status_category) === 'In Progress').length,
    'Successfully Completed': requests.filter(r => (r.mapped_status || r.status_category) === 'Successfully Completed').length,
    'Rejected': requests.filter(r => (r.mapped_status || r.status_category) === 'Rejected').length,
    'Cancelled': requests.filter(r => (r.mapped_status || r.status_category) === 'Cancelled').length,
    'Expired': requests.filter(r => (r.mapped_status || r.status_category) === 'Expired').length,
  };

  const filteredRequests = activeFilter === 'ALL'
    ? requests
    : requests.filter(r => (r.mapped_status || r.status_category) === activeFilter);

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this blood request? Any active donor pledges will be released.')) {
      return;
    }
    try {
      setCancellingId(requestId);
      setActionMessage(null);
      const res = await requestApi.cancelUserRequest(requestId);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Blood request cancelled successfully.' });
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest(prev => prev ? { ...prev, mapped_status: 'Cancelled', status: 'CANCELLED' } : null);
        }
        if (onRefresh) onRefresh();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to cancel blood request.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Error communicating with server.' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-space-900/90 to-space-950/90 border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-mars-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-wider mb-2">
              <Droplet className="w-3.5 h-3.5" />
              <span>Blood Need Management</span>
            </div>
            <h2 className="text-2xl font-orbitron font-extrabold text-white">
              My Blood Requests
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Track emergency blood requests you have submitted. Monitor medical verification, matching voluntary donors, and fulfilled units in real time.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh requests"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mars-400' : ''}`} />
            </button>

            {onRaiseRequest && (
              <button
                type="button"
                onClick={onRaiseRequest}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron text-xs font-semibold tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Raise Blood Request</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Status Message */}
        {actionMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-mono flex items-center justify-between ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
          }`}>
            <span>{actionMessage.text}</span>
            <button 
              type="button" 
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-white cursor-pointer ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs with Precise Counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {STATUS_CATEGORIES.map(cat => {
          const count = categoryCounts[cat.id] ?? 0;
          const isActive = activeFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveFilter(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                isActive
                  ? 'bg-mars-600/20 border-mars-500/50 text-white font-bold shadow-sm shadow-mars-600/20'
                  : 'bg-space-900/60 border-white/5 text-slate-400 hover:text-white hover:bg-space-850'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                isActive 
                  ? 'bg-mars-500 text-white' 
                  : count > 0 
                  ? 'bg-white/10 text-slate-300' 
                  : 'bg-white/5 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="p-12 rounded-3xl bg-space-900/40 border border-white/5 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-mars-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Loading your blood requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 rounded-3xl bg-space-900/40 border border-white/5 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-mars-500/10 border border-mars-500/20 text-mars-400 flex items-center justify-center mx-auto">
            <Droplet className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-orbitron font-bold text-base text-white">
              {activeFilter === 'ALL' ? 'No Blood Requests Found' : `No ${activeFilter} Requests`}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {activeFilter === 'ALL'
                ? "You haven't submitted any emergency blood requests yet. When a patient needs blood urgently, submit a request to alert verified donors in the hospital city."
                : `You currently have 0 blood requests in the "${activeFilter}" category.`}
            </p>
          </div>
          {onRaiseRequest && (
            <button
              type="button"
              onClick={onRaiseRequest}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron text-xs font-semibold tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Emergency Request</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.map((req, rIdx) => {
            const statusCat = req.mapped_status || req.status_category || 'Pending Request';
            const canCancel = (statusCat === 'Pending Request' || statusCat === 'Approved') && req.status !== 'CANCELLED' && req.status !== 'FULFILLED' && !req.is_expired && statusCat !== 'Expired';
            const urgencyBg = req.urgency_level === 'CRITICAL'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
              : req.urgency_level === 'URGENT'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-slate-500/15 text-slate-300 border-slate-500/30';

            return (
              <div 
                key={req.id || `req-${rIdx}`}
                className="p-5 rounded-2xl bg-space-900/80 border border-white/10 hover:border-white/20 transition-all space-y-4"
              >
                {/* Header Row: ID, Blood Group, Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-mars-600/30 to-mars-flame/20 border border-mars-500/40 flex items-center justify-center text-white font-orbitron font-extrabold text-sm shrink-0">
                      {req.blood_group}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white tracking-wider">
                          {req.id}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${urgencyBg}`}>
                          {req.urgency_level || 'URGENT'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold mt-0.5">
                        Patient: {req.patient_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={statusCat} size="sm" />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-space-950/60 border border-white/5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Requested</span>
                    <span className="text-white font-bold text-sm">{req.units_requested} Unit(s)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Pledged/Reserved</span>
                    <span className="text-amber-400 font-bold text-sm">{req.units_reserved || 0} Unit(s)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Fulfilled</span>
                    <span className="text-emerald-400 font-bold text-sm">{req.units_fulfilled || 0} Unit(s)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Remaining</span>
                    <span className="text-cyan-400 font-bold text-sm">
                      {req.units_remaining !== undefined ? req.units_remaining : Math.max(0, req.units_requested - (req.units_reserved || 0) - (req.units_fulfilled || 0))} Unit(s)
                    </span>
                  </div>
                </div>

                {/* Hospital & Location */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2 font-mono">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{req.hospital_name}</span>
                    <span className="text-slate-500">•</span>
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{req.hospital_city}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Submitted: {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="text-[11px] font-mono text-slate-400">
                    {req.required_by && (
                      <span>Needed by: {new Date(req.required_by).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="px-3 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelRequest(req.id)}
                        disabled={cancellingId === req.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-mono text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-details-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-space-900 border border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-space-850/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-mars-600/20 border border-mars-500/40 text-mars-400 flex items-center justify-center font-orbitron font-bold">
                  {selectedRequest.blood_group}
                </div>
                <div>
                  <h3 id="request-details-title" className="font-orbitron font-bold text-base text-white">
                    Request {selectedRequest.id}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Patient: {selectedRequest.patient_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-xl bg-space-950/60 hover:bg-space-950 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-slate-400">Current Category:</span>
                <StatusBadge status={selectedRequest.mapped_status || selectedRequest.status_category} size="md" />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-space-950 border border-white/5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Units Requested</span>
                  <span className="text-white font-bold text-sm">{selectedRequest.units_requested} Unit(s)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Units Fulfilled</span>
                  <span className="text-emerald-400 font-bold text-sm">{selectedRequest.units_fulfilled || 0} Unit(s)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Urgency Level</span>
                  <span className="text-amber-400 font-bold text-sm">{selectedRequest.urgency_level || 'URGENT'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Active Pledges</span>
                  <span className="text-cyan-400 font-bold text-sm">{selectedRequest.pledges_count || 0} Pledge(s)</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Hospital:</span>
                  <span className="text-white font-semibold text-right">{selectedRequest.hospital_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">City / Location:</span>
                  <span className="text-white text-right">{selectedRequest.hospital_city}</span>
                </div>
                {selectedRequest.hospital_address && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Address:</span>
                    <span className="text-white text-right max-w-xs">{selectedRequest.hospital_address}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Contact Person:</span>
                  <span className="text-white">{selectedRequest.contact_person || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Contact Phone:</span>
                  <span className="text-white">{selectedRequest.contact_phone || 'N/A'}</span>
                </div>
                {selectedRequest.clinical_condition && (
                  <div className="py-2 border-b border-white/5 space-y-1">
                    <span className="text-slate-400 block">Clinical Indication:</span>
                    <p className="text-white font-sans text-xs bg-space-950 p-2.5 rounded-lg border border-white/5">
                      {selectedRequest.clinical_condition}
                    </p>
                  </div>
                )}
                {selectedRequest.notes && (
                  <div className="py-2 space-y-1">
                    <span className="text-slate-400 block">Notes:</span>
                    <p className="text-slate-300 font-sans text-xs bg-space-950 p-2.5 rounded-lg border border-white/5">
                      {selectedRequest.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-space-850/60 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Created: {new Date(selectedRequest.created_at).toLocaleString()}
              </span>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
