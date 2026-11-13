import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Heart, 
  FileCheck, 
  Award, 
  Search, 
  Filter, 
  RefreshCw, 
  Send, 
  Trash2, 
  ExternalLink, 
  Check, 
  X, 
  Download, 
  Printer, 
  QrCode,
  Radio,
  Eye,
  LogOut,
  Plus,
  Clock,
  Phone,
  Building2
} from 'lucide-react';
import { INITIAL_BLOOD_REQUESTS, INITIAL_VERIFIED_SUBMISSIONS } from '../data/missionData';
import { requestApi, proofApi } from '../services/api';

export default function AdminDashboard({ 
  isAdminLoggedIn, 
  currentAdmin,
  onAdminLogin, 
  onAdminLogout,
  bloodRequests = INITIAL_BLOOD_REQUESTS,
  onUpdateRequestStatus,
  verifiedSubmissions = INITIAL_VERIFIED_SUBMISSIONS,
  onApproveSubmission,
  onViewCertificate,
  onRefreshData
}) {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'proofs' | 'create_request'
  const [requestFilter, setRequestFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastNotification, setBroadcastNotification] = useState(null);

  // Live admin proofs state
  const [adminProofs, setAdminProofs] = useState([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [proofFilter, setProofFilter] = useState('PENDING'); // 'PENDING' | 'all' | 'APPROVED' | 'REJECTED'
  const [selectedProofPhoto, setSelectedProofPhoto] = useState(null);
  const [rejectModalProof, setRejectModalProof] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' });

  // Create Blood Request Form State
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [createReqLoading, setCreateReqLoading] = useState(false);
  const [createReqMessage, setCreateReqMessage] = useState({ type: '', text: '' });
  const [newRequest, setNewRequest] = useState({
    patientName: '',
    hospitalName: '',
    hospitalCity: 'Mumbai',
    hospitalAddress: '',
    bloodGroup: 'O+',
    unitsRequested: 2,
    urgencyLevel: 'URGENT',
    requiredBy: '',
    contactPerson: '',
    contactPhone: '',
    clinicalCondition: '',
    notes: ''
  });

  // Fetch admin proofs from live API
  const fetchProofs = async () => {
    if (!isAdminLoggedIn) return;
    setLoadingProofs(true);
    try {
      const res = await proofApi.getAdminProofs(proofFilter);
      if (res.success && res.proofs) {
        setAdminProofs(res.proofs);
      }
    } catch (e) {
      console.error('Failed to fetch proofs', e);
    } finally {
      setLoadingProofs(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn && activeTab === 'proofs') {
      fetchProofs();
    }
  }, [isAdminLoggedIn, activeTab, proofFilter]);

  const handleBroadcastAlert = (req) => {
    setBroadcastNotification(`SOS Broadcast Dispatched to all compatible ${req.blood_group || req.bloodGroup} donors within 15km of ${req.hospital_name || req.hospitalName}!`);
    setTimeout(() => {
      setBroadcastNotification(null);
    }, 4000);
  };

  // Create Blood Request Submission
  const handleCreateRequestSubmit = async (e) => {
    e.preventDefault();
    setCreateReqLoading(true);
    setCreateReqMessage({ type: '', text: '' });

    try {
      const res = await requestApi.create({
        ...newRequest,
        unitsRequested: parseInt(newRequest.unitsRequested, 10),
        requiredBy: newRequest.requiredBy || new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      });

      if (res.success) {
        setCreateReqMessage({ type: 'success', text: `Blood Request [${res.request.id}] published successfully!` });
        setNewRequest({
          patientName: '',
          hospitalName: '',
          hospitalCity: 'Mumbai',
          hospitalAddress: '',
          bloodGroup: 'O+',
          unitsRequested: 2,
          urgencyLevel: 'URGENT',
          requiredBy: '',
          contactPerson: '',
          contactPhone: '',
          clinicalCondition: '',
          notes: ''
        });
        if (onRefreshData) onRefreshData();
        setTimeout(() => {
          setIsCreatingRequest(false);
          setActiveTab('requests');
        }, 1500);
      } else {
        setCreateReqMessage({ type: 'error', text: res.error || 'Failed to create blood request.' });
      }
    } catch (err) {
      setCreateReqMessage({ type: 'error', text: 'Network error publishing blood request.' });
    } finally {
      setCreateReqLoading(false);
    }
  };

  // Status toggle handler
  const handleToggleRequestStatus = async (reqId, currentStatus) => {
    const nextStatus = currentStatus === 'OPEN' || currentStatus === 'Open' ? 'FULFILLED' : 'OPEN';
    try {
      const res = await requestApi.updateStatus(reqId, nextStatus);
      if (res.success) {
        if (onUpdateRequestStatus) onUpdateRequestStatus(reqId, nextStatus);
        if (onRefreshData) onRefreshData();
      } else {
        alert(res.error || 'Failed to update request status.');
      }
    } catch (err) {
      if (onUpdateRequestStatus) onUpdateRequestStatus(reqId, nextStatus);
    }
  };

  // Approve Proof
  const handleApproveProof = async (proof) => {
    if (!confirm(`Are you sure you want to approve donation proof for donor ${proof.donorName}? This will issue an official Clinical Lifesaver Certificate.`)) return;

    setReviewActionLoading(true);
    setReviewMessage({ type: '', text: '' });

    try {
      const res = await proofApi.reviewProof(proof.id, 'APPROVE');
      if (res.success) {
        setReviewMessage({ type: 'success', text: `Proof approved! Certificate ${res.certificateId} has been issued.` });
        fetchProofs();
        if (onRefreshData) onRefreshData();
      } else {
        setReviewMessage({ type: 'error', text: res.error || 'Failed to approve proof.' });
      }
    } catch (err) {
      setReviewMessage({ type: 'error', text: 'Network error approving proof.' });
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Reject Proof
  const handleRejectProofSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalProof || !rejectionReasonInput.trim()) return;

    setReviewActionLoading(true);
    try {
      const res = await proofApi.reviewProof(rejectModalProof.id, 'REJECT', rejectionReasonInput.trim());
      if (res.success) {
        setReviewMessage({ type: 'success', text: 'Proof rejected with reason recorded. Donor can resubmit corrected proof.' });
        setRejectModalProof(null);
        setRejectionReasonInput('');
        fetchProofs();
      } else {
        alert(res.error || 'Failed to reject proof.');
      }
    } catch (err) {
      alert('Network error rejecting proof.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Filter requests
  const filteredRequests = bloodRequests.filter((req) => {
    const statusVal = req.status || 'OPEN';
    const urgencyVal = req.urgency_level || req.urgency || 'URGENT';
    const patientName = req.patient_name || req.patientName || '';
    const hospitalName = req.hospital_name || req.hospitalName || '';
    const bloodGroup = req.blood_group || req.bloodGroup || '';

    const matchesFilter = 
      requestFilter === 'ALL' || 
      (requestFilter === 'CRITICAL' && urgencyVal === 'CRITICAL') ||
      (requestFilter === 'OPEN' && statusVal.toUpperCase() === 'OPEN') ||
      (requestFilter === 'FULFILLED' && (statusVal.toUpperCase() === 'FULFILLED' || statusVal === 'Fulfilled'));
    
    const matchesSearch = 
      patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospitalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bloodGroup.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <section id="admin-dashboard" className="py-20 relative bg-space-950/80 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Central Medical Command & Governance</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            ADMIN <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">DASHBOARD</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Manage emergency hospital blood requests, review donor proof slips, verify transfusions, and issue authentic National Digital Certificates.
          </p>
        </div>

        {/* If Admin is NOT logged in, show access card */}
        {!isAdminLoggedIn ? (
          <div className="max-w-md mx-auto card-glass rounded-2xl p-8 border border-white/10 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-orbitron font-bold text-xl text-white">
                Authorized Personnel Only
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Central Medical Command is restricted to verified Hospital Administrators, Medical Officers, and Super Admins. Dual-factor authentication (Mobile + Email OTP) is required.
              </p>
            </div>

            <button
              type="button"
              onClick={onAdminLogin}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-amber-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>ACCESS MEDICAL COMMAND LOGIN →</span>
            </button>

            <p className="text-[11px] font-mono text-slate-400">
              Session-bound authentication with audit trail logging.
            </p>
          </div>
        ) : (
          /* Admin Authenticated View */
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Admin Command Status Bar */}
            <div className="card-glass rounded-2xl p-5 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron font-bold text-white text-base">
                      {currentAdmin?.fullName || currentAdmin?.username || 'Authorized Medical Officer'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {currentAdmin?.roleName || currentAdmin?.roleId || 'ADMIN'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Account: {currentAdmin?.email || currentAdmin?.username || 'admin'} // Active Session
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreatingRequest(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white text-xs font-orbitron font-semibold tracking-wider flex items-center gap-2 shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Blood Request</span>
                </button>

                <button
                  onClick={onAdminLogout}
                  className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-mars-400" />
                  <span>Exit Admin Mode</span>
                </button>
              </div>
            </div>

            {/* Broadcast Toast Notification */}
            {broadcastNotification && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white text-xs font-mono flex items-center justify-between shadow-xl shadow-mars-600/30 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 animate-ping" />
                  <span className="font-bold">{broadcastNotification}</span>
                </div>
                <button onClick={() => setBroadcastNotification(null)} className="p-1 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Review Toast Message */}
            {reviewMessage.text && (
              <div className={`p-4 rounded-xl text-xs font-mono flex items-center justify-between ${
                reviewMessage.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                <span>{reviewMessage.text}</span>
                <button onClick={() => setReviewMessage({ type: '', text: '' })} className="p-1 hover:opacity-80">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
                  <span>ACTIVE REQUESTS</span>
                  <Heart className="w-4 h-4 text-mars-500" />
                </div>
                <div className="text-2xl font-orbitron font-bold text-white">
                  {bloodRequests.filter(r => (r.status || 'OPEN').toUpperCase() !== 'FULFILLED').length}
                </div>
                <div className="text-[10px] text-mars-400 font-mono mt-1">
                  {bloodRequests.filter(r => (r.urgency_level || r.urgency) === 'CRITICAL' && (r.status || 'OPEN').toUpperCase() !== 'FULFILLED').length} Critical Alerts
                </div>
              </div>

              <div className="card-glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
                  <span>PENDING PROOFS</span>
                  <FileCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-orbitron font-bold text-white">
                  {adminProofs.filter(p => p.status === 'PENDING').length}
                </div>
                <div className="text-[10px] text-amber-400 font-mono mt-1">
                  Awaiting Medical Verification
                </div>
              </div>

              <div className="card-glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
                  <span>VERIFIED HEROES</span>
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-orbitron font-bold text-white">
                  {adminProofs.filter(p => p.status === 'APPROVED').length || verifiedSubmissions.length}
                </div>
                <div className="text-[10px] text-cyan-400 font-mono mt-1">
                  Official Certificates Issued
                </div>
              </div>

              <div className="card-glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
                  <span>GOVERNANCE STATUS</span>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-orbitron font-bold text-white">
                  Active
                </div>
                <div className="text-[10px] text-emerald-400 font-mono mt-1">
                  Full RBAC Gating Enforced
                </div>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'requests'
                    ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                    : 'bg-space-850 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Manage Blood Requests ({bloodRequests.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('proofs')}
                className={`px-4 py-2 rounded-xl text-xs font-orbitron font-semibold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'proofs'
                    ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                    : 'bg-space-850 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Verify Donation Proofs ({adminProofs.length})</span>
              </button>
            </div>

            {/* TAB 1: MANAGE BLOOD REQUESTS */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    {['ALL', 'CRITICAL', 'OPEN', 'FULFILLED'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setRequestFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                          requestFilter === filter
                            ? 'bg-mars-600 text-white'
                            : 'bg-space-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patient, hospital, group..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-space-850 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                    />
                  </div>
                </div>

                <div className="card-glass rounded-2xl border border-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-space-900 border-b border-white/10 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                          <th className="py-3 px-4">Req ID</th>
                          <th className="py-3 px-4">Patient / Condition</th>
                          <th className="py-3 px-4">Hospital / City</th>
                          <th className="py-3 px-4">Group Needed</th>
                          <th className="py-3 px-4">Remaining Units</th>
                          <th className="py-3 px-4">Urgency</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Admin Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {filteredRequests.map((req) => {
                          const patientName = req.patient_name || req.patientName || 'Anonymous';
                          const condition = req.clinical_condition || req.condition || 'Blood Transfusion';
                          const hospitalName = req.hospital_name || req.hospitalName || 'City Hospital';
                          const city = req.hospital_city || req.city || 'Mumbai';
                          const bloodGroup = req.blood_group || req.bloodGroup || 'O+';
                          const unitsNeeded = req.units_requested || req.unitsNeeded || 1;
                          const unitsRemaining = req.units_remaining !== undefined ? req.units_remaining : unitsNeeded;
                          const urgency = req.urgency_level || req.urgency || 'URGENT';
                          const status = (req.status || 'OPEN').toUpperCase();

                          return (
                            <tr key={req.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4 font-mono font-semibold text-mars-400">
                                {req.id}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{patientName}</div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{condition}</div>
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                <div>{hospitalName}</div>
                                <div className="text-[10px] text-slate-500">{city}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded font-bold font-mono text-xs bg-mars-500/10 text-mars-400 border border-mars-500/30">
                                  {bloodGroup} • {unitsNeeded} Units
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`font-mono font-bold ${unitsRemaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                  {unitsRemaining} / {unitsNeeded} Left
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  urgency === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}>
                                  {urgency}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                  status === 'FULFILLED'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleBroadcastAlert(req)}
                                    className="p-1.5 rounded-lg bg-mars-500/10 hover:bg-mars-500/20 text-mars-400 border border-mars-500/30 text-xs transition-colors cursor-pointer"
                                    title="Broadcast Emergency SOS"
                                  >
                                    <Radio className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleRequestStatus(req.id, status)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                                      status !== 'FULFILLED'
                                        ? 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {status !== 'FULFILLED' ? 'Mark Fulfilled' : 'Reopen'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VERIFY DONATION PROOFS */}
            {activeTab === 'proofs' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    {['PENDING', 'all', 'APPROVED', 'REJECTED'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setProofFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                          proofFilter === f
                            ? 'bg-mars-600 text-white font-bold'
                            : 'bg-space-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={fetchProofs}
                    disabled={loadingProofs}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-slate-300 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingProofs ? 'animate-spin' : ''}`} />
                    <span>Refresh Submissions</span>
                  </button>
                </div>

                {loadingProofs ? (
                  <div className="text-center py-12 text-slate-400 font-mono text-xs">
                    Loading clinical proof submissions...
                  </div>
                ) : adminProofs.length === 0 ? (
                  <div className="card-glass rounded-2xl p-12 text-center text-slate-400 border border-white/5 space-y-2">
                    <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-mono text-xs">No proof submissions found matching filter [{proofFilter}].</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminProofs.map((sub) => (
                      <div
                        key={sub.id}
                        className="card-glass rounded-xl p-5 border border-white/10 space-y-4 hover:border-mars-500/30 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono text-mars-400 block mb-0.5">
                              {sub.id} // Pledge: {sub.pledgeId}
                            </span>
                            <h4 className="font-orbitron font-bold text-white text-base">
                              {sub.donorName}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {sub.donorMobile}
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center font-bold text-mars-400 text-sm font-mono">
                            {sub.donorBloodGroup || sub.requestedBloodGroup}
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                          <div className="text-slate-400">
                            Patient: <span className="text-white">{sub.patientName}</span>
                          </div>
                          <div className="text-slate-400">
                            Hospital: <span className="text-white">{sub.hospitalName}, {sub.hospitalCity}</span>
                          </div>
                          <div className="text-slate-400">
                            Units Pledged: <span className="text-white">{sub.unitsPledged} Unit(s)</span>
                          </div>
                          <div className="text-slate-400">
                            Submitted: <span className="text-white">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Proof Photo Thumbnail */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProofPhoto(sub.photoUrl)}
                            className="w-full py-2 px-3 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-mars-400 hover:text-mars-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Inspect Proof Photograph</span>
                          </button>
                        </div>

                        {/* Review Status & Action Buttons */}
                        <div className="pt-3 border-t border-white/10">
                          {sub.status === 'PENDING' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveProof(sub)}
                                disabled={reviewActionLoading}
                                className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => {
                                  setRejectModalProof(sub);
                                  setRejectionReasonInput('');
                                }}
                                disabled={reviewActionLoading}
                                className="flex-1 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                                sub.status === 'APPROVED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}>
                                {sub.status === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                <span>{sub.status}</span>
                              </span>

                              {sub.rejectionReason && (
                                <span className="text-[10px] text-rose-400 italic truncate max-w-[150px]" title={sub.rejectionReason}>
                                  Reason: {sub.rejectionReason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CREATE BLOOD REQUEST MODAL */}
            {isCreatingRequest && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in">
                <div className="relative w-full max-w-xl card-glass rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-mars-500" />
                      <h3 className="font-orbitron font-bold text-lg text-white">
                        Publish Emergency Blood Requisition
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsCreatingRequest(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-space-850"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {createReqMessage.text && (
                    <div className={`p-3 rounded-xl text-xs font-mono ${
                      createReqMessage.type === 'success' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {createReqMessage.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateRequestSubmit} className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-300 block mb-1">Patient Full Name *</label>
                        <input
                          type="text"
                          required
                          value={newRequest.patientName}
                          onChange={(e) => setNewRequest({ ...newRequest, patientName: e.target.value })}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Blood Group Needed *</label>
                        <select
                          value={newRequest.bloodGroup}
                          onChange={(e) => setNewRequest({ ...newRequest, bloodGroup: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-slate-300 block mb-1">Hospital Name *</label>
                        <input
                          type="text"
                          required
                          value={newRequest.hospitalName}
                          onChange={(e) => setNewRequest({ ...newRequest, hospitalName: e.target.value })}
                          placeholder="e.g. Lilavati Hospital"
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Units Needed *</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          required
                          value={newRequest.unitsRequested}
                          onChange={(e) => setNewRequest({ ...newRequest, unitsRequested: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-300 block mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={newRequest.hospitalCity}
                          onChange={(e) => setNewRequest({ ...newRequest, hospitalCity: e.target.value })}
                          placeholder="e.g. Mumbai"
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Urgency Level *</label>
                        <select
                          value={newRequest.urgencyLevel}
                          onChange={(e) => setNewRequest({ ...newRequest, urgencyLevel: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        >
                          <option value="CRITICAL">CRITICAL (Immediate Transfusion)</option>
                          <option value="URGENT">URGENT (Within 6 Hours)</option>
                          <option value="STANDARD">STANDARD (Scheduled Surgery)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1">Hospital Address / Ward Details *</label>
                      <input
                        type="text"
                        required
                        value={newRequest.hospitalAddress}
                        onChange={(e) => setNewRequest({ ...newRequest, hospitalAddress: e.target.value })}
                        placeholder="e.g. Bandra West, ICU Ward 4, Bed 12"
                        className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-300 block mb-1">Contact Person Name *</label>
                        <input
                          type="text"
                          required
                          value={newRequest.contactPerson}
                          onChange={(e) => setNewRequest({ ...newRequest, contactPerson: e.target.value })}
                          placeholder="e.g. Dr. Verma / Attendant"
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Contact Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={newRequest.contactPhone}
                          onChange={(e) => setNewRequest({ ...newRequest, contactPhone: e.target.value })}
                          placeholder="+91 9876543210"
                          className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1">Clinical Condition / Remarks</label>
                      <input
                        type="text"
                        value={newRequest.clinicalCondition}
                        onChange={(e) => setNewRequest({ ...newRequest, clinicalCondition: e.target.value })}
                        placeholder="e.g. Acute Trauma / Bypass Surgery"
                        className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-mars-500"
                      />
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsCreatingRequest(false)}
                        className="px-4 py-2 rounded-xl bg-space-850 text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={createReqLoading}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold tracking-wider flex items-center gap-2 hover:brightness-110 disabled:opacity-50"
                      >
                        {createReqLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span>Publish Request</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* FULL SIZE PROOF INSPECTION MODAL */}
            {selectedProofPhoto && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md animate-in fade-in">
                <div className="relative max-w-3xl w-full card-glass rounded-2xl p-4 border border-white/10 text-center space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-mono text-slate-400">Clinical Slip / Hospital Verification Document</span>
                    <button
                      onClick={() => setSelectedProofPhoto(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
                    <img
                      src={selectedProofPhoto}
                      alt="Donation Proof"
                      className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* REJECT PROOF MODAL (MANDATORY REASON) */}
            {rejectModalProof && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in">
                <div className="relative max-w-md w-full card-glass rounded-2xl p-6 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                      <h4 className="font-orbitron font-bold text-white text-base">Reject Proof Submission</h4>
                    </div>
                    <button onClick={() => setRejectModalProof(null)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300">
                    Specify the clinical or verification reason for rejecting this proof. This feedback will be displayed directly to donor <strong className="text-white">{rejectModalProof.donorName}</strong> to allow them to upload a corrected document.
                  </p>

                  <form onSubmit={handleRejectProofSubmit} className="space-y-4 text-xs font-mono">
                    <div>
                      <label className="text-slate-300 block mb-1">Rejection Reason *</label>
                      <textarea
                        required
                        rows="3"
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="e.g. Illegible hospital stamp, date on slip does not match requisition date, or incorrect patient name."
                        className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setRejectModalProof(null)}
                        className="px-3 py-1.5 rounded-lg bg-space-850 text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={reviewActionLoading || !rejectionReasonInput.trim()}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {reviewActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        <span>Confirm Rejection</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </section>
  );
}
