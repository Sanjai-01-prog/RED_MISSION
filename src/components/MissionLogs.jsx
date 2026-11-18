import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Phone, 
  Building2, 
  Plus, 
  CheckCircle2, 
  X, 
  Filter, 
  Share2, 
  Droplet,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Send
} from 'lucide-react';
import { INITIAL_BLOOD_REQUESTS } from '../data/missionData';
import { requestApi, pledgeApi, donorApi } from '../services/api';
import { resolveDonorAvailability, formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../utils/donorAvailability';
import CalendarDatePicker from './common/CalendarDatePicker';

export default function MissionLogs({ 
  bloodRequests, 
  onAddRequest,
  currentUser,
  onOpenAuthModal,
  onRefreshData
}) {
  const [requests, setRequests] = useState(bloodRequests || INITIAL_BLOOD_REQUESTS);
  const [selectedUrgency, setSelectedUrgency] = useState('All');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('All');
  const [selectedCity, setSelectedCity] = useState('');
  
  // Pledging State
  const [selectedRequestForDonate, setSelectedRequestForDonate] = useState(null);
  const [pledgeLoading, setPledgeLoading] = useState(false);
  const [pledgeConfirmed, setPledgeConfirmed] = useState(false);
  const [pledgeError, setPledgeError] = useState('');
  const [pledgeResult, setPledgeResult] = useState(null);
  const [donorAvailability, setDonorAvailability] = useState(null);

  // WhatsApp share notification toast
  const [shareToast, setShareToast] = useState(null);

  // Citizen blood request form
  const [showCitizenRequestModal, setShowCitizenRequestModal] = useState(false);
  const [citizenRequestLoading, setCitizenRequestLoading] = useState(false);
  const [citizenRequestError, setCitizenRequestError] = useState('');
  const [citizenRequestSuccess, setCitizenRequestSuccess] = useState(false);

  const getDefaultRequiredBy = () => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };

  const [citizenRequestForm, setCitizenRequestForm] = useState({
    patientName: '',
    hospitalName: '',
    hospitalCity: '',
    hospitalAddress: '',
    bloodGroup: '',
    unitsRequested: '1',
    urgencyLevel: 'STANDARD',
    requiredBy: getDefaultRequiredBy(),
    contactPerson: '',
    contactPhone: '',
    clinicalCondition: '',
    notes: ''
  });

  const updateCitizenRequestField = (field, value) => {
    setCitizenRequestForm(previous => ({ ...previous, [field]: value }));
  };

  const closeCitizenRequestModal = () => {
    if (citizenRequestLoading) return;
    setShowCitizenRequestModal(false);
    setCitizenRequestError('');
    setCitizenRequestSuccess(false);
  };

  useEffect(() => {
    if (bloodRequests && bloodRequests.length > 0) {
      setRequests(bloodRequests);
    }
  }, [bloodRequests]);

  useEffect(() => {
    const loadDonorCooldownStatus = () => {
      if (!currentUser) {
        setDonorAvailability(null);
        return;
      }
      donorApi
        .getProfile()
        .then((res) => {
          if (res?.success && res.isDonor && res.donor) {
            setDonorAvailability(resolveDonorAvailability(res.donor));
          } else if (res?.availability) {
            setDonorAvailability(resolveDonorAvailability({ availability: res.availability }));
          } else {
            setDonorAvailability(null);
          }
        })
        .catch(() => setDonorAvailability(null));
    };

    loadDonorCooldownStatus();
    const handleOpenRaise = () => {
      setCitizenRequestError('');
      setCitizenRequestSuccess(false);
      setShowCitizenRequestModal(true);
    };
    const handleOpenPledge = (e) => {
      if (e?.detail) {
        setSelectedRequestForDonate(e.detail);
        setPledgeConfirmed(false);
        setPledgeError('');
        setPledgeResult(null);
      }
    };
    window.addEventListener('donor-registered', loadDonorCooldownStatus);
    window.addEventListener('proof-reviewed', loadDonorCooldownStatus);
    window.addEventListener('pledge-updated', loadDonorCooldownStatus);
    window.addEventListener('open-raise-request-modal', handleOpenRaise);
    window.addEventListener('open-pledge-modal', handleOpenPledge);
    return () => {
      window.removeEventListener('donor-registered', loadDonorCooldownStatus);
      window.removeEventListener('proof-reviewed', loadDonorCooldownStatus);
      window.removeEventListener('pledge-updated', loadDonorCooldownStatus);
      window.removeEventListener('open-raise-request-modal', handleOpenRaise);
      window.removeEventListener('open-pledge-modal', handleOpenPledge);
    };
  }, [currentUser]);

  // Deep Link listener for #request-{id}
  useEffect(() => {
    const handleDeepLink = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#request-')) {
        const targetId = hash.replace('#request-', '');
        const found = requests.find(r => r.id === targetId);
        if (found) {
          setSelectedRequestForDonate(found);
          setPledgeConfirmed(false);
          setPledgeError('');
        }
      }
    };

    handleDeepLink();
    window.addEventListener('hashchange', handleDeepLink);
    return () => window.removeEventListener('hashchange', handleDeepLink);
  }, [requests]);

  // Modal Escape key listeners and scroll locking
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedRequestForDonate(null);
        if (!citizenRequestLoading) setShowCitizenRequestModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedRequestForDonate || showCitizenRequestModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRequestForDonate, showCitizenRequestModal]);

  // Share via WhatsApp
  const handleShareWhatsApp = (req) => {
    const patientName = req.patient_name || req.patientName || 'A patient';
    const bloodGroup = req.blood_group || req.bloodGroup || 'Blood';
    const hospitalName = req.hospital_name || req.hospitalName || 'Hospital';
    const city = req.hospital_city || req.city || 'Emergency';
    const unitsRequested = req.units_requested || req.unitsNeeded || 1;
    const unitsRemaining = req.units_remaining !== undefined ? req.units_remaining : unitsRequested;
    const urgency = req.urgency_level || req.urgency || 'URGENT';
    const deadline = req.required_by ? new Date(req.required_by).toLocaleDateString() : 'Urgent';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://redmission.org';
    const deepLink = `${origin}/#request-${req.id}`;

    const text = 
`ðŸš¨ *URGENT BLOOD NEEDED â€” RED MISSION* ðŸš¨
Patient: ${patientName}
Blood Group: *${bloodGroup}*
Hospital: ${hospitalName}, ${city}
Units Needed: ${unitsRemaining} Unit(s)
Urgency: *${urgency}*
Required Date: ${deadline}

ðŸ©¸ *Can you donate or know someone who can?*
Click the official link below to view details and Pledge to donate:
ðŸ‘‰ ${deepLink}

_(Note: You must log in or register on RED MISSION to securely confirm a pledge. Shared links do not automatically confirm pledges.)_`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setShareToast(`WhatsApp share message created for Request [${req.id}].`);
    setTimeout(() => setShareToast(null), 4000);
  };

  // Open Pledge Modal or require login
  const handleInitiatePledge = (req) => {
    if (req.is_expired || (req.required_by && new Date(req.required_by).getTime() < Date.now())) {
      setShareToast('This emergency blood request has expired and cannot accept new pledges.');
      return;
    }

    if (!currentUser) {
      // Prompt user login and remember target request
      if (onOpenAuthModal) {
        onOpenAuthModal('login', { type: 'PLEDGE', request: req });
      }
      return;
    }

    setSelectedRequestForDonate(req);
    setPledgeConfirmed(false);
    setPledgeError('');
    setPledgeResult(null);
  };

  // Confirm Pledge via API
  const handleConfirmPledge = async () => {
    if (!selectedRequestForDonate) return;
    if (donorAvailability?.isInCooldown) {
      const reavailLabel = formatCalendarDate(donorAvailability.reavailableDate) || donorAvailability.reavailableDate;
      setPledgeError(
        `3-month post-donation cooldown is active. You will be eligible to pledge again on ${reavailLabel}, subject to hospital medical screening.`
      );
      return;
    }

    setPledgeLoading(true);
    setPledgeError('');

    try {
      const res = await pledgeApi.create(selectedRequestForDonate.id);
      if (res.success) {
        setPledgeConfirmed(true);
        setPledgeResult(res.pledge);
        window.dispatchEvent(new CustomEvent('pledge-updated'));
        // Refresh requests in parent if available
        if (onRefreshData) onRefreshData();
      } else {
        if (res.availability) {
          setDonorAvailability(resolveDonorAvailability({ availability: res.availability }));
        }
        setPledgeError(res.error || 'Failed to confirm pledge. Please check availability.');
      }
    } catch (err) {
      setPledgeError('Network error confirming pledge. Please try again.');
    } finally {
      setPledgeLoading(false);
    }
  };

  const handleCitizenRequestSubmit = async (event) => {
    event.preventDefault();
    if (citizenRequestLoading) return;

    if (!currentUser) {
      closeCitizenRequestModal();
      if (onOpenAuthModal) onOpenAuthModal('login');
      return;
    }

    setCitizenRequestLoading(true);
    setCitizenRequestError('');

    try {
      const payload = {
        ...citizenRequestForm,
        unitsRequested: Number(citizenRequestForm.unitsRequested)
      };

      const res = await requestApi.createUserRequest(payload);

      if (!res?.success) {
        setCitizenRequestError(res?.error || 'Unable to submit your blood request.');
        return;
      }

      const createdRequest = res.request || res.data?.request || res.data;
      // Only approved requests are injected into public requests board
      if (createdRequest && createdRequest.approval_status === 'APPROVED') {
        setRequests(previous => [
          createdRequest,
          ...previous.filter(item => item.id !== createdRequest.id)
        ]);
        if (onAddRequest) onAddRequest(createdRequest);
      }

      setCitizenRequestSuccess(true);
      if (onRefreshData) onRefreshData();
    } catch (error) {
      setCitizenRequestError(error?.message || 'Network error. Please try again.');
    } finally {
      setCitizenRequestLoading(false);
    }
  };

  const urgencyFilters = ['All', 'CRITICAL', 'URGENT', 'STANDARD'];
  const bloodGroupFilters = ['All', 'O-', 'O+', 'B-', 'B+', 'A-', 'A+', 'AB-', 'AB+'];

  const filteredRequests = requests.filter((req) => {
    // Only genuine APPROVED requests belong on the public requisitions board
    const approval = (req.approval_status || (req.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase();
    if (approval !== 'APPROVED') return false;

    // Exclude cancelled or rejected requests
    const rawStatus = (req.status || 'OPEN').toUpperCase();
    if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') return false;

    const urgency = (req.urgency_level || req.urgency || '').toUpperCase();
    const group = (req.blood_group || req.bloodGroup || '').toUpperCase();
    const city = (req.hospital_city || req.city || '').toLowerCase();

    const matchesUrgency = selectedUrgency === 'All' || urgency === selectedUrgency.toUpperCase();
    const matchesGroup = selectedBloodGroup === 'All' || group === selectedBloodGroup.toUpperCase();
    const matchesCity = !selectedCity.trim() || city.includes(selectedCity.trim().toLowerCase());

    return matchesUrgency && matchesGroup && matchesCity;
  });

  return (
    <section id="requests" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <Heart className="w-3.5 h-3.5 fill-mars-500 text-mars-500 animate-pulse" />
            <span>Active Hospital Transfusion Requisitions</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-5xl text-white tracking-tight">
            EMERGENCY <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">BLOOD REQUESTS</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Verified emergency requisitions published by hospital coordinators. Step forward to pledge a donation, or share via WhatsApp to alert donors in your locality.
          </p>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                if (onOpenAuthModal) onOpenAuthModal('login', { type: 'RAISE_REQUEST' });
                return;
              }
              setCitizenRequestError('');
              setCitizenRequestSuccess(false);
              setShowCitizenRequestModal(true);
            }}
            className="inline-flex items-center gap-2 mt-3 px-6 py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron text-xs font-bold tracking-wider hover:brightness-110 transition-all shadow-lg shadow-mars-600/20"
          >
            <Plus className="w-4 h-4" />
            Raise Blood Request
          </button>
        </div>

        {/* WhatsApp Toast */}
        {shareToast && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-xl animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>{shareToast}</span>
            </div>
            <button onClick={() => setShareToast(null)} className="p-1 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="card-glass rounded-2xl p-5 border border-white/10 mb-8 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Urgency Level Filter */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5" /> Urgency:
              </span>
              {urgencyFilters.map((u) => (
                <button
                  key={u}
                  onClick={() => setSelectedUrgency(u)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                    selectedUrgency === u
                      ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                      : 'bg-space-850 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Blood Group Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              <span className="text-xs font-mono text-slate-400 mr-1">Group:</span>
              {bloodGroupFilters.map((bg) => (
                <button
                  key={bg}
                  onClick={() => setSelectedBloodGroup(bg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    selectedBloodGroup === bg
                      ? 'bg-gradient-to-r from-mars-600 to-mars-flame text-white'
                      : 'bg-space-850 text-slate-400 hover:text-white'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Donor Cooldown Notice Banner when Authenticated Donor is Resting */}
        {currentUser && donorAvailability?.isInCooldown && (
          <div
            role="status"
            aria-live="polite"
            className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Clock className="w-4 h-4 shrink-0" />
                <span>DONOR ACCOUNT TEMPORARILY UNAVAILABLE — 3-MONTH VERIFIED COOLDOWN</span>
              </div>
              <p className="text-slate-200 leading-relaxed">
                Eligible to pledge again on{' '}
                <strong className="text-white">
                  {formatCalendarDate(donorAvailability.reavailableDate) || donorAvailability.reavailableDate}
                </strong>
                {donorAvailability.daysRemaining > 0 ? ` (${donorAvailability.daysRemaining} days remaining)` : ''}.
              </p>
              <p className="text-[11px] text-slate-400">
                {donorAvailability.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
              </p>
            </div>
          </div>
        )}

        {/* Blood Requests Cards Grid */}
        {filteredRequests.length === 0 ? (
          <div className="card-glass rounded-3xl p-12 text-center text-slate-400 border border-white/5 space-y-3">
            <Heart className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="font-orbitron font-bold text-white text-base">No Requisitions Found</h4>
            <p className="text-xs font-mono text-slate-400">No emergency requests match your current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map((req) => {
              const patientName = req.patient_name || req.patientName || 'Anonymous Patient';
              const hospitalName = req.hospital_name || req.hospitalName || 'City Hospital';
              const city = req.hospital_city || req.city || 'Emergency';
              const address = req.hospital_address || req.hospitalAddress || '';
              const bloodGroup = req.blood_group || req.bloodGroup || 'O+';
              const unitsRequested = req.units_requested || req.unitsNeeded || 1;
              const unitsReserved = req.units_reserved || 0;
              const unitsRemaining = req.units_remaining !== undefined ? req.units_remaining : Math.max(0, unitsRequested - unitsReserved);
              const urgency = (req.urgency_level || req.urgency || 'URGENT').toUpperCase();
              const status = (req.status || 'OPEN').toUpperCase();
              const isFulfilled = status === 'FULFILLED' || unitsRemaining <= 0;
              const isExpired = req.is_expired || status === 'EXPIRED' || (Boolean(req.required_by) && new Date(req.required_by).getTime() < Date.now() && !isFulfilled && status !== 'CANCELLED');
              const deadline = req.required_by ? new Date(req.required_by).toLocaleDateString() : 'Immediate';

              return (
                <div
                  key={req.id}
                  id={`request-card-${req.id}`}
                  className="card-glass rounded-2xl p-6 border border-white/10 space-y-5 hover:border-mars-500/40 transition-all flex flex-col justify-between relative group"
                >
                  {/* Top Badge Row */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {req.id}
                        </span>
                        <h3 className="font-orbitron font-bold text-lg text-white group-hover:text-mars-400 transition-colors">
                          {patientName}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono">
                          {req.clinical_condition || req.condition || 'Emergency Transfusion Need'}
                        </p>
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-mars-600 to-mars-flame text-white flex flex-col items-center justify-center font-orbitron font-extrabold shadow-lg shadow-mars-600/30">
                        <span className="text-sm leading-none">{bloodGroup}</span>
                        <span className="text-[9px] font-mono opacity-80 mt-0.5">GROUP</span>
                      </div>
                    </div>

                    {/* Hospital & Location Details */}
                    <div className="space-y-2 text-xs font-mono text-slate-300 py-3 border-y border-white/5">
                      <div className="flex items-center gap-2 text-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-mars-400 shrink-0" />
                        <span className="font-semibold truncate">{hospitalName}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{city} {address ? `â€¢ ${address}` : ''}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-400">Required By:</span>
                        <span className="text-white font-bold">{deadline}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Remaining Units:</span>
                        <span className={`font-bold ${unitsRemaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {unitsRemaining} of {unitsRequested} Units
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        urgency === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {urgency} URGENCY
                      </span>

                      {isFulfilled ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          FULFILLED
                        </span>
                      ) : isExpired ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          EXPIRED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          ACCEPTING PLEDGES
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* WhatsApp Share Button */}
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(req)}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Share via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>

                      {/* Pledge Button */}
                      {isFulfilled ? (
                        <button
                          disabled
                          className="py-2.5 px-3 rounded-xl bg-space-850 text-slate-500 font-mono text-xs cursor-not-allowed text-center"
                        >
                          Closed
                        </button>
                      ) : isExpired ? (
                        <button
                          disabled
                          className="py-2.5 px-3 rounded-xl bg-space-850 text-amber-500/70 border border-amber-500/20 font-mono text-xs cursor-not-allowed text-center"
                        >
                          Expired
                        </button>
                      ) : donorAvailability?.isInCooldown ? (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          title={`In 3-month cooldown until ${formatCalendarDate(donorAvailability.reavailableDate) || donorAvailability.reavailableDate}`}
                          className="py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300/80 font-mono text-xs cursor-not-allowed flex items-center justify-center gap-1.5 opacity-80"
                        >
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Cooldown Active</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInitiatePledge(req)}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 fill-white" />
                          <span>Pledge</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CITIZEN BLOOD REQUEST MODAL */}
        {showCitizenRequestModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card-glass rounded-3xl p-6 sm:p-8 border border-mars-500/30 shadow-2xl">
              <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-white/10">
                <div>
                  <h3 className="text-white font-orbitron font-bold text-lg">RAISE BLOOD REQUEST</h3>
                  <p className="text-slate-400 text-xs mt-1">Submit patient and hospital details for a blood requirement.</p>
                </div>
                <button type="button" onClick={closeCitizenRequestModal} disabled={citizenRequestLoading} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {citizenRequestSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                  <h4 className="text-white font-orbitron font-bold">Request Submitted — Pending Review</h4>
                  <p className="text-sm text-slate-300">
                    Your blood request has been submitted successfully and is currently <strong className="text-amber-400">Pending Administrative Verification</strong>. It will be verified by a coordinator before public dispatch.
                  </p>
                  <button type="button" onClick={closeCitizenRequestModal} className="px-6 py-3 rounded-xl bg-mars-600 hover:bg-mars-500 text-white text-xs font-bold">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCitizenRequestSubmit} className="space-y-4">
                  {citizenRequestError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {citizenRequestError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Patient Name *
                      <input required maxLength={120} value={citizenRequestForm.patientName} onChange={e => updateCitizenRequestField('patientName', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Patient full name" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Hospital Name *
                      <input required maxLength={180} value={citizenRequestForm.hospitalName} onChange={e => updateCitizenRequestField('hospitalName', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Hospital name" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Hospital City *
                      <input required maxLength={100} value={citizenRequestForm.hospitalCity} onChange={e => updateCitizenRequestField('hospitalCity', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="City" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Hospital Address *
                      <input required maxLength={300} value={citizenRequestForm.hospitalAddress} onChange={e => updateCitizenRequestField('hospitalAddress', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Hospital address" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Blood Group *
                      <select required value={citizenRequestForm.bloodGroup} onChange={e => updateCitizenRequestField('bloodGroup', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500">
                        <option value="">Select blood group</option>
                        {['O-', 'O+', 'B-', 'B+', 'A-', 'A+', 'AB-', 'AB+'].map(group => <option key={group} value={group}>{group}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Units Required *
                      <input required type="number" min="1" max="10" value={citizenRequestForm.unitsRequested} onChange={e => updateCitizenRequestField('unitsRequested', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Urgency *
                      <select required value={citizenRequestForm.urgencyLevel} onChange={e => updateCitizenRequestField('urgencyLevel', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500">
                        <option value="STANDARD">Standard</option>
                        <option value="URGENT">Urgent</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                    <div className="space-y-1.5">
                      <CalendarDatePicker
                        id="citizen-required-by"
                        name="requiredBy"
                        label="Required By"
                        mode="datetime"
                        placeholder="Select required date & time"
                        value={citizenRequestForm.requiredBy}
                        min={getDefaultRequiredBy()}
                        onChange={(newVal) => updateCitizenRequestField('requiredBy', newVal)}
                        required
                      />
                    </div>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Contact Person *
                      <input required maxLength={120} value={citizenRequestForm.contactPerson} onChange={e => updateCitizenRequestField('contactPerson', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Contact person's name" />
                    </label>
                    <label className="text-xs text-slate-300 space-y-1.5">
                      Contact Phone *
                      <input required type="tel" maxLength={15} value={citizenRequestForm.contactPhone} onChange={e => updateCitizenRequestField('contactPhone', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="10-digit phone number" />
                    </label>
                  </div>

                  <label className="block text-xs text-slate-300 space-y-1.5">
                    Clinical Condition
                    <textarea maxLength={500} rows={2} value={citizenRequestForm.clinicalCondition} onChange={e => updateCitizenRequestField('clinicalCondition', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Brief clinical details (optional)" />
                  </label>
                  <label className="block text-xs text-slate-300 space-y-1.5">
                    Additional Notes
                    <textarea maxLength={1000} rows={2} value={citizenRequestForm.notes} onChange={e => updateCitizenRequestField('notes', e.target.value)} className="w-full rounded-lg bg-space-850 border border-white/15 px-3 py-2.5 text-white outline-none focus:border-mars-500" placeholder="Any additional information (optional)" />
                  </label>

                  <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                    <button type="button" onClick={closeCitizenRequestModal} disabled={citizenRequestLoading} className="px-5 py-2.5 rounded-xl bg-space-850 text-slate-300 hover:text-white disabled:opacity-40">
                      Cancel
                    </button>
                    <button type="submit" disabled={citizenRequestLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider flex items-center gap-2 disabled:opacity-50">
                      {citizenRequestLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {citizenRequestLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* PLEDGE CONFIRMATION MODAL */}
        {selectedRequestForDonate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-lg card-glass rounded-3xl p-6 sm:p-8 border border-mars-500/30 shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-mars-500/20 border border-mars-500/40 text-mars-400 flex items-center justify-center">
                    <Heart className="w-4 h-4 fill-mars-500" />
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-white text-base">
                      Confirm Blood Donation Pledge
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">
                      Request ID: {selectedRequestForDonate.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequestForDonate(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-space-850"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pledgeConfirmed ? (
                /* Success State */
                <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-orbitron font-bold text-xl text-white">
                      Pledge Successfully Recorded!
                    </h4>
                    <p className="text-xs font-mono text-emerald-400">
                      Pledge Reference: {pledgeResult?.id}
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    Thank you, <strong className="text-white">{currentUser?.fullName}</strong>! One unit of {selectedRequestForDonate.blood_group || selectedRequestForDonate.bloodGroup} blood has been reserved under your account for <strong className="text-white">{selectedRequestForDonate.patient_name || selectedRequestForDonate.patientName}</strong> at {selectedRequestForDonate.hospital_name || selectedRequestForDonate.hospitalName}.
                  </p>

                  <div className="p-3 rounded-xl bg-space-850 border border-white/10 text-[11px] font-mono text-slate-400 text-left space-y-1">
                    <div>1. Visit hospital within the deadline.</div>
                    <div>2. Open your User Profile â†’ <strong>My Blood Pledges</strong>.</div>
                    <div>3. Upload your donation proof slip to obtain an official Digital Lifesaver Certificate.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRequestForDonate(null)}
                    className="w-full py-3 rounded-xl bg-mars-600 hover:bg-mars-500 text-white font-orbitron font-semibold text-xs tracking-wider transition-colors cursor-pointer"
                  >
                    Close & View Requisitions
                  </button>
                </div>
              ) : (
                /* Confirmation Form State */
                <div className="space-y-5 text-xs font-mono">
                  {donorAvailability?.isInCooldown && (
                    <div
                      id="pledge-modal-cooldown-alert"
                      role="alert"
                      className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-1"
                    >
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Temporarily Unavailable — 3-Month Cooldown</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        You may pledge again on{' '}
                        <strong className="text-white">
                          {formatCalendarDate(donorAvailability.reavailableDate) || donorAvailability.reavailableDate}
                        </strong>
                        {donorAvailability.daysRemaining > 0 ? ` (${donorAvailability.daysRemaining} days remaining)` : ''}.
                      </p>
                      <p className="text-[10px] text-amber-200/80">
                        {donorAvailability.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                      </p>
                    </div>
                  )}

                  {pledgeError && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                      {pledgeError}
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-space-850 border border-white/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Patient:</span>
                      <span className="text-white font-bold">{selectedRequestForDonate.patient_name || selectedRequestForDonate.patientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Blood Group:</span>
                      <span className="text-mars-400 font-bold">{selectedRequestForDonate.blood_group || selectedRequestForDonate.bloodGroup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hospital:</span>
                      <span className="text-white">{selectedRequestForDonate.hospital_name || selectedRequestForDonate.hospitalName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-slate-300">{selectedRequestForDonate.hospital_city || selectedRequestForDonate.city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contact:</span>
                      <span className="text-slate-300">{selectedRequestForDonate.contact_person || selectedRequestForDonate.contactPerson} ({selectedRequestForDonate.contact_phone || selectedRequestForDonate.contactPhone})</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Important Donor Commitment</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      By confirming this pledge, you reserve 1 unit of blood. The patient's clinical team will count on your donation. If you cannot donate, please cancel your pledge promptly from your profile to release the reservation for other donors.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setSelectedRequestForDonate(null)}
                      className="px-4 py-2 rounded-xl bg-space-850 text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmPledge}
                      disabled={pledgeLoading || Boolean(donorAvailability?.isInCooldown)}
                      aria-disabled={donorAvailability?.isInCooldown ? 'true' : undefined}
                      aria-describedby={donorAvailability?.isInCooldown ? 'pledge-modal-cooldown-alert' : undefined}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mars-600/30"
                    >
                      {pledgeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 fill-white" />}
                      <span>{donorAvailability?.isInCooldown ? 'Cooldown Active' : 'Confirm My Pledge'}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </section>
  );
}

