import React, { useState } from 'react';
import { 
  Award, 
  Search, 
  Filter, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Check, 
  QrCode, 
  RefreshCw, 
  Building2, 
  Calendar, 
  Droplet,
  FileText,
  ShieldCheck
} from 'lucide-react';

export default function SuperAdminCertificatesTab({
  certificates = [],
  loading = false,
  onRefreshCertificates,
  onViewCertificate,
  currentAdmin
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState('');

  const copyToClipboard = (text, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Filter certificates
  const filteredCertificates = certificates.filter(cert => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (cert.id || '').toLowerCase().includes(query) ||
      (cert.donorName || '').toLowerCase().includes(query) ||
      (cert.donorEmail || '').toLowerCase().includes(query) ||
      (cert.donorMobile || '').includes(query) ||
      (cert.hospitalName || '').toLowerCase().includes(query) ||
      (cert.patientName || '').toLowerCase().includes(query) ||
      (cert.bloodGroup || '').toLowerCase().includes(query);

    const matchesBloodGroup = bloodGroupFilter === 'ALL' || cert.bloodGroup === bloodGroupFilter;

    return matchesSearch && matchesBloodGroup;
  });

  // Calculate aggregates
  const totalUnits = certificates.reduce((acc, c) => acc + (Number(c.unitsDonated) || 1), 0);
  const uniqueDonors = new Set(certificates.map(c => c.donorUserId || c.donorEmail)).size;

  return (
    <div className="space-y-6">

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase">Total Issued</span>
            <div className="text-2xl font-orbitron font-extrabold text-white">
              {certificates.length}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Clinical certificates generated</p>
          </div>
        </div>

        <div className="card-glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase">Units Donated</span>
            <div className="text-2xl font-orbitron font-extrabold text-white">
              {totalUnits} Units
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Approved verified clinical volume</p>
          </div>
        </div>

        <div className="card-glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase">Unique Donors</span>
            <div className="text-2xl font-orbitron font-extrabold text-white">
              {uniqueDonors}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Recognized lifesaving donors</p>
          </div>
        </div>
      </div>

      {/* Main Certificates Table Card */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">
              Issued Clinical Certificates ({filteredCertificates.length})
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Super Admin oversight across all hospital donations, verification tokens, and donor records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search filter */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search certificate, donor, hospital..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Blood group filter */}
            <select
              value={bloodGroupFilter}
              onChange={(e) => setBloodGroupFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Blood Groups</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>

            <button
              onClick={onRefreshCertificates}
              disabled={loading}
              className="p-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Certificate List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Certificates Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Certificate ID</th>
                <th className="py-2.5 px-3">Donor Information</th>
                <th className="py-2.5 px-3">Group &amp; Units</th>
                <th className="py-2.5 px-3">Hospital &amp; Patient</th>
                <th className="py-2.5 px-3">Issued Date</th>
                <th className="py-2.5 px-3">Verification</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCertificates.length > 0 ? (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-white/5 transition-colors">
                    
                    {/* Certificate ID */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-400 select-all">{cert.id}</span>
                        <button
                          onClick={() => copyToClipboard(cert.id, cert.id)}
                          className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Copy Certificate ID"
                        >
                          {copiedId === cert.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={cert.pledgeId}>
                        Pledge: {cert.pledgeId}
                      </div>
                    </td>

                    {/* Donor Details */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{cert.donorName}</div>
                      <div className="text-slate-400 text-[10px]">{cert.donorEmail}</div>
                      {cert.donorMobile && (
                        <div className="text-slate-500 text-[10px]">{cert.donorMobile}</div>
                      )}
                    </td>

                    {/* Blood Group & Units */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded font-bold bg-mars-500/20 text-mars-400 border border-mars-500/40 text-[11px]">
                          {cert.bloodGroup}
                        </span>
                        <span className="text-slate-300 font-semibold">{cert.unitsDonated} Unit</span>
                      </div>
                    </td>

                    {/* Hospital & Patient */}
                    <td className="py-3 px-3">
                      <div className="text-white font-medium flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{cert.hospitalName}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Patient: <span className="text-slate-300">{cert.patientName || 'Emergency Patient'}</span>
                      </div>
                      {cert.hospitalCity && (
                        <div className="text-slate-500 text-[10px]">{cert.hospitalCity}</div>
                      )}
                    </td>

                    {/* Issued Date */}
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      <div>{cert.donationDate ? new Date(cert.donationDate).toLocaleDateString() : '—'}</div>
                      <div className="text-[10px] text-slate-500">
                        {cert.issuedAt ? new Date(cert.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewCertificate && onViewCertificate(cert)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                          title="Open Official Clinical Certificate View"
                        >
                          <FileText className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        {cert.qrVerificationToken && (
                          <button
                            onClick={() => {
                              window.location.hash = `#verify-certificate-${cert.qrVerificationToken}`;
                            }}
                            className="px-2 py-1 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Verify via Public QR Token Modal"
                          >
                            <QrCode className="w-3 h-3 text-amber-400" />
                            <span className="hidden sm:inline">QR</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400 text-xs font-mono">
                    {loading 
                      ? 'Loading clinical certificates...' 
                      : 'No donation certificates match the filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
