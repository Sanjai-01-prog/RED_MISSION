import React, { useEffect } from 'react';
import { 
  X, 
  User, 
  ShieldCheck, 
  Heart, 
  ArrowRight, 
  Droplet, 
  Building2,
  Lock
} from 'lucide-react';
import LiveDateTime from '../shared/LiveDateTime';

export default function RoleSelectionModal({ isOpen, onClose, onSelectRole }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] bg-mars-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-lg card-glass rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="pb-4 border-b border-white/10 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
                <Droplet className="w-4 h-4 fill-mars-400" />
              </div>
              <div>
                <span className="font-orbitron font-bold text-white text-base">
                  RED<span className="text-mars-500">MISSION</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 block -mt-1">
                  SECURE AUTHENTICATION GATEWAY
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              aria-label="Close Role Selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <LiveDateTime variant="compact" />
        </div>

        {/* Modal Heading */}
        <div className="text-center space-y-2 mb-8">
          <h3 className="font-orbitron font-extrabold text-2xl text-white">
            Select Your Portal
          </h3>
          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Please choose your account category to proceed to the dedicated authentication portal.
          </p>
        </div>

        {/* Two Separate Role Cards */}
        <div className="grid grid-cols-1 gap-4">
          
          {/* Card 1: User / Donor Portal */}
          <button
            onClick={() => onSelectRole('user')}
            className="group relative p-5 rounded-2xl bg-space-900/90 hover:bg-space-850 border border-white/10 hover:border-mars-500/50 transition-all text-left flex items-start gap-4 cursor-pointer shadow-lg hover:shadow-mars-600/10"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-mars-600 to-mars-flame p-0.5 shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-space-950 rounded-[10px] flex items-center justify-center text-mars-400 group-hover:text-white transition-colors">
                <User className="w-6 h-6" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-orbitron font-bold text-base text-white group-hover:text-mars-400 transition-colors">
                  User & Donor Login
                </h4>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-mars-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                For voluntary donors, recipients, and general citizens. Log in using your registered mobile number or email address.
              </p>
              <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Single-factor credential login • Public Registration</span>
              </div>
            </div>
          </button>

          {/* Card 2: Hospital Admin & Command Portal */}
          <button
            onClick={() => onSelectRole('admin')}
            className="group relative p-5 rounded-2xl bg-space-900/90 hover:bg-space-850 border border-white/10 hover:border-amber-500/50 transition-all text-left flex items-start gap-4 cursor-pointer shadow-lg hover:shadow-amber-500/10"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-space-950 rounded-[10px] flex items-center justify-center text-amber-400 group-hover:text-white transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-orbitron font-bold text-base text-white group-hover:text-amber-400 transition-colors">
                  Medical Command & Admin
                </h4>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Restricted to Super Admins, Hospital Administrators, and Verification Officers. Requires dual OTP multi-factor authentication.
              </p>
              <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-amber-400">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Mandatory Dual 2FA (Mobile + Email) • No Public Signup</span>
              </div>
            </div>
          </button>

        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-[11px] text-slate-400 font-mono">
            Protected by RED MISSION Security Infrastructure • All login events audited.
          </p>
        </div>

      </div>
    </div>
  );
}
