import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';

export default function AIMessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          data-testid="ai-message-user"
          className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-mars-600 to-mars-500 px-3.5 py-2.5 text-sm text-white shadow-md whitespace-pre-wrap break-words leading-relaxed"
        >
          {message.content}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex justify-start">
        <div
          role="alert"
          data-testid="ai-message-error"
          className="max-w-[90%] rounded-2xl rounded-bl-sm border border-amber-500/40 bg-amber-950/35 px-3.5 py-2.5 text-xs text-amber-100 flex items-start gap-2 leading-relaxed break-words"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start items-end gap-2">
      <img
        src="/images/red-mission-ai-mascot.png"
        alt=""
        width={1024}
        height={1010}
        aria-hidden="true"
        className="w-6 h-6 object-contain shrink-0 mb-1"
      />
      <div
        data-testid="ai-message-assistant"
        className="max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-space-850/95 px-3.5 py-2.5 text-sm text-slate-100 shadow-md leading-relaxed break-words"
      >
        <div className="flex items-center gap-1 text-[10px] font-mono text-mars-400 mb-1">
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          <span>RED MISSION AI</span>
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
