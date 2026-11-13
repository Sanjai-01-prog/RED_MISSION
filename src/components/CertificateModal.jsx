import React, { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  QrCode,
  HeartHandshake,
  Loader2,
  UserCheck,
  Award,
  MapPin,
  Calendar,
  FileCheck2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { certificateApi } from '../services/api';
import { downloadCertificatePdf, formatCertificateDate } from '../utils/certificatePdfGenerator';

export default function CertificateModal({ isOpen, onClose, certificateData, tokenType }) {
  const [donorPhotoObjectUrl, setDonorPhotoObjectUrl] = useState(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [photoRenderError, setPhotoRenderError] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    let activeUrl = null;
    const controller = new AbortController();

    async function loadAuthorizedDonorPhoto() {
      const hasPhotoRef = Boolean(certificateData?.donorPhotoAvailable || certificateData?.donorPhotoUrl);
      if (!isOpen || !hasPhotoRef || !certificateData?.pledgeId) {
        setDonorPhotoObjectUrl(null);
        setPhotoRenderError(false);
        setIsLoadingPhoto(false);
        return;
      }

      setIsLoadingPhoto(true);
      setPhotoRenderError(false);
      try {
        const blob = await certificateApi.fetchDonorPhotoBlob(certificateData.pledgeId, {
          donorPhotoUrl: certificateData.donorPhotoUrl,
          tokenType,
          signal: controller.signal
        });
        if (!controller.signal.aborted && blob && blob.size > 0) {
          activeUrl = URL.createObjectURL(blob);
          setDonorPhotoObjectUrl(activeUrl);
        } else if (!controller.signal.aborted) {
          setDonorPhotoObjectUrl(null);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setDonorPhotoObjectUrl(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPhoto(false);
        }
      }
    }

    loadAuthorizedDonorPhoto();

    return () => {
      controller.abort();
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [
    isOpen,
    certificateData?.pledgeId,
    certificateData?.donorPhotoAvailable,
    certificateData?.donorPhotoUrl,
    tokenType
  ]);

  if (!isOpen || !certificateData) {
    return null;
  }

  const qrToken = certificateData.qrVerificationToken || certificateData.id || '';
  const verificationUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/#verify-certificate-${qrToken}`
      : `https://redmission.org/#verify-certificate-${qrToken}`;

  const donationLocation = [certificateData.hospitalName, certificateData.hospitalCity]
    .filter(Boolean)
    .join(', ');
  const recipientRef =
    certificateData.recipientReference || certificateData.patientName || null;
  const unitsDonated = Number(certificateData.unitsDonated || 1);
  const issuingAuthority =
    certificateData.issuingAuthority || 'RED MISSION Clinical Verification Council';
  const issuingDesignation =
    certificateData.issuingDesignation || 'Authorized Issuing Authority';
  const approvalBadge =
    certificateData.approvalStatus === 'LEGACY_VERIFIED'
      ? 'LEGACY VERIFIED RECORD'
      : 'VERIFIED & APPROVED';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfError('');
    try {
      await downloadCertificatePdf(certificateData, { tokenType });
    } catch (err) {
      setPdfError(err?.message || 'Failed to generate certificate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="RED MISSION Certificate of Appreciation"
    >
      <div className="relative w-full max-w-6xl my-auto">
        {/* Top Modal Controls (hidden during A4 print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2.5 text-white">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold tracking-wide">
              Official A4 Landscape Donation Certificate
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-600/20 text-red-200 border border-red-500/30">
              {certificateData.id}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold shadow-lg transition-colors"
            >
              <Printer className="w-4 h-4 text-red-600" />
              Print Certificate (A4)
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-colors"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGeneratingPdf ? 'Preparing PDF...' : 'Download Certificate (PDF)'}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Certificate Preview"
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="no-print mb-3 px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-medium">
            {pdfError}
          </div>
        )}

        {/* A4 Landscape Certificate Canvas */}
        <div
          id="printable-certificate-canvas"
          className="relative bg-[#fffdf9] text-slate-900 rounded-2xl shadow-2xl border-[6px] border-[#9f1239] p-2 sm:p-3 overflow-hidden"
        >
          {/* Inner subtle gold double frame */}
          <div className="relative border-2 border-amber-500/70 rounded-xl bg-white p-4 sm:p-6">
            {/* Decorative gold corner brackets */}
            <span className="pointer-events-none absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-amber-600/80" />
            <span className="pointer-events-none absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-amber-600/80" />
            <span className="pointer-events-none absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-amber-600/80" />
            <span className="pointer-events-none absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-amber-600/80" />

            {/* HEADER */}
            <header className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b-2 border-amber-500/40 bg-gradient-to-r from-red-50/80 via-white to-amber-50/50 -mx-2 -mt-2 px-4 pt-3 rounded-t-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-red-700/20 shadow-sm flex items-center justify-center p-1.5 shrink-0">
                  <img
                    src="/red-mission-logo.svg"
                    alt="RED MISSION Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black tracking-[0.22em] text-red-700 uppercase">
                      {certificateData.organizationName || 'RED MISSION'}
                    </span>
                    <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-amber-600" />
                    <span className="hidden sm:inline-block text-[10px] font-bold tracking-widest text-amber-700 uppercase">
                      National Emergency Blood Network
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-wide text-slate-900 mt-0.5">
                    CERTIFICATE OF APPRECIATION
                  </h1>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-0.5">
                    Official Voluntary Blood Donation Recognition & Verified Record
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-auto">
                <div className="px-4 py-2 rounded-xl bg-[#9f1239] text-white border border-amber-400/70 shadow-sm text-center">
                  <div className="text-[9px] font-bold tracking-widest uppercase text-red-100">
                    Blood Group
                  </div>
                  <div className="text-lg font-black leading-tight mt-0.5">
                    {certificateData.bloodGroup}{' '}
                    <span className="text-xs font-semibold text-amber-200">
                      ({unitsDonated} {unitsDonated === 1 ? 'Unit' : 'Units'})
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* MAIN 3-COLUMN LANDSCAPE CONTENT */}
            <div className="cert-main-grid grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {/* LEFT SECTION (~33% width): Prominent Donor Photograph */}
              <div className="md:col-span-4 flex flex-col justify-between bg-[#fdfbf7] border border-amber-500/50 rounded-xl p-3">
                <div className="cert-photo-frame flex-1 min-h-[250px] sm:min-h-[290px] max-h-[340px] bg-slate-100/80 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-2">
                  {isLoadingPhoto ? (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Loader2 className="w-7 h-7 animate-spin text-red-600" />
                      <span className="text-xs font-medium">Loading donor portrait...</span>
                    </div>
                  ) : donorPhotoObjectUrl && !photoRenderError ? (
                    <img
                      src={donorPhotoObjectUrl}
                      alt={`Authenticated photograph of donor ${certificateData.donorName}`}
                      onLoad={() => setPhotoRenderError(false)}
                      onError={() => setPhotoRenderError(true)}
                      className="max-w-full max-h-[320px] w-auto h-auto object-contain rounded shadow-sm"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-slate-500">
                      <div className="w-16 h-16 rounded-full bg-slate-200/80 border border-slate-300 flex items-center justify-center mb-3">
                        <UserCheck className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Donor Photograph Unavailable
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Verified identity record maintained by RED MISSION
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 mt-2 border-t border-amber-500/30 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  <span>Authenticated Donor Portrait</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>

              {/* CENTER SECTION: Donor & Verified Donation Details */}
              <div className="md:col-span-5 flex flex-col justify-between px-1">
                <div>
                  <p className="text-[11px] font-extrabold tracking-[0.18em] text-red-700 uppercase">
                    This Certificate Is Proudly Presented To
                  </p>
                  <h2 className="text-2xl sm:text-[28px] font-serif font-bold text-slate-900 mt-1 pb-2 border-b-2 border-amber-400/60 break-words leading-tight">
                    {certificateData.donorName}
                  </h2>
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed mt-2.5">
                    In grateful recognition of a verified voluntary blood donation through{' '}
                    <span className="font-bold text-slate-800">RED MISSION</span>, directly
                    supporting emergency patient care and saving a precious life.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                  <div className="bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <FileCheck2 className="w-3 h-3 text-red-600" />
                      Certificate ID
                    </div>
                    <div className="text-xs font-mono font-bold text-red-700 mt-0.5 break-all">
                      {certificateData.id}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <HeartHandshake className="w-3 h-3 text-red-600" />
                      Blood Group & Units
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {certificateData.bloodGroup} • {unitsDonated}{' '}
                      {unitsDonated === 1 ? 'Unit' : 'Units'}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      Verified Donation Date
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {formatCertificateDate(
                        certificateData.verifiedDonationDate || certificateData.donationDate
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      Certificate Issue Date
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {formatCertificateDate(certificateData.issuedAt)}
                    </div>
                  </div>

                  {donationLocation && (
                    <div className="sm:col-span-2 bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-600" />
                        Donation Location
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-0.5">
                        {donationLocation}
                      </div>
                    </div>
                  )}

                  {recipientRef && (
                    <div className="sm:col-span-2 bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Recipient / Clinical Case Reference
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-0.5">
                        {recipientRef}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SECTION: Verification QR & Details */}
              <div className="md:col-span-3 flex flex-col justify-between items-center text-center bg-gradient-to-b from-red-50/40 to-amber-50/30 border border-amber-500/50 rounded-xl p-3.5">
                <div className="w-full">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-700 pb-2 border-b border-amber-500/30 w-full justify-center">
                    <QrCode className="w-3.5 h-3.5" />
                    Secure Verification
                  </div>

                  <div className="mt-3 mx-auto w-fit p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <QRCodeSVG
                      value={verificationUrl}
                      size={132}
                      level="M"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#0F172A"
                    />
                  </div>

                  <p className="text-[11px] font-semibold text-slate-700 mt-2.5 leading-snug">
                    Scan this QR code to verify certificate authenticity online.
                  </p>
                </div>

                <div className="w-full space-y-2 mt-3">
                  <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-left">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Verification URL
                    </div>
                    <div className="text-[10px] font-mono text-blue-900 break-all leading-tight mt-0.5">
                      {verificationUrl}
                    </div>
                  </div>

                  <div className="bg-red-50/90 border border-red-200 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-red-700">
                      Certificate ID
                    </div>
                    <div className="text-[11px] font-mono font-extrabold text-slate-900 break-all">
                      {certificateData.id}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <footer className="mt-5 pt-3.5 border-t-2 border-amber-500/40 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Authorized Issuing Authority
                </div>
                <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                  {issuingAuthority}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {issuingDesignation}
                </div>
              </div>

              <div className="px-4 py-1.5 rounded-lg bg-[#fdfbf7] border border-amber-500/50 text-center">
                <div className="text-[10px] font-extrabold tracking-widest text-red-700 uppercase">
                  RED MISSION Official Seal
                </div>
                <div className="text-[11px] font-semibold text-slate-700">
                  Issued: {formatCertificateDate(certificateData.issuedAt)}
                </div>
              </div>

              <div className="text-right ml-auto sm:ml-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Verification Status
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                  {approvalBadge}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  RED MISSION Blood Donor Network
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
