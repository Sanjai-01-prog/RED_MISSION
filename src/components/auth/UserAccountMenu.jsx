import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Bell, 
  Settings, 
  ShieldCheck, 
  Activity, 
  LogOut, 
  ChevronDown, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  MapPin, 
  X,
  Droplet,
  Heart,
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  Upload,
  FileCheck,
  Award,
  Building2,
  Phone,
  LayoutDashboard
} from 'lucide-react';
import { userApi, donorApi, pledgeApi, proofApi, certificateApi } from '../../services/api';
import DonorAvatar from '../common/DonorAvatar';
import { validateAndPrepareDonorPhoto } from '../../utils/donorPhotoValidator';
import { resolveDonorAvailability, formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../utils/donorAvailability';

export default function UserAccountMenu({ currentUser, onLogout, onOpenDonorRegistration, onViewCertificate, onOpenUserDashboard }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'security' | 'activities' | 'settings' | 'delete' | 'pledges'
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  // Pledges state
  const [userPledges, setUserPledges] = useState([]);
  const [loadingPledges, setLoadingPledges] = useState(false);
  const [pledgeCancelLoading, setPledgeCancelLoading] = useState(false);
  const [selectedProofPledge, setSelectedProofPledge] = useState(null);
  const [proofImageBase64, setProofImageBase64] = useState('');
  const [proofPreviewUrl, setProofPreviewUrl] = useState('');
  const [proofUploadLoading, setProofUploadLoading] = useState(false);
  const [proofUploadError, setProofUploadError] = useState('');
  const [proofUploadSuccess, setProofUploadSuccess] = useState('');

  // Donor profile state
  const [donorProfile, setDonorProfile] = useState(null);
  const [photoUpdateLoading, setPhotoUpdateLoading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const [privacyUpdateLoading, setPrivacyUpdateLoading] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const photoInputRef = useRef(null);

  // Security Activity state
  const [securityData, setSecurityData] = useState({ activities: [], activeSessions: [] });
  const [loadingSecurity, setLoadingSecurity] = useState(false);

  // Deletion state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('Personal privacy preference');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Fetch donor profile on mount or user change
  const fetchDonorProfile = async () => {
    try {
      const res = await donorApi.getProfile();
      if (res.success && (res.isDonor || res.donor)) {
        setDonorProfile(res.donor);
      } else {
        setDonorProfile(null);
      }
    } catch (e) {
      // ignore
    }
  };

  // Fetch user pledges
  const fetchUserPledges = async () => {
    setLoadingPledges(true);
    try {
      const res = await pledgeApi.getMyPledges();
      if (res.success && res.pledges) {
        setUserPledges(res.pledges);
      }
    } catch (e) {
      console.error('Failed to fetch user pledges', e);
    } finally {
      setLoadingPledges(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDonorProfile();
      fetchUserPledges();
    }
    const handleDonorEvent = () => {
      fetchDonorProfile();
      fetchUserPledges();
    };
    window.addEventListener('donor-registered', handleDonorEvent);
    window.addEventListener('proof-reviewed', handleDonorEvent);
    window.addEventListener('pledge-updated', handleDonorEvent);
    return () => {
      window.removeEventListener('donor-registered', handleDonorEvent);
      window.removeEventListener('proof-reviewed', handleDonorEvent);
      window.removeEventListener('pledge-updated', handleDonorEvent);
    };
  }, [currentUser]);

  // Cancel Pledge
  const handleCancelPledge = async (pledgeId) => {
    if (!confirm('Are you sure you want to cancel this pledge? The reserved unit will be released for other donors.')) return;
    setPledgeCancelLoading(true);
    try {
      const res = await pledgeApi.cancel(pledgeId, 'Cancelled by donor');
      if (res.success) {
        fetchUserPledges();
      } else {
        alert(res.error || 'Failed to cancel pledge.');
      }
    } catch (err) {
      alert('Network error cancelling pledge.');
    } finally {
      setPledgeCancelLoading(false);
    }
  };

  // Proof File Select
  const handleProofFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProofUploadError('File exceeds maximum size of 5 MB.');
      return;
    }

    setProofUploadError('');
    setProofUploadSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setProofImageBase64(event.target.result);
      setProofPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Submit Proof Photo
  const handleUploadProofSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProofPledge || !proofImageBase64) return;

    setProofUploadLoading(true);
    setProofUploadError('');
    setProofUploadSuccess('');

    try {
      const res = await proofApi.upload(selectedProofPledge.id, proofImageBase64);
      if (res.success) {
        setProofUploadSuccess('Donation proof uploaded successfully! Your submission is now Under Admin Review.');
        fetchUserPledges();
        setTimeout(() => {
          setSelectedProofPledge(null);
          setProofImageBase64('');
          setProofPreviewUrl('');
          setProofUploadSuccess('');
        }, 1500);
      } else {
        setProofUploadError(res.error || 'Failed to upload donation proof.');
      }
    } catch (err) {
      setProofUploadError('Network error uploading proof. Please try again.');
    } finally {
      setProofUploadLoading(false);
    }
  };

  // Open Certificate from approved pledge
  const handleInspectCertificate = async (pledge) => {
    try {
      const res = await certificateApi.getCertificate(pledge.id);
      if (res.success && res.certificate) {
        if (onViewCertificate) {
          onViewCertificate(res.certificate);
        }
      } else {
        alert(res.error || 'Certificate not available.');
      }
    } catch (err) {
      alert('Failed to load certificate.');
    }
  };

  // Handle Photo Update from profile modal
  const handlePhotoFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const prepared = await validateAndPrepareDonorPhoto(file);
    if (!prepared.valid) {
      setPhotoMessage(prepared.error);
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    setPhotoUpdateLoading(true);
    setPhotoMessage('');
    try {
      const res = await donorApi.updatePhoto(prepared.dataUrl);
      if (res.success) {
        setPhotoMessage('Profile photo updated successfully!');
        fetchDonorProfile();
        window.dispatchEvent(new CustomEvent('donor-registered'));
      } else {
        setPhotoMessage(res.error || 'Failed to update photo.');
      }
    } catch (err) {
      setPhotoMessage('Network error updating photo.');
    } finally {
      setPhotoUpdateLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Handle Photo Privacy Toggle
  const handleTogglePrivacy = async () => {
    if (!donorProfile) return;
    setPrivacyUpdateLoading(true);
    setPrivacyMessage('');
    try {
      const newStatus = !donorProfile.isPhotoPublic;
      const res = await donorApi.updatePrivacy(newStatus);
      setPrivacyUpdateLoading(false);
      if (res.success) {
        setPrivacyMessage(res.message || 'Privacy settings updated successfully.');
        fetchDonorProfile();
      } else {
        setPrivacyMessage(res.error || 'Failed to update privacy settings.');
      }
    } catch (err) {
      setPrivacyUpdateLoading(false);
      setPrivacyMessage('Network error updating privacy settings.');
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('#user-account-menu')) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const openSecurityModal = async () => {
    setActiveModal('security');
    setDropdownOpen(false);
    setLoadingSecurity(true);
    const res = await userApi.getSecurityActivity();
    setLoadingSecurity(false);
    if (res.success) {
      setSecurityData({
        activities: res.activities || [],
        activeSessions: res.activeSessions || []
      });
    }
  };

  const handleLogoutOtherSessions = async () => {
    const res = await userApi.logoutOtherSessions();
    if (res.success) {
      openSecurityModal(); // Refresh
    }
  };

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteLoading(true);

    const res = await userApi.deleteAccount(deletePassword, deleteReason);
    setDeleteLoading(false);

    if (res.success) {
      setActiveModal(null);
      onLogout();
      alert('Your account and personal data have been permanently removed.');
    } else {
      setDeleteError(res.error || 'Failed to delete account.');
    }
  };

  if (!currentUser) return null;

  return (
    <div id="user-account-menu" className="relative flex items-center gap-2">
      
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="p-2 rounded-full bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10 transition-colors relative cursor-pointer"
          aria-label="View Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-mars-500 animate-pulse"></span>
        </button>

        {notificationsOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-space-900 border border-white/10 shadow-2xl p-4 z-50 text-xs animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
              <span className="font-orbitron font-bold text-white text-xs">Notifications</span>
              <span className="text-[10px] font-mono text-emerald-400">All Systems Normal</span>
            </div>
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-xl bg-space-850 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-mars-400 font-semibold text-[11px]">
                  <Droplet className="w-3 h-3 fill-mars-400" />
                  <span>Welcome to RED MISSION</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Your voluntary donor profile is active. You will receive notifications when matching blood requests arise in your area.
                </p>
                <span className="text-[9px] font-mono text-slate-500 block">Just now</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Avatar Pill */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-space-850 hover:bg-space-800 border border-white/10 text-xs text-white transition-all cursor-pointer"
      >
        {donorProfile?.photoUrl ? (
          <DonorAvatar src={donorProfile.photoUrl} name={currentUser.fullName} size="xs" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-mars-600 to-mars-flame flex items-center justify-center font-bold text-[11px]">
            {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <div className="flex flex-col text-left max-w-[110px] truncate hidden sm:block">
          <span className="text-white font-medium truncate text-xs">{currentUser.fullName || 'Donor'}</span>
          <span className="text-[10px] font-mono text-mars-400">{currentUser.bloodGroup || 'Donor'}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-space-900 border border-white/10 shadow-2xl p-2 z-50 text-xs animate-in fade-in">
          
          {/* Header */}
          <div className="p-3 border-b border-white/5 mb-1">
            <div className="font-orbitron font-bold text-white text-sm truncate">{currentUser.fullName}</div>
            <div className="text-[11px] font-mono text-slate-400 truncate">{currentUser.email}</div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mars-500/10 text-mars-400 border border-mars-500/30 text-[10px] font-mono font-bold mt-1.5">
              <Droplet className="w-2.5 h-2.5 fill-mars-400" />
              <span>Blood Group: {currentUser.bloodGroup}</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 font-mono">
            <button
              onClick={() => {
                setDropdownOpen(false);
                if (onOpenUserDashboard) {
                  onOpenUserDashboard();
                } else {
                  window.location.hash = '#user-dashboard';
                }
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-white bg-gradient-to-r from-mars-600 to-mars-flame hover:brightness-110 shadow-md shadow-mars-600/20 font-bold transition-all text-left cursor-pointer mb-1"
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                <span className="text-xs">User Dashboard</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-white/70" />
            </button>

            <button
              onClick={() => { setActiveModal('profile'); setDropdownOpen(false); setPhotoMessage(''); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-mars-400" />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => { setActiveModal('pledges'); setDropdownOpen(false); fetchUserPledges(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>My Blood Pledges</span>
              </div>
              {userPledges.filter(p => p.rawStatus !== 'CANCELLED').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-mars-500/20 text-mars-300 text-[10px] font-bold">
                  {userPledges.filter(p => p.rawStatus !== 'CANCELLED').length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveModal('activities'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>My Activities</span>
            </button>

            <button
              onClick={() => { setActiveModal('settings'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Account Settings</span>
            </button>

            <button
              onClick={openSecurityModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Security &amp; Sessions</span>
            </button>
          </div>

          <div className="pt-1 mt-1 border-t border-white/5 space-y-0.5 font-mono">
            <button
              onClick={() => { setActiveModal('delete'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account &amp; Data</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-mars-400" />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: MY PROFILE                                  */}
      {/* ==================================================== */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg card-glass rounded-3xl border border-white/15 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-mars-500/15 border border-mars-500/30 text-mars-400">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-orbitron font-bold text-lg text-white">
                  {donorProfile ? 'Donor Profile' : 'User Account Profile'}
                </h3>
              </div>
              <button 
                onClick={() => { setActiveModal(null); setPhotoMessage(''); }} 
                className="p-1 rounded-lg bg-space-850 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Avatar & Photo Management */}
            <div className="p-4 rounded-2xl bg-space-900 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative">
                <DonorAvatar 
                  src={donorProfile?.photoUrl} 
                  name={currentUser.fullName} 
                  size="xl" 
                  bloodGroup={currentUser.bloodGroup} 
                />
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="font-orbitron font-bold text-base text-white">{currentUser.fullName}</div>
                <div className="text-xs font-mono text-mars-400">Blood Group: {currentUser.bloodGroup}</div>
                
                {donorProfile ? (
                  <div className="pt-2">
                    <input 
                      type="file" 
                      ref={photoInputRef} 
                      accept="image/jpeg,image/png,image/webp" 
                      onChange={handlePhotoFileSelect} 
                      className="hidden" 
                    />
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current && photoInputRef.current.click()}
                        disabled={photoUpdateLoading}
                        className="px-3 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-200 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-mars-400" />
                        <span>{photoUpdateLoading ? 'Updating...' : (donorProfile.photoUrl ? 'Replace Profile Photo' : 'Upload Mandatory Photo')}</span>
                      </button>
                      <span className="text-[10px] font-mono text-slate-400">
                        Verified donors retain a photo (JPEG, PNG, WebP · max 3 MB).
                      </span>
                    </div>
                    {photoMessage && (
                      <p className={`text-[11px] font-mono mt-1.5 ${photoMessage.includes('successfully') || photoMessage.includes('removed') ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {photoMessage}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Donor Clinical & Status Card */}
            {donorProfile ? (() => {
              const donorAvail = resolveDonorAvailability(donorProfile);
              const reavailStr = formatCalendarDate(donorAvail.reavailableDate);
              const lastVerifiedStr = formatCalendarDate(donorAvail.lastVerifiedDonationDate);
              return (
                <div className="p-4 rounded-2xl bg-mars-500/10 border border-mars-500/30 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-mars-500/20">
                    <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">Donor Status:</span>
                    {donorAvail.isInCooldown ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        3-Month Recovery Cooldown
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        ✓ Verified Voluntary Lifesaver
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Emergency Availability:</span>
                    <span className={
                      donorAvail.isInCooldown
                        ? 'text-amber-300 font-bold'
                        : donorAvail.isAvailable
                        ? 'text-emerald-400 font-bold'
                        : 'text-slate-400'
                    }>
                      {donorAvail.isInCooldown
                        ? 'Temporarily Unavailable (Cooldown)'
                        : donorAvail.isAvailable
                        ? 'Active & On-Call'
                        : donorAvail.label}
                    </span>
                  </div>
                  {donorAvail.isInCooldown && reavailStr && (
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Available Again On:</span>
                      <span className="text-amber-200 font-bold">
                        {reavailStr} ({donorAvail.daysRemaining}d)
                      </span>
                    </div>
                  )}
                  {lastVerifiedStr && (
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Last Verified Donation:</span>
                      <span className="text-white font-semibold">{lastVerifiedStr}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Total Recorded Donations:</span>
                    <span className="text-white font-bold">{donorProfile.totalDonationsCount || 0} Donations</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Local PIN Code:</span>
                    <span className="text-white">{donorProfile.pincode || currentUser.pincode || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Selfie Consent Recorded:</span>
                    <span className="text-slate-300">
                      {donorProfile.selfieConsentAt ? new Date(donorProfile.selfieConsentAt).toLocaleDateString() : 'Yes'}
                    </span>
                  </div>
                  {donorAvail.isInCooldown && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-white/5 leading-snug">
                      {donorAvail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                    </p>
                  )}
                </div>
              );
            })() : (
              <div className="p-3.5 rounded-xl bg-space-900/60 border border-white/5 text-xs text-slate-300 flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-mars-400 shrink-0" />
                <span>Enlist as a voluntary donor to enable emergency alerts and save lives in your neighborhood.</span>
              </div>
            )}

            {/* Photo Privacy & Directory Visibility Settings */}
            {donorProfile && (
              <div className="p-4 rounded-2xl bg-space-900 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-orbitron font-semibold text-white flex items-center gap-1.5">
                      {donorProfile.isPhotoPublic ? (
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Photo Directory Visibility</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        donorProfile.isPhotoPublic 
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' 
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}>
                        {donorProfile.isPhotoPublic ? 'Public' : 'Private (Default)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {donorProfile.isPhotoPublic
                        ? 'Your photograph is visible to community members in the voluntary donor directory.'
                        : 'Your photograph is private (visible only to you and verified hospital administrators).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={privacyUpdateLoading}
                    onClick={handleTogglePrivacy}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                      donorProfile.isPhotoPublic
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                    }`}
                  >
                    {privacyUpdateLoading
                      ? 'Saving...'
                      : donorProfile.isPhotoPublic
                      ? 'Switch to Private'
                      : 'Opt In to Public'}
                  </button>
                </div>
                {privacyMessage && (
                  <p className={`text-[11px] font-mono ${privacyMessage.includes('error') || privacyMessage.includes('Failed') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {privacyMessage}
                  </p>
                )}
              </div>
            )}

            {/* Account Details */}
            <div className="p-4 rounded-2xl bg-space-900 border border-white/10 space-y-2.5 text-xs font-mono">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider pb-1 border-b border-white/5">
                Account Credentials &amp; Verification
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Full Name:</span>
                <span className="text-white font-bold">{currentUser.fullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Blood Group:</span>
                <span className="text-mars-400 font-bold">{currentUser.bloodGroup}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Email:</span>
                <span className="text-white">{currentUser.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Mobile:</span>
                <span className="text-white">{currentUser.mobileNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Location:</span>
                <span className="text-white">{currentUser.city}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Age:</span>
                <span className="text-white">{currentUser.age} Years</span>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={() => { setActiveModal(null); setPhotoMessage(''); }}
                className="px-5 py-2 rounded-xl bg-mars-600 hover:bg-mars-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: SECURITY & SESSIONS                         */}
      {/* ==================================================== */}
      {activeModal === 'security' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-2xl card-glass rounded-3xl border border-white/15 p-6 max-h-[85vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-orbitron font-bold text-lg text-white">Security &amp; Active Sessions</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg bg-space-850 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Sessions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-orbitron font-semibold text-xs uppercase text-slate-300 tracking-wider">
                  Active Browser Sessions ({securityData.activeSessions.length})
                </h4>
                {securityData.activeSessions.length > 1 && (
                  <button
                    onClick={handleLogoutOtherSessions}
                    className="text-xs font-mono text-rose-400 hover:text-white underline cursor-pointer"
                  >
                    Log out all other sessions
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {securityData.activeSessions.map((s, sIdx) => (
                  <div key={s.id || s.session_id || `session-${sIdx}`} className="p-3.5 rounded-xl bg-space-900 border border-white/10 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-space-850 border border-white/10 flex items-center justify-center text-slate-400">
                        {s.device_info?.includes('Mobile') ? <Smartphone className="w-4 h-4 text-cyan-400" /> : <Laptop className="w-4 h-4 text-mars-400" />}
                      </div>
                      <div>
                        <div className="text-white font-semibold flex items-center gap-1.5">
                          <span>{s.device_info || 'Web Browser'}</span>
                          {s.is_current_session ? (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Current Session
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          IP: {s.ip_address} • Last Active: {new Date(s.last_activity_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Audit Log */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <h4 className="font-orbitron font-semibold text-xs uppercase text-slate-300 tracking-wider">
                Recent Security Activity
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {securityData.activities.map((a, i) => (
                  <div key={a.id || a.activity_id || `act-${i}`} className="p-2.5 rounded-lg bg-space-900 border border-white/5 text-[11px] font-mono flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{a.description}</div>
                      <div className="text-[10px] text-slate-500">{a.ip_address} • {a.location || 'India'}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: DELETE ACCOUNT (PERMANENT CLOSURE)          */}
      {/* ==================================================== */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md">
          <div className="relative w-full max-w-md card-glass rounded-3xl border border-rose-500/40 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-orbitron font-bold text-lg text-white">Permanently Delete Account?</h3>
                <p className="text-[11px] text-rose-400 font-mono">This action is irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              In accordance with data privacy standards, your personal details (name, email, phone) will be permanently purged. Any past voluntary blood donations are retained in strictly anonymized statistical form without any identifying information.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccountSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  Confirm Your Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password to confirm"
                  className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  Reason for Leaving (Optional)
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Relocating, personal privacy"
                  className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-300 text-xs font-mono"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs font-mono disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Placeholders for My Activities and Settings */}
      {activeModal === 'activities' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-md card-glass rounded-3xl border border-white/15 p-6 space-y-4 text-center">
            <h3 className="font-orbitron font-bold text-lg text-white">My Lifesaver Activities</h3>
            <p className="text-xs text-slate-300">
              Phase 1 foundation active: Verified donor registered. In Phase 2, this section will track your historical donations, emergency pledges, and camp appointments.
            </p>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-mars-600 text-white text-xs font-semibold">
              Close
            </button>
          </div>
        </div>
      )}

      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-md card-glass rounded-3xl border border-white/15 p-6 space-y-4 text-center">
            <h3 className="font-orbitron font-bold text-lg text-white">Account Settings</h3>
            <p className="text-xs text-slate-300">
              Emergency email notifications: <strong className="text-emerald-400">Active</strong>.<br />
              Critical Shortage Alerts: <strong className="text-emerald-400">Subscribed</strong>.
            </p>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-mars-600 text-white text-xs font-semibold">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: MY BLOOD PLEDGES (STAGE 2.5)                  */}
      {/* ==================================================== */}
      {activeModal === 'pledges' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl card-glass rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <Heart className="w-4 h-4 fill-rose-500" />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-lg text-white">
                    My Blood Pledges
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Track your active clinical commitments, submit proof slips &amp; download certificates
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchUserPledges}
                  disabled={loadingPledges}
                  className="p-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-slate-300 transition-colors"
                  title="Refresh Pledges"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPledges ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-space-850 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pledges List */}
            {loadingPledges ? (
              <div className="text-center py-10 font-mono text-xs text-slate-400">
                Loading your blood pledges...
              </div>
            ) : userPledges.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Heart className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-orbitron font-bold text-white text-base">No Blood Pledges Found</h4>
                <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
                  You have not pledged for any emergency requisitions yet. View active hospital requisitions to step forward.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {userPledges.map((pledge, pIdx) => (
                  <div
                    key={pledge.id || pledge.requestId || `pledge-${pIdx}`}
                    className="p-5 rounded-2xl bg-space-900 border border-white/10 space-y-4 hover:border-mars-500/30 transition-all text-xs font-mono"
                  >
                    {/* Top Row: Requisition & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-mars-400 block mb-0.5">
                          PLEDGE REF: {pledge.id} // REQ: {pledge.requestId}
                        </span>
                        <h4 className="font-orbitron font-bold text-white text-base">
                          {pledge.patientName}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {pledge.hospitalName}, {pledge.hospitalCity}
                        </p>
                      </div>

                      {/* Display Status Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                        pledge.displayStatus === 'Approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : pledge.displayStatus === 'Under Admin Review'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : pledge.displayStatus === 'Rejected'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : pledge.displayStatus === 'Cancelled'
                          ? 'bg-slate-800 text-slate-400 border border-white/10'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {pledge.displayStatus === 'Approved' && <CheckCircle2 className="w-3 h-3" />}
                        {pledge.displayStatus === 'Rejected' && <AlertTriangle className="w-3 h-3" />}
                        {pledge.displayStatus === 'Under Admin Review' && <Clock className="w-3 h-3" />}
                        <span>{pledge.displayStatus}</span>
                      </span>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-space-950/60 border border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Blood Group</span>
                        <span className="text-mars-400 font-bold">{pledge.bloodGroup}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Units Pledged</span>
                        <span className="text-white font-bold">{pledge.unitsPledged} Unit</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Required By</span>
                        <span className="text-white">{new Date(pledge.requiredBy).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Urgency</span>
                        <span className="text-amber-400">{pledge.urgencyLevel}</span>
                      </div>
                    </div>

                    {/* Rejection Feedback Note */}
                    {pledge.displayStatus === 'Rejected' && pledge.proof?.rejectionReason && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Admin Rejection Reason:</span>
                        </div>
                        <p className="text-slate-300">{pledge.proof.rejectionReason}</p>
                        <p className="text-[10px] text-slate-400 italic">Please upload a revised, legible hospital slip below.</p>
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/5">
                      {/* Cancel Button (available if Pledged or Rejected) */}
                      {(pledge.displayStatus === 'Donation Proof Pending' || pledge.displayStatus === 'Rejected') && (
                        <button
                          type="button"
                          onClick={() => handleCancelPledge(pledge.id)}
                          disabled={pledgeCancelLoading}
                          className="px-3 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel Pledge
                        </button>
                      )}

                      {/* Upload Proof Button */}
                      {(pledge.displayStatus === 'Donation Proof Pending' || pledge.displayStatus === 'Rejected') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProofPledge(pledge);
                            setProofImageBase64('');
                            setProofPreviewUrl('');
                            setProofUploadError('');
                            setProofUploadSuccess('');
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all cursor-pointer shadow-md shadow-mars-600/20"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{pledge.displayStatus === 'Rejected' ? 'Upload Corrected Proof' : 'Upload Donation Proof'}</span>
                        </button>
                      )}

                      {/* Under Review Notice */}
                      {pledge.displayStatus === 'Under Admin Review' && (
                        <span className="text-[11px] text-slate-400 italic flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>Proof submitted ({new Date(pledge.proof?.submittedAt).toLocaleDateString()}) — Awaiting medical verification</span>
                        </span>
                      )}

                      {/* View Certificate Button (for Approved donations) */}
                      {pledge.displayStatus === 'Approved' && (
                        <button
                          type="button"
                          onClick={() => handleInspectCertificate(pledge)}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-white font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all cursor-pointer shadow-md shadow-amber-600/20"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>View Official Certificate</span>
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* SUB-MODAL: UPLOAD DONATION PROOF PHOTO */}
            {selectedProofPledge && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md animate-in fade-in">
                <div className="relative w-full max-w-lg card-glass rounded-3xl border border-white/20 p-6 sm:p-8 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-mars-400" />
                      <h4 className="font-orbitron font-bold text-white text-base">
                        Upload Donation Proof
                      </h4>
                    </div>
                    <button
                      onClick={() => setSelectedProofPledge(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 font-mono">
                    Please upload a photograph of your hospital donation certificate, serology slip, or blood bank receipt for <strong className="text-white">{selectedProofPledge.patientName}</strong> at {selectedProofPledge.hospitalName}.
                  </p>

                  {proofUploadError && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono">
                      {proofUploadError}
                    </div>
                  )}

                  {proofUploadSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                      {proofUploadSuccess}
                    </div>
                  )}

                  <form onSubmit={handleUploadProofSubmit} className="space-y-4">
                    {/* File Picker & Preview */}
                    <div className="border-2 border-dashed border-white/20 rounded-2xl p-4 text-center hover:border-mars-500/50 transition-colors">
                      {proofPreviewUrl ? (
                        <div className="space-y-3">
                          <img
                            src={proofPreviewUrl}
                            alt="Donation Proof Preview"
                            className="max-h-48 mx-auto rounded-xl object-contain shadow-md"
                          />
                          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-xs font-mono text-slate-300 cursor-pointer">
                            <Camera className="w-3.5 h-3.5" />
                            <span>Change Photo</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
                              onChange={handleProofFileSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="block p-6 cursor-pointer space-y-2">
                          <Upload className="w-8 h-8 text-mars-400 mx-auto" />
                          <div className="font-orbitron text-xs font-bold text-white">
                            Choose or Capture Photograph
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            JPEG, PNG or WebP (Max 5 MB)
                          </div>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            onChange={handleProofFileSelect}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setSelectedProofPledge(null)}
                        className="px-4 py-2 rounded-xl bg-space-850 text-slate-300 text-xs font-mono"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={proofUploadLoading || !proofImageBase64}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider flex items-center gap-2 hover:brightness-110 disabled:opacity-50 cursor-pointer shadow-lg shadow-mars-600/30"
                      >
                        {proofUploadLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>Submit for Verification</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
