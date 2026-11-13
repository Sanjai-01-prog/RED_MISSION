import React, { useState } from 'react';
import { Award, QrCode, Printer, Download, RefreshCw, Copy, Check, ExternalLink, ShieldCheck, Calendar, Building2, Droplet } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';

export default function UserCertificatesTab({
  pledges = [],
  loading = false,
  onViewCertificate,
  onDownloadCertificate,
  downloadingCertPledgeId = null,
  onNavigateTab
}) {
  const [copiedId, setCopiedId] = useState(null);

  // Pledges that have an issued certificate
  const certificatePledges = pledges.filter(p => p.certificate != null);

  const handleCopyVerificationUrl = (token, id) => {
    const url = `${window.location.origin}/#verify-certificate-${token || id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Accredited Banner */}
      <div className="card-glass rounded-3xl border border-amber-500/30 bg-gradient-to-r from-space-900 via-amber-500/5 to-space-900 p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                NBTC ACCREDITED // VERIFIED LIFESAVER REGISTRY
              </span>
            </div>
            <h3 className="font-orbitron font-extrabold text-lg sm:text-xl text-white">
              Official Lifesaver Citations
            </h3>
            <p className="text-xs text-slate-300 font-mono max-w-xl">
              Each certificate is cryptographically verified and anchored with an immutable verification token accessible by hospitals and government blood transfusion councils.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="block text-[10px] font-mono uppercase text-slate-400">Certificates Earned</span>
          <span className="font-orbitron font-extrabold text-3xl text-amber-400">{certificatePledges.length}</span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(n => (
            <div key={n} className="card-glass rounded-2xl p-6 border border-white/5 animate-pulse space-y-4">
              <div className="h-6 w-32 bg-white/10 rounded"></div>
              <div className="h-4 w-48 bg-white/5 rounded"></div>
              <div className="h-20 bg-white/5 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : certificatePledges.length === 0 ? (
        /* Empty State */
        <div className="card-glass rounded-3xl border border-white/10 p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-orbitron font-bold text-base text-white">
              No Lifesaver Certificates Yet
            </h3>
            <p className="text-xs font-mono text-slate-400">
              When you fulfill an emergency blood pledge and your donation slip is approved by hospital administrators, your official citation will appear here.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('pledges')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              View Active Pledges
            </button>
          </div>
        </div>
      ) : (
        /* Certificates Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificatePledges.map((pledge, cIdx) => {
            const cert = pledge.certificate;
            const certId = cert.id;
            const qrToken = cert.qrVerificationToken;

            return (
              <div
                key={certId || pledge.id || `cert-${cIdx}`}
                className="card-glass rounded-3xl border border-amber-500/30 hover:border-amber-500/60 transition-all duration-300 p-6 sm:p-7 space-y-5 relative overflow-hidden group shadow-xl bg-gradient-to-br from-space-900 via-space-950 to-space-900"
              >
                {/* Subtle Filigree Corner Accents */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-amber-400/60"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-amber-400/60"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-amber-400/60"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-amber-400/60"></div>

                {/* Top Badge & Serial */}
                <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                      LIFESAVER CITATION
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-space-850 px-2 py-0.5 rounded border border-white/5">
                    {certId}
                  </span>
                </div>

                {/* Main Certificate Details */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400">Hospital & Center</span>
                    <h4 className="font-orbitron font-bold text-base text-white truncate">
                      {pledge.hospitalName}
                    </h4>
                    <p className="text-xs text-slate-300 font-mono">
                      {pledge.hospitalCity} • Patient: {pledge.patientName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-space-850/70 border border-white/5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Blood Group</span>
                      <span className="text-mars-400 font-bold">{pledge.bloodGroup}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Contribution</span>
                      <span className="text-emerald-400 font-bold">{pledge.unitsPledged || 1} Unit Donated</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopyVerificationUrl(qrToken, pledge.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-space-850 hover:bg-space-800 border border-white/10 transition-colors cursor-pointer"
                    title="Copy Public QR Verification Link"
                  >
                    {copiedId === pledge.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  {onDownloadCertificate && (
                    <button
                      type="button"
                      disabled={downloadingCertPledgeId === pledge.id}
                      onClick={() => onDownloadCertificate(pledge)}
                      className="flex-1 min-w-[165px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame hover:brightness-110 text-white shadow-md shadow-mars-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {downloadingCertPledgeId === pledge.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{downloadingCertPledgeId === pledge.id ? 'Generating PDF...' : 'Download Certificate (PDF)'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onViewCertificate(pledge)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-space-950 font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-space-950" />
                    <span>View &amp; Print</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
