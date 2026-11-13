import React from 'react';

export default function AITypingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ai-typing-indicator"
      className="flex items-end gap-2 justify-start"
    >
      <img
        src="/images/red-mission-ai-mascot.png"
        alt=""
        width={1024}
        height={1010}
        aria-hidden="true"
        className="w-6 h-6 object-contain shrink-0 mb-1"
      />
      <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-space-850 px-4 py-3 flex items-center gap-1.5">
        <span className="sr-only">RED MISSION AI is generating a response...</span>
        <span className="w-2 h-2 rounded-full bg-mars-400 animate-bounce [animation-delay:-0.25s]" aria-hidden="true" />
        <span className="w-2 h-2 rounded-full bg-mars-500 animate-bounce [animation-delay:-0.12s]" aria-hidden="true" />
        <span className="w-2 h-2 rounded-full bg-mars-flame animate-bounce" aria-hidden="true" />
      </div>
    </div>
  );
}
