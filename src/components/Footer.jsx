import React from 'react';
import {
  ArrowUp,
  Droplet,
  ShieldCheck,
  Award,
  GraduationCap,
  Users,
} from 'lucide-react';
import { NAVIGATION_LINKS } from '../data/missionData';

export default function Footer({ onOpenUserAuth, onOpenAdminAuth }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      data-testid="site-footer"
      className="relative bg-space-950 border-t border-white/10 pt-16 pb-24 lg:pb-14 overflow-hidden"
    >
      {/* Background subtle crimson glow */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-mars-600/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10 items-start">
          {/* Col 1: RED MISSION Brand & Accreditation */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-space-850 border border-mars-500/40 flex items-center justify-center p-2 shadow-lg shadow-mars-600/20">
                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-mars-600 to-mars-flame animate-pulse flex items-center justify-center">
                  <Droplet className="w-2.5 h-2.5 text-white fill-white" aria-hidden="true" />
                </div>
              </div>
              <div>
                <span className="font-orbitron font-extrabold text-lg tracking-wider text-white">
                  RED<span className="text-mars-500">MISSION</span>
                </span>
                <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  BLOOD DONATION & DONOR CONNECT
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              Connecting voluntary blood donors directly with critical patients and trauma centers. 100% voluntary, free, and dedicated to zero preventable deaths caused by blood shortages.
            </p>

            <div className="space-y-1.5 pt-1 text-xs font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" aria-hidden="true" />
                <span>24/7 EMERGENCY BLOOD HELPLINE: 108 / 104</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
                <span>ACCREDITED BY NATIONAL BLOOD TRANSFUSION COUNCIL</span>
              </div>
            </div>
          </div>

          {/* Col 2: Platform Navigation */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-orbitron font-bold text-xs uppercase tracking-wider text-white">
              Platform Navigation
            </h4>
            <ul className="grid grid-cols-1 gap-y-2.5">
              {NAVIGATION_LINKS.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-xs text-slate-300 hover:text-mars-400 transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-mars-500" aria-hidden="true">›</span>
                    <span>{link.name}</span>
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenUserAuth) onOpenUserAuth('login');
                    else window.location.hash = '#user-login';
                  }}
                  className="text-xs text-slate-300 hover:text-mars-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="text-mars-500" aria-hidden="true">›</span>
                  <span>User Login</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Created By Profile */}
          <div
            data-testid="footer-creator-profile"
            className="md:col-span-2 lg:col-span-5"
          >
            <div className="rounded-2xl bg-space-900/90 border border-white/10 p-5 shadow-xl shadow-black/40 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-mars-600/10 blur-2xl pointer-events-none"
              />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <span className="font-orbitron text-[10px] font-bold uppercase tracking-[0.22em] text-mars-400">
                    CREATED BY
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mars-600/15 border border-mars-500/35 text-[10px] font-mono text-mars-200">
                    <Award className="w-3 h-3 text-mars-400" aria-hidden="true" />
                    <span>Blood Donor Chair</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  {/* Circular Creator Portrait with subtle RED MISSION red border & glow */}
                  <div className="relative shrink-0">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-mars-500/30 blur-md"
                    />
                    <img
                      src="/images/creators/sanjai-natraj-p.jpg"
                      alt="Sanjai Natraj P, Blood Donor Chair at Rotaract Club of KPRIET"
                      width={400}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="relative w-20 h-20 rounded-full object-cover object-top border-2 border-mars-500/80 ring-2 ring-mars-500/20 shadow-[0_0_20px_rgba(225,29,72,0.35)] bg-space-850"
                    />
                  </div>

                  {/* Verified Creator Credentials */}
                  <div className="min-w-0 space-y-1.5">
                    <h4 className="font-orbitron font-bold text-base sm:text-lg text-white tracking-wide">
                      Sanjai Natraj P
                    </h4>

                    <p className="text-xs text-slate-200 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-mars-400 shrink-0 hidden sm:inline" aria-hidden="true" />
                      <span>Artificial Intelligence &amp; Data Science (AI&amp;DS)</span>
                    </p>

                    <p className="text-xs text-slate-300 leading-snug">
                      KPR Institute of Engineering and Technology
                    </p>

                    <p className="text-[11px] font-mono text-mars-300 flex items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                      <Users className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
                      <span>Rotaract Club of KPRIET</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400 lg:pr-20">
          <div className="text-center sm:text-left">
            © 2026 RED MISSION Blood Network. Accredited by National Blood Transfusion Council. Saving lives 24/7.
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <a
              href="#admin-login"
              onClick={(e) => {
                if (onOpenAdminAuth) {
                  e.preventDefault();
                  onOpenAdminAuth();
                }
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Staff Login
            </a>
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>Back to Top</span>
              <ArrowUp className="w-3.5 h-3.5 text-mars-400" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
