import React, { useEffect, useRef } from 'react';
import AIChatHeader from './AIChatHeader';
import AIWelcomeScreen from './AIWelcomeScreen';
import AIMessageBubble from './AIMessageBubble';
import AITypingIndicator from './AITypingIndicator';
import AIChatInput from './AIChatInput';

export default function AIChatWindow({
  isOpen,
  aiConfigured,
  providerLabel,
  messages,
  isTyping,
  isStreaming,
  onSendMessage,
  onNewChat,
  onClearChat,
  onMinimize,
  onClose,
}) {
  const scrollContainerRef = useRef(null);
  const scrollEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message only when messages exist; keep welcome hero visible at top when empty
  useEffect(() => {
    if (!isOpen) return;
    if (messages.length === 0 && !isTyping) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isTyping]);

  // Focus input smoothly when opened; Esc minimizes/closes panel
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <section
      id="red-mission-ai-chat-window"
      data-testid="ai-chat-window"
      data-state={isOpen ? 'open' : 'closed'}
      aria-label="RED MISSION AI Assistant"
      aria-hidden={!isOpen}
      className="ai-chat-panel fixed right-3 left-3 bottom-24 sm:left-auto sm:right-6 sm:bottom-28 z-50 w-auto sm:w-[408px] max-w-full h-[min(74dvh,600px)] sm:h-[min(600px,calc(100dvh-8.5rem))] flex flex-col rounded-3xl border border-white/15 bg-space-950/95 backdrop-blur-xl shadow-2xl shadow-black/70 overflow-hidden"
    >
      <AIChatHeader
        aiConfigured={aiConfigured}
        providerLabel={providerLabel}
        hasMessages={messages.length > 0}
        isStreaming={isStreaming}
        onNewChat={onNewChat}
        onClearChat={onClearChat}
        onMinimize={onMinimize}
        onClose={onClose}
      />

      {/* Scrollable Message & Welcome Area */}
      <div
        ref={scrollContainerRef}
        className="ai-chat-scroll flex-1 overflow-y-auto px-4 py-3.5 space-y-3 bg-space-900/70"
      >
        {messages.length === 0 ? (
          <AIWelcomeScreen
            aiConfigured={aiConfigured}
            onSelectQuestion={onSendMessage}
            disabled={isStreaming}
          />
        ) : (
          <>
            {messages.map((msg) => (
              <AIMessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && <AITypingIndicator />}
          </>
        )}
        <div ref={scrollEndRef} />
      </div>

      <AIChatInput
        onSendMessage={onSendMessage}
        isSending={isStreaming}
        inputRef={inputRef}
      />
    </section>
  );
}
