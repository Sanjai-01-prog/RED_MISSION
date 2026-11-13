import React, { useCallback, useEffect, useState } from 'react';
import {
  Droplets,
  Search,
  MapPin,
  Phone,
  RefreshCw,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { superAdminDonorApi } from '../../../services/api';
import { formatCalendarDate } from '../../../utils/donorAvailability';
import SuperAdminDonorPhoto from './SuperAdminDonorPhoto';
import SuperAdminDonorProfileModal, { getAvailabilityStyles } from './SuperAdminDonorProfileModal';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function SuperAdminDonorsTab() {
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [nameSearch, setNameSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Detailed donor drawer state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superAdminDonorApi.getDonors({
        bloodGroup: bloodGroupFilter,
        availability: availabilityFilter,
        search: nameSearch.trim(),
        city: citySearch.trim()
      });

      if (res?.success) {
        setDirectory(res);
      } else {
        setError(res?.error || 'Failed to load Super Admin donor directory.');
      }
    } catch (err) {
      console.error('Super Admin donor directory fetch error:', err);
      setError('Unable to reach server while retrieving donor directory.');
    } finally {
      setLoading(false);
    }
  }, [bloodGroupFilter, availabilityFilter, nameSearch, citySearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDirectory();
    }, 120);
    return () => clearTimeout(timer);
  }, [fetchDirectory]);

  const loadDonorDetail = useCallback(async (userId) => {
    if (!userId) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await superAdminDonorApi.getDonorDetail(userId);
      if (res?.success) {
        setDetailData(res);
      } else {
        setDetailError(res?.error || 'Unable to load donor profile details.');
      }
    } catch (err) {
      console.error('Donor detail load error:', err);
      setDetailError('Network error while retrieving donor profile.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleOpenDonor = (userId) => {
    setSelectedUserId(userId);
    setDetailData(null);
    loadDonorDetail(userId);
  };

  const handleCloseModal = () => {
    setSelectedUserId(null);
    setDetailData(null);
    setDetailError('');
  };

  const handleResetFilters = () => {
    setBloodGroupFilter('ALL');
    setAvailabilityFilter('ALL');
    setNameSearch('');
    setCitySearch('');
  };

  const counts = directory?.bloodGroupCounts || {};
  const summary = directory?.summary || {
    totalRegisteredDonors: 0,
    filteredDonorsCount: 0,
    availableCount: 0,
    unavailableCount: 0,
    pendingVerificationCount: 0,
    suspendedOrInactiveCount: 0
  };

  const groupsToRender = (directory?.groups || BLOOD_GROUPS.map((bg) => ({
    bloodGroup: bg,
    registeredCount: counts[bg] || 0,
    filteredCount: 0,
    donors: []
  }))).filter((group) => bloodGroupFilter === 'ALL' || group.bloodGroup === bloodGroupFilter);

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="card-glass p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Registered Donors</span>
            <Users className="w-4 h-4 text-mars-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-display font-bold text-white">{summary.totalRegisteredDonors}</p>
        </div>
        <div className="card-glass p-4 rounded-2xl border border-emerald-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Eligible Now</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-display font-bold text-emerald-400">{summary.availableCount}</p>
        </div>
        <div className="card-glass p-4 rounded-2xl border border-amber-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Pledge Pending</span>
            <Clock className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-display font-bold text-amber-400">{summary.pendingVerificationCount}</p>
        </div>
        <div className="card-glass p-4 rounded-2xl border border-rose-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Unavailable</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-display font-bold text-rose-400">{summary.unavailableCount}</p>
        </div>
        <div className="card-glass p-4 rounded-2xl border border-slate-500/20 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Inactive / Suspended</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-display font-bold text-slate-300">{summary.suspendedOrInactiveCount}</p>
        </div>
      </div>

      {/* 8 Blood Group Summary Pills / Filter Bar */}
      <section aria-labelledby="blood-group-overview-heading" className="card-glass p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="blood-group-overview-heading" className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Droplets className="w-4 h-4 text-mars-500" aria-hidden="true" />
              Blood Group Directory Breakdown
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a blood group below or search to inspect registered donors and click any donor card for full verification history.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDirectory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh Directory
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
          <button
            type="button"
            onClick={() => setBloodGroupFilter('ALL')}
            aria-pressed={bloodGroupFilter === 'ALL'}
            className={`p-3 rounded-xl border text-left transition-all ${
              bloodGroupFilter === 'ALL'
                ? 'bg-mars-600/25 border-mars-500 text-white shadow-lg shadow-mars-500/10'
                : 'bg-space-900/60 border-white/10 text-slate-300 hover:border-white/25 hover:bg-space-900'
            }`}
          >
            <span className="block text-xs font-mono uppercase text-slate-400">All</span>
            <span className="mt-1 block text-lg font-display font-bold text-white">{summary.totalRegisteredDonors}</span>
          </button>

          {BLOOD_GROUPS.map((bg) => {
            const isSelected = bloodGroupFilter === bg;
            const bgCount = counts[bg] ?? 0;
            return (
              <button
                key={bg}
                type="button"
                onClick={() => setBloodGroupFilter(isSelected ? 'ALL' : bg)}
                aria-pressed={isSelected}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-mars-600/25 border-mars-500 text-white shadow-lg shadow-mars-500/10'
                    : 'bg-space-900/60 border-white/10 text-slate-300 hover:border-white/25 hover:bg-space-900'
                }`}
              >
                <span className="block text-sm font-display font-bold text-mars-400">{bg}</span>
                <span className="mt-1 block text-lg font-mono font-bold text-white">{bgCount}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls */}
        <div className="pt-2 border-t border-white/10 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label htmlFor="superadmin-donor-name-search" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Search by Donor Name
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="superadmin-donor-name-search"
                type="search"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Search donor name..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-950 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="superadmin-donor-city-search" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Search by City
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="superadmin-donor-city-search"
                type="search"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Filter city..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-950 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="superadmin-donor-availability-filter" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Availability Status
            </label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <select
                id="superadmin-donor-availability-filter"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-950 border border-white/10 text-sm text-white focus:outline-none focus:border-mars-500"
              >
                <option value="ALL">All Availability Statuses</option>
                <option value="AVAILABLE">Available (Eligible)</option>
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="PENDING_VERIFICATION">Pledge Submitted – Awaiting Verification</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && !directory && (
        <div className="card-glass p-12 rounded-2xl border border-white/10 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-mars-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-mono">Loading blood group donor directory...</p>
        </div>
      )}

      {/* Blood Group Sections */}
      {directory && (
        <div className="space-y-6">
          {groupsToRender.map((group) => (
            <section
              key={group.bloodGroup}
              aria-labelledby={`group-heading-${group.bloodGroup}`}
              className="card-glass p-5 rounded-2xl border border-white/10 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-mars-600/20 border border-mars-500/40 font-display font-bold text-lg text-mars-400">
                    {group.bloodGroup}
                  </span>
                  <div>
                    <h3 id={`group-heading-${group.bloodGroup}`} className="text-base font-display font-bold text-white">
                      Blood Group {group.bloodGroup}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Registered Donors: {group.registeredCount}
                      {group.filteredCount !== group.registeredCount && ` • Matching Filters: ${group.filteredCount}`}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                  {group.donors.length} shown
                </span>
              </div>

              {group.donors.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
                  {group.registeredCount === 0
                    ? `No registered donors recorded under ${group.bloodGroup}.`
                    : `No ${group.bloodGroup} donors match the current search/availability filters.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.donors.map((donor) => {
                    const pres = donor.availabilityPresentation;
                    const styles = getAvailabilityStyles(pres?.badgeCategory);
                    const StatusIcon = styles.Icon;

                    return (
                      <button
                        key={donor.userId}
                        type="button"
                        onClick={() => handleOpenDonor(donor.userId)}
                        className="group text-left p-4 rounded-2xl bg-space-950/80 hover:bg-space-900 border border-white/10 hover:border-mars-500/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-500 flex flex-col justify-between gap-3.5"
                      >
                        <div className="flex items-start gap-3.5 w-full">
                          <SuperAdminDonorPhoto
                            userId={donor.userId}
                            fullName={donor.fullName}
                            bloodGroup={donor.bloodGroup}
                            hasPhoto={donor.hasPhoto}
                            sizeClass="w-16 h-16"
                            textClass="text-lg"
                          />

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-display font-bold text-sm sm:text-base text-white truncate group-hover:text-mars-300 transition-colors">
                                {donor.fullName}
                              </p>
                              <span className="shrink-0 px-2 py-0.5 rounded-md bg-mars-500/20 border border-mars-500/35 font-mono font-bold text-xs text-mars-300">
                                {donor.bloodGroup}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span className="truncate">{donor.city || 'City not recorded'}</span>
                            </p>

                            <p className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{donor.mobileNumber}</span>
                            </p>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 w-full">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${styles.badge}`}>
                              <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{pres?.title || pres?.badgeText}</span>
                            </span>
                            {pres?.isInCooldown && pres?.nextEligibleDate && (
                              <p className="mt-1 text-[11px] font-mono text-rose-300 truncate">
                                Eligible {formatCalendarDate(pres.nextEligibleDate)} ({pres.daysRemaining}d left)
                              </p>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-slate-400 group-hover:text-white shrink-0">
                            Profile
                            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Detailed Donor Profile Modal/Drawer */}
      <SuperAdminDonorProfileModal
        selectedUserId={selectedUserId}
        detail={detailData}
        loading={detailLoading}
        error={detailError}
        onRefresh={() => loadDonorDetail(selectedUserId)}
        onClose={handleCloseModal}
      />
    </div>
  );
}
