import React from 'react';
import { 
  LayoutDashboard, 
  Heart, 
  History, 
  FileCheck2, 
  Award, 
  User, 
  ShieldCheck, 
  ArrowLeft, 
  LogOut, 
  Droplet, 
  X, 
  Shield, 
  Layers,
  FileText,
  Users
} from 'lucide-react';
import DonorAvatar from '../../common/DonorAvatar';

export default function DashboardSidebar({
  activeTab,
  onTabChange,
  currentUser,
  donorProfile,
  badgeCounts = {},
  onBackToWebsite,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
  portalType = 'user',
  navItems: customNavItems,
  currentAdmin,
  switchAction
}) {
  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  const isModerator = adminRole === 'MODERATOR';
  const isSuperAdmin = adminRole === 'SUPER_ADMIN' || portalType === 'superadmin';

  // Default User Navigation items
  const userNavItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'requests',
      label: 'My Requests',
      icon: Droplet,
      badge: badgeCounts.myRequests > 0 ? badgeCounts.myRequests : null,
      badgeColor: 'bg-mars-500/20 text-mars-400 border-mars-500/40'
    },
    {
      id: 'pledges',
      label: 'My Pledges',
      icon: Heart,
      badge: badgeCounts.activePledges > 0 ? badgeCounts.activePledges : null,
      badgeColor: 'bg-mars-500/20 text-mars-400 border-mars-500/40'
    },
    {
      id: 'history',
      label: 'Donation History',
      icon: History,
      badge: badgeCounts.completedDonations > 0 ? badgeCounts.completedDonations : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    },
    {
      id: 'proofs',
      label: 'My Donation Proofs',
      icon: FileCheck2,
      badge: badgeCounts.pendingProofs > 0 ? badgeCounts.pendingProofs : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
    },
    {
      id: 'certificates',
      label: 'My Certificates',
      icon: Award,
      badge: badgeCounts.certificates > 0 ? badgeCounts.certificates : null,
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    },
    {
      id: 'profile',
      label: 'Donor Profile',
      icon: User,
      badge: (donorProfile?.isDonor || donorProfile?.userId) ? 'Active' : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    },
    {
      id: 'security',
      label: 'Security & Sessions',
      icon: ShieldCheck,
      badge: null
    }
  ];

  // Default Admin Navigation items
  const defaultAdminNavItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'proofs',
      label: 'Donation Proof Review',
      icon: FileCheck2,
      badge: badgeCounts.pendingProofs > 0 ? badgeCounts.pendingProofs : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
    },
    {
      id: 'requests',
      label: 'Emergency Requests',
      icon: Heart,
      badge: badgeCounts.activeRequests > 0 ? badgeCounts.activeRequests : null,
      badgeColor: 'bg-mars-500/20 text-mars-400 border-mars-500/40'
    },
    ...(!isModerator ? [
      {
        id: 'reports',
        label: 'Monthly Reports',
        icon: FileText,
        badge: null
      },
      {
        id: 'rotaract',
        label: 'Rotaract Directory',
        icon: Users,
        badge: null
      }
    ] : [])
  ];

  const navItems = customNavItems || (portalType === 'admin' ? defaultAdminNavItems : userNavItems);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile} 
          className="fixed inset-0 z-40 bg-space-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-space-900 border-r border-white/10 flex flex-col justify-between transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        {/* Top Header & Branding */}
        <div>
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-space-850 border border-mars-500/40 flex items-center justify-center p-2 shadow-lg shadow-mars-600/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-mars-700 via-mars-500 to-mars-flame animate-pulse flex items-center justify-center">
                  <Droplet className="w-3 h-3 text-white fill-white" />
                </div>
              </div>
              <div>
                <div className="font-orbitron font-extrabold text-base tracking-wider text-white">
                  RED<span className="text-mars-500">MISSION</span>
                </div>
                <div className="text-[10px] font-mono tracking-widest text-mars-400 uppercase font-bold">
                  {portalType === 'superadmin'
                    ? 'Super Admin Command'
                    : portalType === 'admin' 
                      ? (isModerator ? 'Moderator Panel' : 'Admin Command') 
                      : 'User Dashboard'}
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Identity Mini Card */}
          {(portalType === 'admin' || portalType === 'superadmin') ? (
            <div className="p-4 mx-3 my-3 rounded-2xl bg-space-850/70 border border-white/5 flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md ${
                  isSuperAdmin 
                    ? 'bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 shadow-amber-500/30'
                    : 'bg-gradient-to-tr from-amber-600 to-amber-500 shadow-amber-500/20'
                }`}>
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-space-900" title="Active Admin Session" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-white truncate font-orbitron">
                  {currentAdmin?.fullName || currentAdmin?.username || 'Administrator'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                    isSuperAdmin
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50'
                      : isModerator 
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {adminRole || (portalType === 'superadmin' ? 'SUPER_ADMIN' : 'ADMIN')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate">
                    @{currentAdmin?.username || 'admin'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 mx-3 my-3 rounded-2xl bg-space-850/70 border border-white/5 flex items-center gap-3">
              <div className="relative">
                {donorProfile?.photoUrl ? (
                  <DonorAvatar src={donorProfile.photoUrl} name={currentUser?.fullName} size="sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-mars-600 to-mars-flame flex items-center justify-center font-bold text-sm text-white">
                    {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                {(donorProfile?.isDonor || donorProfile?.userId) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-space-900" title="Active Donor" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-white truncate font-orbitron">
                  {currentUser?.fullName || 'User'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-mars-500/20 text-mars-400 font-bold border border-mars-500/30">
                    {currentUser?.bloodGroup || 'Blood Group N/A'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate">
                    {currentUser?.city || 'India'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Nav Items */}
          <nav className="px-3 space-y-1 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all duration-200 cursor-pointer
                    ${isActive 
                      ? 'bg-mars-600 text-white font-semibold shadow-lg shadow-mars-600/20' 
                      : 'text-slate-300 hover:text-white hover:bg-white/5'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${isActive ? 'bg-white/20 text-white border-white/30' : (item.badgeColor || 'bg-white/10 text-slate-300 border-white/10')}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Optional Portal Switch Action (e.g. Super Admin <-> Admin Ops) */}
          {switchAction && (
            <button
              onClick={switchAction.onClick}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                switchAction.className || 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
              }`}
            >
              {switchAction.icon && <switchAction.icon className="w-4 h-4 shrink-0" />}
              <span>{switchAction.label}</span>
            </button>
          )}

          {/* Back to Website */}
          <button
            onClick={onBackToWebsite}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-mars-400" />
            <span>Return to Website</span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
