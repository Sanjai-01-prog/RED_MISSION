import React, { useState } from 'react';

export default function FloatingAIButton({ isOpen, onToggle, hasUnread = false }) {
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setTooltipDismissed(true);
    }
  };

  return (
    <div
      className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-50 pb-[env(safe-area-inset-bottom,0px)]"
      onMouseLeave={() => setTooltipDismissed(false)}
      onBlur={() => setTooltipDismissed(false)}
    >
      <button
        type="button"
        data-testid="floating-ai-button"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-label="Chat with RED MISSION AI"
        aria-expanded={isOpen}
        aria-controls="red-mission-ai-chat-window"
        className="group relative bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 focus-visible:ring-offset-2 focus-visible:ring-offset-space-950 rounded-full ai-mascot-btn"
      >
        {/* Visual Hover/Focus Tooltip (non-duplicated for SR since button aria-label already says "Chat with RED MISSION AI") */}
        {!tooltipDismissed && !isOpen && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-full mb-2.5 whitespace-nowrap rounded-xl border border-mars-500/40 bg-space-950/95 px-3 py-1.5 text-xs font-medium text-white shadow-xl opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0"
          >
            Chat with RED MISSION AI
          </span>
        )}

        {/* Transparent-background RED MISSION AI Mascot (Zero frame or box container) */}
        <img
          src="/images/red-mission-ai-mascot.png"
          alt=""
          width={1024}
          height={1010}
          decoding="async"
          className="ai-mascot-float w-16 h-16 sm:w-20 sm:h-20 object-contain select-none pointer-events-none"
        />

        {hasUnread && !isOpen && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 w-3 h-3 rounded-full bg-mars-500 ring-2 ring-space-950 animate-pulse"
          />
        )}
      </button>
    </div>
  );
}
