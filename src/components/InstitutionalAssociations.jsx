import React, { useState } from 'react';
import { ExternalLink, Users, Clock } from 'lucide-react';
import { INSTITUTIONAL_ASSOCIATIONS } from '../data/institutionalAssociations';

export default function InstitutionalAssociations({ onOpenRotaractDirectory }) {
  const [pendingNotice, setPendingNotice] = useState(null);

  const handleInternalDirectoryClick = (e) => {
    e.preventDefault();
    setPendingNotice(null);
    if (onOpenRotaractDirectory) {
      onOpenRotaractDirectory();
    }
  };

  const handlePendingExternalClick = (partner) => {
    setPendingNotice(`${partner.name} official website link is pending URL confirmation.`);
  };

  return (
    <section
      aria-labelledby="institutional-associations-heading"
      className="relative bg-space-950/95 border-t border-white/10 py-10 sm:py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Compact Formal Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mars-400">
              Affiliations &amp; Community Partners
            </p>
            <h2
              id="institutional-associations-heading"
              className="font-orbitron font-bold text-base sm:text-lg text-white tracking-wide"
            >
              Institutional &amp; Community Associations
            </h2>
          </div>

          <p className="text-[11px] font-mono text-slate-400">
            Academic, Rotary District, Rotaract Chapter &amp; NSS Collaborations
          </p>
        </div>

        {/* Aligned Five-Logo Responsive Grid */}
        <ul
          role="list"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch"
        >
          {INSTITUTIONAL_ASSOCIATIONS.map((partner) => {
            const isDirectory = partner.type === 'internal-directory';
            const hasExternalUrl = partner.type === 'external' && Boolean(partner.url);

            const innerContent = (
              <>
                <div className="w-full h-24 sm:h-28 flex items-center justify-center">
                  <img
                    src={partner.logoSrc}
                    alt={partner.alt}
                    width={partner.width}
                    height={partner.height}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-full w-auto h-auto object-contain select-none"
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 w-full min-w-0 px-0.5">
                  <div className="min-w-0 text-left">
                    <span className="block text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                      {partner.shortLabel}
                    </span>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 truncate">
                      {partner.subLabel}
                    </span>
                  </div>

                  {isDirectory ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mars-500/15 border border-mars-500/35 text-[10px] font-mono text-mars-300 shrink-0">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      <span>Directory</span>
                    </span>
                  ) : hasExternalUrl ? (
                    <ExternalLink
                      className="w-3.5 h-3.5 text-slate-400 group-hover:text-mars-400 shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                  ) : (
                    <Clock
                      className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </>
            );

            return (
              <li key={partner.id} className="flex min-w-0">
                {isDirectory ? (
                  <a
                    href={partner.routeHash}
                    onClick={handleInternalDirectoryClick}
                    aria-label={`${partner.name} — Open Rotaract College Members Directory`}
                    className="partner-logo-tile group w-full rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer"
                  >
                    {innerContent}
                  </a>
                ) : hasExternalUrl ? (
                  <a
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${partner.name} — Visit official website (opens in a new tab)`}
                    className="partner-logo-tile group w-full rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer"
                  >
                    {innerContent}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePendingExternalClick(partner)}
                    aria-label={`${partner.name} — Official website link pending confirmation`}
                    className="partner-logo-tile group w-full rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer text-left"
                  >
                    {innerContent}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {/* Accessible Status Message for Pending Configurable External Links */}
        {pendingNotice && (
          <div
            role="status"
            aria-live="polite"
            className="text-center text-xs font-mono text-slate-300 pt-1"
          >
            {pendingNotice}
          </div>
        )}
      </div>
    </section>
  );
}
