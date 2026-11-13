import React from 'react';
import { Menu, Heart, Droplet, ArrowLeft, ShieldCheck } from 'lucide-react';
import LiveDateTime from '../../shared/LiveDateTime';

export default function DashboardHeader({
  activeTabTitle,
  activeTabSubtitle,
  onOpenMobileSidebar,
  onBackToWebsite,
  currentUser,
  currentAdmin,
  portalType = 'user',
  headerCategory,
  switchAction
}) {
  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  const isModerator = adminRole === 'MODERATOR';
  const isSuperAdmin = adminRole === 'SUPER_ADMIN' || portalType === 'superadmin';

  const defaultCategory = portalType === 'superadmin'
    ? 'Super Admin Command //'
    : portalType === 'admin' 
      ? (isModerator ? 'Moderator Portal //' : 'Admin Command //') 
      : 'User Portal //';

  return (
    <header className="sticky top-0 z-30 bg-space-950/85 backdrop-blur-md border-b border-white/10">
      {/* Shared Portal Live IST Date & Time Bar */}
      <div className="bg-space-900/75 border-b border-white/5 px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-center sm:justify-between gap-2">
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
          <span>Standard Time // Asia/Kolkata</span>
        </div>
        <LiveDateTime variant="bar" accent={portalType === 'user' ? 'mars' : 'amber'} />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
      
      {/* Left: Mobile Toggle & Tab Heading */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl bg-space-850 border border-white/10 text-slate-300 hover:text-white hover:border-mars-500/40 cursor-pointer"
          aria-label="Open Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              {headerCategory || defaultCategory}
            </span>
            <h1 className="font-orbitron font-extrabold text-base sm:text-lg text-white tracking-wide">
              {activeTabTitle}
            </h1>
          </div>
          {activeTabSubtitle && (
            <p className="text-[11px] font-mono text-slate-400 hidden sm:block">
              {activeTabSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Network Status & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Network indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Red Mission Network Online</span>
        </div>

        {/* Super Admin Switch Action Pill (Header Shortcut) */}
        {switchAction && (
          <button
            onClick={switchAction.onClick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title={switchAction.label}
          >
            {switchAction.icon && <switchAction.icon className="w-3.5 h-3.5 text-amber-400" />}
            <span>{switchAction.shortLabel || switchAction.label}</span>
          </button>
        )}

        {/* Admin / Super Admin Role Pill */}
        {(portalType === 'admin' || portalType === 'superadmin') && (
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
            isSuperAdmin
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : isModerator 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{adminRole || (portalType === 'superadmin' ? 'SUPER_ADMIN' : 'ADMIN')}</span>
          </div>
        )}

        {/* Public Website Button */}
        <button
          onClick={onBackToWebsite}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Return to Public Website"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-mars-400" />
          <span className="hidden sm:inline">Public Site</span>
        </button>

        {/* User Emergency Blood Request Link (User Portal Only) */}
        {portalType === 'user' && (
          <a
            href="#requests"
            onClick={onBackToWebsite}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white shadow-md shadow-mars-600/30 hover:brightness-110 transition-all cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 fill-white" />
            <span>Emergency Request</span>
          </a>
        )}
      </div>
      </div>
    </header>
  );
}
