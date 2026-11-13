import React, { useState } from 'react';
import { 
  Droplet, 
  Activity, 
  Shield, 
  Search, 
  Truck, 
  Thermometer, 
  Radio, 
  Cpu, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  HeartHandshake 
} from 'lucide-react';
import { DONATION_PILLARS } from '../data/missionData';

const iconMap = {
  Droplet: Droplet,
  Activity: Activity,
  Shield: Shield,
  Search: Search,
  Truck: Truck,
  Thermometer: Thermometer,
  Radio: Radio,
  Cpu: Cpu
};

export default function MissionPillars() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);

  const categories = [
    'All', 
    'Essential Supply', 
    'Oncology & Trauma', 
    'Critical Care', 
    'Specialized Transfusion', 
    'Community Outreach', 
    'Logistics & Safety', 
    'Emergency Dispatch', 
    'Digital Network'
  ];

  const filteredPillars = DONATION_PILLARS.filter(pillar => {
    const matchesCategory = selectedCategory === 'All' || pillar.category === selectedCategory;
    const matchesSearch = 
      pillar.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pillar.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pillar.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pillar.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (id) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  return (
    <section id="services" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Comprehensive Blood Services</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            CORE LIFELINE <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">SERVICES</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            From whole blood collection and single-donor platelet apheresis to cryogenic plasma preservation and autonomous drone blood dispatch. Explore the clinical services powering RED MISSION.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-mars-600 text-white shadow-md shadow-mars-600/30'
                    : 'bg-space-850 text-slate-400 hover:text-white hover:bg-space-800 border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blood services..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-space-850 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
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

        {/* Pillars Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {filteredPillars.map((pillar) => {
            const Icon = iconMap[pillar.icon] || Droplet;
            const isExpanded = expandedCard === pillar.id;

            return (
              <div
                key={pillar.id}
                className="card-glass rounded-2xl p-6 card-glass-hover flex flex-col justify-between relative group overflow-hidden border border-white/10"
              >
                {/* Accent top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-mars-500/50 to-transparent group-hover:via-mars-500 transition-all"></div>

                <div>
                  {/* Card Header: Code + Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-mars-400 tracking-wider">
                      {pillar.code} // {pillar.category}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {pillar.badge}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="p-3 rounded-xl bg-space-850 border border-white/10 text-mars-400 group-hover:border-mars-500/40 group-hover:scale-105 transition-all">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-orbitron font-bold text-lg text-white group-hover:text-mars-300 transition-colors">
                      {pillar.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                    {pillar.description}
                  </p>

                  {/* Key Stats Chips */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5 bg-space-950/40 rounded-xl px-2">
                    {Object.entries(pillar.stats).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <span className="block text-[9px] uppercase font-mono text-slate-400 truncate">
                          {k}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-200 truncate block">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Expandable Technical Detail */}
                  {isExpanded && pillar.detailedSpecs && (
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5 animate-in fade-in duration-200">
                      <div>
                        <span className="block text-[10px] font-mono text-mars-400 uppercase font-semibold">
                          Clinical Architecture
                        </span>
                        <p className="text-xs text-slate-200 font-medium">
                          {pillar.detailedSpecs.subsystem}
                        </p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-mono text-slate-400 uppercase">
                          Biomedical Equipment
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {pillar.detailedSpecs.hardware}
                        </p>
                      </div>

                      <div className="p-2 rounded-lg bg-space-900 border border-white/5">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-semibold mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Quality & Safety Standard</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {pillar.detailedSpecs.redundancy}
                        </p>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 space-y-1">
                        <div>
                          <span className="text-slate-500">Transfusion Efficacy: </span>
                          <span className="text-slate-300">{pillar.detailedSpecs.flightHeritage}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Accredited Partner: </span>
                          <span className="text-mars-400">{pillar.detailedSpecs.partner}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="mt-4 pt-3 flex items-center justify-between border-t border-white/5">
                  <span className="text-[11px] font-mono text-slate-400">
                    NBTC Certified Protocol
                  </span>
                  <button
                    onClick={() => toggleExpand(pillar.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-mars-400 hover:text-mars-300 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'Clinical Specs'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty Search Result State */}
        {filteredPillars.length === 0 && (
          <div className="text-center py-12 card-glass rounded-2xl border border-white/10 mt-6">
            <p className="text-slate-400 text-sm">No service found matching "{searchQuery}"</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-3 px-4 py-1.5 rounded-lg bg-mars-600 text-white text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

      </div>
    </section>
  );
}
