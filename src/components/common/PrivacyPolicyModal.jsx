import React from 'react';
import { X, ShieldCheck, FileText, Lock } from 'lucide-react';
import { RED_MISSION_PRIVACY_POLICY } from '../../data/termsAndPrivacyData';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-space-900 border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-space-850/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-mars-500/10 border border-mars-500/30 text-mars-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="privacy-policy-title" className="font-orbitron font-bold text-base text-white">
                {RED_MISSION_PRIVACY_POLICY.title}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Version {RED_MISSION_PRIVACY_POLICY.version} • {RED_MISSION_PRIVACY_POLICY.lastUpdated}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-space-950/60 hover:bg-space-950 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Privacy Policy"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Policy Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <p className="text-[11px] font-mono text-mars-300 bg-mars-500/10 border border-mars-500/20 rounded-xl p-3">
            {RED_MISSION_PRIVACY_POLICY.subtitle}
          </p>

          {RED_MISSION_PRIVACY_POLICY.sections.map((sec, idx) => (
            <div key={idx} className="space-y-1.5 pb-3 border-b border-white/5 last:border-b-0">
              <h4 className="font-orbitron font-semibold text-xs text-white">
                {sec.title}
              </h4>
              <p className="text-slate-300 leading-relaxed">
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-space-850/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted &amp; Non-Commercial</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-space-950 hover:bg-space-850 border border-white/15 text-xs font-semibold text-white font-orbitron transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
