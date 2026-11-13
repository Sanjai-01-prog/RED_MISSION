import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  ShieldCheck, 
  Lock, 
  Phone, 
  Mail, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  Droplet, 
  Heart,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, initialTab = 'donor', onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'donor' | 'admin'
  const [donorAuthMode, setDonorAuthMode] = useState('otp'); // 'otp' | 'profile'
  const [donorIdentifier, setDonorIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
    setAuthError('');
  }, [initialTab, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!donorIdentifier.trim()) {
      setAuthError('Please enter your mobile number or registered email.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    setTimeout(() => {
      setAuthLoading(false);
      setIsOtpSent(true);
    }, 600);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      setAuthError('Please enter the 4-digit verification code sent to your phone.');
      return;
    }
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      const donorUser = {
        role: 'donor',
        name: 'Dr. Rahul Sharma',
        bloodGroup: 'O-',
        donationsCount: 14,
        nextEligibleDate: '2026-11-15',
        badges: ['Universal Lifesaver', 'Platelet Hero', 'Verified Donor']
      };
      onLoginSuccess(donorUser);
      onClose();
    }, 700);
  };

  const handleQuickDemoDonor = () => {
    const demoDonor = {
      role: 'donor',
      name: 'Dr. Rahul Sharma',
      bloodGroup: 'O-',
      donationsCount: 14,
      nextEligibleDate: '2026-11-15',
      badges: ['Universal Lifesaver', 'Platelet Hero', 'Verified Donor']
    };
    onLoginSuccess(demoDonor);
    onClose();
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (adminPasscode.trim() === 'ADMIN123' || adminPasscode.trim() === 'admin') {
      const adminUser = {
        role: 'admin',
        name: 'Dr. S. K. Gupta',
        title: 'Chief Medical Officer',
        hospital: 'National Blood Command'
      };
      onLoginSuccess(adminUser);
      onClose();
    } else {
      setAuthError('INVALID PASSCODE: Use demo admin passcode ADMIN123 to authenticate.');
    }
  };

  const handleQuickDemoAdmin = () => {
    const adminUser = {
      role: 'admin',
      name: 'Dr. S. K. Gupta',
      title: 'Chief Medical Officer',
      hospital: 'National Blood Command'
    };
    onLoginSuccess(adminUser);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Background ambient light */}
      <div className="absolute w-96 h-96 bg-mars-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md card-glass rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
              <Droplet className="w-4 h-4 fill-mars-400" />
            </div>
            <span className="font-orbitron font-bold text-white text-base">
              RED<span className="text-mars-500">MISSION</span> PORTAL
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
            aria-label="Close Auth Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-space-900 border border-white/5 mb-6">
          <button
            onClick={() => {
              setActiveTab('donor');
              setAuthError('');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold font-orbitron transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'donor'
                ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Donor & Recipient</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('admin');
              setAuthError('');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold font-orbitron transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hospital Admin</span>
          </button>
        </div>

        {/* Error message */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {/* TAB 1: DONOR / RECIPIENT AUTH */}
        {activeTab === 'donor' ? (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-bold text-lg text-white">
                Lifesaver Donor Login
              </h3>
              <p className="text-xs text-slate-400">
                Access your voluntary donation record, digital certificates, and emergency alert preferences.
              </p>
            </div>

            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Mobile Number / Registered Email
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={donorIdentifier}
                      onChange={(e) => setDonorIdentifier(e.target.value)}
                      placeholder="+91 98XXX XXXXX or donor@redmission.org"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 font-mono transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {authLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>SEND ONE-TIME PASSCODE (OTP)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between">
                  <span>OTP sent to: {donorIdentifier}</span>
                  <button
                    type="button"
                    onClick={() => setIsOtpSent(false)}
                    className="text-mars-400 hover:text-white underline text-[11px]"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Enter 4-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="e.g. 7824"
                    className="w-full text-center tracking-widest text-lg font-mono py-2.5 rounded-xl bg-space-900 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-mars-500 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-500 font-mono text-center">
                    (Enter any 4-digit code for instant demo authentication)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {authLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>VERIFY & ACCESS PROFILE</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-white/10 text-center">
              <button
                onClick={handleQuickDemoDonor}
                className="text-xs font-mono text-mars-400 hover:text-white underline cursor-pointer"
              >
                Instant 1-Click Demo Donor Login (Dr. Rahul Sharma O-)
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: HOSPITAL & ADMIN LOGIN */
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-bold text-lg text-white">
                Medical Command Access
              </h3>
              <p className="text-xs text-slate-400">
                Restricted to authorized blood bank officers, trauma directors, and Red Mission administrators.
              </p>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Command Passcode
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Enter Admin Passcode (Demo: ADMIN123)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 font-mono transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>AUTHENTICATE MEDICAL COMMAND</span>
              </button>
            </form>

            <div className="pt-3 border-t border-white/10 text-center">
              <button
                onClick={handleQuickDemoAdmin}
                className="text-xs font-mono text-mars-400 hover:text-white underline cursor-pointer"
              >
                Instant 1-Click Demo Admin Access
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}