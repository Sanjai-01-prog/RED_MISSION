import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Sparkles, 
  Search,
  Droplet,
  PhoneCall,
  Mic
} from 'lucide-react';
import { FAQ_ITEMS } from '../data/missionData';

export default function FaqSection({ onOpenBloodDrop }) {
  const [openQuestion, setOpenQuestion] = useState(FAQ_ITEMS[0]?.question || ''); // Default open first question
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    'All',
    'Eligibility & Requirements',
    'Health & Safety',
    'Preparation & Guidelines',
    'Blood Types & Compatibility',
    'Donation Proof & Verification',
    'Emergency Requests',
    'AI & Blood Drop'
  ];

  const filteredFaqs = FAQ_ITEMS.filter((faq) => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (question) => {
    setOpenQuestion(openQuestion === question ? null : question);
  };

  return (
    <section id="faq" className="py-20 relative bg-space-950/70 border-t border-white/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Clinical Knowledge & Transfusion Guidelines</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            FREQUENTLY ASKED <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">QUESTIONS</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Essential facts on donor eligibility, clinical safety standards, blood type compatibility, and emergency response protocols.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                    : 'bg-space-850 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative max-w-md mx-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donor guidelines, eligibility, safety..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-space-850 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = openQuestion === faq.question;

            return (
              <div
                key={faq.question}
                className="card-glass rounded-xl overflow-hidden border border-white/10 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(faq.question)}
                  aria-expanded={isOpen}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:text-mars-400 transition-colors cursor-pointer"
                >
                  <div>
                    {faq.category && (
                      <span className="block text-[10px] font-mono text-mars-400 mb-1">
                        {faq.category.toUpperCase()}
                      </span>
                    )}
                    <span className="font-orbitron font-semibold text-sm sm:text-base text-white">
                      {faq.question}
                    </span>
                  </div>
                  <div className="p-1 rounded-lg bg-space-850 border border-white/10 text-slate-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-mars-400" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-white/5 animate-in fade-in duration-200">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}

          {filteredFaqs.length === 0 && (
            <div className="text-center py-8 card-glass rounded-xl border border-white/10 text-slate-400 text-xs">
              No answers found matching "{searchQuery}". Try a different medical term or reset the category filter.
            </div>
          )}
        </div>

        {/* Bottom Banner */}
        <div className="mt-8 p-4 rounded-xl bg-space-900 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-mars-400 shrink-0" />
            <p className="text-xs text-slate-300">
              Have a clinical question or need urgent blood matching? Our 24/7 National Emergency Blood Helpline is active at <span className="text-mars-400 font-semibold font-mono">108 / 104</span>.
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {onOpenBloodDrop && (
              <button
                onClick={onOpenBloodDrop}
                className="px-4 py-2 rounded-lg bg-mars-600 hover:bg-mars-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-mars-600/30"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Ask Blood Drop AI</span>
              </button>
            )}
            
            <a
              href="#requests"
              className="px-3.5 py-2 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Post Emergency Request
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}