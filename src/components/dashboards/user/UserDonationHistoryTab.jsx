import React, { useState } from 'react';
import { Award, Building2, Calendar, Droplet, MapPin, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import DashboardTable from '../shared/DashboardTable';
import StatusBadge from '../shared/StatusBadge';

export default function UserDonationHistoryTab({
  pledges = [],
  loading = false,
  onViewCertificate,
  onNavigateTab
}) {
  const [copiedId, setCopiedId] = useState(null);

  // Filter only completed / approved donations
  const completedDonations = pledges.filter(p => 
    p.displayStatus === 'Approved' || p.rawStatus === 'APPROVED' || p.certificate
  );

  const totalUnits = completedDonations.reduce((sum, p) => sum + (p.unitsPledged || 1), 0);

  const handleCopyLink = (token, pledgeId) => {
    const url = `${window.location.origin}/#verify-certificate-${token || pledgeId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedId(pledgeId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Lifetime Impact Highlight */}
      <div className="card-glass rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Lifetime Verified Contributions
            </h3>
            <p className="text-xs font-mono text-slate-300">
              Each unit directly preserved human life during clinical emergencies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-[10px] font-mono uppercase text-slate-400">Completed Donations</span>
            <span className="font-orbitron font-extrabold text-2xl text-emerald-400">{completedDonations.length}</span>
          </div>
          <div className="text-right border-l border-white/10 pl-6">
            <span className="block text-[10px] font-mono uppercase text-slate-400">Total Blood Units</span>
            <span className="font-orbitron font-extrabold text-2xl text-white">{totalUnits}</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DashboardTable
        title="Official Donation History"
        subtitle="Chronological audit record of all verified blood donations"
        loading={loading}
        isEmpty={completedDonations.length === 0}
        emptyMessage="No completed donations on record yet"
        emptySubtext="Once your donation proof is approved by the medical admin team, your verified record will appear here."
        emptyAction={
          <button
            onClick={() => onNavigateTab('pledges')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-mars-600 hover:bg-mars-500 text-white transition-colors"
          >
            Check Active Pledges
          </button>
        }
        columns={[
          { label: 'Donation Date' },
          { label: 'Hospital & Location' },
          { label: 'Patient & Blood Group' },
          { label: 'Units' },
          { label: 'Clinical Certificate' },
          { label: 'Actions', className: 'text-right' }
        ]}
      >
        {completedDonations.map((pledge, dIdx) => (
          <tr key={pledge.id || pledge.certificate?.id || `donation-${dIdx}`} className="hover:bg-white/5 transition-colors">
            
            {/* Donation Date */}
            <td className="py-3.5 px-4 font-mono text-xs text-white">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {pledge.completedAt 
                    ? new Date(pledge.completedAt).toLocaleDateString()
                    : pledge.reservedAt 
                    ? new Date(pledge.reservedAt).toLocaleDateString()
                    : 'Verified'}
                </span>
              </div>
            </td>

            {/* Hospital & Location */}
            <td className="py-3.5 px-4">
              <div className="font-semibold text-white">
                {pledge.hospitalName}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>{pledge.hospitalCity}</span>
              </div>
            </td>

            {/* Patient & Blood Group */}
            <td className="py-3.5 px-4">
              <div className="text-slate-200">
                {pledge.patientName}
              </div>
              <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-mars-500/20 text-mars-400 font-bold border border-mars-500/30 text-[10px] font-mono">
                {pledge.bloodGroup}
              </span>
            </td>

            {/* Units */}
            <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
              {pledge.unitsPledged || 1} Unit
            </td>

            {/* Certificate */}
            <td className="py-3.5 px-4">
              {pledge.certificate ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Issued</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]" title={pledge.certificate.id}>
                    {pledge.certificate.id}
                  </div>
                </div>
              ) : (
                <StatusBadge status="Approved" />
              )}
            </td>

            {/* Actions */}
            <td className="py-3.5 px-4 text-right">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onViewCertificate(pledge)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>View Citation</span>
                </button>

                {pledge.certificate?.qrVerificationToken && (
                  <button
                    onClick={() => handleCopyLink(pledge.certificate.qrVerificationToken, pledge.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                    title="Copy Public Verification Link"
                  >
                    {copiedId === pledge.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </td>

          </tr>
        ))}
      </DashboardTable>

    </div>
  );
}
