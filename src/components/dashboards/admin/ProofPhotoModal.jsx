import React, { useState, useEffect } from 'react';
import { X, ZoomIn, Download, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { getAdminToken } from '../../../services/api';

export default function ProofPhotoModal({
  isOpen,
  onClose,
  proof
}) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    async function loadPhoto() {
      if (!isOpen || !proof?.id) return;
      setLoading(true);
      setLoadError(null);

      try {
        const token = getAdminToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        // Omit browser cookies so simultaneous donor user session cookies do not shadow the Admin Bearer token
        const res = await fetch(`/api/proofs/${proof.id}/photo`, { 
          headers,
          credentials: 'omit'
        });

        if (!res.ok) {
          throw new Error(`Failed to load proof image (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error('Error fetching proof image:', err);
          setLoadError(err.message || 'Could not load donation proof photograph.');
          setLoading(false);
        }
      }
    }

    loadPhoto();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, proof?.id]);

  if (!isOpen || !proof) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-space-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-space-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-space-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-mars-500/10 text-mars-400 border border-mars-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-orbitron">
                Donation Proof Record
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Donor: <span className="text-white font-semibold">{proof.donorName || 'Anonymous Donor'}</span> • Request: {proof.patientName || 'Emergency Patient'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-space-950/60 border border-white/5 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Hospital</span>
              <span className="text-white font-medium truncate block">{proof.hospitalName || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Blood Group</span>
              <span className="text-mars-400 font-bold block">{proof.requestedBloodGroup || proof.donorBloodGroup || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Units Donated</span>
              <span className="text-emerald-400 font-bold block">{proof.unitsPledged || 1} Unit(s)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Status</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${
                proof.status === 'APPROVED' || proof.proofStatus === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : proof.status === 'REJECTED' || proof.proofStatus === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {proof.status || proof.proofStatus || 'PENDING'}
              </span>
            </div>
          </div>

          {/* Photo Preview Container */}
          <div className="relative rounded-xl border border-white/10 bg-space-950 flex items-center justify-center min-h-[320px] max-h-[500px] overflow-hidden">
            {loading && (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <div className="w-8 h-8 rounded-full border-2 border-mars-500 border-t-transparent animate-spin" />
                <span className="text-xs font-mono">Decryption &amp; loading proof photo...</span>
              </div>
            )}

            {loadError && (
              <div className="p-6 text-center max-w-sm">
                <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <p className="text-xs text-rose-300 font-mono">{loadError}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Ensure you are authorized with VERIFY_PROOFS permission.
                </p>
              </div>
            )}

            {!loading && !loadError && imageUrl && (
              <img 
                src={imageUrl} 
                alt="Donation Proof Document" 
                className="max-h-[480px] w-auto max-w-full object-contain rounded-lg"
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between bg-space-850">
          <span className="text-[11px] font-mono text-slate-400">
            Proof ID: <span className="text-slate-300">{proof.id}</span>
          </span>

          <div className="flex items-center gap-2">
            {!loading && imageUrl && (
              <a
                href={imageUrl}
                download={`proof_${proof.id}.jpg`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-space-800 hover:bg-space-750 border border-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-mono bg-mars-600 hover:bg-mars-500 text-white font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
