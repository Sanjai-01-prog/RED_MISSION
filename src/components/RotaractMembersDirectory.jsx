import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  ArrowLeft,
  Users,
  Search,
  Award,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck
} from 'lucide-react';
import LiveDateTime from './shared/LiveDateTime';
import { rotaractApi } from '../services/api';

function MemberInitialsFallback({ fullName }) {
  const parts = String(fullName || 'RM')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.slice(0, 2) || 'RM').toUpperCase();

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-gradient-to-br from-space-800 via-space-850 to-mars-950/70 text-mars-300 font-orbitron font-bold text-3xl tracking-wider select-none"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function RotaractMembersDirectory({ onBackToWebsite, isAdminAuthenticated, onOpenAdminDirectory }) {
  const [members, setMembers] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [totalPublic, setTotalPublic] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('all');

  const searchInputId = useId();
  const designationFilterId = useId();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await rotaractApi.getPublicMembers();
      if (res.success) {
        setMembers(Array.isArray(res.members) ? res.members : []);
        setDesignations(Array.isArray(res.designations) ? res.designations : []);
        setTotalPublic(typeof res.totalPublic === 'number' ? res.totalPublic : (res.members?.length || 0));
      } else {
        setError(res.error || 'Unable to load Rotaract college members directory.');
      }
    } catch (err) {
      setError('Failed to connect to the Rotaract directory service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [fetchMembers]);

  const cleanSearch = searchQuery.trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (selectedDesignation !== 'all' && member.designation !== selectedDesignation) {
      return false;
    }
    if (cleanSearch) {
      const nameMatch = String(member.fullName || '').toLowerCase().includes(cleanSearch);
      const desigMatch = String(member.designation || '').toLowerCase().includes(cleanSearch);
      return nameMatch || desigMatch;
    }
    return true;
  });

  const showFilterToolbar = members.length > 0;

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col relative z-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-space-950/90 backdrop-blur-md border-b border-white/10">
        <div className="bg-space-900/75 border-b border-white/5 px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-center sm:justify-between gap-2">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
            <span>Rotaract Club // KPR Institute of Engineering and Technology</span>
          </div>
          <LiveDateTime variant="bar" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 hover:border-mars-500/40 text-xs font-mono text-slate-200 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-mars-400 focus-visible:outline-offset-2"
          >
            <ArrowLeft className="w-4 h-4 text-mars-400" aria-hidden="true" />
            <span>Back to RED MISSION</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchMembers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-space-900 hover:bg-space-850 border border-white/10 text-xs font-mono text-slate-300 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            {isAdminAuthenticated && onOpenAdminDirectory && (
              <button
                type="button"
                onClick={onOpenAdminDirectory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-mono text-amber-300 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Manage Directory</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        {/* Heading Banner */}
        <section aria-labelledby="rotaract-directory-heading" className="relative rounded-3xl bg-space-900/75 border border-white/10 p-6 sm:p-8 lg:p-10 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-[11px] font-mono uppercase tracking-widest text-mars-300">
                <Award className="w-3.5 h-3.5 text-mars-400" aria-hidden="true" />
                <span>Rotaract District 3206 // Institutional Chapter</span>
              </div>

              <h1 id="rotaract-directory-heading" className="font-orbitron font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                Rotaract Club of <span className="text-mars-400">KPRIET</span> — Members Directory
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed">
                Official public directory recognizing the Rotaract College office bearers and voluntary service leaders advancing blood donation awareness and community health initiatives through RED MISSION.
              </p>
            </div>

            <div className="partner-logo-surface rounded-2xl px-6 py-4 flex items-center justify-center shrink-0 border border-white/10">
              <img
                src="/images/partners/rotaract-kpriet-college-logo.png"
                alt="Rotaract Club of KPR Institute of Engineering and Technology official emblem"
                width="1024"
                height="576"
                className="h-20 sm:h-24 w-auto object-contain"
              />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Authorized Public Roster</span>
            </div>
            <div>
              Showing <span className="text-white font-semibold">{filteredMembers.length}</span> of{' '}
              <span className="text-white font-semibold">{totalPublic}</span> published members
            </div>
          </div>
        </section>

        {/* Search & Designation Filtering (rendered cleanly when directory has entries) */}
        {showFilterToolbar && (
          <search>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="rounded-2xl bg-space-900/70 border border-white/10 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            >
              <div className="md:col-span-7 space-y-1.5">
                <label htmlFor={searchInputId} className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Search Member Name or Designation
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id={searchInputId}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by member name or office designation..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-space-950 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                  />
                </div>
              </div>

              <div className="md:col-span-5 space-y-1.5">
                <label htmlFor={designationFilterId} className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Designation Role
                </label>
                <select
                  id={designationFilterId}
                  value={selectedDesignation}
                  onChange={(e) => setSelectedDesignation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-space-950 border border-white/15 text-sm text-white focus:outline-none focus:border-mars-500"
                >
                  <option value="all">All Designations ({members.length})</option>
                  {designations.map((desig) => (
                    <option key={desig} value={desig}>
                      {desig}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          </search>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-9 h-9 border-4 border-mars-500/30 border-t-mars-500 rounded-full animate-spin" aria-hidden="true"></div>
            <p className="text-xs font-mono uppercase tracking-wider">Loading Rotaract Directory...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div role="alert" className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 text-center space-y-3">
            <p className="text-sm text-rose-200">{error}</p>
            <button
              type="button"
              onClick={fetchMembers}
              className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 border border-rose-500/40 text-xs font-mono text-white cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty Directory State (when zero genuine members are added yet) */}
        {!loading && !error && members.length === 0 && (
          <div className="rounded-3xl bg-space-900/60 border border-white/10 p-10 sm:p-14 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-space-850 border border-white/10 flex items-center justify-center mx-auto text-mars-400">
              <Users className="w-7 h-7" aria-hidden="true" />
            </div>
            <h2 className="font-orbitron font-bold text-lg sm:text-xl text-white">
              Directory Ready for Verified Club Members
            </h2>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              No Rotaract Club member profiles have been published yet. Authorized RED MISSION administrators can add verified member photographs, full names, and official designations from the Admin Command Portal.
            </p>
            {isAdminAuthenticated && onOpenAdminDirectory && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenAdminDirectory}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-mars-600 hover:bg-mars-500 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Open Directory Management</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Returned Zero Matches */}
        {!loading && !error && members.length > 0 && filteredMembers.length === 0 && (
          <div className="rounded-2xl bg-space-900/60 border border-white/10 p-8 text-center space-y-3">
            <p className="text-sm text-slate-300">
              No directory members match your current filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDesignation('all');
              }}
              className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-white cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Member Cards Grid */}
        {!loading && !error && filteredMembers.length > 0 && (
          <ul
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {filteredMembers.map((member) => (
              <li key={member.id} className="min-w-0">
                <article className="member-directory-card h-full rounded-2xl bg-space-900/80 border border-white/10 overflow-hidden flex flex-col shadow-lg">
                  <div className="aspect-[4/3] w-full bg-space-850 border-b border-white/10 overflow-hidden">
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={`${member.fullName}, ${member.designation}`}
                        loading="lazy"
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <MemberInitialsFallback fullName={member.fullName} />
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-2.5">
                    <h2 className="font-orbitron font-bold text-base text-white leading-snug break-words">
                      {member.fullName}
                    </h2>
                    <p className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-mars-300">
                      <Award className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
                      <span className="break-words">{member.designation}</span>
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
