import React from 'react';
import { Minus, X, PlusCircle, Trash2 } from 'lucide-react';

export default function AIChatHeader({
  aiConfigured,
  providerLabel,
  hasMessages,
  isStreaming,
  onNewChat,
  onClearChat,
  onMinimize,
  onClose,
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 py-3 bg-space-950 border-b border-white/10 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src="/images/red-mission-ai-mascot.png"
          alt="RED MISSION AI Mascot"
          width={1024}
          height={1010}
          className="w-8 h-8 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(225,29,72,0.65)]"
        />
        <div className="min-w-0">
          <h2 className="font-orbitron font-bold text-sm text-white tracking-wide truncate">
            RED MISSION <span className="text-mars-500">AI</span>
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                aiConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className={aiConfigured ? 'text-emerald-400' : 'text-amber-300'}>
              {aiConfigured ? `Online · ${providerLabel || 'Live AI'}` : 'Provider Setup Required'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          disabled={isStreaming}
          aria-label="Start new chat"
          title="New Chat"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-space-800 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
        </button>

        {hasMessages && (
          <button
            type="button"
            onClick={onClearChat}
            disabled={isStreaming}
            aria-label="Clear chat history"
            title="Clear Chat"
            className="p-1.5 rounded-lg text-slate-300 hover:text-mars-300 hover:bg-space-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize chat"
          title="Minimize"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-space-800 transition-colors cursor-pointer"
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          title="Close"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-mars-600/30 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
