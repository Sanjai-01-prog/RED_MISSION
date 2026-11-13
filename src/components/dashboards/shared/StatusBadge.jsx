import React from 'react';

/**
 * Standardized status badges for pledges and donation proofs
 */
export default function StatusBadge({ status, size = 'sm' }) {
  const normalized = (status || '').toUpperCase();
  
  let colorClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  let dotColor = 'bg-slate-400';
  let label = status || 'Unknown';

  if (normalized === 'SUCCESSFULLY COMPLETED' || normalized === 'COMPLETED' || normalized === 'FULFILLED') {
    colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
    dotColor = 'bg-emerald-400';
    label = 'Successfully Completed';
  } else if (normalized === 'APPROVED') {
    colorClasses = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    dotColor = 'bg-emerald-400';
    label = 'Approved';
  } else if (normalized === 'IN PROGRESS' || normalized === 'IN_PROGRESS') {
    colorClasses = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-sm shadow-cyan-500/10';
    dotColor = 'bg-cyan-400 animate-pulse';
    label = 'In Progress';
  } else if (normalized === 'PENDING REQUEST' || normalized === 'PENDING_REQUEST') {
    colorClasses = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    dotColor = 'bg-amber-400 animate-pulse';
    label = 'Pending Request';
  } else if (normalized === 'UNDER ADMIN REVIEW' || normalized === 'UNDER_REVIEW' || normalized === 'PENDING') {
    colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    dotColor = 'bg-cyan-400 animate-pulse';
    label = 'Under Review';
  } else if (normalized === 'DONATION PROOF PENDING' || normalized === 'PROOF_PENDING') {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
    label = 'Proof Pending';
  } else if (normalized === 'PLEDGED') {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
    label = 'Pledged';
  } else if (normalized === 'REJECTED') {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    dotColor = 'bg-rose-400';
    label = 'Rejected';
  } else if (normalized === 'CANCELLED') {
    colorClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    dotColor = 'bg-slate-400';
    label = 'Cancelled';
  } else if (normalized === 'EXPIRED') {
    colorClasses = 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10';
    dotColor = 'bg-amber-400';
    label = 'Expired';
  }

  const sizeClasses = size === 'xs' 
    ? 'text-[10px] px-2 py-0.5' 
    : size === 'md' 
    ? 'text-xs px-3 py-1 font-semibold' 
    : 'text-[11px] px-2.5 py-0.5 font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-mono border ${colorClasses} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      <span>{label}</span>
    </span>
  );
}
