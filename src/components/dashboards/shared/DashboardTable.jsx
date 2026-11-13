import React from 'react';

export default function DashboardTable({
  title,
  subtitle,
  headerAction,
  columns = [],
  children,
  isEmpty = false,
  emptyMessage = 'No records found.',
  emptySubtext = 'Records will appear here as soon as activities take place.',
  emptyAction,
  loading = false
}) {
  return (
    <div className="card-glass rounded-2xl border border-white/10 shadow-xl overflow-hidden">
      {(title || headerAction) && (
        <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {title && (
              <h3 className="font-orbitron font-bold text-sm sm:text-base text-white tracking-wide">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-mars-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-400">Loading records from secure network...</p>
        </div>
      ) : isEmpty ? (
        <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
            <span className="text-xl">📋</span>
          </div>
          <div className="font-orbitron font-bold text-sm text-slate-200">
            {emptyMessage}
          </div>
          <p className="text-xs text-slate-400 font-mono">
            {emptySubtext}
          </p>
          {emptyAction && (
            <div className="pt-2">
              {emptyAction}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {columns.length > 0 && (
              <thead>
                <tr className="border-b border-white/5 bg-space-900/60 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  {columns.map((col, idx) => (
                    <th key={col.id || col.label || `col-${idx}`} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-white/5 text-xs text-slate-300 font-mono">
              {children}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
