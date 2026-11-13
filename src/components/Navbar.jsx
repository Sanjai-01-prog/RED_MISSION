import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Droplet,
  ShieldCheck,
  ChevronRight,
  User,
  LogOut,
  LayoutDashboard,
  ExternalLink
} from 'lucide-react';
import UserAccountMenu from './auth/UserAccountMenu';
import LiveDateTime from './shared/LiveDateTime';

const NAVBAR_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'Blood Register', href: '#requests' }
];

const COLLEGE_LOGO = {
  src: '/images/partners/kpriet-college-navbar-logo.png',
  alt: 'KPR Institute of Engineering and Technology official logo',
  href: 'https://www.kpriet.ac.in/',
  label: 'KPRIET',
  width: 1024,
  height: 1024
};

const ROTARACT_COLLEGE_LOGO = {
  src: '/images/partners/rotaract-kpriet-club-navbar-logo.png',
  alt: 'Rotaract Club of KPR Institute of Engineering and Technology official logo',
  href: '#rotaract-directory',
  label: 'Rotaract KPRIET',
  width: 1024,
  height: 576
};

export default function Navbar({
  onOpenRoleSelection,
  onOpenUserAuth,
  onOpenBloodDrop,
  currentUser,
  currentAdmin,
  onUserLogout,
  onAdminLogout,
  onOpenDonorRegistration,
  onViewCertificate,
  onOpenUserDashboard,
  onOpenAdminDashboard,
  onOpenSuperAdminDashboard,
  onOpenRotaractDirectory,
  hideClock = false
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = NAVBAR_LINKS.map((link) => link.href.substring(1));
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 260 && rect.bottom >= 120) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLoginTrigger = () => {
    if (onOpenRoleSelection) onOpenRoleSelection();
    else if (onOpenUserAuth) onOpenUserAuth('login');
  };

  const handleRotaractLogoClick = (e) => {
    setMobileMenuOpen(false);
    if (onOpenRotaractDirectory) {
      e.preventDefault();
      onOpenRotaractDirectory();
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-space-950/95 backdrop-blur-md border-b border-white/10 pb-4 shadow-2xl'
          : 'bg-space-950/75 backdrop-blur-sm border-b border-white/5 pb-4'
      }`}
    >
      {/* Permanent Live IST Date & Time Strip */}
      <div className="w-full bg-space-950/90 backdrop-blur-md border-b border-white/10">
        <div className="w-full px-3 sm:px-4 lg:px-8 py-2 flex items-center justify-center sm:justify-between gap-2 min-h-[34px]">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
            <span>24/7 Emergency Blood Network</span>
          </div>
          {!hideClock && <LiveDateTime variant="bar" />}
        </div>
      </div>

      {/* Main Full-Width Three-Part Navbar: LEFT (Brand + Nav) | SPACER | RIGHT (Institutional Logos + Account/Login) */}
      <div className={`w-full px-2.5 sm:px-4 lg:px-8 ${isScrolled ? 'pt-3.5' : 'pt-4'}`}>
        <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 lg:gap-4 min-h-[68px]">
          {/* LEFT SECTION: RED MISSION Branding + Primary Navigation */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-7 min-w-0 shrink-0">
            {/* Official RED MISSION Logo & Brand Name */}
            <a
              href="#home"
              className="flex items-center gap-1.5 lg:gap-3 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 shrink-0"
            >
              <div className="relative w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl bg-space-850 border border-mars-500/40 flex items-center justify-center p-1 sm:p-1.5 lg:p-2 overflow-hidden group-hover:border-mars-500 transition-colors shadow-lg shadow-mars-600/10 shrink-0">
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-full bg-gradient-to-tr from-mars-700 via-mars-500 to-mars-flame animate-pulse flex items-center justify-center">
                  <Droplet className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 text-white fill-white" aria-hidden="true" />
                </div>
                <div className="absolute inset-0 border border-mars-flame/30 rounded-xl rotate-45 transform group-hover:rotate-90 transition-transform duration-700"></div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-orbitron font-extrabold text-[13px] sm:text-base lg:text-xl tracking-wider text-white whitespace-nowrap">
                    RED<span className="text-mars-500">MISSION</span>
                  </span>
                  <span className="hidden xl:inline-flex text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-mars-500/10 text-mars-400 border border-mars-500/30 whitespace-nowrap">
                    BLOOD NETWORK
                  </span>
                </div>
                <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase hidden xl:block whitespace-nowrap">
                  Emergency Blood &amp; Donor Connect
                </p>
              </div>
            </a>

            {/* Primary Navigation Links Beside RED MISSION */}
            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-1 lg:gap-1.5 bg-space-900/75 p-1 rounded-full border border-white/10 backdrop-blur-md shrink-0"
            >
              {NAVBAR_LINKS.map((link) => {
                const sectionId = link.href.substring(1);
                const isActive = activeSection === sectionId;

                return (
                  <a
                    key={link.name}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-full font-orbitron font-bold text-[11px] lg:text-[13px] tracking-wider uppercase whitespace-nowrap border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 ${
                      isActive
                        ? 'bg-mars-600 text-white border-mars-400/60 shadow-md shadow-mars-600/30'
                        : 'text-slate-200 border-transparent hover:text-white hover:bg-mars-500/15 hover:border-mars-500/40'
                    }`}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true"></span>
                    )}
                    <span>{link.name}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* CENTER FLEX SPACER */}
          <div className="hidden md:block flex-1 min-w-[4px]" aria-hidden="true" />

          {/* RIGHT SECTION: Institutional Logos + User Profile / Login + Mobile Toggle */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 lg:gap-4 shrink-0">
            {/* Official College & Rotaract College Logos (Frameless Transparent Originals) */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 shrink-0" aria-label="Institutional Partners">
              <a
                href={COLLEGE_LOGO.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${COLLEGE_LOGO.alt} — Visit official website (opens in a new tab)`}
                title="KPR Institute of Engineering and Technology"
                className="inline-flex items-center justify-center shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400"
              >
                <img
                  src={COLLEGE_LOGO.src}
                  alt={COLLEGE_LOGO.alt}
                  width={COLLEGE_LOGO.width}
                  height={COLLEGE_LOGO.height}
                  className="h-7 sm:h-10 lg:h-12 w-auto object-contain select-none"
                />
              </a>

              <a
                href={ROTARACT_COLLEGE_LOGO.href}
                onClick={handleRotaractLogoClick}
                aria-label={`${ROTARACT_COLLEGE_LOGO.alt} — Open Rotaract Members Directory`}
                title="Rotaract Club of KPRIET — Members Directory"
                className="inline-flex items-center justify-center shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400"
              >
                <img
                  src={ROTARACT_COLLEGE_LOGO.src}
                  alt={ROTARACT_COLLEGE_LOGO.alt}
                  width={ROTARACT_COLLEGE_LOGO.width}
                  height={ROTARACT_COLLEGE_LOGO.height}
                  className="h-7 sm:h-10 lg:h-12 w-auto object-contain select-none"
                />
              </a>
            </div>

            <div className="hidden lg:block h-7 w-px bg-white/10 mx-0.5 shrink-0" aria-hidden="true" />

            {/* User Profile / Account Area or Public Login Trigger */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => (onOpenUserDashboard ? onOpenUserDashboard() : (window.location.hash = '#user-dashboard'))}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-full text-xs font-orbitron font-bold tracking-wider uppercase bg-space-850 hover:bg-space-800 border border-mars-500/40 text-mars-300 hover:text-white transition-all cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400"
                  title="Open User Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">Dashboard</span>
                </button>
                <UserAccountMenu
                  currentUser={currentUser}
                  onLogout={onUserLogout}
                  onOpenDonorRegistration={onOpenDonorRegistration}
                  onViewCertificate={onViewCertificate}
                  onOpenUserDashboard={onOpenUserDashboard}
                />
              </div>
            ) : currentAdmin ? (
              <>
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  {(currentAdmin.roleId === 'SUPER_ADMIN' || currentAdmin.role_id === 'SUPER_ADMIN') ? (
                    <button
                      type="button"
                      onClick={() => (onOpenSuperAdminDashboard ? onOpenSuperAdminDashboard() : (window.location.hash = '#superadmin-dashboard'))}
                      className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-full text-xs font-orbitron font-bold tracking-wider uppercase bg-space-850 hover:bg-space-800 border border-amber-500/50 text-amber-300 hover:text-white transition-all cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="Open Super Admin Dashboard"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="hidden lg:inline">Super Admin</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (onOpenAdminDashboard ? onOpenAdminDashboard() : (window.location.hash = '#admin-dashboard'))}
                      className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-full text-xs font-orbitron font-bold tracking-wider uppercase bg-space-850 hover:bg-space-800 border border-amber-500/40 text-amber-300 hover:text-white transition-all cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="Open Admin Dashboard"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="hidden lg:inline">Dashboard</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-mono">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    {(currentAdmin.roleId === 'SUPER_ADMIN' || currentAdmin.role_id === 'SUPER_ADMIN') ? (
                      <button
                        type="button"
                        onClick={() => (onOpenSuperAdminDashboard ? onOpenSuperAdminDashboard() : (window.location.hash = '#superadmin-dashboard'))}
                        className="text-amber-300 hover:text-white font-semibold truncate max-w-[90px] lg:max-w-[120px] cursor-pointer"
                        title="Open Super Admin Dashboard"
                      >
                        {currentAdmin.username} (SUPER_ADMIN)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (onOpenAdminDashboard ? onOpenAdminDashboard() : (window.location.hash = '#admin-dashboard'))}
                        className="text-amber-300 hover:text-white font-semibold truncate max-w-[90px] lg:max-w-[120px] cursor-pointer"
                      >
                        {currentAdmin.username} ({currentAdmin.roleId || currentAdmin.role_id})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onAdminLogout}
                      className="text-[10px] text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                      title="Logout Admin"
                      aria-label="Logout Admin"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Compact Mobile Admin Shortcut */}
                <button
                  type="button"
                  onClick={() => {
                    const isSuper = (currentAdmin.roleId === 'SUPER_ADMIN' || currentAdmin.role_id === 'SUPER_ADMIN');
                    if (isSuper) {
                      if (onOpenSuperAdminDashboard) onOpenSuperAdminDashboard();
                      else window.location.hash = '#superadmin-dashboard';
                    } else {
                      if (onOpenAdminDashboard) onOpenAdminDashboard();
                      else window.location.hash = '#admin-dashboard';
                    }
                  }}
                  className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[10px] font-orbitron font-bold uppercase text-amber-300 shrink-0"
                  title="Open Admin Dashboard"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Admin</span>
                </button>
              </>
            ) : (
              /* Logged Out: Public Login Button (opens original Role Selection modal) */
              <button
                type="button"
                data-testid="navbar-login-btn"
                onClick={handleLoginTrigger}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 lg:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] lg:text-xs font-orbitron font-bold tracking-wider uppercase bg-gradient-to-r from-mars-600 to-mars-flame hover:brightness-110 text-white transition-all cursor-pointer shadow-lg shadow-mars-600/30 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 shrink-0"
              >
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
                <span>Login</span>
              </button>
            )}

            {/* Mobile Collapsible Navigation Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1 sm:p-1.5 rounded-xl bg-space-850 border border-white/10 text-slate-300 hover:text-white hover:border-mars-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 shrink-0"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-primary-nav"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5 text-mars-400" aria-hidden="true" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-primary-nav"
          className="md:hidden bg-space-950/95 border-t border-b border-white/10 px-4 pt-3 pb-5 mt-4 backdrop-blur-xl animate-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between py-2 border-b border-white/5 mb-3">
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" aria-hidden="true"></span>
              <span>24/7 EMERGENCY BLOOD NETWORK</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">HELPLINE: 108 / 104</span>
          </div>

          <nav aria-label="Mobile Primary" className="grid grid-cols-1 gap-1.5">
            {NAVBAR_LINKS.map((link) => {
              const sectionId = link.href.substring(1);
              const isActive = activeSection === sectionId;

              return (
                <a
                  key={link.name}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-orbitron font-bold text-xs tracking-wider uppercase border transition-all ${
                    isActive
                      ? 'bg-mars-600/20 text-white border-mars-500/60'
                      : 'text-slate-200 border-transparent hover:text-white hover:bg-mars-500/10 hover:border-mars-500/40'
                  }`}
                >
                  <span>{link.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                </a>
              );
            })}
          </nav>

          {/* Institutional Partner Links on Mobile */}
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
            <a
              href={COLLEGE_LOGO.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-space-900/90 border border-white/10 hover:border-mars-500/40 transition-colors"
            >
              <img
                src={COLLEGE_LOGO.src}
                alt={COLLEGE_LOGO.alt}
                width={COLLEGE_LOGO.width}
                height={COLLEGE_LOGO.height}
                className="h-8 w-auto object-contain select-none shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-white truncate">{COLLEGE_LOGO.label}</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400">
                  <span>Official Site</span>
                  <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                </span>
              </div>
            </a>

            <a
              href={ROTARACT_COLLEGE_LOGO.href}
              onClick={handleRotaractLogoClick}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-space-900/90 border border-white/10 hover:border-mars-500/40 transition-colors"
            >
              <img
                src={ROTARACT_COLLEGE_LOGO.src}
                alt={ROTARACT_COLLEGE_LOGO.alt}
                width={ROTARACT_COLLEGE_LOGO.width}
                height={ROTARACT_COLLEGE_LOGO.height}
                className="h-8 w-auto object-contain select-none shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-white truncate">{ROTARACT_COLLEGE_LOGO.label}</span>
                <span className="block text-[9px] font-mono text-mars-300 truncate">Directory</span>
              </div>
            </a>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
            {!currentUser && !currentAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLoginTrigger();
                }}
                className="w-full py-2.5 rounded-lg text-xs font-orbitron font-bold tracking-wider uppercase bg-gradient-to-r from-mars-600 to-mars-flame text-white flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                <span>Login</span>
              </button>
            ) : currentUser ? (
              <div className="p-3 rounded-xl bg-space-900 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold text-xs">{currentUser.fullName}</div>
                    <div className="text-[10px] text-mars-400 font-mono">Blood Group: {currentUser.bloodGroup}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onUserLogout();
                    }}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Log out
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenUserDashboard) onOpenUserDashboard();
                    else window.location.hash = '#user-dashboard';
                  }}
                  className="w-full py-2 rounded-lg text-xs font-orbitron font-bold tracking-wider uppercase bg-gradient-to-r from-mars-600 to-mars-flame text-white flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open User Dashboard</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-amber-300 font-semibold text-xs">{currentAdmin.username}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Role: {currentAdmin.roleId || currentAdmin.role_id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onAdminLogout();
                    }}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Exit Command
                  </button>
                </div>
                {(currentAdmin.roleId === 'SUPER_ADMIN' || currentAdmin.role_id === 'SUPER_ADMIN') ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onOpenSuperAdminDashboard) onOpenSuperAdminDashboard();
                        else window.location.hash = '#superadmin-dashboard';
                      }}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-500 text-white flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Super Admin Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onOpenAdminDashboard) onOpenAdminDashboard();
                        else window.location.hash = '#admin-dashboard';
                      }}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-space-850 hover:bg-space-800 border border-cyan-500/40 text-cyan-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Admin Ops Dashboard</span>
                    </button>
                    <a
                      href="#admin-management-panel"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-space-900 border border-white/10 text-slate-300 flex items-center justify-center gap-2"
                    >
                      <span>Public Admin Panel</span>
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onOpenAdminDashboard) onOpenAdminDashboard();
                      else window.location.hash = '#admin-dashboard';
                    }}
                    className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-500 text-white flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Open Admin Dashboard</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
