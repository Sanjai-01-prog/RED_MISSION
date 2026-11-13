import React, { useEffect, useId, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Building2,
  Droplets,
  HeartHandshake,
  RefreshCw,
  FileCheck2,
  UserCheck,
  UserX,
  Info
} from 'lucide-react';
import SuperAdminDonorPhoto from './SuperAdminDonorPhoto';
import { formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../../utils/donorAvailability';

function formatYmdDisplay(ymd) {
  if (!ymd) return 'Not available';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(ymd).trim())) {
    return `${formatCalendarDate(String(ymd).trim())} (${String(ymd).trim()})`;
  }
  return formatTimestampIst(ymd);
}

function formatTimestampIst(ts) {
  if (!ts) return 'Not recorded';
  const raw = String(ts).trim();
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T00:00:00+05:30`
        : raw;

  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return raw;
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(dt) + ' IST'
  );
}

export function getAvailabilityStyles(badgeCategory) {
  switch (badgeCategory) {
    case 'AVAILABLE':
      return {
        panel: 'bg-emerald-500/10 border-emerald-500/35 text-emerald-100',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        iconBg: 'bg-emerald-500/20 text-emerald-400',
        Icon: CheckCircle2
      };
    case 'PENDING_VERIFICATION':
      return {
        panel: 'bg-amber-500/10 border-amber-500/35 text-amber-100',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        iconBg: 'bg-amber-500/20 text-amber-400',
        Icon: Clock
      };
    case 'COOLDOWN':
      return {
        panel: 'bg-rose-500/10 border-rose-500/35 text-rose-100',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        iconBg: 'bg-rose-500/20 text-rose-400',
        Icon: AlertTriangle
      };
    case 'INACTIVE':
    default:
      return {
        panel: 'bg-slate-700/25 border-slate-600/40 text-slate-200',
        badge: 'bg-slate-700/40 text-slate-300 border-slate-500/40',
        iconBg: 'bg-slate-700/50 text-slate-300',
        Icon: ShieldAlert
      };
  }
}

function getTimelineBadgeClass(tone) {
  if (tone === 'green') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
  if (tone === 'amber') return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  if (tone === 'red') return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
}

export default function SuperAdminDonorProfileModal({
  selectedUserId,
  detail,
  loading = false,
  error = '',
  onRefresh,
  onClose
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selectedUserId) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [selectedUserId]);

  const handleBackdropClick = (e) => {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;
    // Guard against keyboard-synthesized clicks at coordinates (0, 0)
    if (e.clientX === 0 && e.clientY === 0) return;

    const rect = dialog.getBoundingClientRect();
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;

    if (clickedOutside) {
      dialog.close();
    }
  };

  const donor = detail?.donor || null;
  const availability = detail?.availability || null;
  const presentation = detail?.availabilityPresentation || null;
  const latestVerifiedDonation = detail?.latestVerifiedDonation || null;
  const pledgeHistory = detail?.pledgeHistory || [];
  const verifiedDonationHistory = detail?.verifiedDonationHistory || [];
  const availStyles = getAvailabilityStyles(presentation?.badgeCategory);
  const AvailIcon = availStyles.Icon;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="donor-profile-dialog p-0 bg-transparent text-slate-100 w-[calc(100%-1rem)] max-w-3xl max-h-[92vh] m-auto md:m-0 md:ml-auto md:h-full md:max-h-screen md:w-full rounded-2xl md:rounded-none md:rounded-l-2xl shadow-2xl border-0 overflow-hidden"
    >
      <div className="flex flex-col h-full max-h-[92vh] md:max-h-screen bg-space-950 border border-white/10 md:border-r-0">
        {/* Sticky Top Header */}
        <header className="shrink-0 px-5 sm:px-6 py-4 bg-space-900/95 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-mars-400">
              Super Admin Authorized Donor Profile
            </p>
            <h2 id={titleId} className="text-lg sm:text-xl font-display font-bold text-white truncate">
              {donor ? donor.fullName : 'Loading Donor Profile...'}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedUserId && onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Refresh donor profile"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close donor profile"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {loading && !detail ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-mars-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 font-mono">Retrieving donor verification records...</p>
            </div>
          ) : error && !detail ? (
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Unable to Load Donor Profile</p>
                <p className="text-xs text-rose-300 mt-1">{error}</p>
              </div>
            </div>
          ) : donor ? (
            <>
              {/* Hero Summary Bar: Large Photo + Blood Group + Key Account Status */}
              <section className="p-5 rounded-2xl bg-space-900/70 border border-white/10 flex flex-col sm:flex-row sm:items-center gap-5">
                <SuperAdminDonorPhoto
                  userId={donor.userId}
                  fullName={donor.fullName}
                  bloodGroup={donor.bloodGroup}
                  hasPhoto={donor.hasPhoto}
                  sizeClass="w-24 h-24 sm:w-28 sm:h-28"
                  textClass="text-2xl"
                />

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-mars-600/25 border border-mars-500/40 text-mars-300 font-display font-bold text-sm">
                      <Droplets className="w-4 h-4 text-mars-400" aria-hidden="true" />
                      {donor.bloodGroup}
                    </span>

                    {presentation && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${availStyles.badge}`}>
                        <AvailIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {presentation.badgeText}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono ${
                        donor.isSuspended
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                          : donor.isActive
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-700/40 text-slate-300 border-slate-500/40'
                      }`}
                    >
                      {donor.isSuspended ? (
                        <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {donor.accountStatus}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {donor.mobileNumber}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {donor.city || 'City not recorded'}
                    </span>
                    <span className="font-mono text-slate-400">
                      ID: {donor.publicReference || donor.userId}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Photo Status: {donor.hasPhoto ? 'Registered selfie stored on file' : 'No selfie uploaded (default avatar shown)'}
                    {donor.hasPhoto && ` • Public Visibility: ${donor.isPhotoPublic ? 'Publicly Visible' : 'Admin Only'}`}
                  </p>
                </div>
              </section>

              {/* B. Current Donation Availability */}
              {presentation && (
                <section aria-labelledby="donor-availability-heading" className={`p-5 rounded-2xl border ${availStyles.panel}`}>
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${availStyles.iconBg}`}>
                      <AvailIcon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p id="donor-availability-heading" className="text-[11px] font-mono uppercase tracking-widest opacity-80">
                          Current Donation Availability
                        </p>
                        {presentation.countdownText && (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-mono font-bold">
                            {presentation.countdownText}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-display font-bold text-white">
                        {presentation.title}
                      </h3>
                      <p className="text-sm leading-relaxed opacity-90">
                        {presentation.description}
                      </p>

                      {/* Cooldown or Post-Cooldown Dates */}
                      {(presentation.isInCooldown || presentation.lastVerifiedDonationDate) && (
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
                            <span className="block text-[11px] text-slate-400 uppercase font-mono">Last Verified Donation</span>
                            <span className="block mt-1 font-semibold text-white">
                              {formatYmdDisplay(presentation.lastVerifiedDonationDate)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
                            <span className="block text-[11px] text-slate-400 uppercase font-mono">
                              {presentation.isInCooldown ? 'Next Eligible Date' : 'Cooldown Ended On'}
                            </span>
                            <span className="block mt-1 font-semibold text-white">
                              {formatYmdDisplay(presentation.nextEligibleDate)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
                            <span className="block text-[11px] text-slate-400 uppercase font-mono">
                              Cooldown Rule (IST)
                            </span>
                            <span className="block mt-1 font-semibold text-white">
                              {presentation.isInCooldown
                                ? `${presentation.daysRemaining} ${presentation.daysRemaining === 1 ? 'day' : 'days'} remaining (${presentation.cooldownMonths} calendar months)`
                                : '3-month cooldown completed'}
                            </span>
                          </div>
                        </div>
                      )}

                      {presentation.caseCode === 'CASE_2_PLEDGE_AWAITING_VERIFICATION' && (
                        <p className="text-xs font-mono text-amber-200/90 pt-1">
                          Active unverified pledges: {presentation.activePledgesCount}. Cooldown begins only after admin verification of donation proof.
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
                        <span>{availability?.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}</span>
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* A. Personal Information */}
              <section aria-labelledby="donor-personal-info-heading" className="p-5 rounded-2xl bg-space-900/60 border border-white/10 space-y-4">
                <h3 id="donor-personal-info-heading" className="text-sm font-display font-bold uppercase tracking-wider text-white">
                  Personal Information
                </h3>

                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px]">Full Name</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{donor.fullName}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px]">Blood Group</dt>
                    <dd className="mt-1 text-sm font-bold text-mars-400">{donor.bloodGroup}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px]">Age</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">
                      {donor.age !== null && donor.age !== undefined ? `${donor.age} years` : 'Not recorded'}
                    </dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px] flex items-center gap-1">
                      <Phone className="w-3 h-3" aria-hidden="true" /> Mobile Number
                    </dt>
                    <dd className="mt-1 text-sm font-mono font-semibold text-white">{donor.mobileNumber}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px] flex items-center gap-1">
                      <Mail className="w-3 h-3" aria-hidden="true" /> Email
                    </dt>
                    <dd className="mt-1 text-sm text-white break-all">{donor.email || 'Not recorded'}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px] flex items-center gap-1">
                      <MapPin className="w-3 h-3" aria-hidden="true" /> City / Pincode
                    </dt>
                    <dd className="mt-1 text-sm text-white">
                      {donor.city || 'Not recorded'}
                      {donor.pincode ? ` (${donor.pincode})` : ''}
                    </dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px] flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden="true" /> Registration Date
                    </dt>
                    <dd className="mt-1 text-xs font-medium text-white">{formatTimestampIst(donor.registrationDate)}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px]">Account Status</dt>
                    <dd className="mt-1 text-xs font-semibold text-white">
                      {presentation?.accountStatusLabel || donor.accountStatus}
                      <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                        Emergency Standby: {donor.emergencyOptIn ? 'Opted In' : 'Standby / Opted Out'}
                      </span>
                    </dd>
                  </div>
                  <div className="p-3 rounded-xl bg-space-950/70 border border-white/5">
                    <dt className="text-slate-400 font-mono uppercase text-[10px]">Verified Donations</dt>
                    <dd className="mt-1 text-sm font-bold text-emerald-400">
                      {donor.verifiedDonationsCount} verified
                      {donor.selfReportedLastDonationDate && (
                        <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                          Self-reported date (unverified): {donor.selfReportedLastDonationDate}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Prominent Latest Verified Donation Highlight */}
              {latestVerifiedDonation && (
                <section className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-emerald-300 font-semibold">
                      <Award className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      Latest Verified Donation
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                      {latestVerifiedDonation.proofVerificationStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Verified Donation Date: </span>
                      <span className="font-semibold text-white">{formatYmdDisplay(latestVerifiedDonation.donationDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Hospital / Location: </span>
                      <span className="font-semibold text-white">
                        {latestVerifiedDonation.hospitalName || 'Not recorded'}
                        {latestVerifiedDonation.hospitalCity ? `, ${latestVerifiedDonation.hospitalCity}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Pledge Reference: </span>
                      <span className="font-mono text-slate-200">{latestVerifiedDonation.pledgeId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Certificate Reference: </span>
                      <span className="font-mono text-emerald-300">
                        {latestVerifiedDonation.certificate?.id || 'Not issued'}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* 4. Pledge History */}
              <section aria-labelledby="pledge-history-heading" className="p-5 rounded-2xl bg-space-900/60 border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="pledge-history-heading" className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    Pledge History
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                    {pledgeHistory.length} {pledgeHistory.length === 1 ? 'record' : 'records'}
                  </span>
                </div>

                {pledgeHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-white/10 rounded-xl">
                    No emergency donation pledges recorded for this donor yet.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {pledgeHistory.map((item, idx) => (
                      <li key={item.pledgeId || item.id || `pledge-${idx}`} className="p-4 rounded-xl bg-space-950/75 border border-white/10 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-bold text-slate-200">
                            {item.pledgeId}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md border font-semibold ${getTimelineBadgeClass(item.badgeTone)}`}>
                              {item.pledgeStatusLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
                              Completion: {item.donationCompletionLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
                              Proof: {item.proofVerificationLabel}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                          <div>
                            <span className="text-slate-400">Recipient / Request: </span>
                            <span className="font-medium text-white">
                              {item.recipientDetails?.patientName || 'Emergency Request'}
                              {item.recipientDetails?.bloodGroup ? ` (${item.recipientDetails.bloodGroup})` : ''}
                            </span>
                            {item.recipientDetails?.urgencyLevel && (
                              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                                {item.recipientDetails.urgencyLevel}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400">Hospital / Location: </span>
                            <span className="text-white">
                              {item.hospitalName || 'Not recorded'}
                              {item.hospitalCity ? `, ${item.hospitalCity}` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Pledge Created: </span>
                            <span className="text-slate-200">{formatTimestampIst(item.pledgeCreatedAt)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Units Pledged: </span>
                            <span className="text-slate-200">{item.recipientDetails?.unitsPledged ?? 1} unit(s)</span>
                          </div>
                        </div>

                        {(item.proofRejectionReason || item.cancelReason || item.certificateId) && (
                          <div className="pt-2 border-t border-white/5 flex flex-wrap gap-3 text-[11px] text-slate-400">
                            {item.proofRejectionReason && (
                              <span className="text-rose-300">Rejection Reason: {item.proofRejectionReason}</span>
                            )}
                            {item.cancelReason && (
                              <span className="text-slate-300">Cancel Reason: {item.cancelReason}</span>
                            )}
                            {item.certificateId && (
                              <span className="text-emerald-300 font-mono">Certificate: {item.certificateId}</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* 5. Verified Donation History */}
              <section aria-labelledby="verified-history-heading" className="p-5 rounded-2xl bg-space-900/60 border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="verified-history-heading" className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    Verified Donation History
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-xs font-mono text-emerald-300">
                    {verifiedDonationHistory.length} verified
                  </span>
                </div>

                {verifiedDonationHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 px-3 text-center border border-dashed border-white/10 rounded-xl">
                    No admin-verified donations recorded yet. Pledged, pending, under-review, rejected, cancelled, expired, or self-reported dates do not count as verified donations or trigger cooldown.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {verifiedDonationHistory.map((item, idx) => (
                      <li
                        key={item.proofId || item.pledgeId || item.id || `verified-${idx}`}
                        className={`p-4 rounded-xl border space-y-2 text-xs ${
                          idx === 0
                            ? 'bg-emerald-950/25 border-emerald-500/35'
                            : 'bg-space-950/75 border-white/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {formatYmdDisplay(item.donationDate)}
                            </span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono uppercase font-bold">
                                Latest Verified
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-semibold">
                            {item.proofVerificationStatus}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                          <div>
                            <span className="text-slate-400">Recipient: </span>
                            <span className="font-medium text-white">
                              {item.recipientDetails?.patientName || 'Emergency Recipient'}
                              {item.recipientDetails?.bloodGroup ? ` (${item.recipientDetails.bloodGroup})` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Hospital / Location: </span>
                            <span className="text-white inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                              {item.hospitalName || 'Not recorded'}
                              {item.hospitalCity ? `, ${item.hospitalCity}` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Related Pledge: </span>
                            <span className="font-mono text-slate-200">{item.pledgeId}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Certificate Reference: </span>
                            <span className="font-mono text-emerald-300">
                              {item.certificate?.id || 'Not issued'}
                            </span>
                          </div>
                        </div>

                        {(item.verifiedAt || item.verifiedByAdminName || item.certificate?.qrVerificationToken) && (
                          <div className="pt-2 border-t border-white/5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                            {item.verifiedAt && <span>Verified At: {formatTimestampIst(item.verifiedAt)}</span>}
                            {item.verifiedByAdminName && <span>Verified By: {item.verifiedByAdminName}</span>}
                            {item.certificate?.qrVerificationToken && (
                              <span className="font-mono">QR Token: {item.certificate.qrVerificationToken}</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
