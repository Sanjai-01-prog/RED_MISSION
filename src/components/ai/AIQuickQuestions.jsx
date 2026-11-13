import React from 'react';
import { HelpCircle } from 'lucide-react';

export const QUICK_AI_QUESTIONS = [
  'How can I register as a blood donor?',
  'What are the eligibility requirements?',
  'How can I find blood donors?',
  'How can I request emergency blood?',
  'How can I update my donor profile?',
  'How can I get my donation certificate?',
];

export default function AIQuickQuestions({
  onSelectQuestion,
  disabled = false,
  compact = false,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 px-0.5">
        <HelpCircle className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
        <span>Quick Questions</span>
      </div>

      <div className={`grid gap-1.5 ${compact ? 'grid-cols-1' : 'grid-cols-1'}`}>
        {QUICK_AI_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelectQuestion(question)}
            className="w-full text-left px-3 py-2 rounded-xl bg-space-900 hover:bg-space-800 border border-white/10 hover:border-mars-500/45 text-xs text-slate-200 hover:text-white disabled:opacity-50 transition-colors cursor-pointer leading-snug"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
