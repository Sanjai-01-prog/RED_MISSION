import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  Heart, 
  Users, 
  MapPin, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  Activity,
  Award
} from 'lucide-react';
import { publicApi } from '../services/api';

/**
 * RED MISSION IMPACT SECTION
 * Authentic, verifiable metrics queried directly from the SQLite database.
 * 
 * Potential Lives Impacted Calculation:
 * Estimated potential based on up to three therapeutic components per verified whole-blood donation:
 *   1. Packed Red Blood Cells (PRBC) — severe anemia, trauma, surgery
 *   2. Platelet Concentrate (RDP/SDP) — oncology, dengue, thrombocytopenia
 *   3. Fresh Frozen Plasma (FFP) — burn victims, coagulopathy, liver disease
 * Actual patient treatment is not confirmed by this statistic.
 * Formula: Potential Lives Impacted = Total Verified Whole-Blood Donations × up to 3
 */
export default function TelemetryBar() {
  const [stats, setStats] = useState({
    totalDonations: 0,
    registeredDonors: 0,
    potentialLivesImpacted: 0,
    citiesRepresented: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [showFormulaTooltip, setShowFormulaTooltip] = useState(false);

  const fetchRealImpactStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await publicApi.getImpactStats();
      if (res.success && res.stats) {
        setStats({
          totalDonations: Number(res.stats.totalDonations || 0),
          registeredDonors: Number(res.stats.registeredDonors || 0),
          potentialLivesImpacted: Number(res.stats.potentialLivesImpacted !== undefined ? res.stats.potentialLivesImpacted : (res.stats.livesImpacted || 0)),
          citiesRepresented: Number(res.stats.citiesRepresented !== undefined ? res.stats.citiesRepresented : (res.stats.citiesReached || 0))
        });
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setError(res.error || 'Failed to load impact telemetry.');
      }
    } catch (err) {
      console.error('Impact stats fetch error:', err);
      setError('Network communication error loading real-time telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealImpactStats();

    // Auto-refresh when donors register or donation proofs/pledges update
    const handlePlatformEvent = () => {
      fetchRealImpactStats();
    };

    window.addEventListener('donor-registered', handlePlatformEvent);
    window.addEventListener('pledge-updated', handlePlatformEvent);
    window.addEventListener('proof-reviewed', handlePlatformEvent);

    return () => {
      window.removeEventListener('donor-registered', handlePlatformEvent);
      window.removeEventListener('pledge-updated', handlePlatformEvent);
      window.removeEventListener('proof-reviewed', handlePlatformEvent);
    };
  }, []);

  return (
    <section 
      id="telemetry" 
      aria-label="RED MISSION Impact and Network Statistics"
      className="relative z-20 py-8 px-4 sm:px-6 lg:px-8 border-y border-white/10 bg-space-950/90 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest mb-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
              <span>LIVE RELATIONAL DATABASE TELEMETRY</span>
            </div>
            
            <h2 className="font-orbitron font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              RED MISSION <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-400 to-mars-flame">IMPACT</span>
            </h2>
            
            <p className="text-slate-300 text-sm sm:text-base font-light mt-1">
              Together, saving lives through blood donation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
                Last Synced: <span className="text-slate-200">{lastUpdated}</span>
              </span>
            )}

            <button
              type="button"
              onClick={fetchRealImpactStats}
              disabled={loading}
              className="p-2 rounded-xl bg-space-900 hover:bg-space-850 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-mars-500/50"
              title="Refresh live impact statistics"
              aria-label="Refresh live impact statistics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mars-400' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
            {error} (Displaying last synchronized database state)
          </div>
        )}

        {/* 4 Primary Real Impact Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          
          {/* 1. Total Donations */}
          <div className="card-glass rounded-2xl p-5 border-l-4 border-l-mars-500 hover:border-white/20 transition-all space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="tracking-wider uppercase">Total Donations</span>
              <div className="p-2 rounded-xl bg-mars-500/10 border border-mars-500/20 text-mars-400 group-hover:scale-110 transition-transform">
                <Award className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
                {loading && stats.totalDonations === 0 ? '...' : stats.totalDonations.toLocaleString()}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-1">
                Verified completed donations
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-mars-400"></span>
              <span>Verified Relational Records</span>
            </div>
          </div>

          {/* 2. Registered Donors */}
          <div className="card-glass rounded-2xl p-5 border-l-4 border-l-cyan-500 hover:border-white/20 transition-all space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="tracking-wider uppercase">Registered Donors</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="font-orbitron font-extrabold text-3xl sm:text-4xl text-cyan-400 tracking-tight">
                {loading && stats.registeredDonors === 0 ? '...' : stats.registeredDonors.toLocaleString()}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-1">
                Verified voluntary lifesavers
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] font-mono text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>24/7 Standby Availability</span>
            </div>
          </div>

          {/* 3. Potential Lives Impacted */}
          <div className="card-glass rounded-2xl p-5 border-l-4 border-l-emerald-500 hover:border-white/20 transition-all space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="tracking-wider uppercase">Potential Lives Impacted</span>
                <button
                  type="button"
                  onClick={() => setShowFormulaTooltip(!showFormulaTooltip)}
                  className="text-slate-400 hover:text-emerald-400 cursor-pointer"
                  title="Click to view component separation calculation"
                  aria-label="Component calculation explanation"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                <Heart className="w-4 h-4 fill-emerald-400/20" />
              </div>
            </div>

            <div>
              <div className="font-orbitron font-extrabold text-3xl sm:text-4xl text-emerald-400 tracking-tight">
                {loading && stats.potentialLivesImpacted === 0 ? '...' : stats.potentialLivesImpacted.toLocaleString()}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-1 leading-snug">
                Estimated potential based on up to three therapeutic components per verified whole-blood donation. Actual patient treatment is not confirmed by this statistic.
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Up to 3 Components</span>
              <span className="text-emerald-400 font-bold">RBC • Platelets • Plasma</span>
            </div>
          </div>

          {/* 4. Cities Represented */}
          <div className="card-glass rounded-2xl p-5 border-l-4 border-l-amber-500 hover:border-white/20 transition-all space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="tracking-wider uppercase">Cities Represented</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                <MapPin className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="font-orbitron font-extrabold text-3xl sm:text-4xl text-amber-300 tracking-tight">
                {loading && stats.citiesRepresented === 0 ? '...' : stats.citiesRepresented.toLocaleString()}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-1">
                Active voluntary donor and hospital locations across network
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] font-mono text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>Network Geographic Footprint</span>
            </div>
          </div>

        </div>

        {/* Medically Defensible Potential Lives Impacted Explanation Accordion / Banner */}
        {showFormulaTooltip && (
          <div className="mt-4 p-4 rounded-2xl bg-space-900/95 border border-emerald-500/30 text-xs font-mono text-slate-300 space-y-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between font-bold text-emerald-400">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Component Fractionation Standard</span>
              </span>
              <button 
                type="button" 
                onClick={() => setShowFormulaTooltip(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="leading-relaxed text-[11px] text-slate-300">
              Under standard National Blood Transfusion Council (NBTC) and WHO guidelines, a single 350–450 mL voluntary whole blood donation can be fractionated into up to three essential therapeutic components: <strong className="text-white">Packed Red Blood Cells (PRBC)</strong>, <strong className="text-white">Platelet Concentrate</strong>, and <strong className="text-white">Fresh Frozen Plasma (FFP)</strong>. This metric represents the estimated potential therapeutic reach based on component fractionation; actual patient transfusion and treatment are not confirmed by this platform statistic.
            </p>
            <div className="text-[10px] text-emerald-300 pt-1 border-t border-white/10">
              Formula: Verified Whole-Blood Donations ({stats.totalDonations}) × up to 3 Potential Components = {stats.potentialLivesImpacted} Potential Lives Impacted.
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
