import React, { useState } from 'react';
import {
  HeartPulse,
  Droplet,
  Microscope,
  ThermometerSnowflake,
  HeartHandshake,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Info
} from 'lucide-react';
import { DONATION_LIFELINE_ROADMAP } from '../data/missionData';

const STAGE_ICON_MAP = {
  'health-check': HeartPulse,
  'blood-collection': Droplet,
  'testing-separation': Microscope,
  'storage-transport': ThermometerSnowflake,
  'transfusion': HeartHandshake
};

/**
 * Educational 5-stage vertical journey explaining how donated blood travels
 * from donor health check through licensed blood-centre processing to a patient.
 */
export default function MissionTimeline() {
  const [openSteps, setOpenSteps] = useState(() => DONATION_LIFELINE_ROADMAP.map(() => false));

  const allExpanded = openSteps.length > 0 && openSteps.every(Boolean);

  const handleToggleAll = () => {
    const nextState = !allExpanded;
    setOpenSteps(DONATION_LIFELINE_ROADMAP.map(() => nextState));
  };

  const handleStepToggle = (index, isOpen) => {
    setOpenSteps((prev) => {
      if (prev[index] === isOpen) return prev;
      const next = [...prev];
      next[index] = isOpen;
      return next;
    });
  };

  return (
    <section
      id="journey"
      aria-labelledby="lifeline-journey-heading"
      className="py-20 sm:py-24 scroll-mt-32 sm:scroll-mt-36 relative bg-space-950/60 overflow-hidden"
    >
      {/* Subtle ambient background accent */}
      <div
        className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-mars-500/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <header className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <p className="font-orbitron font-bold text-xs sm:text-sm uppercase tracking-[0.2em] text-mars-400">
            Every Drop Has a Journey. Every Donation Gives Hope.
          </p>

          <h2
            id="lifeline-journey-heading"
            className="font-orbitron font-extrabold text-3xl sm:text-4xl lg:text-[2.6rem] text-white tracking-tight"
          >
            THE LIFELINE{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">
              JOURNEY
            </span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Discover how your donated blood travels from a donor to someone who needs it.
          </p>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={handleToggleAll}
              aria-expanded={allExpanded}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-space-900/90 hover:bg-space-850 border border-white/15 hover:border-mars-500/40 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400 focus-visible:ring-offset-2 focus-visible:ring-offset-space-950"
            >
              <Info className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
              <span>{allExpanded ? 'Collapse all medical details' : 'Expand all medical details'}</span>
            </button>
          </div>
        </header>

        {/* Vertical 5-Stage Educational Timeline */}
        <div className="relative">
          {/* Vertical Spine Line */}
          <div
            className="pointer-events-none absolute left-5 sm:left-7 top-6 bottom-6 w-px bg-gradient-to-b from-mars-500/70 via-mars-500/35 to-mars-flame/70"
            aria-hidden="true"
          />

          <ol className="space-y-6 sm:space-y-8">
            {DONATION_LIFELINE_ROADMAP.map((stage, idx) => {
              const Icon = STAGE_ICON_MAP[stage.iconName] || HeartPulse;
              const isOpen = Boolean(openSteps[idx]);

              return (
                <li
                  key={stage.stepNumber}
                  className="relative pl-14 sm:pl-20"
                >
                  {/* Step Marker Node on the Vertical Spine */}
                  <div
                    className="absolute left-0 top-1.5 sm:top-2 w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-space-900 border border-mars-500/50 shadow-[0_0_24px_rgba(225,29,72,0.18)] flex flex-col items-center justify-center z-10"
                    aria-hidden="true"
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-mars-400" />
                    <span className="font-orbitron font-bold text-[9px] sm:text-[10px] leading-none text-white/90 mt-0.5">
                      {stage.stepNumber}
                    </span>
                  </div>

                  {/* Stage Card */}
                  <article className="card-glass rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-white/10 hover:border-mars-500/35 transition-colors bg-gradient-to-br from-space-900/95 via-space-900/80 to-space-850/90 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 font-orbitron font-bold text-[11px] sm:text-xs tracking-wider text-mars-300 uppercase">
                        {stage.phase}
                      </span>
                    </div>

                    <h3 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white tracking-tight">
                      {stage.title}
                    </h3>

                    <p className="mt-2.5 text-slate-200 text-sm sm:text-base leading-relaxed">
                      {stage.description}
                    </p>

                    {/* Simple Takeaway Callout */}
                    <div className="mt-4 rounded-xl bg-mars-500/[0.08] border border-mars-500/25 px-4 py-3 flex items-start gap-2.5">
                      <Sparkles
                        className="w-4 h-4 text-mars-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-xs sm:text-sm text-slate-100 leading-snug">
                        <span className="font-semibold text-mars-300 uppercase tracking-wider text-[11px] mr-1.5">
                          Simple Takeaway:
                        </span>
                        <span className="font-medium text-white">{stage.takeaway}</span>
                      </p>
                    </div>

                    {/* Expandable Verified Medical Context (No headings inside <summary> for AT compatibility) */}
                    <details
                      open={isOpen}
                      onToggle={(e) => handleStepToggle(idx, e.currentTarget.open)}
                      className="lifeline-details mt-4 pt-3.5 border-t border-white/10"
                    >
                      <summary className="inline-flex items-center gap-2 py-1 text-xs sm:text-sm font-medium text-slate-300 hover:text-white cursor-pointer select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-400">
                        <ChevronDown
                          className="lifeline-details-chevron w-4 h-4 text-mars-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{isOpen ? 'Hide medical details' : 'Learn more about this step'}</span>
                      </summary>

                      <div className="mt-3 rounded-xl bg-space-950/75 border border-white/10 p-4 space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-mars-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-mars-400 shrink-0" aria-hidden="true" />
                          <span>{stage.additionalInfoTitle}</span>
                        </p>
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {stage.milestones.map((point, pointIdx) => (
                            <li key={pointIdx} className="flex items-start gap-2.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-mars-400 mt-2 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Final Inspirational Closing Message & Institutional Clarification */}
        <footer className="mt-12 sm:mt-14 text-center space-y-4">
          <div className="rounded-2xl sm:rounded-3xl border border-mars-500/35 bg-gradient-to-r from-space-900 via-mars-950/35 to-space-900 px-6 py-7 sm:py-8 shadow-[0_0_40px_rgba(225,29,72,0.12)]">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-mars-500/15 border border-mars-500/40 mb-3" aria-hidden="true">
              <HeartHandshake className="w-5 h-5 text-mars-400" />
            </div>
            <p className="font-orbitron font-extrabold text-xl sm:text-2xl tracking-[0.08em] text-white uppercase">
              YOUR DONATION.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-400 to-mars-flame">
                SOMEONE&apos;S HOPE.
              </span>
            </p>
            <p className="mt-2.5 max-w-2xl mx-auto text-xs sm:text-sm text-slate-300 leading-relaxed">
              RED MISSION connects voluntary donors and raises awareness. All health screening, blood collection, safety testing, storage, and hospital transfusions are performed independently by licensed blood centres and healthcare professionals.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
