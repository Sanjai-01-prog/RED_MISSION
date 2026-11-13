import React from 'react';
import { 
  Heart, 
  Award, 
  FileCheck2, 
  Activity, 
  Droplet, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  ArrowRight,
  Upload,
  UserPlus
} from 'lucide-react';
import DashboardStatCard from '../shared/DashboardStatCard';
import StatusBadge from '../shared/StatusBadge';
import DashboardTable from '../shared/DashboardTable';
import { resolveDonorAvailability, formatCalendarDate, MEDICAL_COOLDOWN_NOTE } from '../../../utils/donorAvailability';

export default function UserOverviewTab({
  currentUser,
  donorProfile,
  pledges = [],
  requests = [],
  loading = false,
  onNavigateTab,
  onOpenProofModal,
  onViewCertificate,
  onOpenDonorRegistration,
  onRaiseRequest
}) {
  const activePledges = pledges.filter(p => p.rawStatus !== 'CANCELLED' && p.rawStatus !== 'APPROVED' && p.displayStatus !== 'Approved');
  const completedDonations = pledges.filter(p => p.displayStatus === 'Approved' || p.rawStatus === 'APPROVED' || p.certificate);
  const pendingProofs = pledges.filter(p => p.displayStatus === 'Under Admin Review');
  const certificatesCount = pledges.filter(p => p.certificate != null).length;

  const isEnlistedDonor = Boolean(donorProfile?.isDonor || donorProfile?.userId);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-space-900 via-space-850 to-space-900 border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-mars-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-xs font-mono text-mars-400">
              <Droplet className="w-3.5 h-3.5 fill-mars-400" />
              <span>BLOOD GROUP: {currentUser?.bloodGroup || 'UNASSIGNED'}</span>
            </div>

            <h2 className="font-orbitron font-extrabold text-2xl sm:text-3xl text-white tracking-wide">
              Welcome, {currentUser?.fullName || 'Lifesaver'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-mono max-w-xl">
              Track your voluntary blood pledges, monitor clinical proof verifications, and access your verified lifesaver honor certificates.
            </p>
          </div>

          {/* Quick Donor Status Card */}
          {!isEnlistedDonor ? (
            <div className="bg-mars-500/10 border border-mars-500/30 rounded-2xl p-4 sm:p-5 max-w-xs space-y-2 text-left">
              <div className="flex items-center gap-2 text-mars-300 font-bold text-xs font-mono">
                <Heart className="w-4 h-4 fill-mars-400" />
                <span>Voluntary Donor Network</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Complete your donor photograph in the Donor Profile section to activate verified donor status for emergency alerts.
              </p>
            </div>
          ) : (() => {
            const donorAvail = resolveDonorAvailability(donorProfile);
            const reavailFormatted = formatCalendarDate(donorAvail.reavailableDate);
            return donorAvail.isInCooldown ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 max-w-xs space-y-1.5 text-left">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Temporarily Unavailable</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  3-month verified donation cooldown active until{' '}
                  <strong className="text-white">{reavailFormatted || donorAvail.reavailableDate}</strong>
                  {donorAvail.daysRemaining > 0 ? ` (${donorAvail.daysRemaining}d remaining)` : ''}.
                </p>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {donorAvail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE}
                </p>
                <button
                  onClick={() => onNavigateTab('profile')}
                  className="text-[11px] font-mono text-amber-300 hover:underline flex items-center gap-1 pt-1"
                >
                  <span>View recovery timeline</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 max-w-xs space-y-1.5 text-left">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Lifesaver Profile</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {donorAvail.isAvailable
                    ? 'Your profile is active for 24/7 local emergency requests in ' + (currentUser?.city || 'your area') + '.'
                    : donorAvail.reason || 'Your profile is currently on standby.'}
                </p>
                <button
                  onClick={() => onNavigateTab('profile')}
                  className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1 pt-1"
                >
                  <span>Manage donor settings</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 4 Real-time Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStatCard
          title="Verified Donations"
          value={completedDonations.length}
          subtext="Completed & clinically verified"
          icon={Award}
          color="emerald"
          loading={loading}
        />

        <DashboardStatCard
          title="Active Pledges"
          value={activePledges.length}
          subtext="Reserved emergency commitments"
          icon={Heart}
          color="mars"
          loading={loading}
        />

        <DashboardStatCard
          title="Lifesaver Certificates"
          value={certificatesCount}
          subtext="Official NBTC citations"
          icon={FileCheck2}
          color="amber"
          loading={loading}
        />

        {(() => {
          const donorAvail = isEnlistedDonor ? resolveDonorAvailability(donorProfile) : null;
          const reavailFormatted = donorAvail ? formatCalendarDate(donorAvail.reavailableDate) : null;
          const statusVal = !isEnlistedDonor
            ? 'Citizen'
            : donorAvail.isInCooldown
            ? 'Cooldown'
            : donorAvail.isAvailable
            ? 'Active'
            : donorAvail.label;
          const statusSubtext = !isEnlistedDonor
            ? 'Not yet enlisted as donor'
            : donorAvail.isInCooldown
            ? `Re-available ${reavailFormatted || donorAvail.reavailableDate}`
            : donorAvail.isAvailable
            ? 'Available for emergency alerts'
            : 'Unavailable for dispatch';
          return (
            <DashboardStatCard
              title="Donor Status"
              value={statusVal}
              subtext={statusSubtext}
              icon={Activity}
              color={!isEnlistedDonor ? 'purple' : donorAvail.isInCooldown ? 'amber' : 'cyan'}
              loading={loading}
            />
          );
        })()}
      </div>

      {/* Grid: Donor Clinical Details & Recent Pledges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Clinical Identity Details */}
        <div className="card-glass rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="font-orbitron font-bold text-sm text-white">
              Clinical Donor Identity
            </h3>
            <button
              onClick={() => onNavigateTab('profile')}
              className="text-[11px] font-mono text-mars-400 hover:underline"
            >
              Edit Profile
            </button>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
              <span className="text-slate-400 flex items-center gap-2">
                <Droplet className="w-3.5 h-3.5 text-mars-400" />
                <span>Blood Group:</span>
              </span>
              <span className="text-white font-bold px-2 py-0.5 rounded bg-mars-500/20 text-mars-400 border border-mars-500/30">
                {currentUser?.bloodGroup || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
              <span className="text-slate-400 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>City & Region:</span>
              </span>
              <span className="text-white font-medium">{currentUser?.city || 'India'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Age:</span>
              </span>
              <span className="text-white font-medium">{currentUser?.age ? `${currentUser.age} years` : 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
              <span className="text-slate-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Mobile:</span>
              </span>
              <span className="text-slate-300 font-mono">{currentUser?.mobileNumber || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
              <span className="text-slate-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email:</span>
              </span>
              <span className="text-slate-300 font-mono truncate max-w-[150px]">{currentUser?.email || 'N/A'}</span>
            </div>

            {(() => {
              const donorAvail = isEnlistedDonor ? resolveDonorAvailability(donorProfile) : null;
              const verifiedFormatted = donorAvail?.lastVerifiedDonationDate
                ? formatCalendarDate(donorAvail.lastVerifiedDonationDate)
                : null;
              const selfReportedFormatted = donorProfile?.lastDonationDate
                ? formatCalendarDate(donorProfile.lastDonationDate)
                : null;
              const reavailFormatted = donorAvail?.reavailableDate
                ? formatCalendarDate(donorAvail.reavailableDate)
                : null;

              return (
                <>
                  {(verifiedFormatted || selfReportedFormatted) && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-850/60 border border-white/5">
                      <span className="text-slate-400 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{verifiedFormatted ? 'Last Verified Donation:' : 'Last Donated (Self-Reported):'}</span>
                      </span>
                      <span className="text-emerald-400 font-medium">
                        {verifiedFormatted || selfReportedFormatted}
                      </span>
                    </div>
                  )}

                  {donorAvail?.isInCooldown && reavailFormatted && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <span className="text-amber-300 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>Re-available Date:</span>
                      </span>
                      <span className="text-amber-200 font-bold">
                        {reavailFormatted} ({donorAvail.daysRemaining}d)
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Right Columns: Recent Pledges Table */}
        <div className="lg:col-span-2">
          <DashboardTable
            title="Recent Pledges & Commitments"
            subtitle="Your active and recently fulfilled emergency pledges"
            loading={loading}
            isEmpty={pledges.length === 0}
            emptyMessage="No blood pledges recorded yet"
            emptySubtext="When an emergency blood request arises and you pledge a unit, it will appear here."
            headerAction={
              <button
                onClick={() => onNavigateTab('pledges')}
                className="text-xs font-mono text-mars-400 hover:text-mars-300 flex items-center gap-1"
              >
                <span>View all ({pledges.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
            columns={[
              { label: 'Hospital & Patient' },
              { label: 'Blood Group' },
              { label: 'Status' },
              { label: 'Action', className: 'text-right' }
            ]}
          >
            {pledges.slice(0, 4).map((pledge, pIdx) => (
              <tr key={pledge.id || `pledge-${pIdx}`} className="hover:bg-white/5 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-white truncate max-w-[180px]">
                    {pledge.hospitalName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Patient: {pledge.patientName} • {pledge.hospitalCity}
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-mars-500/20 text-mars-400 font-bold border border-mars-500/30 text-[10px]">
                    {pledge.bloodGroup}
                  </span>
                </td>

                <td className="py-3 px-4">
                  <StatusBadge status={pledge.displayStatus} />
                </td>

                <td className="py-3 px-4 text-right">
                  {pledge.displayStatus === 'Approved' && pledge.certificate ? (
                    <button
                      onClick={() => onViewCertificate(pledge)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
                    >
                      Certificate
                    </button>
                  ) : pledge.displayStatus === 'Donation Proof Pending' || pledge.displayStatus === 'Pledged' ? (
                    <button
                      onClick={() => onOpenProofModal(pledge)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-mars-600 hover:bg-mars-500 text-white shadow-sm transition-colors"
                    >
                      Upload Proof
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigateTab('pledges')}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Details →
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DashboardTable>
        </div>

      </div>

      {/* My Blood Requests Overview Section */}
      <div className="rounded-3xl bg-space-900/60 border border-white/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mars-500/10 border border-mars-500/30 text-mars-400 flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-base text-white">
                My Blood Requests
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Requests you submitted for emergency patient transfusions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRaiseRequest && (
              <button
                type="button"
                onClick={onRaiseRequest}
                className="px-3 py-1.5 rounded-xl bg-mars-600/20 hover:bg-mars-600/30 border border-mars-500/40 text-mars-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>+ Raise Request</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('requests')}
              className="px-3.5 py-1.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Manage Requests ({requests.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="p-6 rounded-2xl bg-space-950/40 border border-white/5 text-center text-xs font-mono text-slate-400">
            No blood requests submitted yet. If you or a loved one requires blood, submit an emergency request to dispatch voluntary donors.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {requests.slice(0, 3).map((req, rIdx) => (
              <div 
                key={req.id || `req-${rIdx}`}
                onClick={() => onNavigateTab('requests')}
                className="p-3.5 rounded-xl bg-space-950/70 border border-white/5 hover:border-white/20 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-orbitron font-bold text-xs text-white">
                    {req.blood_group} • {req.units_requested} Unit(s)
                  </span>
                  <StatusBadge status={req.mapped_status || req.status_category} size="xs" />
                </div>
                <div className="text-[11px] font-mono text-slate-300 truncate">
                  {req.patient_name} — {req.hospital_name}
                </div>
                <div className="text-[10px] font-mono text-slate-500 flex justify-between">
                  <span>{req.hospital_city}</span>
                  <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
