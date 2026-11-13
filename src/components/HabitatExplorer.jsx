import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Droplet, 
  MapPin, 
  Phone, 
  Calendar, 
  Award, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  Heart, 
  X, 
  Clock,
  Camera,
  Lock,
  ArrowRight
} from 'lucide-react';
import { FALLBACK_DONOR_AVATAR_SVG } from '../utils/imageFallbacks';
import DonorAvatar from './common/DonorAvatar';
import { donorApi } from '../services/api';
import { resolveDonorAvailability, formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../utils/donorAvailability';

export default function HabitatExplorer({ currentUser, onOpenDonorRegistration, onOpenRoleSelection }) {
  const [activeTab, setActiveTab] = useState('find'); // 'find' | 'register'
  const [donorsList, setDonorsList] = useState([]);
  const [isLoadingDonors, setIsLoadingDonors] = useState(true);
  const [donorError, setDonorError] = useState(null);
  const [totalDonorsCount, setTotalDonorsCount] = useState(0);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDonorForContact, setSelectedDonorForContact] = useState(null);
  const [contactMessageSent, setContactMessageSent] = useState(false);
  const [currentUserDonorProfile, setCurrentUserDonorProfile] = useState(null);

  const fetchCurrentDonorProfile = () => {
    if (currentUser) {
      donorApi.getProfile().then(res => {
        if (res && res.success && res.isDonor) {
          setCurrentUserDonorProfile(res.donor);
        } else {
          setCurrentUserDonorProfile(null);
        }
      }).catch(() => setCurrentUserDonorProfile(null));
    } else {
      setCurrentUserDonorProfile(null);
    }
  };

  const fetchLiveDonors = async () => {
    setIsLoadingDonors(true);
    setDonorError(null);
    try {
      const res = await donorApi.search({
        bloodGroup: selectedBloodGroup !== 'All' ? selectedBloodGroup : undefined,
        city: selectedCity !== 'All' ? selectedCity : undefined,
        search: searchQuery.trim() || undefined
      });
      if (res && res.success) {
        setDonorsList(res.donors || []);
        setTotalDonorsCount(res.totalCount || 0);
      } else {
        setDonorError(res?.error || 'Failed to retrieve voluntary donors.');
        setDonorsList([]);
      }
    } catch (err) {
      console.error('Error fetching donors:', err);
      setDonorError('Unable to connect to voluntary donor directory service.');
      setDonorsList([]);
    } finally {
      setIsLoadingDonors(false);
    }
  };

  useEffect(() => {
    fetchCurrentDonorProfile();
  }, [currentUser]);

  useEffect(() => {
    fetchLiveDonors();
  }, [selectedBloodGroup, selectedCity, searchQuery]);

  useEffect(() => {
    const handleDonorEvent = () => {
      fetchCurrentDonorProfile();
      fetchLiveDonors();
    };
    window.addEventListener('donor-registered', handleDonorEvent);
    window.addEventListener('proof-reviewed', handleDonorEvent);
    window.addEventListener('pledge-updated', handleDonorEvent);
    return () => {
      window.removeEventListener('donor-registered', handleDonorEvent);
      window.removeEventListener('proof-reviewed', handleDonorEvent);
      window.removeEventListener('pledge-updated', handleDonorEvent);
    };
  }, []);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#registration') {
        setActiveTab('register');
      } else if (window.location.hash === '#find-donors') {
        setActiveTab('find');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const bloodGroups = ['All', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const cities = ['All', 'Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Kolkata', 'Hyderabad'];

  return (
    <section id="find-donors" className="py-20 relative bg-space-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <Droplet className="w-3.5 h-3.5 fill-mars-400" />
            <span>Lifesaver Directory &amp; Registration</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            CONNECT WITH <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">BLOOD DONORS</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Search 48,250+ verified voluntary blood donors across the nation by blood group and locality, or register yourself today to become an on-call emergency lifesaver.
          </p>
        </div>

        {/* Primary Tabs: Find Donors vs Donor Registration */}
        <div className="flex items-center justify-center gap-3 mb-10" id="registration">
          <button
            onClick={() => setActiveTab('find')}
            className={`px-6 py-3 rounded-xl font-orbitron font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'find'
                ? 'bg-mars-600 text-white shadow-lg shadow-mars-600/30 border border-mars-400/40'
                : 'bg-space-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Search Donors Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-3 rounded-xl font-orbitron font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-mars-600 text-white shadow-lg shadow-mars-600/30 border border-mars-400/40'
                : 'bg-space-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Register as Voluntary Donor</span>
          </button>
        </div>

        {/* Tab 1: Find Donors */}
        {activeTab === 'find' && (
          <div className="space-y-6">
            
            {/* Filter Bar: Blood Group Pills + City Dropdown + Search Input */}
            <div className="card-glass rounded-2xl p-5 border border-white/10 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                
                {/* Blood Group Quick Buttons */}
                <div className="w-full lg:w-auto">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Filter by Blood Group:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {bloodGroups.map((bg) => (
                      <button
                        key={bg}
                        onClick={() => setSelectedBloodGroup(bg)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          selectedBloodGroup === bg
                            ? 'bg-mars-600 text-white shadow-md shadow-mars-600/40 scale-105'
                            : 'bg-space-900 text-slate-300 hover:text-white border border-white/5'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City Filter & Search Input */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="w-full sm:w-44">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Select City:
                    </span>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                    >
                      {cities.map((c) => (
                        <option key={c} value={c}>{c === 'All' ? 'All Cities' : c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-60">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Search Locality / Name:
                    </span>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Andheri or Max Hospital..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Donors Grid */}
            {isLoadingDonors ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="card-glass rounded-2xl p-6 border border-white/5 animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/10"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-white/10 rounded w-28"></div>
                        <div className="h-3 bg-white/5 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="h-10 bg-white/5 rounded-xl"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-white/5 rounded"></div>
                      <div className="h-8 bg-white/5 rounded"></div>
                    </div>
                    <div className="h-8 bg-white/5 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : donorError ? (
              <div className="text-center py-12 card-glass rounded-2xl border border-mars-500/30">
                <AlertCircle className="w-8 h-8 text-mars-400 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold text-sm">{donorError}</p>
                <button
                  onClick={fetchLiveDonors}
                  className="mt-4 px-4 py-2 rounded-xl bg-mars-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : donorsList.length === 0 ? (
              <div className="text-center py-12 card-glass rounded-2xl border border-white/10">
                <AlertCircle className="w-8 h-8 text-mars-400 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold text-sm">No voluntary donors currently listed</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Only verified voluntary donors who have provided explicit consent for public directory listing appear here.
                </p>
                {(selectedBloodGroup !== 'All' || selectedCity !== 'All' || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedBloodGroup('All');
                      setSelectedCity('All');
                      setSearchQuery('');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-mars-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {donorsList.map((donor, donorIndex) => {
                  const avail = resolveDonorAvailability(donor);
                  const reavailableFormatted = formatCalendarDate(avail.reavailableDate);
                  const cooldownNoteId = `donor-cooldown-note-${donor.id || donorIndex}`;

                  return (
                  <div
                    key={donor.id || donor.userId || donor.publicReference || donor.displayName || `donor-${donorIndex}`}
                    className={`card-glass rounded-2xl p-6 card-glass-hover flex flex-col justify-between border relative overflow-hidden group ${
                      avail.isInCooldown ? 'border-amber-500/30' : 'border-white/10'
                    }`}
                  >
                    {/* Top Blood Drop Accent Banner */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent ${
                      avail.isInCooldown ? 'via-amber-500' : 'via-mars-500'
                    } to-transparent`}></div>

                    <div>
                      {/* Top Meta: Visual Avatar + Details + Availability */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <DonorAvatar
                            src={donor.photoUrl}
                            name={donor.displayName}
                            bloodGroup={donor.bloodGroup}
                            size="lg"
                          />
                          <div>
                            <h3 className="font-orbitron font-bold text-base text-white group-hover:text-mars-300 transition-colors">
                              {donor.displayName}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-slate-400 font-mono mt-0.5">
                              <MapPin className="w-3 h-3 text-mars-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{donor.city}</span>
                            </div>
                          </div>
                        </div>

                        {avail.isInCooldown ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shrink-0 uppercase">
                            Temporarily Unavailable
                          </span>
                        ) : avail.isAvailable ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                            Available
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30 shrink-0">
                            {avail.label}
                          </span>
                        )}
                      </div>

                      {avail.isInCooldown && (
                        <div
                          id={cooldownNoteId}
                          role="status"
                          className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-amber-300 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>3-Month Cooldown</span>
                            </span>
                            {avail.daysRemaining > 0 && (
                              <span className="text-[10px] text-amber-200">{avail.daysRemaining}d left</span>
                            )}
                          </div>
                          {reavailableFormatted && (
                            <div className="text-slate-200">
                              Available again: <strong className="text-white">{reavailableFormatted}</strong>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 leading-snug">
                            {avail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                          </div>
                        </div>
                      )}

                      {/* Stats chips */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-space-950/60 border border-white/5 font-mono text-xs mb-4">
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase">Verified Donations</span>
                          <span className="text-slate-200 font-bold">{donor.totalDonations} Completed</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase">Registry Reference</span>
                          <span className="text-mars-400 font-semibold truncate block" title={donor.id}>{donor.id}</span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {donor.badges.map((b, bIdx) => (
                          <span key={`${b}-${bIdx}`} className="px-2 py-0.5 rounded text-[9px] font-mono bg-space-900 border border-white/10 text-slate-300">
                            ✓ {b}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action: Connect / Request Donor */}
                    <div className="pt-3 border-t border-white/5">
                      <button
                        type="button"
                        disabled={!avail.isAvailable}
                        aria-disabled={!avail.isAvailable ? 'true' : undefined}
                        aria-describedby={avail.isInCooldown ? cooldownNoteId : undefined}
                        onClick={() => {
                          if (!avail.isAvailable) return;
                          setSelectedDonorForContact(donor);
                          setContactMessageSent(false);
                        }}
                        className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          avail.isAvailable
                            ? 'bg-space-850 hover:bg-mars-600 border-mars-500/30 hover:border-mars-500 text-slate-200 hover:text-white cursor-pointer shadow-md'
                            : 'bg-space-900/80 border-amber-500/20 text-slate-400 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        {avail.isInCooldown ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              Temporarily Unavailable {reavailableFormatted ? `(Until ${reavailableFormatted})` : ''}
                            </span>
                          </>
                        ) : avail.isAvailable ? (
                          <>
                            <Heart className="w-3.5 h-3.5 text-mars-400 group-hover:text-white" />
                            <span>Request Blood / Dispatch Alert</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Currently Unavailable</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* Tab 2: Donor Registration - Authenticated Flow */}
        {activeTab === 'register' && (
          <div>
            {!currentUser ? (
              /* Case 1: Unauthenticated User */
              <div className="max-w-2xl mx-auto card-glass rounded-2xl p-8 sm:p-10 border border-white/10 shadow-2xl text-center space-y-6 animate-in fade-in">
                <div className="w-16 h-16 rounded-2xl bg-mars-500/10 border border-mars-500/30 text-mars-400 flex items-center justify-center mx-auto shadow-lg shadow-mars-600/10">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mars-500/10 text-mars-400 border border-mars-500/30 text-xs font-mono font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>AUTHENTICATED ENLISTMENT REQUIRED</span>
                  </div>
                  <h3 className="font-orbitron font-bold text-2xl text-white">
                    LOGIN TO BECOME A DONOR
                  </h3>
                  <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                    To protect emergency patients, prevent spam, and maintain a 1-to-1 verified registry, donor registration is linked to your authenticated RED MISSION account and requires a verified visual selfie for hospital identification.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => onOpenRoleSelection && onOpenRoleSelection()}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-bold text-xs shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>LOG IN TO REGISTER</span>
                  </button>
                  <a
                    href="#user-register"
                    onClick={() => { window.location.hash = '#user-register'; }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white font-orbitron font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>CREATE AN ACCOUNT</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : currentUserDonorProfile ? (
              /* Case 2: Authenticated User who is already an enlisted donor */
              <div className="max-w-2xl mx-auto card-glass rounded-2xl p-8 sm:p-10 border border-emerald-500/30 shadow-2xl space-y-6 text-center animate-in fade-in">
                <div className="flex justify-center">
                  <DonorAvatar
                    src={currentUserDonorProfile.photoUrl}
                    name={currentUser.fullName}
                    bloodGroup={currentUser.bloodGroup}
                    size="xl"
                  />
                </div>
                {(() => {
                  const profileAvail = resolveDonorAvailability(currentUserDonorProfile);
                  const reavailStr = formatCalendarDate(profileAvail.reavailableDate);
                  const lastVerifiedStr = formatCalendarDate(profileAvail.lastVerifiedDonationDate);
                  return (
                    <>
                      <div className="space-y-2">
                        {profileAvail.isInCooldown ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>TEMPORARILY UNAVAILABLE — 3-MONTH COOLDOWN</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ACTIVE VOLUNTARY LIFESAVER</span>
                          </div>
                        )}
                        <h3 className="font-orbitron font-bold text-2xl text-white">
                          {profileAvail.isInCooldown ? 'DONATION RECOVERY PERIOD ACTIVE' : 'YOU ARE AN ACTIVE DONOR'}
                        </h3>
                        <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                          Thank you, <span className="text-white font-bold">{currentUser.fullName}</span>! Your voluntary donor profile is registered with blood group <span className="text-mars-400 font-bold">{currentUser.bloodGroup}</span>.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-space-900 border border-white/10 font-mono text-xs max-w-md mx-auto text-left space-y-2">
                        <div className="flex justify-between py-0.5 border-b border-white/5">
                          <span className="text-slate-400">Emergency Status:</span>
                          <span className={
                            profileAvail.isInCooldown
                              ? 'text-amber-300 font-bold'
                              : profileAvail.isAvailable
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }>
                            {profileAvail.isInCooldown
                              ? 'Temporarily Unavailable (3-Month Cooldown)'
                              : profileAvail.isAvailable
                              ? 'Active & Available'
                              : profileAvail.label}
                          </span>
                        </div>
                        {profileAvail.isInCooldown && reavailStr && (
                          <div className="flex justify-between py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Re-available On:</span>
                            <span className="text-amber-300 font-bold">
                              {reavailStr} ({profileAvail.daysRemaining}d remaining)
                            </span>
                          </div>
                        )}
                        {lastVerifiedStr && (
                          <div className="flex justify-between py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Last Verified Donation:</span>
                            <span className="text-white font-semibold">{lastVerifiedStr}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5 border-b border-white/5">
                          <span className="text-slate-400">Total Recorded Donations:</span>
                          <span className="text-white font-bold">{currentUserDonorProfile.totalDonationsCount || 0}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-white/5">
                          <span className="text-slate-400">Locality PIN Code:</span>
                          <span className="text-white">{currentUserDonorProfile.pincode || currentUser.pincode || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate-400">Visual Selfie Identification:</span>
                          <span className="text-emerald-400">Recorded</span>
                        </div>
                        <p className="pt-2 text-[10px] text-slate-400 border-t border-white/5 leading-relaxed">
                          {profileAvail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                        </p>
                      </div>
                    </>
                  );
                })()}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('find')}
                    className="px-6 py-2.5 rounded-xl bg-mars-600 hover:bg-mars-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    View in Donors Directory
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: Authenticated User who has not yet registered as a donor */
              <div className="max-w-2xl mx-auto card-glass rounded-2xl p-8 sm:p-10 border border-mars-500/30 shadow-2xl space-y-6 animate-in fade-in">
                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                  <div className="p-3 rounded-2xl bg-mars-500/10 border border-mars-500/30 text-mars-400">
                    <Heart className="w-6 h-6 fill-mars-400" />
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-xl text-white">
                      VOLUNTARY LIFESAVER ENLISTMENT
                    </h3>
                    <p className="text-xs font-mono text-slate-400">
                      Welcome, {currentUser.fullName} • Blood Group: {currentUser.bloodGroup}
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-space-900 border border-white/10 space-y-3.5 text-xs text-slate-300">
                  <h4 className="font-orbitron font-bold text-white text-xs uppercase tracking-wider">
                    Registration Guidelines &amp; Selfie Requirement:
                  </h4>
                  <ul className="space-y-2.5 font-mono text-[11px]">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Linked 1-to-1 to your authenticated user account (<span className="text-white font-bold">{currentUser.email}</span>).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Camera className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span><strong>Mandatory Live Selfie:</strong> Capture via your device camera or upload a clear portrait. Used solely as your donor profile picture for visual recognition at clinics.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Privacy-First:</strong> Strictly a visual aid. No biometrics, facial recognition, or government verification claims.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Droplet className="w-4 h-4 text-mars-400 shrink-0 mt-0.5" />
                      <span>General eligibility: Age 18–65, weight &gt; 50 kg, fit for voluntary blood donation.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenDonorRegistration && onOpenDonorRegistration()}
                  className="w-full py-4 rounded-2xl font-orbitron font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-mars-600 via-mars-500 to-mars-flame hover:brightness-110 shadow-xl shadow-mars-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>START DONOR REGISTRATION &amp; CAPTURE SELFIE</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: Direct Contact / Request Donor */}
        {selectedDonorForContact && resolveDonorAvailability(selectedDonorForContact).isAvailable && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedDonorForContact(null)}
          >
            <div 
              className="relative w-full max-w-lg card-glass rounded-2xl p-6 sm:p-8 border border-mars-500/40 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-mars-600 text-white font-orbitron font-bold text-xl flex items-center justify-center shadow-lg">
                    {selectedDonorForContact.bloodGroup}
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-lg text-white">
                      {selectedDonorForContact.displayName || selectedDonorForContact.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-400">
                      {selectedDonorForContact.city}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDonorForContact(null)}
                  className="p-1 rounded-lg bg-space-850 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {contactMessageSent ? (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h4 className="font-orbitron font-bold text-lg text-white">
                    EMERGENCY ALERT TRANSMITTED
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    An urgent SMS and notification with your patient requirement has been queued for {selectedDonorForContact.displayName || selectedDonorForContact.name}. If the donor responds, immediate coordination will be initiated.
                  </p>
                  <button
                    onClick={() => setSelectedDonorForContact(null)}
                    className="px-6 py-2 rounded-xl bg-mars-600 text-white text-xs font-semibold mt-3 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-space-900 border border-white/5 space-y-1">
                    <span className="text-slate-400 block text-[10px] uppercase">Confidential Emergency Dispatch</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-emerald-400">RED MISSION Emergency Dispatch Gateway</span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Protected</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-xs font-sans leading-relaxed">
                    Would you like RED MISSION to transmit an automated high-priority emergency blood dispatch notification to this donor on your behalf?
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setContactMessageSent(true)}
                      className="flex-1 py-2.5 rounded-xl bg-mars-600 hover:bg-mars-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-mars-600/30 cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-white" />
                      <span>Send Emergency Dispatch Alert</span>
                    </button>
                    <button
                      onClick={() => setSelectedDonorForContact(null)}
                      className="px-4 py-2.5 rounded-xl bg-space-850 border border-white/10 text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      Cancel
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
