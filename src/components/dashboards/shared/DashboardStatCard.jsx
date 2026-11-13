import React from 'react';

export default function DashboardStatCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'mars', // 'mars' | 'emerald' | 'amber' | 'cyan' | 'purple'
  loading = false,
  unavailable = false
}) {
  const colorMap = {
    mars: {
      border: 'border-mars-500/30 hover:border-mars-500/60',
      bgGlow: 'bg-mars-500/5',
      iconBg: 'bg-mars-500/10 text-mars-400 border-mars-500/30',
      textAccent: 'text-mars-400'
    },
    emerald: {
      border: 'border-emerald-500/30 hover:border-emerald-500/60',
      bgGlow: 'bg-emerald-500/5',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      textAccent: 'text-emerald-400'
    },
    amber: {
      border: 'border-amber-500/30 hover:border-amber-500/60',
      bgGlow: 'bg-amber-500/5',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      textAccent: 'text-amber-400'
    },
    cyan: {
      border: 'border-cyan-500/30 hover:border-cyan-500/60',
      bgGlow: 'bg-cyan-500/5',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      textAccent: 'text-cyan-400'
    },
    purple: {
      border: 'border-purple-500/30 hover:border-purple-500/60',
      bgGlow: 'bg-purple-500/5',
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      textAccent: 'text-purple-400'
    }
  };

  const currentTheme = colorMap[color] || colorMap.mars;

  if (loading) {
    return (
      <div className="card-glass rounded-2xl p-5 border border-white/5 animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 bg-white/10 rounded"></div>
          <div className="w-9 h-9 rounded-xl bg-white/10"></div>
        </div>
        <div className="h-7 w-16 bg-white/10 rounded"></div>
        <div className="h-2.5 w-32 bg-white/5 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`card-glass rounded-2xl p-5 border transition-all duration-300 ${currentTheme.border} ${currentTheme.bgGlow} shadow-lg relative overflow-hidden group`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-medium text-slate-400 tracking-wider uppercase">
          {title}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110 ${currentTheme.iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-orbitron font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          {unavailable ? (
            <span className="text-slate-500 text-lg font-mono">Unavailable</span>
          ) : (
            value ?? '0'
          )}
        </span>
      </div>

      {subtext && (
        <p className="mt-2 text-[11px] font-mono text-slate-400 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}
