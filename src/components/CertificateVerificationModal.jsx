import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Ban,
  AlertTriangle,
  Loader2,
  Droplets,
  Calendar,
  Building2,
  Award,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { certificateApi } from '../services/api';
import { formatCertificateDate } from '../utils/certificatePdfGenerator';

export default function CertificateVerificationModal({ isOpen, onClose, verifyToken }) {
  const [status, setStatus] = useState('IDLE'); // IDLE | LOADING | VERIFIED | INVALID | REVOKED | MALFORMED | NETWORK
  const [certData, setCertData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const cleaned = verifyToken ? String(verifyToken).trim() : '';

    if (!cleaned || cleaned === ':token' || cleaned.length < 4) {
      setStatus('MALFORMED');
      setCertData(null);
      setErrorMessage('Invalid or malformed certificate verification link.');
      return;
    }

    async function verify() {
      setStatus('LOADING');
      setCertData(null);
      setErrorMessage('');

      try {
        const res = await certificateApi.verifyCertificate(cleaned);
        if (cancelled) return;

        if (res.ok && res.verified && res.certificate) {
          setStatus('VERIFIED');
          setCertData(res.certificate);
          return;
        }

        if (
          res.verificationStatus === 'REVOKED' ||
          res.code === 'CERTIFICATE_REVOKED' ||
          res.status === 403
        ) {
          setStatus('REVOKED');
          setCertData(res.certificate || null);
          setErrorMessage(
            res.error || 'This donation certificate has been revoked or its proof is no longer approved.'
          );
          return;
        }

        if (res.code === 'MALFORMED_TOKEN' || res.status === 400) {
          setStatus('MALFORMED');
          setErrorMessage(res.error || 'Malformed certificate verification token.');
          return;
        }

        if (
          res.verificationStatus === 'INVALID' ||
          res.code === 'INVALID_CERTIFICATE_TOKEN' ||
          res.status === 404
        ) {
          setStatus('INVALID');
          setErrorMessage(
            res.error || 'No valid donation certificate matches this verification token.'
          );
          return;
        }

        setStatus('NETWORK');
        setErrorMessage(res.error || 'Unable to reach verification server. Please try again.');
      } catch (err) {
        if (cancelled) return;
        setStatus('NETWORK');
        setErrorMessage(err?.message || 'Network error while verifying certificate.');
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [isOpen, verifyToken]);

  if (!isOpen) {
    return null;
  }

  const approvalLabel =
    certData?.approvalStatus === 'LEGACY_VERIFIED'
      ? 'LEGACY VERIFIED'
      : certData?.approvalStatus || 'APPROVED';
  const organizationName = certData?.organizationName || 'RED MISSION';
  const locationText = [certData?.hospitalName, certData?.hospitalCity].filter(Boolean).join(', ');

  return (
    <div
      className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/85 backdrop-blur-sm p-4 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="RED MISSION Certificate Verification"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/80 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/red-mission-logo.svg"
              alt="RED MISSION"
              className="w-8 h-8 rounded-full bg-white p-0.5 object-contain"
            />
            <div>
              <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">
                RED MISSION Certificate Verification
              </h2>
              <p className="text-[11px] text-slate-400">
                Public Clinical Record Authenticity Registry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification modal"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {status === 'LOADING' && (
            <div className="py-12 flex flex-col items-center text-center gap-3">
              <Loader2 className="w-9 h-9 animate-spin text-red-500" />
              <p className="text-sm font-semibold text-white">
                Verifying certificate authenticity...
              </p>
              <p className="text-xs text-slate-400">
                Checking official RED MISSION registry records
              </p>
            </div>
          )}

          {status === 'VERIFIED' && certData && (
            <div className="space-y-4">
              {/* Verification Status Banner */}
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase bg-emerald-500 text-slate-950">
                        VERIFIED
                      </span>
                      <span className="text-xs font-bold text-emerald-300">
                        Authentic RED MISSION Certificate
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-200/80 mt-0.5">
                      Verified directly from server clinical records
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-300 uppercase shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {approvalLabel}
                </span>
              </div>

              {/* Optional Publicly Consented Portrait Only */}
              {certData.donorPhotoAvailable && certData.donorPhotoUrl && (
                <div className="flex justify-center">
                  <div className="p-2 rounded-xl bg-slate-950 border border-white/10">
                    <img
                      src={certData.donorPhotoUrl}
                      alt={`Verified donor ${certData.donorName}`}
                      className="max-h-36 w-auto object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Verified Details Grid (No Private Phone/Email/Address) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Donor Name
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {certData.donorName}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3 text-red-400" />
                    Certificate ID
                  </div>
                  <div className="font-mono font-bold text-red-300 mt-0.5 break-all">
                    {certData.certificateId}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-red-400" />
                    Blood Group
                  </div>
                  <div className="font-extrabold text-white mt-0.5">
                    {certData.bloodGroup} ({certData.unitsDonated || 1}{' '}
                    {(certData.unitsDonated || 1) === 1 ? 'Unit' : 'Units'})
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    Verified Donation Date
                  </div>
                  <div className="font-bold text-white mt-0.5">
                    {formatCertificateDate(certData.verifiedDonationDate || certData.donationDate)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Award className="w-3 h-3 text-emerald-400" />
                    Certificate Issue Date
                  </div>
                  <div className="font-bold text-white mt-0.5">
                    {formatCertificateDate(certData.issuedAt)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-red-400" />
                    Organization Name
                  </div>
                  <div className="font-bold text-white mt-0.5">{organizationName}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Donation Approval Status
                  </div>
                  <div className="font-bold text-emerald-400 mt-0.5">{approvalLabel}</div>
                </div>

                {locationText && (
                  <div className="sm:col-span-2 p-3 rounded-xl bg-slate-950/70 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Clinical Donation Facility
                    </div>
                    <div className="font-semibold text-slate-200 mt-0.5">{locationText}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'REVOKED' && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Ban className="w-7 h-7 text-amber-400" />
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                REVOKED
              </span>
              <h3 className="text-base font-bold text-white">Certificate Revoked or Unapproved</h3>
              <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{errorMessage}</p>
              {certData?.certificateId && (
                <p className="text-[11px] font-mono text-slate-400">
                  Certificate ID: {certData.certificateId}
                </p>
              )}
            </div>
          )}

          {(status === 'INVALID' || status === 'MALFORMED') && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-red-400" />
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                INVALID
              </span>
              <h3 className="text-base font-bold text-white">Certificate Verification Failed</h3>
              <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {status === 'NETWORK' && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white">Verification Unavailable</h3>
              <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-950/70 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
