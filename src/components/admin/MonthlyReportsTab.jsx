import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileSpreadsheet, 
  Eye, 
  ShieldCheck, 
  Droplet, 
  User, 
  Heart, 
  Building2, 
  Clock, 
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  Info
} from 'lucide-react';
import { reportApi, proofApi } from '../../services/api';

export default function MonthlyReportsTab({ currentAdmin }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  // Data States
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedDonationIndex, setExpandedDonationIndex] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Load proof photo securely using Authorization header and object URL (never query-string token)
  useEffect(() => {
    if (!previewPhoto?.proofId) {
      setPreviewPhotoUrl(null);
      setPhotoError('');
      setLoadingPhoto(false);
      return;
    }

    let active = true;
    let createdUrl = null;
    const controller = new AbortController();

    async function loadProofImage() {
      setLoadingPhoto(true);
      setPhotoError('');
      setPreviewPhotoUrl(null);
      try {
        const blobUrl = await proofApi.fetchPhotoBlobUrl(previewPhoto.proofId, {
          tokenType: 'admin',
          signal: controller.signal
        });
        createdUrl = blobUrl;
        if (active) {
          setPreviewPhotoUrl(blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setPhotoError(err.message || 'Proof photograph unavailable on clinical disk storage.');
        }
      } finally {
        if (active) {
          setLoadingPhoto(false);
        }
      }
    }

    loadProofImage();

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [previewPhoto?.proofId]);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const currentYear = currentDate.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Fetch report preview for selected month/year
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportApi.getMonthlyReport(selectedMonth, selectedYear);
      if (res.success && res.report) {
        setReportData(res.report);
      } else {
        setError(res.error || 'Failed to retrieve report preview.');
      }
    } catch (err) {
      console.error('Failed to fetch report preview:', err);
      setError('Network error while retrieving report data.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Fetch report generation history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await reportApi.getReportHistory();
      if (res.success && res.reports) {
        setHistory(res.reports);
      }
    } catch (err) {
      console.error('Failed to load report history:', err);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
    fetchHistory();
  }, [fetchReportData, fetchHistory]);

  // Handle Official Report Generation
  const handleGenerateReport = async () => {
    setGenerating(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await reportApi.generateMonthlyReport(selectedMonth, selectedYear);
      if (res.success) {
        setSuccessMessage(`Official report for ${res.period?.label || 'selected month'} generated and certified successfully!`);
        fetchReportData();
        fetchHistory();
      } else {
        setError(res.error || 'Failed to generate official report.');
      }
    } catch (err) {
      console.error('Report generation error:', err);
      setError('An error occurred during report compilation and certification.');
    } finally {
      setGenerating(false);
    }
  };

  // Download Handlers
  const handleDownloadPdf = async (month = selectedMonth, year = selectedYear, reportId = null, maskSensitive = true) => {
    setDownloadingPdf(true);
    setError('');
    try {
      await reportApi.downloadPdf(month, year, reportId, maskSensitive);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(`PDF download failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async (month = selectedMonth, year = selectedYear, reportId = null, maskSensitive = true) => {
    setDownloadingExcel(true);
    setError('');
    try {
      await reportApi.downloadExcel(month, year, reportId, maskSensitive);
    } catch (err) {
      console.error('Excel download error:', err);
      setError(`Excel download failed: ${err.message}`);
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="card-glass p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-mars-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-mars-400 uppercase tracking-wider">
              ROTARACT DISTRICT PORTAL ACTIVITY DOSSIER
            </span>
          </div>
          <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">
            Monthly Donation Activity Report
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Evidence-based clinical verification reports with donor records, recipient telemetry, and photographic proof.
          </p>
        </div>

        {/* Month / Year Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-space-850 p-1.5 rounded-xl border border-white/10">
            <Calendar className="w-4 h-4 text-mars-400 ml-2" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer pr-2"
            >
              {months.map(m => (
                <option key={m.value} value={m.value} className="bg-space-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer pr-2"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-space-900 text-white">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchReportData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Refresh Preview"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mars-400' : ''}`} />
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={generating || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-500 hover:from-mars-500 hover:to-mars-flame text-white font-semibold text-sm shadow-lg shadow-mars-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Compiling Dossier...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Generate Official Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Selected Reporting Period Summary Banner */}
      {reportData && (
        <div className="card-glass p-5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-space-900 via-space-850 to-space-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-mars-500/20 border border-mars-500/40 flex items-center justify-center">
              <Droplet className="w-6 h-6 text-mars-400 fill-mars-400" />
            </div>
            <div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">SELECTED PERIOD</div>
              <div className="text-lg font-orbitron font-bold text-white">
                {reportData.period.label}
              </div>
              <div className="text-xs text-slate-400">
                Window: {reportData.period.startDate} to {reportData.period.endDate}
              </div>
            </div>
          </div>

          {/* Quick Action Downloads */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownloadPdf()}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-200 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <FileText className="w-4 h-4 text-mars-400" />
              <span>{downloadingPdf ? 'Downloading PDF...' : 'Download Official PDF'}</span>
            </button>

            <button
              onClick={() => handleDownloadExcel()}
              disabled={downloadingExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-200 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{downloadingExcel ? 'Downloading Excel...' : 'Download Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 Metric Telemetry Cards */}
      {reportData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-glass p-5 rounded-2xl border border-white/10">
            <div className="text-xs font-mono text-mars-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>VERIFIED DONATIONS</span>
            </div>
            <div className="text-3xl font-orbitron font-bold text-white">
              {reportData.summary.totalDonations}
            </div>
            <div className="text-xs text-slate-400 mt-1">100% clinically audited</div>
          </div>

          <div className="card-glass p-5 rounded-2xl border border-white/10">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5" />
              <span>WHOLE BLOOD UNITS</span>
            </div>
            <div className="text-3xl font-orbitron font-bold text-cyan-400">
              {reportData.summary.totalUnits}
            </div>
            <div className="text-xs text-slate-400 mt-1">Total volume collected</div>
          </div>

          <div className="card-glass p-5 rounded-2xl border border-white/10">
            <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>UNIQUE LIFESAVERS</span>
            </div>
            <div className="text-3xl font-orbitron font-bold text-emerald-400">
              {reportData.summary.uniqueDonorsCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">Active volunteer donors</div>
          </div>

          <div className="card-glass p-5 rounded-2xl border border-white/10">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>HOSPITALS SERVED</span>
            </div>
            <div className="text-3xl font-orbitron font-bold text-amber-400">
              {reportData.summary.uniqueHospitalsCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">Facilities supported</div>
          </div>
        </div>
      )}

      {/* Blood Group Distribution Grid */}
      {reportData && (
        <div className="card-glass p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4 text-mars-400" />
              <h3 className="font-orbitron font-bold text-sm text-white tracking-wide">
                Blood Group Clinical Breakdown ({reportData.period.label})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {reportData.summary.totalDonations} Donations Mapped
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {Object.entries(reportData.summary.bloodGroups).map(([bg, count]) => {
              const pct = reportData.summary.totalDonations > 0 
                ? ((count / reportData.summary.totalDonations) * 100).toFixed(0) 
                : 0;
              return (
                <div 
                  key={bg} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    count > 0 
                      ? 'bg-space-850 border-mars-500/30 shadow-lg shadow-mars-600/5' 
                      : 'bg-space-900/60 border-white/5 opacity-60'
                  }`}
                >
                  <span className="font-orbitron font-bold text-lg text-white">{bg}</span>
                  <span className="font-mono text-xs font-bold text-mars-400 mt-0.5">{count} Units</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Donor-wise Records Table / Cards */}
      {reportData && (
        <div className="card-glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-mars-400" />
              <h3 className="font-orbitron font-bold text-sm text-white tracking-wide">
                Detailed Donor-Wise Donation Records ({reportData.donations.length})
              </h3>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Strict Eligibility: Excludes unverified pledges
            </div>
          </div>

          {reportData.donations.length === 0 ? (
            <div className="p-12 text-center">
              <Droplet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">No verified completed donations recorded for {reportData.period.label}.</p>
              <p className="text-xs text-slate-500 mt-1">
                Pledges must have approved medical proofs and issued certificates to be included in official reports.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {reportData.donations.map((d, idx) => {
                const isExpanded = expandedDonationIndex === idx;
                return (
                  <div key={d.referenceId || d.id || `donation-${idx}`} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div 
                      onClick={() => setExpandedDonationIndex(isExpanded ? null : idx)}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-space-850 border border-mars-500/30 flex items-center justify-center font-orbitron font-bold text-mars-400 text-sm flex-shrink-0">
                          {d.donorBloodGroup}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{d.donorName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {d.donationStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5 font-mono">
                            <span>Ref: {d.referenceId}</span>
                            <span>•</span>
                            <span>Date: {d.donationDate}</span>
                            <span>•</span>
                            <span>Patient: {d.patientName}</span>
                            <span>•</span>
                            <span>Hospital: {d.hospitalName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end lg:self-auto">
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                          {d.unitsDonated} Unit(s)
                        </span>

                        {d.hasProofPhoto && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto(d);
                            }}
                            className="p-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10"
                            title="Inspect Proof Photo"
                          >
                            <ImageIcon className="w-4 h-4 text-mars-400" />
                          </button>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono bg-space-950/40 p-4 rounded-xl">
                        <div>
                          <div className="text-mars-400 font-bold mb-1">DONOR PROFILE</div>
                          <div className="text-slate-300">Name: {d.donorName}</div>
                          <div className="text-slate-300">Age: {d.donorAge}</div>
                          <div className="text-slate-300">City: {d.donorCity}</div>
                          <div className="text-slate-400">Mobile: {d.donorMobile}</div>
                          <div className="text-slate-400">Email: {d.donorEmail}</div>
                          <div className="text-emerald-400">Lifetime Donations: {d.donorLifetimeDonations}</div>
                        </div>

                        <div>
                          <div className="text-cyan-400 font-bold mb-1">RECIPIENT & CLINICAL FACILITY</div>
                          <div className="text-slate-300">Patient: {d.patientName}</div>
                          <div className="text-slate-300">Required Group: {d.recipientBloodGroup}</div>
                          <div className="text-slate-300">Hospital: {d.hospitalName}</div>
                          <div className="text-slate-400">City: {d.hospitalCity}</div>
                          <div className="text-slate-400">Address: {d.hospitalAddress}</div>
                          <div className="text-amber-400">Urgency: {d.urgencyLevel}</div>
                        </div>

                        <div>
                          <div className="text-emerald-400 font-bold mb-1">VERIFICATION CREDENTIALS</div>
                          <div className="text-slate-300">Audited By: {d.reviewedByAdmin}</div>
                          <div className="text-slate-300">Admin Role: {d.reviewedByRole}</div>
                          <div className="text-slate-300">Approval Time: {d.approvalDate}</div>
                          <div className="text-slate-400">Proof Ref: {d.proofId}</div>
                          <div className="text-slate-400">Certificate Ref: {d.certificateId}</div>
                          <div className="text-slate-400 truncate">QR Token: {d.qrToken}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Report Generation History Table */}
      <div className="card-glass rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-mars-400" />
            <h3 className="font-orbitron font-bold text-sm text-white tracking-wide">
              Official Report Generation Ledger ({history.length})
            </h3>
          </div>
          <button
            onClick={fetchHistory}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No official reports have been compiled in the ledger yet. Select a month and click "Generate Official Report".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-space-850/80 text-slate-400 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3.5 pl-5">Reporting Period</th>
                  <th className="p-3.5">Report Reference ID</th>
                  <th className="p-3.5">Donations / Units</th>
                  <th className="p-3.5">Compiled By</th>
                  <th className="p-3.5">Generation Timestamp</th>
                  <th className="p-3.5 pr-5 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {history.map((h) => {
                  const rowIsMasked = h.maskSensitive !== false;
                  const rowPrivacyLabel = h.privacyMode || (rowIsMasked ? 'MASKED' : 'UNMASKED');
                  return (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 pl-5 font-bold text-white">
                      {h.periodLabel || `${h.monthName} ${h.year}`}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono border ${rowIsMasked ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                        {rowPrivacyLabel}
                      </span>
                    </td>
                    <td className="p-3.5 text-mars-400 font-mono">
                      {h.id}
                    </td>
                    <td className="p-3.5">
                      <span className="text-white font-bold">{h.totalDonations}</span> donations ({h.totalUnits} units)
                    </td>
                    <td className="p-3.5">
                      {h.generatedByAdminName} ({h.generatedByAdminRole})
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {h.generatedAt ? h.generatedAt.replace('T', ' ').split('.')[0] : 'N/A'}
                    </td>
                    <td className="p-3.5 pr-5 text-right space-x-2">
                      <button
                        onClick={() => handleDownloadPdf(h.month, h.year, h.id, rowIsMasked)}
                        className="p-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-mars-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                        <span>PDF</span>
                      </button>

                      <button
                        onClick={() => handleDownloadExcel(h.month, h.year, h.id, rowIsMasked)}
                        className="p-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-emerald-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                        title="Download Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />
                        <span>XLSX</span>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof Photo Inspection Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="card-glass p-6 rounded-2xl border border-white/20 max-w-lg w-full relative shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h4 className="font-orbitron font-bold text-sm text-white">Donation Proof Photo</h4>
                <p className="text-xs text-slate-400 font-mono">Ref: {previewPhoto.referenceId} • {previewPhoto.donorName}</p>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-space-950 p-2 rounded-xl flex items-center justify-center border border-white/10 mb-4 min-h-48 max-h-96 overflow-hidden">
              {loadingPhoto && (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  Loading authenticated proof photograph...
                </div>
              )}
              {!loadingPhoto && photoError && (
                <div className="p-8 text-center text-xs text-rose-300 font-mono">
                  {photoError}
                </div>
              )}
              {!loadingPhoto && !photoError && previewPhotoUrl && (
                <img
                  src={previewPhotoUrl}
                  alt="Donation Proof"
                  className="max-h-80 w-auto object-contain rounded-lg shadow-md"
                />
              )}
            </div>

            <div className="text-xs font-mono text-slate-300 space-y-1">
              <div>Hospital: <span className="text-white">{previewPhoto.hospitalName}</span></div>
              <div>Audited By: <span className="text-emerald-400">{previewPhoto.reviewedByAdmin}</span></div>
              <div>Certificate ID: <span className="text-cyan-400">{previewPhoto.certificateId}</span></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
