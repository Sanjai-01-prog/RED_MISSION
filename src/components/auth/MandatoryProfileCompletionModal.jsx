import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Lock,
  Heart,
  Droplet
} from 'lucide-react';
import CalendarDatePicker from '../common/CalendarDatePicker';
import { calculateAgeFromDob, formatDisplayDate } from '../../utils/calendarUtils';
import { userApi } from '../../services/api';

const APPROVED_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function MandatoryProfileCompletionModal({
  isOpen,
  currentUser,
  onComplete,
  onLogout
}) {
  if (!isOpen || !currentUser) return null;

  // Determine what is missing on the existing legacy account
  const hasExistingDob = Boolean(currentUser.dateOfBirth);
  const hasExistingGender = Boolean(currentUser.gender);

  const [dob, setDob] = useState(currentUser.dateOfBirth || '');
  const [gender, setGender] = useState(currentUser.gender || '');
  const [calculatedAge, setCalculatedAge] = useState(null);
  const [ageError, setAgeError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  // Re-calculate dynamic age whenever DOB changes
  useEffect(() => {
    if (!dob) {
      setCalculatedAge(null);
      setAgeError('');
      return;
    }

    const age = calculateAgeFromDob(dob);
    if (age === null) {
      setCalculatedAge(null);
      setAgeError('Please enter a valid date in YYYY-MM-DD format.');
    } else if (age === -1) {
      setCalculatedAge(null);
      setAgeError('Date of birth cannot be in the future.');
    } else if (age < 18) {
      setCalculatedAge(age);
      setAgeError('Voluntary blood donors must be at least 18 years old.');
    } else if (age > 65) {
      setCalculatedAge(age);
      setAgeError('Voluntary blood donors must be 65 years or younger.');
    } else {
      setCalculatedAge(age);
      setAgeError('');
    }
  }, [dob]);

  const isFormValid = Boolean(
    dob &&
    gender &&
    APPROVED_GENDERS.includes(gender) &&
    calculatedAge !== null &&
    calculatedAge >= 18 &&
    calculatedAge <= 65 &&
    !ageError
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setSubmitError('');

    try {
      // Reuse the existing authenticated PUT /api/user/profile endpoint
      // Only send the fields being completed to avoid overwriting unchanged fields
      const payload = {};
      if (!hasExistingDob || dob !== currentUser.dateOfBirth) {
        payload.dob = dob;
      }
      if (!hasExistingGender || gender !== currentUser.gender) {
        payload.gender = gender;
      }

      const res = await userApi.updateProfile(payload);

      if (res.success && res.user) {
        // Broadcast profile completion event
        window.dispatchEvent(new CustomEvent('profile-completed', { detail: res.user }));
        if (onComplete) {
          onComplete(res.user);
        }
      } else {
        setSubmitError(res.error || 'Failed to update profile. Please verify your inputs and retry.');
      }
    } catch (err) {
      setSubmitError(err?.message || 'A network error occurred while updating your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-completion-title"
    >
      <div className="relative w-full max-w-lg card-glass rounded-2xl border border-mars-500/40 p-6 md:p-8 space-y-6 shadow-2xl shadow-mars-900/40 animate-fade-in my-8">

        {/* Header with Mandatory Badge */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono tracking-wider uppercase">
            <ShieldAlert className="w-3.5 h-3.5 text-mars-400 animate-pulse" />
            <span>Action Required • Clinical Compliance</span>
          </div>

          <h2 id="profile-completion-title" className="font-orbitron font-bold text-xl md:text-2xl text-white tracking-wide">
            Mandatory Profile Completion
          </h2>

          <p className="text-xs font-mono text-slate-300 leading-relaxed max-w-md mx-auto">
            To comply with NBTC blood donation eligibility standards and enable 24/7 emergency donor matching, your account requires verified Date of Birth and Gender details before continuing to the User Dashboard.
          </p>
        </div>

        {/* User Identity Snapshot */}
        <div className="p-3.5 rounded-xl bg-space-900/80 border border-white/10 grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Registered Donor</span>
            <span className="text-white font-semibold truncate block">{currentUser.fullName}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Blood Group</span>
            <span className="text-mars-400 font-bold flex items-center gap-1">
              <Droplet className="w-3 h-3 fill-mars-400" />
              {currentUser.bloodGroup || 'Recorded'}
            </span>
          </div>
          <div className="col-span-2 pt-1 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="truncate">{currentUser.email || currentUser.mobileNumber}</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Verified Identity
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 1. Date of Birth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-200">
                Date of Birth <span className="text-mars-400">*</span>
              </label>
              {hasExistingDob && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Already Recorded
                </span>
              )}
            </div>

            {hasExistingDob ? (
              <div className="p-3 rounded-xl bg-space-900 border border-white/10 text-xs font-mono text-slate-200 flex items-center justify-between">
                <span>{formatDisplayDate(currentUser.dateOfBirth)}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                  {currentUser.age} Years Old
                </span>
              </div>
            ) : (
              <CalendarDatePicker
                value={dob}
                onChange={(val) => {
                  setDob(val);
                  setSubmitError('');
                }}
                mode="dob"
                label="Select Date of Birth"
                required={true}
                maxDate={new Date().toISOString().split('T')[0]}
                placeholder="YYYY-MM-DD"
              />
            )}

            {/* Dynamic Age Badge or Error Alert */}
            {ageError ? (
              <div className="flex items-center gap-1.5 text-xs font-mono text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{ageError}</span>
              </div>
            ) : calculatedAge !== null && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Calculated Age: <strong className="text-white">{calculatedAge} Years</strong>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                  Eligible (18–65)
                </span>
              </div>
            )}
          </div>

          {/* 2. Gender Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-200">
                Gender <span className="text-mars-400">*</span>
              </label>
              {hasExistingGender && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Already Recorded
                </span>
              )}
            </div>

            {hasExistingGender ? (
              <div className="p-3 rounded-xl bg-space-900 border border-white/10 text-xs font-mono text-slate-200">
                {currentUser.gender}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {APPROVED_GENDERS.map((g) => {
                  const isSelected = gender === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGender(g);
                        setSubmitError('');
                      }}
                      className={`px-3 py-2.5 rounded-xl text-xs font-mono transition-all text-left flex items-center justify-between border cursor-pointer ${
                        isSelected
                          ? 'bg-mars-500/20 border-mars-500 text-white font-semibold shadow-sm shadow-mars-500/20'
                          : 'bg-space-900 hover:bg-space-850 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{g}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-mars-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-mars-600/30 hover:shadow-mars-600/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying &amp; Saving...</span>
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 text-mars-200 fill-mars-200" />
                  <span>Complete &amp; Enter Dashboard</span>
                </>
              )}
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-space-900 hover:bg-space-850 border border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Sign out of RED MISSION"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>

        </form>

        <p className="text-[10px] font-mono text-slate-500 text-center leading-tight">
          Your medical records are encrypted and protected under RED MISSION Clinical Privacy Standards. Contact details and security credentials remain unchanged.
        </p>

      </div>
    </div>
  );
}
