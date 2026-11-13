import React, { useState, useEffect } from 'react';
import { X, Upload, FileCheck, AlertCircle, CheckCircle2, Building2, Droplet, Calendar } from 'lucide-react';
import { proofApi } from '../../../services/api';

export default function ProofUploadModal({
  isOpen,
  onClose,
  pledge,
  onUploadSuccess
}) {
  const [imageBase64, setImageBase64] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setImageBase64('');
      setPreviewUrl('');
      setError('');
      setSuccess('');
    }
  }, [isOpen, pledge]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !pledge) return null;

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Proof photo exceeds 5 MB limit. Please select a smaller photo or document scan.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Invalid file type. Please upload an image (JPG, PNG, WebP).');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target.result);
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageBase64) {
      setError('Please select or capture a proof document image before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await proofApi.upload(pledge.id, imageBase64);
      if (res.success) {
        setSuccess('Donation proof uploaded successfully! Your submission is now Under Admin Review.');
        setTimeout(() => {
          if (onUploadSuccess) onUploadSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to upload donation proof.');
      }
    } catch (err) {
      setError('Network error while uploading proof. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg card-glass rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-7 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-base text-white">
                Upload Donation Proof
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Pledge Ref: {pledge.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pledge Context Box */}
        <div className="p-3.5 rounded-xl bg-space-850 border border-white/5 text-xs font-mono space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Hospital:</span>
            <span className="text-white font-semibold truncate max-w-[200px]">{pledge.hospitalName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Patient:</span>
            <span className="text-slate-200">{pledge.patientName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Blood Group:</span>
            <span className="text-mars-400 font-bold">{pledge.bloodGroup}</span>
          </div>
        </div>

        {/* File Upload / Preview Box */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-mono text-slate-300">
              Official Blood Bank Receipt / Donor Card Scan:
            </label>

            {previewUrl ? (
              <div className="relative rounded-2xl border border-emerald-500/30 bg-space-900/60 p-2 text-center">
                <img 
                  src={previewUrl} 
                  alt="Proof preview" 
                  className="max-h-56 mx-auto rounded-xl object-contain border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageBase64('');
                    setPreviewUrl('');
                  }}
                  className="mt-2 text-xs text-rose-400 hover:underline font-mono"
                >
                  Choose another image
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-mars-500/50 rounded-2xl p-6 bg-space-900/40 cursor-pointer transition-colors group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-mars-400 transition-colors mb-2" />
                <span className="text-xs text-slate-300 font-medium">Click to select image</span>
                <span className="text-[10px] text-slate-500 font-mono mt-1">PNG, JPG, WebP up to 5 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !imageBase64}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white shadow-md shadow-mars-600/30 hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Submit for Medical Verification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
