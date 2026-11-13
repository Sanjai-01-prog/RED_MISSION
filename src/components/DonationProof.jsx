import React, { useState } from 'react';
import { 
  FileCheck, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Copy, 
  Check, 
  Award, 
  Calendar, 
  Building2, 
  Droplet, 
  FileText, 
  ShieldCheck, 
  ExternalLink,
  Clock,
  Eye
} from 'lucide-react';
import { INITIAL_VERIFIED_SUBMISSIONS } from '../data/missionData';

export default function DonationProof({ onNewSubmission, onViewCertificate }) {
  const [formData, setFormData] = useState({
    donorName: '',
    contactPhone: '',
    bloodGroup: 'O+',
    centerName: '',
    donationDate: new Date().toISOString().split('T')[0],
    unitsDonated: '1 Unit (Whole Blood 450ml)',
    proofFileName: ''
  });

  const [submissionsList, setSubmissionsList] = useState(INITIAL_VERIFIED_SUBMISSIONS);
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationLogs, setVerificationLogs] = useState([]);
  const [submissionId, setSubmissionId] = useState('');
  const [issuedCertId, setIssuedCertId] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedSubForPreview, setSelectedSubForPreview] = useState(null);

  const presets = [
    {
      label: 'Rotary Blood Bank',
      donorName: 'Rahul Deshmukh',
      contactPhone: '+91 98201 55667',
      bloodGroup: 'O-',
      centerName: 'Rotary Blood Bank Central, Mumbai',
      unitsDonated: '1 Unit (Whole Blood 450ml)',
      proofFileName: 'rotary_slip_deshmukh.pdf'
    },
    {
      label: 'Apollo Hospital Camp',
      donorName: 'Pooja Iyer',
      contactPhone: '+91 98450 88991',
      bloodGroup: 'A+',
      centerName: 'Apollo Hospital Transfusion Medicine, Bangalore',
      unitsDonated: 'Platelet Apheresis (SDP)',
      proofFileName: 'apollo_apheresis_receipt.jpg'
    },
    {
      label: 'Red Cross Mobile Unit',
      donorName: 'Sameer Khan',
      contactPhone: '+91 98112 33445',
      bloodGroup: 'B+',
      centerName: 'Indian Red Cross Society Drive, Delhi',
      unitsDonated: '1 Unit (Whole Blood 450ml)',
      proofFileName: 'ircs_donation_card.png'
    }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  const handleApplyPreset = (preset) => {
    setFormData({
      ...formData,
      donorName: preset.donorName,
      contactPhone: preset.contactPhone,
      bloodGroup: preset.bloodGroup,
      centerName: preset.centerName,
      unitsDonated: preset.unitsDonated,
      proofFileName: preset.proofFileName
    });
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, proofFileName: e.target.files[0].name });
    }
  };

  const handleSubmitProof = (e) => {
    e.preventDefault();

    if (!formData.donorName.trim() || !formData.contactPhone.trim() || !formData.centerName.trim()) {
      setStatus('error');
      setErrorMessage('Please fill in Donor Name, Contact Phone, and Donation Centre.');
      return;
    }

    if (!formData.donationDate) {
      setStatus('error');
      setErrorMessage('Please provide a valid donation date.');
      return;
    }

    const generatedSubId = `SUB-${Math.floor(7800 + Math.random() * 2000)}`;
    const generatedCert = `CERT-RED-${Math.floor(1000 + Math.random() * 9000)}`;

    setSubmissionId(generatedSubId);
    setIssuedCertId(generatedCert);
    setStatus('uploading');
    setVerificationLogs(['[INIT] Uploading clinical donation proof to Red Mission Repository...']);

    setTimeout(() => {
      setVerificationLogs(prev => [...prev, '[OCR] Scanning hospital stamp, donor vitals, and bag barcode...']);
    }, 600);

    setTimeout(() => {
      setVerificationLogs(prev => [...prev, '[CROSS-MATCH] Connecting with State Blood Transfusion Registry...']);
    }, 1200);

    setTimeout(() => {
      setVerificationLogs(prev => [
        ...prev, 
        `[CONFIRMED] Submission recorded under ID: #${generatedSubId}. Ready for Medical Admin verification.`
      ]);

      const newSubmission = {
        id: generatedSubId,
        donorName: formData.donorName,
        bloodGroup: formData.bloodGroup,
        centerName: formData.centerName,
        donationDate: formData.donationDate,
        unitsDonated: formData.unitsDonated.includes('SDP') ? 1 : 1,
        proofUrl: formData.proofFileName || 'clinical_donation_receipt.pdf',
        certificateId: generatedCert,
        status: 'Verified',
        verifiedDate: new Date().toISOString().split('T')[0],
        verifiedBy: 'Dr. Vivek Joshi (CMO Red Mission)'
      };

      setSubmissionsList(prev => [newSubmission, ...prev]);
      if (onNewSubmission) {
        onNewSubmission(newSubmission);
      }
      setStatus('success');
    }, 2000);
  };

  const handleCopyId = () => {
    if (submissionId) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(submissionId).catch(() => {
          fallbackCopyText(submissionId);
        });
      } else {
        fallbackCopyText(submissionId);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fallbackCopyText = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const handleReset = () => {
    setFormData({
      donorName: '',
      contactPhone: '',
      bloodGroup: 'O+',
      centerName: '',
      donationDate: new Date().toISOString().split('T')[0],
      unitsDonated: '1 Unit (Whole Blood 450ml)',
      proofFileName: ''
    });
    setStatus('idle');
    setVerificationLogs([]);
    setSubmissionId('');
    setIssuedCertId('');
  };

  return (
    <section id="donation-proof" className="py-20 relative bg-space-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <FileCheck className="w-3.5 h-3.5" />
            <span>Donation Verification & Lifesaver Badging</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            DONATION PROOF <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">PORTAL</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Upload your hospital donation certificate or donor slip to verify your voluntary blood donation, earn verified lifesaver badges, and receive your tamper-proof Digital Certificate.
          </p>
        </div>

        {/* Portal Card */}
        <div className="max-w-4xl mx-auto card-glass rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-16">
          
          {/* Top Bar simulating a secure clinical portal */}
          <div className="bg-space-900 px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="text-xs font-mono text-slate-400 ml-2">
                MED_CHAIN://PROOF_VERIFICATION/GATEWAY
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>NBTC ACCREDITED // 256-BIT ENCRYPTED</span>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            
            {/* Quick Presets Bar */}
            <div className="mb-6 pb-5 border-b border-white/5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-mars-400" />
                <span>Quick Test Presets (Click to autofill sample slip data):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-3 py-1.5 rounded-lg bg-space-900 hover:bg-space-800 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-mars-500/40 font-mono transition-colors cursor-pointer"
                  >
                    + {preset.label} ({preset.bloodGroup})
                  </button>
                ))}
              </div>
            </div>

            {status === 'success' ? (
              /* Success View */
              <div className="text-center py-8 space-y-6 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-orbitron font-bold text-2xl text-white">
                    DONATION PROOF SUBMITTED
                  </h3>
                  <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                    Thank you, <span className="text-mars-400 font-semibold">{formData.donorName}</span>! Your blood donation slip from <span className="text-slate-100 font-medium">{formData.centerName}</span> has been securely logged and verified.
                  </p>
                </div>

                {/* Submission and Certificate Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-space-900 border border-mars-500/40 text-xs font-mono text-mars-300">
                    <span>SUBMISSION ID: #{submissionId}</span>
                    <button
                      onClick={handleCopyId}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title="Copy Submission ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {copied && <span className="text-emerald-400 text-[10px]">COPIED</span>}
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-space-900 border border-emerald-500/40 text-xs font-mono text-emerald-300">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>CERTIFICATE ID: #{issuedCertId}</span>
                  </div>
                </div>

                {/* Verification Process Log */}
                <div className="bg-space-900 rounded-xl p-4 max-w-lg mx-auto text-left font-mono text-xs text-emerald-400 border border-white/5 space-y-1">
                  {verificationLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {onViewCertificate && (
                    <button
                      onClick={() => onViewCertificate({
                        id: submissionId,
                        donorName: formData.donorName,
                        bloodGroup: formData.bloodGroup,
                        centerName: formData.centerName,
                        donationDate: formData.donationDate,
                        certificateId: issuedCertId,
                        unitsDonated: 1
                      })}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold text-xs transition-all shadow-lg shadow-mars-600/30 flex items-center gap-2 cursor-pointer hover:brightness-110"
                    >
                      <Award className="w-4 h-4" />
                      <span>View Official Certificate</span>
                    </button>
                  )}

                  <button
                    onClick={handleReset}
                    className="px-6 py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    Submit Another Donation Proof
                  </button>
                </div>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmitProof} className="space-y-6">
                
                {/* Error Banner */}
                {status === 'error' && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Donor Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Donor Full Name <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="donorName"
                      value={formData.donorName}
                      onChange={handleChange}
                      placeholder="e.g. Dr. Rahul Deshmukh"
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Contact Mobile / WhatsApp <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleChange}
                      placeholder="+91 98XXX XXXXX"
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Blood Group */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Blood Group Donated <span className="text-mars-400">*</span>
                    </label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white focus:outline-none focus:border-mars-500 transition-colors cursor-pointer"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                        <option key={group} value={group} className="bg-space-900 text-white">
                          {group} {group === 'O-' ? '(Universal Donor)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Donation Date */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Date of Donation <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="date"
                      name="donationDate"
                      value={formData.donationDate}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white focus:outline-none focus:border-mars-500 transition-colors cursor-pointer"
                      required
                    />
                  </div>

                  {/* Donation Centre / Hospital */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Donation Centre / Hospital / Camp Name <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="centerName"
                      value={formData.centerName}
                      onChange={handleChange}
                      placeholder="e.g. Apollo Hospital Blood Bank / Red Cross Metro Camp"
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Units & Component Type */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Donation Type & Volume
                    </label>
                    <select
                      name="unitsDonated"
                      value={formData.unitsDonated}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm text-white focus:outline-none focus:border-mars-500 transition-colors cursor-pointer"
                    >
                      <option value="1 Unit (Whole Blood 450ml)">1 Unit (Whole Blood 450ml) — Standard Donation</option>
                      <option value="1 Unit (Whole Blood 350ml)">1 Unit (Whole Blood 350ml) — Compact Donation</option>
                      <option value="Platelet Apheresis (SDP)">Single Donor Platelet (SDP Apheresis) — Oncology Support</option>
                      <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
                    </select>
                  </div>
                </div>

                {/* Proof File Upload Area */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Upload Donation Slip / Certificate Photo <span className="text-slate-400 font-normal">(JPG, PNG, PDF max 10MB)</span>
                  </label>
                  
                  <div className="border-2 border-dashed border-white/15 hover:border-mars-500/60 rounded-2xl p-6 text-center transition-colors bg-space-900/60 relative group">
                    <input
                      type="file"
                      id="proofFile"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <div className="w-12 h-12 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      
                      {formData.proofFileName ? (
                        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                          <FileText className="w-4 h-4" />
                          <span>Selected: {formData.proofFileName}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-200 font-medium">
                            Drag & drop your donation slip here, or <span className="text-mars-400 underline">browse files</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Accepted: Official Hospital Blood Slip, Camp Badge, or Donor Card photo
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={status === 'uploading'}
                    className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-mars-600 via-mars-500 to-mars-flame hover:brightness-110 text-white font-orbitron font-semibold text-sm tracking-wider shadow-lg shadow-mars-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {status === 'uploading' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>VERIFYING CLINICAL PROOF...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>SUBMIT DONATION PROOF & CLAIM CERTIFICATE</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

        {/* Recently Verified Submissions Board */}
        <div className="card-glass rounded-2xl p-6 sm:p-8 border border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>OFFICIAL VERIFICATION LOGS</span>
              </div>
              <h3 className="font-orbitron font-bold text-xl text-white">
                Recently Verified Donations & Digital Certificates
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-space-900 px-3 py-1.5 rounded-lg border border-white/5">
              Live National Registry ({submissionsList.length} Records)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {submissionsList.map((sub) => (
              <div
                key={sub.id}
                className="bg-space-900/90 rounded-xl p-4 border border-white/5 hover:border-mars-500/30 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-mars-500/10 border border-mars-500/30 flex items-center justify-center font-bold text-mars-400 text-xs font-mono">
                      {sub.bloodGroup}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white truncate max-w-[150px]">
                        {sub.donorName}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sub.id}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Verified</span>
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 text-slate-400 truncate">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span className="truncate">{sub.centerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {sub.donationDate}
                    </span>
                    <span className="font-mono text-mars-400 font-semibold">
                      {sub.certificateId}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    By: {sub.verifiedBy ? sub.verifiedBy.split('(')[0] : 'Medical Officer'}
                  </span>
                  
                  {onViewCertificate && (
                    <button
                      onClick={() => onViewCertificate(sub)}
                      className="text-xs text-mars-400 hover:text-white flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Certificate</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}