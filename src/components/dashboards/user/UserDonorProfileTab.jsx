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
  Clock
} from 'lucide-react';
import DonorAvatar from '../../common/DonorAvatar';
import { donorApi } from '../../../services/api';
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

  const isEnlisted = Boolean(donorProfile?.isDonor || donorProfile?.userId);

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

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-mars-500/20 text-mars-400 border border-mars-500/40">
                {currentUser?.bloodGroup || 'Blood Group N/A'}
              </span>
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

    </div>
  );
}
