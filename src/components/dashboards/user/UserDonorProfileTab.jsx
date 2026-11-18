import React, { useState, useRef } from 'react';
import { 
  User, 
  Camera, 
  Eye, 
  EyeOff, 
  Upload, 
  Droplet, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Heart,
  UserPlus,
  Clock,
  Edit2,
  X,
  Loader2,
  Check
} from 'lucide-react';
import DonorAvatar from '../../common/DonorAvatar';
import CalendarDatePicker, { formatDisplayDate, calculateAgeFromDob } from '../../common/CalendarDatePicker';
import { donorApi, userApi } from '../../../services/api';
import { validateAndPrepareDonorPhoto } from '../../../utils/donorPhotoValidator';
import { resolveDonorAvailability, formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../../utils/donorAvailability';

export default function UserDonorProfileTab({
  currentUser,
  donorProfile,
  loading = false,
  onProfileUpdated,
  onOpenDonorRegistration
}) {
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState({ text: '', type: '' });
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    mobileNumber: '',
    email: '',
    dob: '',
    gender: 'Male',
    bloodGroup: 'O+',
    city: '',
    pincode: '',
    profilePhoto: null
  });
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const editPhotoInputRef = useRef(null);

  const isEnlisted = Boolean(donorProfile?.isDonor || donorProfile?.userId);

  const handleOpenEdit = () => {
    setEditFormData({
      fullName: currentUser?.fullName || '',
      mobileNumber: currentUser?.mobileNumber || '',
      email: currentUser?.email || '',
      dob: currentUser?.dateOfBirth || '',
      gender: currentUser?.gender || 'Male',
      bloodGroup: currentUser?.bloodGroup || donorProfile?.bloodGroup || 'O+',
      city: currentUser?.city || donorProfile?.city || '',
      pincode: donorProfile?.pincode || '',
      profilePhoto: null
    });
    setEditPhotoPreview(donorProfile?.photoUrl || null);
    setEditError('');
    setEditSuccess('');
    setIsEditModalOpen(true);
  };

  const handleEditPhotoSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const prepared = await validateAndPrepareDonorPhoto(file);
    if (!prepared.valid) {
      setEditError(prepared.error);
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
      return;
    }

    setEditFormData(prev => ({ ...prev, profilePhoto: prepared.dataUrl }));
    setEditPhotoPreview(prepared.dataUrl);
    setEditError('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    if (!editFormData.fullName.trim() || editFormData.fullName.trim().length < 2) {
      setEditError('Full Legal Name must be between 2 and 100 characters.');
      return;
    }

    if (!editFormData.city.trim() || editFormData.city.trim().length < 2) {
      setEditError('City must be between 2 and 100 characters.');
      return;
    }

    if (editFormData.dob) {
      const age = calculateAgeFromDob(editFormData.dob);
      if (age === null || age === -1) {
        setEditError('Please select a valid past Date of Birth.');
        return;
      }
      if (age < 18 || age > 65) {
        setEditError('Voluntary blood donors must be aged between 18 and 65 years.');
        return;
      }
    }

    if (editFormData.pincode && !/^\d{6}$/.test(editFormData.pincode.trim())) {
      setEditError('Local pincode must be exactly 6 digits.');
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        fullName: editFormData.fullName.trim(),
        dob: editFormData.dob || null,
        gender: editFormData.gender,
        bloodGroup: editFormData.bloodGroup,
        city: editFormData.city.trim(),
        pincode: editFormData.pincode ? editFormData.pincode.trim() : null
      };

      if (editFormData.profilePhoto) {
        payload.profilePhoto = editFormData.profilePhoto;
      }

      const res = await userApi.updateProfile(payload);
      if (res.success) {
        setEditSuccess('Profile updated successfully!');
        if (onProfileUpdated) onProfileUpdated();
        window.dispatchEvent(new CustomEvent('donor-registered'));
        setTimeout(() => {
          setIsEditModalOpen(false);
          setEditSuccess('');
        }, 1200);
      } else {
        setEditError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setEditError('Network connection error while updating profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const prepared = await validateAndPrepareDonorPhoto(file);
    if (!prepared.valid) {
      setPhotoMessage({ text: prepared.error, type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoLoading(true);
    setPhotoMessage({ text: '', type: '' });

    try {
      const res = await donorApi.updatePhoto(prepared.dataUrl);
      if (res.success) {
        setPhotoMessage({ text: 'Profile photo updated successfully!', type: 'success' });
        if (onProfileUpdated) onProfileUpdated();
        window.dispatchEvent(new CustomEvent('donor-registered'));
      } else {
        setPhotoMessage({ text: res.error || 'Failed to update photo.', type: 'error' });
      }
    } catch (err) {
      setPhotoMessage({ text: 'Network error updating photo.', type: 'error' });
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTogglePrivacy = async () => {
    if (!donorProfile) return;

    setPrivacyLoading(true);
    setPrivacyMessage({ text: '', type: '' });

    try {
      const newStatus = !donorProfile.isPhotoPublic;
      const res = await donorApi.updatePrivacy(newStatus);
      if (res.success) {
        setPrivacyMessage({ text: res.message || 'Privacy preference updated.', type: 'success' });
        if (onProfileUpdated) onProfileUpdated();
      } else {
        setPrivacyMessage({ text: res.error || 'Failed to update privacy.', type: 'error' });
      }
    } catch (err) {
      setPrivacyMessage({ text: 'Network error updating privacy.', type: 'error' });
    } finally {
      setPrivacyLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Main Grid: Photo Settings & Clinical Attributes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Donor Visual Photo Card */}
        <div className="card-glass rounded-2xl border border-white/10 p-6 space-y-5 text-center">
          <h3 className="font-orbitron font-bold text-sm text-white text-left">
            Donor Visual Identity
          </h3>

          <div className="relative w-28 h-28 mx-auto">
            {donorProfile?.photoUrl ? (
              <DonorAvatar src={donorProfile.photoUrl} name={currentUser?.fullName} size="xl" className="w-28 h-28 text-3xl" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-mars-600 to-mars-flame flex items-center justify-center font-orbitron font-bold text-4xl text-white shadow-xl">
                {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}

            {photoLoading && (
              <div className="absolute inset-0 rounded-full bg-space-950/70 backdrop-blur-xs flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-mars-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="font-orbitron font-bold text-base text-white">
              {currentUser?.fullName}
            </h4>
            <p className="text-xs font-mono text-slate-400">
              Registered Voluntary Donor
            </p>
          </div>

          {/* Photo Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-mono text-slate-200 hover:text-white bg-space-850 hover:bg-space-800 border border-white/10 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-mars-400" />
              <span>{photoLoading ? 'Uploading...' : (donorProfile?.photoUrl ? 'Replace Profile Photo' : 'Upload Mandatory Photo')}</span>
            </button>

            <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
              Verified donors maintain an active photo (JPEG, PNG, WebP · max 3 MB). You can replace your photo anytime.
            </p>
          </div>

          {/* Privacy Toggle */}
          {isEnlisted && (
            <div className="pt-3 border-t border-white/5 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">Photo Visibility:</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  donorProfile?.isPhotoPublic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {donorProfile?.isPhotoPublic ? 'Public' : 'Protected'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {donorProfile?.isPhotoPublic
                  ? 'Your photo is visible on public verified donor lists.'
                  : 'Your photo is only visible to authorized hospital medical staff.'}
              </p>
              <button
                onClick={handleTogglePrivacy}
                disabled={privacyLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-space-850 hover:bg-space-800 border border-white/10 transition-colors cursor-pointer"
              >
                {donorProfile?.isPhotoPublic ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>Switch to Protected Mode</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Make Photo Public</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Notification Messages */}
          {photoMessage.text && (
            <div className={`p-2.5 rounded-xl text-xs font-mono flex items-center gap-2 ${
              photoMessage.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}>
              {photoMessage.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{photoMessage.text}</span>
            </div>
          )}

          {privacyMessage.text && (
            <div className={`p-2.5 rounded-xl text-xs font-mono flex items-center gap-2 ${
              privacyMessage.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}>
              {privacyMessage.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{privacyMessage.text}</span>
            </div>
          )}
        </div>

        {/* Right 2 Columns: Clinical Attributes & Contact Information */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Clinical Profile Card */}
          <div className="card-glass rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
                  <Droplet className="w-4 h-4 fill-mars-400" />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-white">
                    Clinical Donor Record
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Official medical demographics registered in the system
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/40">
                  {currentUser?.bloodGroup || 'Blood Group N/A'}
                </span>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-space-800 hover:bg-space-750 text-slate-200 hover:text-white border border-white/10 hover:border-mars-500/40 text-xs font-mono transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-mars-400" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Full Legal Name</span>
                <span className="text-white font-semibold">{currentUser?.fullName || 'N/A'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Age Eligibility</span>
                <span className="text-white font-semibold">{currentUser?.age ? `${currentUser.age} years (Eligible)` : '18-65'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Date of Birth</span>
                <span className="text-white font-semibold">{currentUser?.dateOfBirth ? formatDisplayDate(currentUser.dateOfBirth) : 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Gender</span>
                <span className="text-white font-semibold">{currentUser?.gender || 'Not specified'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Registered City</span>
                <span className="text-white font-semibold">{currentUser?.city || 'India'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Local Pincode</span>
                <span className="text-white font-semibold">{donorProfile?.pincode || 'Recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Verified Mobile Number</span>
                <span className="text-white font-semibold">{currentUser?.mobileNumber || 'N/A'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-space-850/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Verified Email</span>
                <span className="text-white font-semibold truncate block">{currentUser?.email || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Operational Readiness Card */}
          <div className="card-glass rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-orbitron font-bold text-sm text-white">
                  Operational Readiness &amp; Availability
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Real-time status for urgent donor notifications
                </p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {(() => {
                const donorAvail = resolveDonorAvailability(donorProfile);
                const reavailFormatted = formatCalendarDate(donorAvail.reavailableDate);
                const verifiedFormatted = formatCalendarDate(donorAvail.lastVerifiedDonationDate);
                const selfReportedFormatted = formatCalendarDate(donorProfile?.lastDonationDate);

                return (
                  <>
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-space-850/60 border border-white/5 gap-2">
                      <div>
                        <div className="text-white font-semibold">24/7 Emergency Dispatch Availability</div>
                        <div className="text-[11px] text-slate-400">
                          {donorAvail.isInCooldown
                            ? 'Paused automatically during 3-month verified recovery cooldown'
                            : 'Can be pinged when critical blood shortages occur'}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                          donorAvail.isInCooldown
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : donorAvail.isAvailable
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {donorAvail.isInCooldown
                          ? 'Temporarily Unavailable'
                          : donorAvail.isAvailable
                          ? 'Available'
                          : donorAvail.label}
                      </span>
                    </div>

                    {donorAvail.isInCooldown && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                        <div className="flex items-center justify-between text-amber-300 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>3-Month Verified Donation Cooldown</span>
                          </span>
                          {donorAvail.daysRemaining > 0 && (
                            <span>{donorAvail.daysRemaining} days left</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-200">
                          Re-available on:{' '}
                          <strong className="text-white">{reavailFormatted || donorAvail.reavailableDate}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400 leading-relaxed">
                          {donorAvail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-space-850/60 border border-white/5 gap-2">
                      <div>
                        <div className="text-white font-semibold">
                          {verifiedFormatted ? 'Last Verified Blood Donation' : 'Last Recorded Blood Donation'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {verifiedFormatted
                            ? 'Confirmed by Admin proof approval — governs 3-month re-availability'
                            : '3-month cooldown starts only upon Admin verification of a donation proof'}
                        </div>
                      </div>
                      <span className="text-slate-200 font-bold shrink-0">
                        {verifiedFormatted || selfReportedFormatted || 'None recorded'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

        </div>

      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl my-8 rounded-3xl bg-space-900 border border-white/15 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-white">
                    Edit Donor Profile
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Update your verified demographics &amp; identification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contact Security Notice */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs font-mono text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-300 block">Contact Protection Policy</span>
                <span className="text-[11px] text-amber-200/80 leading-relaxed block">
                  Mobile number and Email address serve as trusted account-recovery channels. While two-factor OTP verification is disabled, contact modifications are locked to safeguard your account against unauthorized recovery takeover.
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">

              {/* Photo Upload Section */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-space-850/60 border border-white/5">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/15 bg-space-900 shrink-0 flex items-center justify-center">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-500" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <input
                    type="file"
                    ref={editPhotoInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleEditPhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editPhotoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono text-slate-200 hover:text-white bg-space-800 hover:bg-space-750 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-mars-400" />
                    <span>Upload New Photo</span>
                  </button>
                  <p className="text-[10px] font-mono text-slate-400">JPEG, PNG, WebP · max 3 MB</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

                {/* Full Legal Name */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-300">
                    Full Legal Name <span className="text-mars-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-mars-500"
                    required
                  />
                </div>

                {/* Blood Group */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-300">
                    Blood Group <span className="text-mars-400">*</span>
                  </label>
                  <select
                    value={editFormData.bloodGroup}
                    onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-mars-500 cursor-pointer"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg} className="bg-space-900 text-white">
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date of Birth */}
                <div className="space-y-1">
                  <CalendarDatePicker
                    id="edit-dob"
                    name="dob"
                    label="Date of Birth"
                    placeholder="Select DOB"
                    mode="dob"
                    value={editFormData.dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(newVal) => setEditFormData({ ...editFormData, dob: newVal })}
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1.5">
                    Gender <span className="text-mars-400">*</span>
                  </label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-space-850 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-mars-500 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                {/* Registered City */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-300">
                    City / Location <span className="text-mars-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-mars-500"
                    required
                  />
                </div>

                {/* Local Pincode */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-300">
                    Local PIN Code (6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={editFormData.pincode}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    placeholder="e.g. 400001"
                    className="w-full px-3 py-2 rounded-xl bg-space-850 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-mars-500"
                  />
                </div>

                {/* Mobile (Protected) */}
                <div className="space-y-1 opacity-70">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                    <span>Mobile Number</span>
                    <span className="text-[10px] text-amber-400">Locked (OTP Off)</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.mobileNumber}
                    disabled
                    className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/5 text-xs font-mono text-slate-400 cursor-not-allowed"
                  />
                </div>

                {/* Email (Protected) */}
                <div className="space-y-1 opacity-70">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                    <span>Email Address</span>
                    <span className="text-[10px] text-amber-400">Locked (OTP Off)</span>
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    disabled
                    className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/5 text-xs font-mono text-slate-400 cursor-not-allowed"
                  />
                </div>

              </div>

              {/* Error and Success Alerts */}
              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-space-850 hover:bg-space-800 border border-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Profile Changes'
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
