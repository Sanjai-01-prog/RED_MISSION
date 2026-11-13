import React from 'react';
import { 
  Heart, 
  ArrowRight, 
  Users 
} from 'lucide-react';
import WebsiteLaunchTimer from './shared/WebsiteLaunchTimer';

export default function Hero({ onOpenUserAuth }) {
  return (
    <section id="home" className="relative min-h-screen pt-[150px] pb-16 flex items-center justify-center overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none"></div>
      
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none"></div>

      {/* Atmospheric Ruby Glow in background */}
      <div className="absolute top-1/4 -right-28 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-mars-500/20 via-mars-flame/10 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-mars-900/30 via-space-800/20 to-transparent blur-3xl pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Mission Narrative & Actions */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest shadow-inner">
              <span className="w-2 h-2 rounded-full bg-mars-500 animate-pulse"></span>
              <span>EMERGENCY BLOOD NETWORK // 24/7 ACTIVE DONOR DISPATCH</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-orbitron font-black text-3xl sm:text-5xl xl:text-6xl text-white tracking-tight leading-tight">
              PIONEERING THE <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-400 via-mars-500 to-mars-flame text-glow">
                RED LIFELINE
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
              <strong className="text-white font-medium">RED MISSION</strong> is humanity's intelligent blood donation and donor matching network. Connecting voluntary lifesavers directly with hospital ICUs, surgical teams, and patients facing critical emergency care.
            </p>

            {/* Quick Metrics Chips */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <div className="px-3 py-2 rounded-lg bg-space-850/80 border border-white/10 text-xs font-mono">
                <span className="text-slate-400 block text-[10px]">CRITICAL BLOOD TYPES</span>
                <span className="text-mars-400 font-semibold">O-, B-, AB- Needed Now</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-space-850/80 border border-white/10 text-xs font-mono">
                <span className="text-slate-400 block text-[10px]">AVERAGE RESPONSE</span>
                <span className="text-emerald-400 font-semibold">&lt; 15 Minutes Match</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-space-850/80 border border-white/10 text-xs font-mono">
                <span className="text-slate-400 block text-[10px]">VERIFIED DONORS</span>
                <span className="text-cyan-400 font-semibold">48,250+ Registered</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <a
                href="#requests"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-mars-600 via-mars-500 to-mars-flame hover:brightness-110 shadow-xl shadow-mars-600/30 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-white/20" />
                <span>Blood Requests</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>

              <button
                type="button"
                onClick={() => {
                  if (onOpenUserAuth) onOpenUserAuth('login');
                  else window.location.hash = '#user-login';
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-200 bg-space-850 hover:bg-space-800 border border-white/10 hover:border-mars-500/40 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Users className="w-4 h-4 text-mars-400" />
                <span>User Login</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Blood Drop Life Orb & Golden Hour HUD */}
          <div className="lg:col-span-5 flex flex-col items-center">
            
            {/* Visual Blood Drop Life Orb Container */}
            <div className="relative w-72 h-72 sm:w-88 sm:h-88 flex items-center justify-center">
              
              {/* Outer Orbital Pulse Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-mars-500/25 animate-spin-slow"></div>
              <div className="absolute -inset-4 rounded-full border border-white/5"></div>

              {/* Status Satellite Badge */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-space-900 border border-mars-500/40 text-[10px] font-mono text-mars-300 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>NATIONAL BLOOD BANK NETWORK • LIVE</span>
              </div>

              {/* Glowing Ruby Blood Drop / Hemoglobin Life Orb */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden shadow-2xl shadow-mars-600/40 border-2 border-mars-500/40 flex items-center justify-center bg-gradient-to-br from-[#2a080c] via-[#4c0519] to-[#05070a]">
                
                {/* Internal Pulsing Hemoglobin Glow */}
                <div className="absolute inset-0 bg-radial-gradient from-mars-500/30 via-mars-600/20 to-transparent animate-pulse-slow"></div>

                {/* Vector Blood Drop Icon */}
                <svg className="w-36 h-36 sm:w-44 sm:h-44 filter drop-shadow-[0_0_25px_rgba(225,29,72,0.8)]" viewBox="0 0 100 100" fill="none">
                  <path
                    d="M50 14 C50 14 24 44 24 64 C24 78.36 35.64 90 50 90 C64.36 90 76 78.36 76 64 C76 44 50 14 50 14 Z"
                    fill="url(#heroBloodGrad)"
                  />
                  {/* ECG Lifeline Pulse over Drop */}
                  <path
                    d="M28 64 L40 64 L45 52 L50 74 L55 58 L60 64 L72 64"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.95"
                  />
                  <circle cx="50" cy="74" r="2.5" fill="#ffffff" />
                  <defs>
                    <linearGradient id="heroBloodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff5c26" />
                      <stop offset="40%" stopColor="#e11d48" />
                      <stop offset="100%" stopColor="#881337" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Atmospheric Glow Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none"></div>
              </div>

              {/* Target Reticle */}
              <div className="absolute bottom-10 right-10 flex items-center gap-1 px-2.5 py-1 bg-space-950/90 rounded border border-emerald-500/40 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>144,750+ LIVES SAVED</span>
              </div>
            </div>

            {/* Persistent Official Website Launch Timer */}
            <WebsiteLaunchTimer className="mt-6" />

          </div>

        </div>
      </div>
    </section>
  );
}
