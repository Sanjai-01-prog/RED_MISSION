import React, { useId, useRef, useState } from 'react';
import { Send } from 'lucide-react';

const MAX_LENGTH = 1500;

export default function AIChatInput({
  onSendMessage,
  isSending = false,
  inputRef: externalRef,
}) {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const localRef = useRef(null);
  const textareaRef = externalRef || localRef;

  const trimmed = value.trim();
  const charCount = value.length;

  const submitCurrent = () => {
    if (isSending) return;
    if (!trimmed) {
      setValidationMsg('Please type a question before sending.');
      textareaRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setValidationMsg(`Please keep your message under ${MAX_LENGTH} characters.`);
      textareaRef.current?.focus();
      return;
    }
    setValidationMsg('');
    onSendMessage(trimmed);
    setValue('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitCurrent();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submitCurrent();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-space-950 border-t border-white/10 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
    >
      {validationMsg && (
        <p role="alert" className="text-[11px] text-amber-300 mb-1.5 px-1">
          {validationMsg}
        </p>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ask RED MISSION AI a question
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          name="message"
          rows={1}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (validationMsg) setValidationMsg('');
          }}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
          placeholder="Ask (English / தமிழ் / Tanglish)..."
          className="flex-1 min-w-0 resize-none max-h-28 min-h-[46px] overflow-y-auto rounded-xl bg-space-900 border border-white/15 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-mars-500 leading-snug"
        />

        <button
          type="submit"
          disabled={isSending}
          aria-label="Send message"
          className="min-w-[44px] min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-500 hover:from-mars-500 hover:to-mars-flame disabled:opacity-50 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
        <span>Enter to send · Shift+Enter for new line</span>
        {charCount > MAX_LENGTH - 300 && (
          <span className={charCount >= MAX_LENGTH ? 'text-amber-300' : ''}>
            {charCount}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}
