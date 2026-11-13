import React from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import AIQuickQuestions from './AIQuickQuestions';

export default function AIWelcomeScreen({
  aiConfigured,
  onSelectQuestion,
  disabled,
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Mascot Welcome Hero */}
      <div className="flex flex-col items-center text-center space-y-2.5 px-2">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute w-20 h-20 rounded-full bg-mars-600/25 blur-xl pointer-events-none"
          />
          <img
            src="/images/red-mission-ai-mascot.png"
            alt="RED MISSION AI Superhero Mascot"
            width={1024}
            height={1010}
            className="relative w-20 h-20 object-contain drop-shadow-[0_4px_14px_rgba(225,29,72,0.5)]"
          />
        </div>

        <div className="space-y-1">
          <p className="font-orbitron font-bold text-base text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-mars-400" aria-hidden="true" />
            <span>Welcome to RED MISSION AI</span>
          </p>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            Ask me in <strong className="text-white">English, தமிழ், or Tanglish</strong> about blood donor registration, eligibility, emergency requests, profiles, or donation certificates.
          </p>
        </div>
      </div>

      {/* Notice if backend AI provider key has not been configured yet */}
      {aiConfigured === false && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-3 py-2.5 text-[11px] text-amber-200 flex items-start gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Backend AI provider credentials are not configured yet. Set{' '}
            <code className="font-mono text-white">AI_PROVIDER</code> and your API key in{' '}
            <code className="font-mono text-white">.env</code> to enable live AI replies.
          </span>
        </div>
      )}

      {/* Quick Questions */}
      <AIQuickQuestions onSelectQuestion={onSelectQuestion} disabled={disabled} />

      {/* Safety boundary */}
      <p className="text-[10px] text-slate-400 text-center leading-snug px-2">
        RED MISSION AI provides verified platform & general donor guidance only—not medical diagnosis. For acute medical emergencies, call <strong className="text-slate-200">108 / 104</strong>.
      </p>
    </div>
  );
}
