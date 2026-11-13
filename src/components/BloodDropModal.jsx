import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Droplet,
  Sparkles,
  Send,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { VOICE_PROMPTS } from '../data/missionData';
import {
  BLOOD_AI_FAQ_KNOWLEDGE,
  BLOOD_AI_CATEGORIES,
  queryBloodAi,
} from '../utils/bloodAiKnowledge';

export default function BloodDropModal({ isOpen, onClose, onNavigateSection }) {
  const [isListening, setIsListening] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [transcript, setTranscript] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const simTimerRef = useRef(null);

  // Sync React open prop with native top-layer <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Move focus to question input once open so keyboard users can type immediately
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Clean up speech/mic timers on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopVoiceSynthesis = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const stopVoiceCapture = () => {
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    setIsListening(false);
  };

  const handleClose = () => {
    stopVoiceSynthesis();
    stopVoiceCapture();
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else if (isOpen) {
      onClose();
    }
  };

  const handleNativeClose = () => {
    stopVoiceSynthesis();
    stopVoiceCapture();
    if (isOpen) {
      onClose();
    }
  };

  // Fallback click-outside dismiss for browsers without closedby="any"
  const handleBackdropClick = (e) => {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!clickedInDialog) {
      handleClose();
    }
  };

  const speakVoiceResponse = (text) => {
    if (!window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Query Blood AI FAQ & clinical knowledge engine (never fabricates or leaks private data)
  const processQuery = (rawText, { speak = true } = {}) => {
    const cleaned = String(rawText || '').trim();
    if (!cleaned) return;

    setTranscript(cleaned);
    setTextQuery(cleaned);
    setIsListening(false);

    const result = queryBloodAi(cleaned);
    setQueryResult(result);

    if (speak) {
      speakVoiceResponse(result.text);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!textQuery.trim()) return;
    processQuery(textQuery, { speak: false });
  };

  const toggleMicListening = () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    setIsListening(true);
    setTranscript('Listening to your voice prompt...');
    setQueryResult(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript;
          processQuery(speechResult, { speak: true });
        };

        recognition.onerror = () => {
          simulateVoiceInput();
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        simulateVoiceInput();
      }
    } else {
      simulateVoiceInput();
    }
  };

  const simulateVoiceInput = () => {
    simTimerRef.current = setTimeout(() => {
      const samplePool = [
        ...BLOOD_AI_FAQ_KNOWLEDGE.map((item) => item.question),
        ...VOICE_PROMPTS,
      ];
      const picked = samplePool[Math.floor(Math.random() * samplePool.length)];
      processQuery(picked, { speak: true });
    }, 1800);
  };

  const handleActionLinkClick = (e, href) => {
    stopVoiceSynthesis();
    stopVoiceCapture();
    if (onNavigateSection) {
      e.preventDefault();
      onNavigateSection(href);
    }
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else if (isOpen) {
      onClose();
    }
  };

  const filteredFaqs =
    activeCategory === 'All'
      ? BLOOD_AI_FAQ_KNOWLEDGE
      : BLOOD_AI_FAQ_KNOWLEDGE.filter((item) => item.category === activeCategory);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="blood-drop-dialog-title"
      onClose={handleNativeClose}
      onClick={handleBackdropClick}
      className="blood-drop-dialog m-auto w-[min(100%-1.5rem,52rem)] max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/15 bg-space-950/95 text-slate-100 shadow-2xl p-5 sm:p-8"
    >
      {/* Top Control Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" aria-hidden="true"></span>
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider truncate">
            BLOOD DROP // VERIFIED FAQ & VOICE AI
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSpeaking && (
            <button
              type="button"
              onClick={stopVoiceSynthesis}
              className="px-2.5 py-1.5 rounded-lg bg-mars-500/20 text-mars-300 hover:text-white border border-mars-500/30 text-xs flex items-center gap-1 cursor-pointer"
              title="Mute Speech"
            >
              <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-[10px] font-mono">Mute</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
            aria-label="Close Blood Drop Assistant"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-3 mb-5">
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-2 border-mars-500/30 ${isListening ? 'animate-ping' : ''}`}></div>
          <div className={`absolute -inset-2 rounded-full border border-mars-500/20 ${isSpeaking ? 'animate-pulse' : ''}`}></div>
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-mars-700 via-mars-500 to-mars-flame p-3.5 shadow-xl shadow-mars-600/40 flex items-center justify-center">
            <Droplet className="w-8 h-8 text-white fill-white" aria-hidden="true" />
          </div>
        </div>

        <div>
          <h2 id="blood-drop-dialog-title" className="font-orbitron font-extrabold text-xl sm:text-2xl text-white">
            Ask <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">Blood Drop AI</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mt-1">
            Ask any RED MISSION FAQ, eligibility rule, donation precaution, proof verification, or emergency guidance in your own words.
          </p>
        </div>
      </div>

      {/* Audio Waveform Animation when Listening or Speaking */}
      {(isListening || isSpeaking) && (
        <div className="flex items-center justify-center gap-1.5 my-3 h-7" aria-hidden="true">
          <span className="w-1.5 bg-mars-500 rounded-full animate-pulse h-3"></span>
          <span className="w-1.5 bg-mars-400 rounded-full animate-bounce h-6"></span>
          <span className="w-1.5 bg-mars-500 rounded-full animate-pulse h-4"></span>
          <span className="w-1.5 bg-mars-flame rounded-full animate-bounce h-7"></span>
          <span className="w-1.5 bg-mars-400 rounded-full animate-pulse h-5"></span>
          <span className="w-1.5 bg-mars-500 rounded-full animate-bounce h-6"></span>
          <span className="w-1.5 bg-mars-flame rounded-full animate-pulse h-3"></span>
        </div>
      )}

      {/* Natural-Language Question Form + Voice Trigger */}
      <form onSubmit={handleFormSubmit} className="space-y-2.5 mb-5">
        <label htmlFor="blood-ai-question-input" className="block text-xs font-mono text-slate-300">
          Ask a question or use voice input
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            ref={inputRef}
            id="blood-ai-question-input"
            type="text"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="e.g., What is the minimum weight to donate blood?"
            autoComplete="off"
            className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-space-900 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-mars-500"
          />
          <div className="flex gap-2 shrink-0">
            <button
              type="submit"
              disabled={!textQuery.trim()}
              className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-500 hover:from-mars-500 hover:to-mars-flame disabled:opacity-50 text-white text-xs font-orbitron font-semibold tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ask AI</span>
            </button>
            <button
              type="button"
              onClick={toggleMicListening}
              aria-label={isListening ? 'Stop voice listening' : 'Speak to Blood Drop AI'}
              className={`px-3.5 py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : 'bg-space-900 hover:bg-space-850 border-white/15 text-slate-200 hover:text-white'
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Mic className="w-4 h-4 text-mars-400" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isListening ? 'Listening' : 'Voice'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Response Box */}
      {queryResult ? (
        <div
          data-testid="blood-ai-response"
          data-matched={queryResult.matched ? 'true' : 'false'}
          className={`rounded-2xl p-4 sm:p-5 border space-y-3 mb-6 ${
            queryResult.matched
              ? 'bg-space-900 border-mars-500/35'
              : 'bg-amber-950/25 border-amber-500/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <span className="text-mars-400 flex items-center gap-1.5 font-semibold min-w-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">QUERY: "{transcript}"</span>
            </span>
            {queryResult.matched ? (
              <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {queryResult.source === 'faq' ? 'VERIFIED FAQ' : 'VERIFIED GUIDANCE'} // {queryResult.category}
                </span>
              </span>
            ) : (
              <span className="text-amber-300 flex items-center gap-1 shrink-0">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>NOT IN VERIFIED KB</span>
              </span>
            )}
          </div>

          {queryResult.matchedQuestion &&
            queryResult.matchedQuestion.toLowerCase() !== transcript.toLowerCase() && (
              <div className="text-xs text-slate-300 bg-space-950/70 border border-white/10 rounded-lg px-3 py-2">
                <span className="text-slate-400 font-mono uppercase text-[10px] mr-2">Matched FAQ:</span>
                <span className="font-medium text-white">{queryResult.matchedQuestion}</span>
              </div>
            )}

          <p className="text-sm text-slate-100 leading-relaxed">{queryResult.text}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => speakVoiceResponse(queryResult.text)}
              className="text-xs font-mono text-mars-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Replay Voice Audio</span>
            </button>

            {queryResult.linkHref && queryResult.linkText && (
              <a
                href={queryResult.linkHref}
                onClick={(e) => handleActionLinkClick(e, queryResult.linkHref)}
                className="px-3.5 py-1.5 rounded-xl bg-mars-600 hover:bg-mars-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{queryResult.linkText}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      ) : isListening ? (
        <div className="text-center py-4 text-xs font-mono text-mars-300 animate-pulse mb-4">
          Listening for your speech... Or pick a verified FAQ below:
        </div>
      ) : null}

      {/* Categorized Verified FAQ Knowledge Topics */}
      <div className="pt-4 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-mars-400" aria-hidden="true" />
            <span>RED MISSION FAQ Knowledge ({BLOOD_AI_FAQ_KNOWLEDGE.length} topics)</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="FAQ Categories">
          {['All', ...BLOOD_AI_CATEGORIES].map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-mars-600/30 border-mars-500 text-white'
                    : 'bg-space-900 border-white/10 text-slate-300 hover:text-white hover:border-white/25'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* FAQ Question Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {filteredFaqs.map((faq) => (
            <button
              key={faq.id}
              type="button"
              onClick={() => processQuery(faq.question, { speak: false })}
              className="px-3 py-2 rounded-xl bg-space-900 hover:bg-space-850 border border-white/10 hover:border-mars-500/40 text-left transition-colors cursor-pointer space-y-0.5"
            >
              <span className="block text-[10px] font-mono text-mars-400 uppercase tracking-wider">
                {faq.category}
              </span>
              <span className="block text-xs text-slate-200 leading-snug">
                {faq.question}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Voice / Emergency Commands */}
        <div className="pt-3 border-t border-white/5">
          <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-mars-400" aria-hidden="true" />
            <span>Quick clinical & emergency voice prompts:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => processQuery(prompt, { speak: true })}
                className="px-2.5 py-1 rounded-lg bg-space-900/80 hover:bg-space-850 border border-white/10 text-[11px] text-slate-300 hover:text-white hover:border-mars-500/40 text-left transition-colors cursor-pointer"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  );
}
